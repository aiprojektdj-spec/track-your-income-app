// Self-Test:  node test/test-sync-token-refresh.js
// Prueft: CloudSync._api erneuert bei 401 den Whop-Token genau einmal und wiederholt den
// Aufruf mit dem frischen Token. Vorher lief der Sync nach einer Stunde dauerhaft in 401
// (Kundenmeldung 2026-10-06, Diagnose "Server: nicht erreichbar — HTTP 401").
'use strict';
const assert = require('assert');

const _ls = new Map([['whop_access_token', 'alt']]);
global.localStorage = {
    getItem: k => (_ls.has(k) ? _ls.get(k) : null),
    setItem: (k, v) => _ls.set(k, String(v)),
    removeItem: k => _ls.delete(k)
};
global.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {} };
global.window = {};

let refreshes = 0, refreshResult = 'frisch';
global.AuthUI = {
    validToken: async () => localStorage.getItem('whop_access_token'),
    refreshToken: async () => { refreshes++; return refreshResult; }
};
const seen = [];
let reply401 = () => true;
global.fetch = async (url, opts) => {
    const tok = opts.headers.Authorization.slice(7);
    seen.push(tok);
    const s = (tok === 'alt' && reply401()) ? 401 : 200;
    return { status: s, json: async () => ({ ok: s === 200 }) };
};

const T = require('../js/cloud-sync.js')._test;

(async () => {
    let pass = 0;

    // 1) Abgelaufener Token → einmal erneuern, mit frischem Token wiederholen
    let r = await T.api({ action: 'pull' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(seen, ['alt', 'frisch']);
    assert.strictEqual(refreshes, 1);
    pass++; console.log('✓ 401 → Erneuerung + Wiederholung mit frischem Token');

    // 2) Gueltiger Token → keine Erneuerung, ein einziger Aufruf
    seen.length = 0; refreshes = 0; reply401 = () => false;
    r = await T.api({ action: 'pull' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(seen, ['alt']);
    assert.strictEqual(refreshes, 0);
    pass++; console.log('✓ gueltiger Token → keine Erneuerung');

    // 3) Erneuerung scheitert → 401 bleibt stehen, keine Schleife
    seen.length = 0; refreshes = 0; reply401 = () => true; refreshResult = null;
    r = await T.api({ action: 'pull' });
    assert.strictEqual(r.status, 401);
    assert.deepStrictEqual(seen, ['alt']);
    assert.strictEqual(refreshes, 1);
    pass++; console.log('✓ Erneuerung scheitert → 401, genau ein Versuch');

    console.log(pass + ' Tests bestanden');
})().catch(e => { console.error(e); process.exit(1); });
