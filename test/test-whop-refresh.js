// Self-Test der Token-Erneuerung:  node test/test-whop-refresh.js
//
// Hintergrund: plan/funde-whop-sitzungsabriss-2026-09-04.md — Whops Access-Token laeuft nach
// einer Stunde ab, es gab keinen Erneuerungsweg, und der 401-Zweig loeschte zusaetzlich das
// Offline-Grace-Token. Jeder zahlende Kunde flog stuendlich raus.
//
// Getestet wird der Handler ECHT (fake req/res), nicht eine herausgeloeste Hilfsfunktion —
// die Fehler, die hier wehtun, sitzen in der Reihenfolge von Sperre, Rotation und Aufraeumen,
// nicht in einer einzelnen Rechnung.
//
// Der wichtigste Test ist "Rotation": Whop entwertet den alten Refresh-Token bei jedem
// Gebrauch. Wer den alten weiterspeichert, hat eine Kette, die genau einmal funktioniert und
// beim zweiten Mal still stirbt — das faellt im Handbetrieb erst eine Stunde spaeter auf.

process.env.UPSTASH_REDIS_REST_URL   = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
process.env.WHOP_CLIENT_SECRET       = 'geheim';

const handler = require('../api/whop-refresh.js');

let pass = 0, fail = 0;
function check(name, cond, info) {
    if (cond) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + (info ? ' — ' + info : '')); fail++; }
}

// ── Fake-Redis als Map, versteht die Befehle, die der Handler wirklich nutzt ──
let store, whopCalls, whopReply;

function redisExec(cmd) {
    const op = String(cmd[0]).toUpperCase();
    if (op === 'GET')  return store.has(cmd[1]) ? store.get(cmd[1]) : null;
    if (op === 'DEL')  { const da = store.delete(cmd[1]); return da ? 1 : 0; }
    if (op === 'INCR') { const v = (parseInt(store.get(cmd[1]), 10) || 0) + 1; store.set(cmd[1], String(v)); return v; }
    if (op === 'EXPIRE') return 1;
    if (op === 'SET') {
        const nx = cmd.indexOf('NX') !== -1;
        if (nx && store.has(cmd[1])) return null;     // Upstash: null wenn NX nicht griff
        store.set(cmd[1], cmd[2]);
        return 'OK';
    }
    throw new Error('unbekannter Redis-Befehl im Test: ' + op);
}

function stubFetch() {
    whopCalls = [];
    global.fetch = async (url, opts) => {
        const body = opts && opts.body ? JSON.parse(opts.body) : null;
        if (String(url).indexOf('redis.test') !== -1) {
            return { ok: true, status: 200, json: async () => ({ result: redisExec(body) }) };
        }
        if (String(url).indexOf('api.whop.com') !== -1) {
            whopCalls.push(body);
            if (whopReply === 'netzfehler') throw new Error('ECONNRESET');
            return {
                ok: whopReply.status >= 200 && whopReply.status < 300,
                status: whopReply.status,
                json: async () => whopReply.body || {}
            };
        }
        throw new Error('unerwarteter fetch: ' + url);
    };
}

function fakeRes() {
    const r = { _status: 0, _json: null, headers: {} };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    r.status = (c) => { r._status = c; return r; };
    r.json = (o) => { r._json = o; return r; };
    r.end = () => r;
    return r;
}

async function call(body) {
    const req = { method: 'POST', body, headers: { 'x-vercel-forwarded-for': '1.2.3.4' }, socket: {} };
    const res = fakeRes();
    await handler(req, res);
    return res;
}

const SID = 'a'.repeat(64);
function setSession(entry) { store.set('whoprt:' + SID, JSON.stringify(entry)); }
function getSession() { const v = store.get('whoprt:' + SID); return v ? JSON.parse(v) : null; }

(async () => {
    // ── A · Eingabepruefung ───────────────────────────────────────────────
    store = new Map(); whopReply = { status: 200 }; stubFetch();
    check('A1 fehlende session_id → 400', (await call({}))._status === 400);
    check('A2 unplausible session_id → 400', (await call({ session_id: 'kurz' }))._status === 400);
    check('A3 session_id mit Sonderzeichen → 400', (await call({ session_id: '../etc/passwd' }))._status === 400);

    // ── B · Unbekannte Sitzung ────────────────────────────────────────────
    store = new Map(); stubFetch();
    let r = await call({ session_id: SID });
    check('B1 unbekannte Sitzung → 401 session_expired', r._status === 401 && r._json.error === 'session_expired');
    check('B2 dabei kein Whop-Aufruf', whopCalls.length === 0);

    // ── C · Noch gueltiger Access-Token wird durchgereicht ────────────────
    // Deckt "zwei Tabs erneuern gleichzeitig" ab, ohne bei Whop zu rotieren.
    store = new Map(); stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() + 10 * 60 * 1000 });
    r = await call({ session_id: SID });
    check('C1 gueltiger Token wird zurueckgegeben', r._status === 200 && r._json.access_token === 'AT1');
    check('C2 KEIN Whop-Aufruf dafuer', whopCalls.length === 0, 'Aufrufe: ' + whopCalls.length);
    check('C3 Restlaufzeit plausibel', r._json.expires_in > 500 && r._json.expires_in <= 600, 'got ' + r._json.expires_in);

    // Knapp vor Ablauf (< 60 s Rand) muss dagegen wirklich rotiert werden
    store = new Map(); whopReply = { status: 200, body: { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 } }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() + 30 * 1000 });
    r = await call({ session_id: SID });
    check('C4 knapp vor Ablauf → echte Erneuerung', r._status === 200 && r._json.access_token === 'AT2');

    // ── D · Rotation (der teuerste Fehler, wenn er passiert) ──────────────
    store = new Map(); whopReply = { status: 200, body: { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 } }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() - 1000 });
    r = await call({ session_id: SID });
    check('D1 abgelaufen → neuer Token', r._status === 200 && r._json.access_token === 'AT2');
    check('D2 Whop mit grant_type refresh_token gerufen', whopCalls.length === 1 && whopCalls[0].grant_type === 'refresh_token');
    check('D3 alter Refresh-Token mitgeschickt', whopCalls[0].refresh_token === 'RT1');
    check('D4 NEUER Refresh-Token gespeichert', getSession().rt === 'RT2', 'gespeichert: ' + JSON.stringify(getSession()));
    check('D5 neuer Access-Token mitgespeichert', getSession().at === 'AT2');
    check('D6 Ablauf in die Zukunft gesetzt', getSession().exp > Date.now() + 3500 * 1000);

    // Zweite Runde muss mit dem ROTIERTEN Token laufen — sonst stirbt die Kette nach einmal
    whopReply = { status: 200, body: { access_token: 'AT3', refresh_token: 'RT3', expires_in: 3600 } };
    const s = getSession(); s.exp = Date.now() - 1000; setSession(s);
    whopCalls = [];
    r = await call({ session_id: SID });
    check('D7 zweite Runde nutzt RT2, nicht RT1', whopCalls[0].refresh_token === 'RT2', 'geschickt: ' + whopCalls[0].refresh_token);
    check('D8 Kette laeuft weiter', r._json.access_token === 'AT3' && getSession().rt === 'RT3');

    // Whop liefert wider Erwarten keinen neuen Refresh-Token → alten behalten statt verlieren
    store = new Map(); whopReply = { status: 200, body: { access_token: 'AT9', expires_in: 3600 } }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() - 1000 });
    await call({ session_id: SID });
    check('D9 ohne neuen Refresh-Token bleibt der alte stehen', getSession().rt === 'RT1');

    // ── E · Whop lehnt ab → Sitzung aufraeumen ────────────────────────────
    store = new Map(); whopReply = { status: 400, body: { error: 'invalid_grant' } }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() - 1000 });
    r = await call({ session_id: SID });
    check('E1 invalid_grant → 401', r._status === 401 && r._json.error === 'session_expired');
    check('E2 tote Sitzung geloescht (keine Schleife)', getSession() === null);

    // ── F · Netzfehler darf die Sitzung NICHT toeten ──────────────────────
    // Der Refresh-Token ist dabei vermutlich noch gut — wer ihn hier wegwirft, meldet den
    // Kunden wegen eines Schluckaufs ab.
    store = new Map(); whopReply = 'netzfehler'; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() - 1000 });
    r = await call({ session_id: SID });
    check('F1 Netzfehler → 503', r._status === 503 && r._json.error === 'refresh_unavailable');
    check('F2 Sitzung bleibt erhalten', getSession() !== null && getSession().rt === 'RT1');

    // ── G · Abmelden widerruft serverseitig ───────────────────────────────
    store = new Map(); whopReply = { status: 200 }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() + 60000 });
    r = await call({ session_id: SID, revoke: true });
    check('G1 revoke → 200', r._status === 200 && r._json.revoked === true);
    check('G2 Sitzung wirklich weg', getSession() === null);
    check('G3 revoke ruft Whop nicht', whopCalls.length === 0);

    // ── H · Sperre: zweiter Aufruf bekommt das Ergebnis des ersten ────────
    store = new Map(); whopReply = { status: 200 }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() - 1000 });
    store.set('whoprt:lock:' + SID, '1');                       // Sperre haelt ein anderer
    setTimeout(() => setSession({ rt: 'RT2', at: 'AT2', exp: Date.now() + 3600 * 1000 }), 300);
    r = await call({ session_id: SID });
    check('H1 wartet und liefert den frischen Token', r._status === 200 && r._json.access_token === 'AT2', JSON.stringify(r._json));
    check('H2 rotiert nicht selbst nochmal', whopCalls.length === 0, 'Aufrufe: ' + whopCalls.length);

    // ── I · Rate-Limit greift ─────────────────────────────────────────────
    store = new Map(); whopReply = { status: 200 }; stubFetch();
    setSession({ rt: 'RT1', at: 'AT1', exp: Date.now() + 3600 * 1000 });
    let limited = false;
    for (let i = 0; i < 35; i++) {
        const rr = await call({ session_id: SID });
        if (rr._status === 429) { limited = true; break; }
    }
    check('I1 IP-Deckel greift', limited === true);

    console.log('\n' + pass + '/' + (pass + fail) + ' Checks bestanden');
    if (fail) process.exit(1);
})();
