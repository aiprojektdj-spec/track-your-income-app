// Byte-Budget des Blob-Uploads:  node test/test-blob-budget.js
//
// Fund R6 (Red-Team-Audit 2026-08-10): api/blob-upload.js erlaubte RATE_MAX=120 Requests/Minute
// à MAX_CHUNK=4 MB — 480 MB/Minute ≈ 28 GB/Stunde pro zahlendem Account. MAX_TOTAL_BYTES deckelt
// nur EINE zusammengesetzte Datei (200 MB), nicht die Summe, und api/blob-cleanup.js räumt
// ausschließlich stackr/tmp/ — Anhänge aus action=put bleiben dauerhaft liegen.
//
// Geprüft wird chargeBlobBudget() gegen ein In-Memory-Redis: Deckel greift, abgelehnte Uploads
// verbrauchen kein Budget, Redis-Ausfall blockiert den Upload nicht (fail-open wie das
// bestehende Rate-Limit), und das Fenster wird nur EINMAL gesetzt (EXPIRE ... NX), sonst würde
// jeder Upload die 30 Tage neu starten und das Budget wäre nie erschöpfbar.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024, GB = 1024 * MB;

// chargeBlobBudget aus der Datei schneiden und mit einem Fake-redisCmd bestücken.
const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'blob-upload.js'), 'utf8');
const m = src.match(/async function chargeBlobBudget\([\s\S]*?\n\}/m);
assert.ok(m, 'chargeBlobBudget in api/blob-upload.js nicht gefunden');

function build(opts) {
    const store = new Map();
    const calls = [];
    const redisCmd = async (cmd) => {
        calls.push(cmd);
        if (opts.fail) throw new Error('Redis: down');
        const [op, key, arg] = cmd;
        if (op === 'INCRBY') { const v = (store.get(key) || 0) + Number(arg); store.set(key, v); return v; }
        if (op === 'DECRBY') { const v = (store.get(key) || 0) - Number(arg); store.set(key, v); return v; }
        if (op === 'EXPIRE') return 1;
        return null;
    };
    // Der Byte-Deckel ist fail-open. Damit ein offener Deckel nicht still im Log versandet,
    // meldet chargeBlobBudget ihn ueber api/_alert.js — hier als Spion eingehaengt.
    const alerts = [];
    const alertOps = async (source, event, detail) => { alerts.push({ source, event, detail }); };
    const fn = new Function('REDIS_URL', 'REDIS_TOKEN', 'redisCmd', 'BLOB_BUDGET_BYTES',
                            'BLOB_BUDGET_WINDOW', 'console', 'alertOps',
                            m[0] + '; return chargeBlobBudget;')(
        opts.noRedis ? '' : 'http://r', opts.noRedis ? '' : 'tok', redisCmd,
        opts.budget !== undefined ? opts.budget : 10 * GB, 2592000,
        { error: () => {} }, alertOps);
    return { charge: fn, store, calls, alerts };
}

(async () => {
    let pass = 0;

    // 1) Unter dem Deckel wird gebucht
    let b = build({ budget: 10 * MB });
    assert.strictEqual(await b.charge('user_1', 4 * MB), true, 'erster Chunk geht durch');
    assert.strictEqual(await b.charge('user_1', 4 * MB), true, 'zweiter Chunk geht durch');
    assert.strictEqual(b.store.get('blob:bytes:user_1'), 8 * MB, 'Zähler stimmt');
    pass++; console.log('✓ Uploads unter dem Deckel werden gebucht');

    // 2) Genau auf dem Deckel ist noch erlaubt (<=, nicht <)
    assert.strictEqual(await b.charge('user_1', 2 * MB), true, 'exakt der Deckel ist erlaubt');
    assert.strictEqual(b.store.get('blob:bytes:user_1'), 10 * MB);
    pass++; console.log('✓ exakt der Deckel ist noch erlaubt');

    // 3) Darüber: abgelehnt UND der Zähler bleibt unverändert — ein abgelehnter Upload darf
    //    kein Budget verbrennen, sonst sperrt sich ein Nutzer mit einer zu großen Datei selbst aus
    assert.strictEqual(await b.charge('user_1', 1), false, 'über dem Deckel abgelehnt');
    assert.strictEqual(b.store.get('blob:bytes:user_1'), 10 * MB, 'Buchung wurde zurückgenommen');
    pass++; console.log('✓ abgelehnter Upload verbraucht kein Budget (DECRBY-Rücknahme)');

    // 4) Budget ist pro Nutzer, nicht global
    assert.strictEqual(await b.charge('user_2', 4 * MB), true, 'anderer Nutzer hat eigenes Budget');
    assert.strictEqual(b.store.get('blob:bytes:user_2'), 4 * MB);
    pass++; console.log('✓ Budget ist nutzerbezogen');

    // 5) Das Zeitfenster wird mit NX gesetzt: sonst würde jeder Upload die 30 Tage neu starten
    //    und der Deckel wäre praktisch nie erreichbar (klassischer Fehler bei gleitenden Fenstern)
    const expires = b.calls.filter(c => c[0] === 'EXPIRE');
    assert.ok(expires.length > 0, 'EXPIRE wird gesetzt');
    assert.ok(expires.every(c => c[3] === 'NX'), 'EXPIRE immer mit NX — Fenster nie verlängern');
    assert.ok(expires.every(c => Number(c[2]) === 2592000), 'Fenster = 30 Tage');
    pass++; console.log('✓ Fenster wird nur einmal gesetzt (EXPIRE … NX)');

    // 6) Redis-Ausfall lässt den Upload durch (fail-open, wie das Rate-Limit daneben):
    //    ein Redis-Ausfall darf keinen zahlenden Kunden am Arbeiten hindern
    const bFail = build({ fail: true, budget: 1 });
    assert.strictEqual(await bFail.charge('user_1', 999 * GB), true, 'Redis-Fehler blockiert nicht');
    pass++; console.log('✓ Redis-Ausfall blockiert den Upload nicht (fail-open)');

    // 6b) …meldet den offenen Deckel aber, statt ihn nur ins Log zu schreiben
    assert.strictEqual(bFail.alerts.length, 1, 'genau eine Meldung');
    assert.strictEqual(bFail.alerts[0].event, 'byte-budget-open', 'Ereignis benennt den offenen Deckel');
    pass++; console.log('✓ offener Byte-Deckel wird gemeldet, nicht nur geloggt');

    // 7) Ohne konfiguriertes Redis wird gar nicht gezählt (lokale Entwicklung)
    const bNo = build({ noRedis: true, budget: 1 });
    assert.strictEqual(await bNo.charge('user_1', 999 * GB), true, 'ohne Redis kein Budget');
    assert.strictEqual(bNo.calls.length, 0, 'ohne Redis auch kein Redis-Call');
    pass++; console.log('✓ ohne konfiguriertes Redis wird nicht gezählt');

    // 7b) …und genau das wird gemeldet: fehlende Redis-Env in Produktion heisst, dass
    //     Byte-Budget UND Rate-Limit komplett aus sind, ohne dass es irgendwo auffaellt
    assert.strictEqual(bNo.alerts.length, 1, 'fehlende Redis-Env wird gemeldet');
    assert.strictEqual(bNo.alerts[0].event, 'redis-env-missing');
    pass++; console.log('✓ fehlende Redis-Env wird gemeldet, nicht still uebersprungen');

    // 8) Der Default-Deckel im Code ist plausibel: großzügig für eine Belegverwaltung, aber
    //    klein genug, dass die im Audit genannten ~28 GB/Stunde nicht mehr möglich sind
    const defMatch = src.match(/BLOB_MAX_BYTES \|\| String\(([^)]+)\)/);
    assert.ok(defMatch, 'Default für BLOB_MAX_BYTES nicht gefunden');
    const defBytes = eval(defMatch[1]);            // eslint-disable-line no-eval
    assert.strictEqual(defBytes, 10 * GB, 'Default 10 GB');
    assert.ok(defBytes < 28 * GB, 'kleiner als die im Audit genannte Stundenleistung');
    pass++; console.log('✓ Default-Deckel 10 GB je 30-Tage-Fenster');

    console.log('\n' + pass + '/10 Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
