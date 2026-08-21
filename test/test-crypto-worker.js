// ============================================================================
// test-crypto-worker.js — js/crypto-worker.js (Fund F6)
// ============================================================================
// Der Worker laeuft im Browser, seine Logik ist aber reines WebCrypto und laesst sich
// in Node pruefen, indem `self` geschimmt wird. Geprueft wird das, was beim Auslagern
// kaputtgehen KANN:
//   - Rundlauf encrypt -> decrypt
//   - Byte-Kompatibilitaet mit dem Main-Thread-Pfad aus js/cloud-sync.js (sonst waeren
//     bestehende Chiffrate nach dem Umstieg unlesbar)
//   - AAD-Bindung an (ownerId, scope) bleibt wirksam
//   - der AAD-Migrations-Fallback greift NUR mit allowNoAad (Fund R7: das Ablaufdatum
//     gehoert in den Aufrufer, nicht in den Worker)
//   - Fehler kommen als { ok:false, error } zurueck statt zu werfen

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');

let passed = 0;
function ok(bedingung, name) {
    assert.ok(bedingung, name);
    passed++;
}

// ── Worker in einer self-Umgebung laden ─────────────────────────────────────
const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'crypto-worker.js'), 'utf8');
const selfObj = {
    crypto: globalThis.crypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    postMessage: null,
    onmessage: null,
};
const sandbox = { self: selfObj, TextEncoder, TextDecoder, Uint8Array, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(quelle, sandbox);
ok(typeof selfObj.onmessage === 'function', 'Worker registriert einen onmessage-Handler');

// Einen Worker-Aufruf nachstellen
function ruf(msg) {
    return new Promise((resolve) => {
        selfObj.postMessage = resolve;
        selfObj.onmessage({ data: Object.assign({ id: 'x' }, msg) });
    });
}

const AAD = (owner, scope) => new TextEncoder().encode(owner + '|' + scope + '|sync-v1');

(async () => {
    const rohBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const key = await globalThis.crypto.subtle.importKey(
        'raw', rohBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    ok(key.extractable === false, 'Schluessel ist nicht-extrahierbar (Fund R5 bleibt gewahrt)');

    const daten = { purchases: [{ id: 'p1', marke: 'Nike', einkaufspreis: 79.9 }], meta: { v: 1 } };
    const json  = JSON.stringify(daten);
    const aad   = AAD('user_a', 'firma1');

    // 1) Rundlauf
    const enc = await ruf({ op: 'encrypt', json, key, aad });
    ok(enc.ok === true, 'encrypt meldet Erfolg');
    ok(typeof enc.ct === 'string' && typeof enc.iv === 'string', 'encrypt liefert ct und iv als base64');
    const dec = await ruf({ op: 'decrypt', ct: enc.ct, iv: enc.iv, key, aad });
    ok(dec.ok === true && dec.json === json, 'decrypt stellt den Klartext wieder her');

    // 2) Byte-Kompatibilitaet mit dem bestehenden Main-Thread-Pfad
    const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
    const ptMain = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unb64(enc.iv), additionalData: aad }, key, unb64(enc.ct));
    ok(new TextDecoder().decode(ptMain) === json,
       'Worker-Chiffrat ist mit dem Main-Thread-Pfad entschluesselbar (kein Datenbruch beim Umstieg)');

    // 3) AAD bindet an (ownerId, scope)
    const fremd = await ruf({ op: 'decrypt', ct: enc.ct, iv: enc.iv, key, aad: AAD('user_a', 'firma2') });
    ok(fremd.ok === false, 'falscher Scope im AAD wird abgewiesen');
    const fremderOwner = await ruf({ op: 'decrypt', ct: enc.ct, iv: enc.iv, key, aad: AAD('user_b', 'firma1') });
    ok(fremderOwner.ok === false, 'fremder Owner im AAD wird abgewiesen');

    // 4) Migrations-Fallback nur mit ausdruecklicher Erlaubnis
    const altChiffrat = await ruf({ op: 'encrypt', json, key });          // ohne AAD, wie vor 2026-08-09
    const ohneErlaubnis = await ruf({ op: 'decrypt', ct: altChiffrat.ct, iv: altChiffrat.iv, key, aad });
    ok(ohneErlaubnis.ok === false, 'Alt-Chiffrat ohne AAD wird ohne allowNoAad abgewiesen');
    const mitErlaubnis = await ruf({ op: 'decrypt', ct: altChiffrat.ct, iv: altChiffrat.iv, key, aad, allowNoAad: true });
    ok(mitErlaubnis.ok === true && mitErlaubnis.json === json, 'mit allowNoAad greift der Migrations-Fallback');

    // 5) Fehler werden gemeldet, nicht geworfen
    const unbekannt = await ruf({ op: 'quatsch' });
    ok(unbekannt.ok === false && unbekannt.error === 'unknown_op', 'unbekannte Operation meldet unknown_op');
    const kaputt = await ruf({ op: 'decrypt', ct: 'AAAA', iv: enc.iv, key, aad });
    ok(kaputt.ok === false && typeof kaputt.error === 'string', 'defektes Chiffrat meldet einen Fehler statt zu werfen');

    // 6) Antwort traegt die id des Aufrufs (Zuordnung bei parallelen Anfragen)
    ok(enc.id === 'x', 'Antwort traegt die id der Anfrage');

    console.log('test-crypto-worker: ' + passed + ' Pruefungen bestanden');
})().catch((e) => { console.error(e); process.exit(1); });
