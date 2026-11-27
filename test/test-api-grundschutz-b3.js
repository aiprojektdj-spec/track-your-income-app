// API-Grundschutz B3 (2026-11-27): Methoden-Check im Cron-Endpunkt und explizite Body-Limits
// der Whop-Endpunkte. Ausfuehrungstest gegen die echten Handler; alle Faelle enden VOR jedem
// Netz-, Redis- oder Supabase-Zugriff (fetch ist so gestellt, dass jeder Aufruf auffaellt).
// Sperre + Body-Limit in api/shopify-install.js: test/test-shopify-endpunkte.js.
'use strict';
const assert = require('assert');
const path = require('path');
const API = path.join(__dirname, '..', 'api');

let netz = 0;
global.fetch = async () => { netz++; throw new Error('kein Netz im Test'); };
process.env.CRON_SECRET = 'test-cron-secret';
console.error = function () {};

function mockRes() {
    const r = { statusCode: 0, headers: {}, body: undefined };
    r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
    r.status = c => { r.statusCode = c; return r; };
    r.json = b => { r.body = b; return r; };
    r.end = () => r;
    return r;
}

let pass = 0, fail = 0;
async function check(name, fn) {
    try { await fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

(async () => {
    const cleanup = require(path.join(API, 'blob-cleanup.js'));
    for (const m of ['POST', 'PUT', 'DELETE']) {
        await check('blob-cleanup: ' + m + ' mit gueltigem Secret -> 405', async () => {
            const res = mockRes();
            await cleanup({ method: m, url: '/api/blob-cleanup', query: {}, headers: { authorization: 'Bearer test-cron-secret' } }, res);
            assert.strictEqual(res.statusCode, 405);
        });
    }

    const grenzen = [['whop-access.js', 8192], ['whop-refresh.js', 1024], ['whop-token.js', 4096]];
    for (const [datei, max] of grenzen) {
        const h = require(path.join(API, datei));
        await check(datei + ': Content-Length ' + (max + 1) + ' -> 413 vor jeder Pruefung', async () => {
            const res = mockRes();
            await h({ method: 'POST', headers: { 'content-length': String(max + 1) }, body: {} }, res);
            assert.strictEqual(res.statusCode, 413);
            assert.strictEqual(res.body.error, 'too_large');
        });
        await check(datei + ': Content-Length ' + max + ' liegt am Limit, kein 413', async () => {
            const res = mockRes();
            await h({ method: 'POST', headers: { 'content-length': String(max) }, body: {} }, res);
            assert.notStrictEqual(res.statusCode, 413);
        });
    }

    await check('kein Netzaufruf in allen Faellen', async () => { assert.strictEqual(netz, 0); });
    console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
    process.exit(fail ? 1 : 0);
})();
