// Handler-Test für die StB-Grant-Autorisierung:  node test/test-api-sync.js
// Mockt Upstash-Redis (in-memory) + Whop (userinfo + v2/me/has_access + company/memberships) und fährt den echten
// api/sync.js-Handler. Prüft: Grant-gated pull, read-only push-Sperre, Pro-Ausnahme
// für Grantee-Reads, echter Revoke.
'use strict';
const assert = require('assert');
process.env.UPSTASH_REDIS_REST_URL   = 'http://redis.mock';
process.env.UPSTASH_REDIS_REST_TOKEN = 'x';
process.env.WHOP_API_KEY             = 'test_app_key';

// ── In-Memory-Redis ───────────────────────────────────────────────────────────
const store = new Map(), sets = new Map(), lists = new Map();
function redisExec(cmd) {
    const op = cmd[0];
    if (op === 'GET')      return store.has(cmd[1]) ? store.get(cmd[1]) : null;
    if (op === 'SET')      { store.set(cmd[1], cmd[2]); return 'OK'; }
    // DEL löscht in echtem Redis den KEY, unabhängig vom Typ (String, Liste, Set).
    if (op === 'DEL')      { store.delete(cmd[1]); lists.delete(cmd[1]); sets.delete(cmd[1]); return 1; }
    if (op === 'INCR')     { const v = parseInt(store.get(cmd[1]) || '0', 10) + 1; store.set(cmd[1], String(v)); return v; }
    if (op === 'EXPIRE')   return 1;
    if (op === 'EVAL')     return 'OK';
    // SADD muss 0 liefern, wenn das Element schon drin war — die Mengendeckel in api/sync.js
    // (claimScope, Grant-Deckel) unterscheiden genau daran "neu" von "bestand schon".
    if (op === 'SADD')     { const s = sets.get(cmd[1]) || new Set(); const had = s.has(cmd[2]); s.add(cmd[2]); sets.set(cmd[1], s); return had ? 0 : 1; }
    if (op === 'SREM')     { const s = sets.get(cmd[1]); if (s) s.delete(cmd[2]); return 1; }
    if (op === 'SMEMBERS') { const s = sets.get(cmd[1]); return s ? Array.from(s) : []; }
    if (op === 'SCARD')    { const s = sets.get(cmd[1]); return s ? s.size : 0; }
    if (op === 'EXISTS')   return (store.has(cmd[1]) || sets.has(cmd[1]) || lists.has(cmd[1])) ? 1 : 0;
    if (op === 'RPUSH')    { const l = lists.get(cmd[1]) || []; for (let i = 2; i < cmd.length; i++) l.push(cmd[i]); lists.set(cmd[1], l); return l.length; }
    if (op === 'LTRIM' || op === 'LRANGE') {
        const l = lists.get(cmd[1]) || []; let s = parseInt(cmd[2], 10), e = parseInt(cmd[3], 10);
        s = s < 0 ? Math.max(l.length + s, 0) : s; e = e < 0 ? l.length + e : e;
        const sliced = l.slice(s, e + 1);
        if (op === 'LTRIM') { lists.set(cmd[1], sliced); return 'OK'; }
        return sliced;
    }
    return null;
}

// ── Whop-Mock (Token → User) ──────────────────────────────────────────────────
const whopUsers = {
    tok_owner: { sub: 'owner1', preferred_username: 'ownerX', has_access: true },
    tok_stb:   { sub: 'stb1',   preferred_username: 'stbY',   has_access: false }   // StB OHNE eigenes Pro
};
global.fetch = async (url, opts) => {
    if (url === 'http://redis.mock') {
        return { json: async () => ({ result: redisExec(JSON.parse(opts.body)) }) };
    }
    const auth = (opts.headers.Authorization || '').replace('Bearer ', '');
    const u = whopUsers[auth] || null;
    if (url.includes('/oauth/userinfo')) return u ? { ok: true, json: async () => ({ sub: u.sub, preferred_username: u.preferred_username }) } : { ok: false, status: 401 };
    if (url.includes('/me/has_access/')) {
        // v2 has_access mit dem User-Token: valid = hat der Token-User Zugang?
        return u ? { ok: true, status: 200, json: async () => ({ valid: !!u.has_access }) } : { ok: false, status: 401 };
    }
    if (url.includes('/company/memberships')) {
        // Company-API-Key-Check: gibt ALLE gültigen Memberships zurück (user_id-Filter wirkt nicht);
        // der Handler matcht die user_id selbst. Nur Mock-User mit has_access sind gültig.
        const members = Object.values(whopUsers).filter(x => x.has_access)
            .map(x => ({ id: 'mem_' + x.sub, user_id: x.sub, valid: true, status: 'active' }));
        return { ok: true, json: async () => ({ data: members, pagination: { next_page: null } }) };
    }
    return { ok: false };
};

const handler = require('../api/sync.js');
function mkRes() { const r = { code: 0, body: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (b) => { r.body = b; return r; }, end: () => r }; }; return r; }
async function call(token, body) { const res = mkRes(); await handler({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body }, res); return res; }

(async () => {
    let pass = 0, r;

    r = await call('tok_stb', { action: 'register_pubkey', pub: { kty: 'EC', x: 'a', y: 'b' } });
    assert.strictEqual(r.code, 200, 'StB register_pubkey ohne Pro'); pass++; console.log('✓ register_pubkey (kein Pro nötig)');

    r = await call('tok_owner', { action: 'get_pubkey', granteeId: 'stb1' });
    assert.strictEqual(r.code, 200); assert.ok(r.body.pubkey.pub, 'pubkey zurück'); pass++; console.log('✓ get_pubkey (Owner holt StB-Key)');

    r = await call('tok_stb', { action: 'pull', scope: '__account', owner: 'owner1' });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'no_grant', 'ohne Grant kein Zugriff'); pass++; console.log('✓ pull vor Grant → 403 no_grant');

    store.set('sync:owner1:__account', JSON.stringify({ ciphertext: 'X', iv: 'Y', version: 1 }));
    r = await call('tok_owner', { action: 'grant', granteeId: 'stb1', envelope: { ephPub: {}, iv: 'i', ct: 'c' } });
    assert.strictEqual(r.code, 200, 'Grant erteilt'); pass++; console.log('✓ grant (Owner teilt Envelope)');

    r = await call('tok_stb', { action: 'list_grants' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.grants.length, 1);
    assert.strictEqual(r.body.grants[0].ownerId, 'owner1'); assert.ok(r.body.grants[0].envelope, 'Envelope dabei'); pass++; console.log('✓ list_grants (StB sieht Mandant + Envelope)');

    r = await call('tok_owner', { action: 'list_my_grantees' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.grantees.length, 1);
    assert.strictEqual(r.body.grantees[0].granteeId, 'stb1'); assert.ok(r.body.grantees[0].createdAt, 'createdAt dabei'); pass++; console.log('✓ list_my_grantees (Owner sieht erteilten Grant)');

    r = await call('tok_stb', { action: 'pull', scope: '__account', owner: 'owner1' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.blob.ciphertext, 'X', 'Chiffrat gelesen'); pass++; console.log('✓ pull nach Grant → Chiffrat');

    r = await call('tok_stb', { action: 'push', scope: '__account', owner: 'owner1', version: 1, ciphertext: 'Z', iv: 'i' });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'readonly', 'StB darf nie schreiben'); pass++; console.log('✓ push als StB → 403 readonly');

    r = await call('tok_owner', { action: 'revoke', granteeId: 'stb1' });
    assert.strictEqual(r.code, 200);
    r = await call('tok_stb', { action: 'pull', scope: '__account', owner: 'owner1' });
    assert.strictEqual(r.code, 403, 'nach Revoke kein Zugriff'); pass++; console.log('✓ revoke → Zugriff entzogen');

    r = await call('tok_owner', { action: 'list_my_grantees' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.grantees.length, 0, 'nach Revoke aus eigener Liste verschwunden'); pass++; console.log('✓ list_my_grantees nach Revoke → leer');

    r = await call('tok_stb', { action: 'pull', scope: '__account' });   // eigener Scope, StB ohne Pro
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'pro_required', 'eigener Scope braucht Pro'); pass++; console.log('✓ eigener pull ohne Pro → pro_required');

    // ── Audit-Log-Anker (Manipulationserkennung via externe append-only Liste) ──
    const H = 'a'.repeat(64);
    r = await call('tok_owner', { action: 'anchor', scope: '__account', entries: [{ id: 'e1', h: H }] });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.added, 1); pass++; console.log('✓ anchor (Content-Hash angehaengt)');

    r = await call('tok_owner', { action: 'anchor_pull', scope: '__account' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.anchors.length, 1);
    assert.strictEqual(r.body.anchors[0].id, 'e1'); assert.strictEqual(r.body.anchors[0].h, H); pass++; console.log('✓ anchor_pull (Liste zurück)');

    r = await call('tok_owner', { action: 'anchor', scope: '__account', entries: [{ id: 'bad id!', h: H }] });
    assert.strictEqual(r.code, 400); assert.strictEqual(r.body.error, 'bad_entry', 'ungültige ID abgelehnt'); pass++; console.log('✓ anchor mit ungültiger ID → 400 bad_entry');

    r = await call('tok_owner', { action: 'anchor', scope: '__account', entries: [{ id: 'e2', h: 'zu-kurz' }] });
    assert.strictEqual(r.code, 400); assert.strictEqual(r.body.error, 'bad_entry', 'ungültiger Hash abgelehnt'); pass++; console.log('✓ anchor mit ungültigem Hash → 400 bad_entry');

    r = await call('tok_owner', { action: 'anchor', scope: '__account', owner: 'someoneElse', entries: [{ id: 'e3', h: H }] });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'readonly', 'nie in fremden Owner-Scope anchoren'); pass++; console.log('✓ anchor mit owner-Param → 403 readonly');

    r = await call('tok_owner', { action: 'anchor_pull', scope: '__account', owner: 'someoneElse' });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'readonly'); pass++; console.log('✓ anchor_pull mit owner-Param → 403 readonly');

    // delete löscht die Geschäftsdaten, aber NICHT die GoBD-Anker-Kette (Security-Fix a4ade79,
    // 2026-08-10): sonst könnte ein Nutzer, der Buchungen nachträglich manipuliert hat, seine
    // eigene Tamper-Evidence per "Geschäftsdaten löschen" mit entfernen. Die Anker enthalten
    // keine personenbezogenen Klardaten (nur Hash + ID + Timestamp), Art. 17 DSGVO greift dort
    // nicht. Dieser Test forderte bis 2026-08-10 noch das alte Verhalten und schlug seither fehl.
    r = await call('tok_owner', { action: 'delete', scope: '__account' });
    assert.strictEqual(r.code, 200);
    r = await call('tok_owner', { action: 'pull', scope: '__account' });
    assert.ok(r.code === 404 || !r.body.data, 'Geschäftsdaten sind weg');
    r = await call('tok_owner', { action: 'anchor_pull', scope: '__account' });
    assert.strictEqual(r.code, 200);
    assert.ok(r.body.anchors.length > 0, 'Anker-Kette überlebt delete (GoBD Rz. 64, Tamper-Evidence)');
    pass++; console.log('✓ delete löscht Geschäftsdaten, Anker-Kette bleibt (GoBD Rz. 64)');

    // ── Mengendeckel pro Nutzer (Fund R2/R4, Red-Team-Audit 2026-08-10) ──────────────────────
    // Vorher validierte SCOPE_RE nur die FORM des Scopes: ein Nutzer mit einem 15-€-Abo konnte
    // beliebig viele Scopes anlegen und je Scope MAX_CIPHER (3,5 MB) belegen — laut Audit
    // ~200 GB/Tag Upstash-Speicher auf Kosten des Betreibers.
    const MAX_SCOPES = 25, MAX_GRANTS = 10;

    // Der Mock lässt EXPIRE ins Leere laufen, die Rate-Limit-Zähler verfallen also nie und die
    // folgenden Schleifen würden nach 40 Requests in 429 laufen. resetRate() simuliert den
    // Minutenwechsel, den echtes Redis per TTL erledigt — hier wird der Deckel getestet, nicht
    // der Rate-Limiter.
    const resetRate = () => {
        for (const k of Array.from(store.keys())) {
            if (k.indexOf('sync:rl:') === 0 || k.indexOf('sync:iprl:') === 0) store.delete(k);
        }
    };
    const pushScope = async (sc) => { resetRate(); return call('tok_owner', { action: 'push', scope: sc, version: 0, iv: 'AA', ciphertext: 'X' }); };

    // Bis zum Deckel auffüllen. '__account' ist durch das delete oben wieder frei, der Zähler
    // startet also bei 0 — genau das soll delete leisten.
    let accepted = 0, limited = null;
    for (let i = 0; i < MAX_SCOPES + 5; i++) {
        const rr = await pushScope('co_flood' + i);
        if (rr.code === 200) accepted++;
        else if (rr.body && rr.body.error === 'scope_limit') { limited = rr; break; }
    }
    assert.strictEqual(accepted, MAX_SCOPES, 'genau MAX_SCOPES Scopes werden angenommen, dann Stop');
    assert.ok(limited, 'der nächste Scope wird abgelehnt');
    assert.strictEqual(limited.code, 409);
    assert.strictEqual(limited.body.maxScopes, MAX_SCOPES, 'Antwort nennt den Deckel');
    pass++; console.log('✓ Scope-Deckel greift bei ' + MAX_SCOPES + ' (Speicher pro Nutzer begrenzt)');

    // Schreiben in einen BESTEHENDEN Scope bleibt erlaubt — der Deckel darf niemanden aussperren,
    // der bereits Daten liegen hat.
    r = await pushScope('co_flood0');
    assert.strictEqual(r.code, 200, 'bestehender Scope weiterhin beschreibbar');
    pass++; console.log('✓ bestehende Scopes bleiben trotz erreichtem Deckel schreibbar');

    // anchor darf den Deckel nicht umgehen (eigener Key je Scope)
    resetRate();
    r = await call('tok_owner', { action: 'anchor', scope: 'co_umgehung', entries: [{ id: 'e9', h: H }] });
    assert.strictEqual(r.code, 409); assert.strictEqual(r.body.error, 'scope_limit', 'anchor umgeht den Deckel nicht');
    pass++; console.log('✓ anchor-Pfad umgeht den Scope-Deckel nicht');

    // delete gibt einen Platz frei → danach ist wieder genau einer zu haben
    resetRate();
    r = await call('tok_owner', { action: 'delete', scope: 'co_flood0' });
    assert.strictEqual(r.code, 200);
    r = await pushScope('co_nachraeumen');
    assert.strictEqual(r.code, 200, 'nach delete ist wieder ein Platz frei');
    r = await pushScope('co_nocheiner');
    assert.strictEqual(r.code, 409, 'aber nur einer');
    pass++; console.log('✓ delete gibt genau einen Scope-Platz frei');

    // Grant nur an Grantees mit registriertem Public Key (Fund R4): vorher ließ sich ein Grant
    // blind auf eine beliebige ID setzen und blähte grantsby:<userId> auf.
    resetRate();
    r = await call('tok_owner', { action: 'grant', granteeId: 'gibtEsNicht', envelope: { ephPub: {}, iv: 'i', ct: 'c' } });
    assert.strictEqual(r.code, 404); assert.strictEqual(r.body.error, 'no_pubkey', 'Fantasie-Grantee abgelehnt');
    pass++; console.log('✓ Grant an unbekannte ID abgelehnt (kein registrierter Pubkey)');

    // Grant-Deckel pro Owner. Jeder Grantee braucht erst einen Pubkey — der Deckel ist also nur
    // über echte, angemeldete Accounts erreichbar; getestet wird er trotzdem.
    for (let i = 0; i < MAX_GRANTS + 2; i++) store.set('pubkey:stbX' + i, JSON.stringify({ pub: { kty: 'EC' } }));
    let grantsOk = 0, grantLimited = null;
    for (let i = 0; i < MAX_GRANTS + 2; i++) {
        resetRate();
        const rr = await call('tok_owner', { action: 'grant', granteeId: 'stbX' + i, envelope: { ephPub: {}, iv: 'i', ct: 'c' } });
        if (rr.code === 200) grantsOk++;
        else if (rr.body && rr.body.error === 'grant_limit') { grantLimited = rr; break; }
    }
    // 'stb1' wurde oben revoked, die Menge startet also leer → alle MAX_GRANTS passen rein
    assert.strictEqual(grantsOk, MAX_GRANTS, 'genau MAX_GRANTS Freigaben werden angenommen');
    assert.ok(grantLimited && grantLimited.code === 409, 'weiterer Grant abgelehnt');
    assert.strictEqual(grantLimited.body.maxGrants, MAX_GRANTS, 'Antwort nennt den Deckel');
    pass++; console.log('✓ Grant-Deckel greift bei ' + MAX_GRANTS + ' aktiven Freigaben');

    // Re-Grant an einen BESTEHENDEN Steuerberater muss trotz erreichtem Deckel gehen
    // (Schlüsselwechsel beim Owner erzeugt einen neuen Envelope für dieselbe ID).
    resetRate();
    r = await call('tok_owner', { action: 'grant', granteeId: 'stbX0', envelope: { ephPub: {}, iv: 'i2', ct: 'c2' } });
    assert.strictEqual(r.code, 200, 'Re-Grant an bestehenden Grantee bleibt möglich');
    pass++; console.log('✓ Re-Grant an bestehenden Steuerberater trotz Deckel möglich');

    // ── R8: get_pubkey darf kein Nutzer-Enumerations-Orakel sein ────────────────────────────
    // Vorher gab der Endpunkt den ganzen gespeicherten Datensatz heraus, inklusive `username`.
    // Ein zahlender Angreifer konnte damit für beliebige Whop-User-IDs feststellen, ob sie
    // Stackr nutzen UND wie sie dort heißen (40 Abfragen/Minute).
    resetRate();
    r = await call('tok_stb', { action: 'register_pubkey', pub: { kty: 'EC', x: 'n', y: 'n' } });
    assert.strictEqual(r.code, 200);
    assert.ok(!/username/.test(store.get('pubkey:stb1') || ''),
        'username wird gar nicht erst gespeichert (Datenminimierung)');
    resetRate();
    r = await call('tok_owner', { action: 'get_pubkey', granteeId: 'stb1' });
    assert.strictEqual(r.code, 200);
    assert.ok(r.body.pubkey.pub, 'pub kommt weiterhin zurück — dafür ist der Endpunkt da');
    assert.strictEqual(r.body.pubkey.username, undefined, 'kein username in der Antwort');
    assert.deepStrictEqual(Object.keys(r.body.pubkey).sort(), ['pub', 'updatedAt'],
        'Antwort ist eine Whitelist, nicht der gespeicherte Datensatz');
    pass++; console.log('✓ get_pubkey gibt keinen Benutzernamen heraus (R8)');

    // Alt-Datensatz von VOR dem Fix trägt noch username. Der Whitelist-Zugriff muss ihn filtern,
    // bis er beim nächsten Login des Betroffenen überschrieben wird.
    store.set('pubkey:altuser', JSON.stringify({ pub: { kty: 'EC' }, username: 'heisstSo', updatedAt: 1 }));
    resetRate();
    r = await call('tok_owner', { action: 'get_pubkey', granteeId: 'altuser' });
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.body.pubkey.username, undefined, 'Alt-Datensatz wird gefiltert');
    assert.ok(!JSON.stringify(r.body).includes('heisstSo'), 'Name taucht nirgends in der Antwort auf');
    pass++; console.log('✓ Alt-Datensätze mit username werden beim Abruf gefiltert');

    // ── reset_all: Notausgang aus der Schlüssel-Sackgasse ──────────────────────────────────
    // Voraussetzung des Fixes vom 2026-08-11: wer den Schlüssel zu seinen Cloud-Daten verloren
    // hat, muss sie verwerfen können — sonst bleibt der Account dauerhaft unsynchronisierbar.
    resetRate();
    await call('tok_owner', { action: 'push', scope: '__account', version: 0, iv: 'i', ciphertext: 'c' });
    store.set('sync:owner1:__account', JSON.stringify({ ciphertext: 'c', iv: 'i', version: 1 }));
    store.set('sync:owner1:co_reset1',  JSON.stringify({ ciphertext: 'c', iv: 'i', version: 1 }));
    sets.set('scopes:owner1', new Set(['__account', 'co_reset1']));
    lists.set('syncanchor:owner1:co_reset1', [JSON.stringify({ id: 'a1', h: 'f'.repeat(64), ts: 1 })]);
    resetRate();
    r = await call('tok_owner', { action: 'reset_all' });
    assert.strictEqual(r.code, 200, 'reset_all erfolgreich');
    assert.deepStrictEqual(r.body.scopes.sort(), ['__account', 'co_reset1'], 'alle Scopes gemeldet');
    assert.strictEqual(store.get('sync:owner1:__account'), undefined, 'Registry-Snapshot weg');
    assert.strictEqual(store.get('sync:owner1:co_reset1'), undefined, 'Firmen-Snapshot weg');
    assert.ok(!sets.has('scopes:owner1') || sets.get('scopes:owner1').size === 0, 'Scope-Set freigegeben');
    assert.ok((lists.get('syncanchor:owner1:co_reset1') || []).length === 1,
        'GoBD-Anker bleibt bestehen — sonst wäre die Tamper-Evidence per "Reset" abstreifbar');
    pass++; console.log('✓ reset_all verwirft alle Snapshots, Anker-Kette bleibt (GoBD Rz. 64)');

    // Ohne Scope-Set (Alt-Account von vor dem Scope-Deckel) muss __account trotzdem fallen
    store.set('sync:owner1:__account', JSON.stringify({ ciphertext: 'c', iv: 'i', version: 9 }));
    sets.delete('scopes:owner1');
    resetRate();
    r = await call('tok_owner', { action: 'reset_all' });
    assert.strictEqual(r.code, 200);
    assert.strictEqual(store.get('sync:owner1:__account'), undefined, '__account auch ohne Scope-Set gelöscht');
    pass++; console.log('✓ reset_all erwischt __account auch ohne Scope-Set');

    // Fremde Daten sind für reset_all tabu (StB-Read-Only-Prinzip)
    store.set('sync:owner1:__account', JSON.stringify({ ciphertext: 'c', iv: 'i', version: 1 }));
    resetRate();
    r = await call('tok_stb', { action: 'reset_all', owner: 'owner1' });
    assert.strictEqual(r.code, 403, 'Reset fremder Daten abgelehnt');
    assert.ok(store.get('sync:owner1:__account'), 'fremder Snapshot unangetastet');
    pass++; console.log('✓ reset_all mit owner-Param → 403 readonly');

    // Ohne Pro kein Reset (Owner-Aktion, kein Grantee-Read)
    resetRate();
    r = await call('tok_stb', { action: 'reset_all' });
    assert.strictEqual(r.code, 403);
    assert.strictEqual(r.body.error, 'pro_required');
    pass++; console.log('✓ reset_all ohne Pro → 403 pro_required');

    console.log('\n' + pass + '/31 API-Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
