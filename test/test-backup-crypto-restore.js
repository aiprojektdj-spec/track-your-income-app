// Self-Test der Backup-Restore-Härtung:  node test/test-backup-crypto-restore.js
// Prüft die beiden P1/P2-Funde des Delta-Security-Audits vom 2026-08-10:
//   Fund 2 — _restore schrieb jeden Key aus der Datei ungefiltert nach localStorage.
//            Eine präparierte Backup-Datei konnte damit whop_access_token, whop_grace_token,
//            oyi_device_owner_uid u.a. überschreiben. Erwartet: nur Allowlist-Keys landen im Store.
//   Fund 3 — _decryptFile ignorierte kdf.iterations und leitete immer mit der Modul-Konstante ab.
//            Erwartet: eine Datei mit abweichenden iterations bleibt entschlüsselbar.
'use strict';
const assert = require('assert');

// ── Browser-Umgebung minimal nachbauen (Modul ist self-contained, braucht nur diese Primitive)
const ls = new Map();
global.localStorage = {
    get length() { return ls.size; },
    key: (i) => Array.from(ls.keys())[i] ?? null,
    getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: (k, v) => { ls.set(k, String(v)); },
    removeItem: (k) => { ls.delete(k); }
};
global.Store = {
    _cache: {},
    _EIGENBELEG_KEYS: ['eigenbelege_belege', 'eigenbelege_kategorien', 'eigenbelege_einstellungen',
                       'eigenbelege_naechste_nummer', 'eigenbelege_produkte'],
    _idbPutAsync: (k, v) => { Store._cache[k] = v; return Promise.resolve(); },
    _calcChecksum: (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h); }
};
if (typeof global.btoa !== 'function') {
    global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
    global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

const BC = require('../js/backup-crypto.js');
const T = BC._test;

(async () => {
    let pass = 0;

    // 1) Allowlist: was rein darf und was nicht
    assert.ok(T.isAllowedKey('__account', 'oyi_companies'), 'oyi_companies erlaubt');
    assert.ok(!T.isAllowedKey('__account', 'whop_access_token'), 'Token im __account-Scope verboten');
    assert.ok(T.isAllowedKey('co_abc123', 'co_abc123__reselling_purchases'), 'reselling erlaubt');
    assert.ok(T.isAllowedKey('co_abc123', 'co_abc123__rechnungsbuch_rechnungen'), 'rechnungsbuch erlaubt');
    assert.ok(T.isAllowedKey('co_abc123', 'co_abc123__audit_log'), 'audit_log erlaubt');
    assert.ok(T.isAllowedKey('co_abc123', 'co_abc123__eigenbelege_belege'), 'eigenbelege erlaubt');
    assert.ok(!T.isAllowedKey('co_abc123', 'co_abc123__whop_access_token'), 'Token im Firmen-Scope verboten');
    assert.ok(!T.isAllowedKey('co_abc123', 'co_other__reselling_purchases'), 'Fremd-Scope-Schmuggel verboten');
    assert.ok(!T.isAllowedKey('whop_access_token', 'whop_access_token'), 'Scope muss Firmen-ID sein');
    assert.ok(!T.isAllowedKey('co_abc123', '__proto__'), 'kein Prototype-Key');
    pass++; console.log('✓ Allowlist trennt Backup-Keys von Fremd-Keys');

    // 2) Fund 2: präpariertes Bundle darf keine Sitzungs-/Identitäts-Keys setzen
    localStorage.setItem('whop_access_token', 'echter-token-des-opfers');
    localStorage.setItem('oyi_device_owner_uid', 'user_victim');
    const evil = {
        __account: { oyi_companies: [{ id: 'co_abc123', name: 'A' }], whop_access_token: 'token-des-angreifers' },
        co_abc123: {
            'co_abc123__reselling_purchases': [{ id: 1, updatedAt: 5 }],   // legitim
            'whop_access_token':        'token-des-angreifers',
            'whop_grace_token':         'gefaelschtes-grace-token',
            'oyi_device_owner_uid':     'user_attacker',
            'stackr_lang':              'xx',
            'evil_key':                 'x'
        }
    };
    await T.restore(evil);
    assert.strictEqual(localStorage.getItem('whop_access_token'), 'echter-token-des-opfers', 'Access-Token unverändert');
    assert.strictEqual(localStorage.getItem('oyi_device_owner_uid'), 'user_victim', 'Geräte-Sperre unverändert');
    assert.strictEqual(localStorage.getItem('whop_grace_token'), null, 'Grace-Token nicht gesetzt');
    assert.strictEqual(localStorage.getItem('stackr_lang'), null, 'Sprachwahl nicht gesetzt');
    assert.strictEqual(localStorage.getItem('evil_key'), null, 'Fremd-Key nicht gesetzt');
    assert.ok(Store._cache['co_abc123__reselling_purchases'], 'legitime Buchungen kamen an');
    pass++; console.log('✓ präpariertes Bundle setzt keine Fremd-Keys (Fund 2)');

    // 3) Fund 3: Datei mit abweichenden kdf.iterations bleibt lesbar
    //    (simuliert ein Alt-Backup nach einer späteren ITER-Erhöhung)
    const bundle = { __account: { oyi_companies: [{ id: 'co_abc123', name: 'A' }] } };
    const file = await T.exportFile('pw-test-123');           // exportiert den Test-Store, Inhalt egal
    assert.strictEqual(file.kdf.iterations, T.ITER, 'Header trägt die aktuellen Runden');
    const out = await T.decryptFile(file, 'pw-test-123');
    assert.ok(out && typeof out === 'object', 'aktuelles Backup entschlüsselbar');

    // Legacy-Datei mit 210.000 Runden explizit gegenprüfen: von Hand erzeugt wie ein Alt-Export
    const legacy = await (async () => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));
        const km   = await crypto.subtle.importKey('raw', new TextEncoder().encode('pw-alt-456'), 'PBKDF2', false, ['deriveKey']);
        const key  = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
                                                   km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
        const aad  = new TextEncoder().encode('stackr-backup|v1');
        const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key,
                                                 new TextEncoder().encode(JSON.stringify(bundle)));
        const b64  = (b) => Buffer.from(b).toString('base64');
        return {
            format: 'stackr-backup', version: 1, app: 'stackr', createdAt: new Date().toISOString(),
            kdf:    { algo: 'PBKDF2', hash: 'SHA-256', iterations: 210000, salt: b64(salt) },
            cipher: { algo: 'AES-GCM', iv: b64(iv), ciphertext: b64(new Uint8Array(ct)) }
        };
    })();
    const outLegacy = await T.decryptFile(legacy, 'pw-alt-456');
    assert.deepStrictEqual(outLegacy, bundle, 'Alt-Backup (210k Runden) weiterhin entschlüsselbar');
    pass++; console.log('✓ kdf.iterations wird respektiert, Alt-Backups bleiben lesbar (Fund 3)');

    // 4) Datei ohne kdf.iterations (ganz alte Exporte) → Fallback ITER_LEGACY
    const noIter = JSON.parse(JSON.stringify(legacy));
    delete noIter.kdf.iterations;
    assert.strictEqual(T.ITER_LEGACY, 210000, 'Legacy-Fallback bleibt bei 210k');
    const outNoIter = await T.decryptFile(noIter, 'pw-alt-456');
    assert.deepStrictEqual(outNoIter, bundle, 'Datei ohne iterations-Feld über Fallback lesbar');
    pass++; console.log('✓ Fallback für Dateien ohne kdf.iterations');

    // 5) Falsche Passphrase scheitert weiterhin klar
    let denied = false;
    try { await T.decryptFile(legacy, 'falsch'); } catch (e) { denied = /Passphrase/.test(e.message); }
    assert.ok(denied, 'falsche Passphrase wird abgelehnt');
    pass++; console.log('✓ falsche Passphrase abgelehnt');

    console.log('\n' + pass + '/5 Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
