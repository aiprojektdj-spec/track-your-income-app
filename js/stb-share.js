// ============================================================================
// StbShare — Envelope-Key-Freigabe für Steuerberater-Read-Only-Zugriff
// ============================================================================
// PROBLEM: Cloud-Sync ist echtes E2E (js/cloud-sync.js) — der 256-bit-Datenschlüssel
//   liegt nur lokal, der Server sieht nur Chiffrat, und Daten liegen server-seitig
//   unter sync:<ownerId>:<scope>. Ein zweiter Whop-Account (Steuerberater) hat eine
//   ANDERE userId → kann die Daten weder abrufen noch entschlüsseln.
//
// LÖSUNG (Envelope-Key, ECDH P-256):
//   1. Jeder Account erzeugt ein ECDH-Schlüsselpaar. Private-Key bleibt lokal,
//      Public-Key wird server-seitig registriert (kein Geheimnis).
//   2. Einladung: der StB nennt dem Mandanten seinen Freigabe-Code (= seine userId).
//      Der Mandant holt den Public-Key des StB, verpackt seinen Datenschlüssel per
//      ephemeralem ECDH darin (Envelope) und legt ihn als "grant" auf dem Server ab.
//   3. Der StB liest die Grants, entpackt mit seinem Private-Key den Datenschlüssel
//      und kann die (read-only) gepullten Scopes des Mandanten entschlüsseln.
//
// Read-only ist damit ZWEIFACH abgesichert: server-seitig kann der StB-Token nie in
// sync:<ownerId>:<scope> schreiben (nur der Owner-Token), und die UI blendet Schreib-
// Aktionen aus. Der StB hat lesenden Vollzugriff (gewollt — er sieht die Bücher).
//
// STATUS: Phase 1 (dieses File) = reiner Krypto-Kern, node-getestet (test-stb-share.js).
//   Phase 2 = Server-Endpoints in api/sync.js (register_pubkey/get_pubkey/grant/
//   list_grants/revoke + pull mit owner-Param & Grant-Check). Phase 3 = UI
//   (Einladungs-Dialog beim Owner, Freigabe-Code beim StB, Read-Only-Modus + zentrale
//   Schreib-Sperre). Siehe plan/spec-offline-grace-stb-readonly.md.
// ============================================================================
var StbShare = (function () {
    'use strict';

    // WebCrypto in Browser UND Node (Node ≥18: globalThis.crypto; Fallback require)
    var _wc = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto
            : (typeof require !== 'undefined' ? require('crypto').webcrypto : null);
    var subtle = _wc ? _wc.subtle : null;

    var EC = { name: 'ECDH', namedCurve: 'P-256' };

    // ── Base64 (chunked) ──────────────────────────────────────────────────────
    function _b64(bytes) {
        var s = '', CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return btoa(s);
    }
    function _unb64(str) {
        var bin = atob(str), b = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return b;
    }

    // ── Schlüsselpaar erzeugen → { pub, priv } als JWK ────────────────────────
    async function genKeyPair() {
        var kp = await subtle.generateKey(EC, true, ['deriveBits']);
        return {
            pub:  await subtle.exportKey('jwk', kp.publicKey),
            priv: await subtle.exportKey('jwk', kp.privateKey)
        };
    }

    // ── Gemeinsamen AES-GCM-Schlüssel aus eigenem Private + fremdem Public ─────
    async function _sharedKey(privJwk, pubJwk) {
        var priv = await subtle.importKey('jwk', privJwk, EC, false, ['deriveBits']);
        var pub  = await subtle.importKey('jwk', pubJwk,  EC, false, []);
        var bits = await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
        return subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    // ── Datenschlüssel (32 Byte) für einen Empfänger-Public-Key verpacken ─────
    // Ephemerales ECDH → forward secrecy: jeder Envelope nutzt ein frisches Paar.
    async function wrapKey(dataKeyBytes, granteePubJwk) {
        var eph     = await subtle.generateKey(EC, true, ['deriveBits']);
        var ephPub  = await subtle.exportKey('jwk', eph.publicKey);
        var ephPriv = await subtle.exportKey('jwk', eph.privateKey);
        var aes     = await _sharedKey(ephPriv, granteePubJwk);
        var iv      = _wc.getRandomValues(new Uint8Array(12));
        var ct      = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, aes, dataKeyBytes);
        return { ephPub: ephPub, iv: _b64(iv), ct: _b64(new Uint8Array(ct)) };
    }

    // ── Envelope mit eigenem Private-Key entpacken → Datenschlüssel (32 Byte) ──
    async function unwrapKey(envelope, granteePrivJwk) {
        var aes = await _sharedKey(granteePrivJwk, envelope.ephPub);
        var pt  = await subtle.decrypt({ name: 'AES-GCM', iv: _unb64(envelope.iv) }, aes, _unb64(envelope.ct));
        return new Uint8Array(pt);
    }

    return {
        genKeyPair: genKeyPair,
        wrapKey:    wrapKey,
        unwrapKey:  unwrapKey,
        _b64: _b64, _unb64: _unb64,
        _test: { genKeyPair: genKeyPair, wrapKey: wrapKey, unwrapKey: unwrapKey }
    };
})();
if (typeof window !== 'undefined') window.StbShare = StbShare;
if (typeof module !== 'undefined' && module.exports) module.exports = StbShare;
