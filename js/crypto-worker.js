// ============================================================================
// crypto-worker.js — Sync-Krypto abseits des Main-Threads (Fund F6)
// ============================================================================
// WARUM ES DIESEN WORKER GIBT — und warum er mehr macht als nur AES-GCM:
//
// Das Performance-Audit vermutete, AES-GCM sei der Haenger. Gemessen (Edge/Chromium,
// Median aus 5 Laeufen nach 2 Warmlaeufen, 2026-08-18) stimmt das so nicht:
//
//   Artikel | Klartext | stringify | encode | AES-GCM | base64 | gesamt | Krypto
//    2.000  |  1,05 MB |    3,3 ms |  6,8ms |  4,3 ms | 2,6 ms |  17 ms |  25 %
//    8.000  |  4,21 MB |   13,6 ms | 23,3ms |  8,9 ms | 3,0 ms |  49 ms |  18 %
//   20.000  | 10,55 MB |   52,5 ms | 75,3ms | 47,7 ms |15,9 ms | 191 ms |  25 %
//
// AES-GCM ist also nur rund ein Viertel der Kette. Wer NUR die Verschluesselung
// auslagert, verschiebt ein Viertel und laesst drei Viertel liegen.
//
// A/B gegen den heutigen Pfad, 20.000 Artikel / 10,55 MB Klartext, Median aus 4 Laeufen
// nach 2 Warmlaeufen (Edge/Chromium, Desktop, 2026-08-18):
//
//   heute (alles im Main-Thread) : 143,8 ms blockiert
//   mit diesem Worker            :  54,3 ms blockiert   -> 62 % weniger
//
// Die verbleibenden ~54 ms sind JSON.stringify plus postMessage. Beides laesst sich nicht
// verschieben: der String muss dort entstehen, wo die Daten liegen. Auf schwachen Geraeten
// skalieren beide Saeulen mit, der absolute Gewinn waechst also.
//
// Deshalb der Zuschnitt hier: der Aufrufer macht ausschliesslich JSON.stringify
// (der String muss ohnehin im Main-Thread entstehen, dort liegen die Daten) und
// schickt den STRING herueber. Alles danach — TextEncoder, AES-GCM, base64 —
// laeuft in diesem Worker. Das sind nach obiger Messung rund 70 % der Blockierzeit.
//
// Den Schluessel bekommt der Worker als CryptoKey, nicht als Rohbytes: CryptoKey ist
// strukturiert klonbar und bleibt dabei nicht-extrahierbar. Der Worker kann damit
// ver- und entschluesseln, die Bytes sieht er nie (Fund R5 bleibt gewahrt).
//
// Fehler werden als { ok:false, error } zurueckgemeldet, NICHT geworfen: der Aufrufer
// unterscheidet anhand der Meldung weiter zwischen "Schluessel passt nicht" und
// "Chiffrat nicht ladbar" (_classifyDecryptError in js/cloud-sync.js). Diese
// Unterscheidung darf der Worker nicht einebnen.

/* global self */
'use strict';

function b64(bytes) {
    if (typeof bytes.toBase64 === 'function') return bytes.toBase64();   // nativ, wo vorhanden
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return self.btoa(s);
}

function unb64(str) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(str);
    var bin = self.atob(str), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
}

// aad kommt als fertiges Uint8Array vom Aufrufer — die Zusammensetzung
// (ownerId|scope|version) bleibt bewusst in cloud-sync.js, damit es genau eine
// Stelle gibt, die das Format kennt.
async function doEncrypt(msg) {
    var pt = new TextEncoder().encode(msg.json);
    var iv = self.crypto.getRandomValues(new Uint8Array(12));
    var params = { name: 'AES-GCM', iv: iv };
    if (msg.aad) params.additionalData = msg.aad;
    var ct = await self.crypto.subtle.encrypt(params, msg.key, pt);
    return { ct: b64(new Uint8Array(ct)), iv: b64(iv) };
}

// Liefert den KLARTEXT-STRING zurueck, nicht das geparste Objekt: JSON.parse gehoert
// zum Aufrufer, sonst wandert das Ergebnis als grosser Objektgraph durch den
// strukturierten Klon — und der kostet ungefaehr so viel wie das Parsen selbst.
async function doDecrypt(msg) {
    var ct = (typeof msg.ct === 'string') ? unb64(msg.ct) : msg.ct;
    var iv = (typeof msg.iv === 'string') ? unb64(msg.iv) : msg.iv;
    var pt;
    try {
        var params = { name: 'AES-GCM', iv: iv };
        if (msg.aad) params.additionalData = msg.aad;
        pt = await self.crypto.subtle.decrypt(params, msg.key, ct);
    } catch (e) {
        // Migrations-Fallback fuer Chiffrat von vor der AAD-Einfuehrung. Ob er ueberhaupt
        // erlaubt ist, entscheidet der Aufrufer per allowNoAad (Ablaufdatum, Fund R7) —
        // der Worker kennt das Datum nicht und soll es auch nicht kennen.
        if (!msg.allowNoAad) throw e;
        pt = await self.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, msg.key, ct);
    }
    return { json: new TextDecoder().decode(pt) };
}

self.onmessage = async function (ev) {
    var msg = ev.data || {};
    try {
        var res;
        if (msg.op === 'encrypt')      res = await doEncrypt(msg);
        else if (msg.op === 'decrypt') res = await doDecrypt(msg);
        else throw new Error('unknown_op');
        res.ok = true;
        res.id = msg.id;
        self.postMessage(res);
    } catch (e) {
        self.postMessage({ ok: false, id: msg.id, error: (e && e.message) || String(e) });
    }
};
