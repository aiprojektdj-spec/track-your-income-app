// Backfill Whop-Sitzungen + Blob-Budget: Upstash Redis → Supabase
// =============================================================================
// Ergänzt scripts/backfill-sync-supabase.js um den Rest, der noch nur in Redis liegt:
//   whoprt:<sid>                     → whop_sessions (AES-256-GCM, Rest-TTL bleibt erhalten)
//   blob:bytes:* / blob:ledgerbytes:* → counters (Rest-Fenster bleibt erhalten)
// Nicht kopiert: Sperren (whoprt:lock:), Rate-Limits, clerr:*, blob:commit*/rl/iprl —
// kurzlebig, laufen von selbst ab. Redis bleibt unverändert. Was in Supabase schon
// liegt (Spiegel seit STORAGE_MIRROR=supabase), wird nicht überschrieben.
//
//   node scripts/backfill-sessions-budget-supabase.js            Trockenlauf: zählt nur
//   node scripts/backfill-sessions-budget-supabase.js --write    kopiert
//   node scripts/backfill-sessions-budget-supabase.js --check    fehlt etwas / weicht etwas ab? Exit 1
//
// Env: KV_REST_API_URL/KV_REST_API_TOKEN (oder UPSTASH_REDIS_REST_*), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY und WHOP_SESSION_KEY (derselbe wie in Vercel, sonst lassen
// sich die Sitzungen nicht verschlüsseln). Gibt nur Zähler aus, nie Schlüssel oder Inhalte.
// =============================================================================
'use strict';
const path = require('path');
const sess = require(path.join(__dirname, '..', 'api', '_whop-sessions.js'));
const db   = require(path.join(__dirname, '..', 'api', '_db.js'));

const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'dry';
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const SB  = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function redisCmd(cmd) {
    const r = await fetch(REDIS_URL, { method: 'POST', body: JSON.stringify(cmd),
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' } });
    const j = await r.json();
    if (j && j.error) throw new Error('Redis: ' + j.error);
    return j.result;
}

async function scan(pattern) {
    const out = []; let cursor = '0';
    do {
        const [next, keys] = await redisCmd(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '500']);
        out.push(...keys); cursor = String(next);
    } while (cursor !== '0');
    return out;
}

async function counterRow(key) {
    const r = await fetch(SB + '/rest/v1/counters?select=value&key=eq.' + encodeURIComponent(key),
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    if (!r.ok) throw new Error('counters HTTP ' + r.status);
    return (await r.json())[0] || null;
}

(async () => {
    if (!REDIS_URL || !REDIS_TOKEN || !db.isConfigured() || !sess._seal)
        throw new Error('KV_REST_API_*, SUPABASE_* und WHOP_SESSION_KEY müssen gesetzt sein');
    const n = { sitzungen: 0, sitzungenFehlen: 0, sitzungenKopiert: 0, zaehler: 0, zaehlerFehlen: 0, zaehlerKopiert: 0 };

    for (const k of await scan('whoprt:*')) {
        if (k.indexOf('whoprt:lock:') === 0) continue;
        const sid = k.slice('whoprt:'.length);
        const raw = await redisCmd(['GET', k]); if (!raw) continue;
        let entry; try { entry = JSON.parse(raw); } catch (e) { continue; }
        const pttl = Number(await redisCmd(['PTTL', k]));
        if (pttl <= 0) continue;                                   // abgelaufen oder ohne TTL
        n.sitzungen++;
        if (await db.rpc('sync_whop_session_get', { p_sid: sid })) continue;
        n.sitzungenFehlen++;
        if (MODE !== 'write') continue;
        await db.rpc('sync_whop_session_put', { p_sid: sid, p_data: sess._seal(sid, entry), p_ttl: Math.max(1, Math.ceil(pttl / 1000)) });
        n.sitzungenKopiert++;
    }

    for (const pattern of ['blob:bytes:*', 'blob:ledgerbytes:*']) {
        for (const k of await scan(pattern)) {
            const v = Number(await redisCmd(['GET', k])), ttl = Number(await redisCmd(['TTL', k]));
            if (!Number.isFinite(v) || ttl <= 0) continue;
            n.zaehler++;
            if (await counterRow(k)) continue;
            n.zaehlerFehlen++;
            if (MODE !== 'write') continue;
            await db.rpc('sync_counter_add', { p_key: k, p_delta: v, p_window: ttl });
            n.zaehlerKopiert++;
        }
    }

    console.log(MODE, n);
    if (MODE === 'check') {
        const fehlt = n.sitzungenFehlen + n.zaehlerFehlen;
        console.log(fehlt ? fehlt + ' fehlen in Supabase' : 'alles vorhanden');
        process.exit(fehlt ? 1 : 0);
    }
})().catch(e => { console.error(e.message); process.exit(1); });
