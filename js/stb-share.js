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

    // ========================================================================
    // Client-Flows (Browser) — Schlüsselverwaltung, Einladung, Mandantenansicht
    // ========================================================================
    var LS_PRIV = 'oyi_stb_privkey', LS_PUB = 'oyi_stb_pubkey', LS_CLIENT = 'oyi_stb_active_client';

    function _uid()   { try { var u = JSON.parse(localStorage.getItem('whop_user') || '{}'); return u.id || u.sub || ''; } catch (e) { return ''; } }
    function _token() { try { return localStorage.getItem('whop_access_token') || ''; } catch (e) { return ''; } }
    function _toast(m, t, d) { if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast(m, t || 'info', d); else console.log('[StbShare]', m); }
    function _esc(s) { return (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(s)) : String(s); }

    async function _api(body) {
        var res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() },
            body: JSON.stringify(body)
        });
        var json = {}; try { json = await res.json(); } catch (e) {}
        return { status: res.status, json: json };
    }

    // Eigenes ECDH-Schlüsselpaar (einmalig erzeugt, lokal gehalten)
    async function _ensureKeys() {
        if (localStorage.getItem(LS_PRIV) && localStorage.getItem(LS_PUB)) return;
        var kp = await genKeyPair();
        localStorage.setItem(LS_PRIV, JSON.stringify(kp.priv));
        localStorage.setItem(LS_PUB,  JSON.stringify(kp.pub));
    }
    function _privJwk() { try { return JSON.parse(localStorage.getItem(LS_PRIV) || 'null'); } catch (e) { return null; } }
    function _pubJwk()  { try { return JSON.parse(localStorage.getItem(LS_PUB)  || 'null'); } catch (e) { return null; } }

    // Beim Login aufrufen: Schlüsselpaar sicherstellen + Public-Key registrieren
    async function registerPubkey() {
        if (!_token() || !_uid()) return;
        try { await _ensureKeys(); await _api({ action: 'register_pubkey', pub: _pubJwk() }); }
        catch (e) { console.warn('[StbShare] registerPubkey:', e && e.message); }
    }

    // ── Read-Only-Zustand (aktive Firma ist eine Mandanten-Firma) ─────────────
    function _companies() { try { return JSON.parse(localStorage.getItem('oyi_companies') || '[]'); } catch (e) { return []; } }
    function isReadonly() {
        var active = localStorage.getItem('oyi_active_company'); if (!active) return false;
        var c = _companies().filter(function (x) { return x && x.id === active; })[0];
        return !!(c && c._readonly);
    }
    // Schreib-Aktionen im Read-Only-Modus blocken (zentraler Chokepoint in js/actions.js).
    // Server erzwingt read-only bereits hart; das hier ist die UX-Sperre.
    var WRITE_RE  = /(^|-)(save|add|new|create|edit|update|delete|del|remove|storno|cancel|import|submit|confirm|apply|pay|book|buchen|anlegen|speichern|loeschen|erstellen|aendern|finish|enable|disable|generate|send|upload)(-|$)/i;
    var ALLOW_SET = { 'stb-exit': 1, 'close-modal': 1, 'navigate': 1, 'reload': 1, 'stop': 1, 'goto': 1, 'print-page': 1 };
    function blocks(name) { return isReadonly() && !ALLOW_SET[name] && WRITE_RE.test(name); }

    // ── UI: eigener Freigabe-Code ─────────────────────────────────────────────
    function _noApp() { if (typeof App === 'undefined' || !App.showModal) { _toast('Bitte im Haupt-Dashboard öffnen.', 'info'); return true; } return false; }
    function showCode() {
        if (_noApp()) return;
        var code = _uid();
        if (!code) { _toast('Bitte zuerst mit Whop anmelden.', 'warning'); return; }
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">Gib diesen <strong>Freigabe-Code</strong> deinem Mandanten. Er trägt ihn bei „Steuerberater einladen" ein und gibt dir damit <strong>Nur-Lese-Zugriff</strong> auf seine Daten.</div>' +
            '<div style="font-family:monospace;font-size:15px;word-break:break-all;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center;">' + _esc(code) + '</div>' +
            '<button class="btn btn-outline" data-action="stb-copy-code" data-args="' + _esc(JSON.stringify([code])).replace(/"/g, '&quot;') + '" style="width:100%;">📋 Code kopieren</button>' +
          '</div>';
        App.showModal('Mein Steuerberater-Freigabe-Code', body, '');
    }
    function copyCode(code) {
        try { navigator.clipboard.writeText(code); _toast('Code kopiert', 'success'); }
        catch (e) { _toast('Kopieren nicht möglich.', 'warning'); }
    }

    // ── UI: Steuerberater einladen (Owner) ────────────────────────────────────
    function inviteFlow() {
        if (_noApp()) return;
        if (typeof CloudSync === 'undefined' || !CloudSync.keyBytes || !CloudSync.keyBytes()) {
            _toast('Aktiviere zuerst Cloud-Sync — nur dann liegen deine Daten (verschlüsselt) bereit, damit dein Steuerberater sie sehen kann.', 'warning', 6000);
            return;
        }
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">Dein Steuerberater meldet sich einmal in Stackr an und nennt dir seinen <strong>Freigabe-Code</strong>. Trage ihn hier ein — er bekommt dann <strong>Nur-Lese-Zugriff</strong> auf deine Buchhaltung. Du kannst den Zugriff jederzeit entziehen.</div>' +
            '<input type="text" id="stbInviteCode" class="form-input" placeholder="Freigabe-Code des Steuerberaters" autocomplete="off" style="font-family:monospace;">' +
            '<button class="btn btn-primary" data-action="stb-do-invite" style="width:100%;">Zugriff freigeben</button>' +
          '</div>';
        App.showModal('Steuerberater einladen', body, '');
    }
    async function _doInvite() {
        var el = document.getElementById('stbInviteCode');
        var code = (el ? el.value : '').trim();
        if (!code) { _toast('Bitte den Freigabe-Code eingeben.', 'warning'); return; }
        if (code === _uid()) { _toast('Das ist dein eigener Code.', 'warning'); return; }
        var kb = CloudSync.keyBytes();
        if (!kb) { _toast('Cloud-Sync nicht aktiv.', 'warning'); return; }
        try {
            var pk = await _api({ action: 'get_pubkey', granteeId: code });
            if (pk.status === 404) { _toast('Kein Steuerberater mit diesem Code gefunden — er muss sich zuerst einmal in Stackr anmelden.', 'error', 6000); return; }
            if (pk.status !== 200 || !pk.json.pubkey) { _toast('Abruf fehlgeschlagen (' + pk.status + ').', 'error'); return; }
            var env = await wrapKey(kb, pk.json.pubkey.pub);
            var g = await _api({ action: 'grant', granteeId: code, envelope: env });
            if (g.status !== 200) { _toast('Freigabe fehlgeschlagen (' + g.status + ').', 'error'); return; }
            App.closeModal();
            _toast('✅ Steuerberater eingeladen — er sieht deine Daten jetzt read-only.', 'success', 5000);
        } catch (e) { console.error('[StbShare] invite', e); _toast('Freigabe fehlgeschlagen.', 'error'); }
    }

    // Reiner Grant-Abruf ohne UI (Unterschied zu clientsFlow, das direkt ein Modal öffnet) —
    // fürs Login-Gate: ein StB ohne eigenes Abo braucht nur die Info "hat er Grants ja/nein".
    async function checkGrants() {
        try { var r = await _api({ action: 'list_grants' }); return (r.status === 200 && r.json.grants) || []; }
        catch (e) { return []; }
    }

    // ── UI: Mandanten (StB-Seite) ─────────────────────────────────────────────
    async function clientsFlow() {
        if (_noApp()) return;
        var r = await _api({ action: 'list_grants' });
        if (r.status !== 200) { _toast('Abruf fehlgeschlagen (' + r.status + ').', 'error'); return; }
        var grants = r.json.grants || [];
        var inClient = localStorage.getItem(LS_CLIENT);
        if (!grants.length && !inClient) { _toast('Dir wurde noch kein Mandant freigegeben. Gib deinem Mandanten deinen Freigabe-Code.', 'info', 6000); return; }
        var rows = grants.map(function (g) {
            return '<button class="btn btn-outline" data-action="stb-enter" data-args="' + _esc(JSON.stringify([g.ownerId])).replace(/"/g, '&quot;') + '" style="width:100%;text-align:left;">📂 ' + _esc(g.ownerName || g.ownerId) + '</button>';
        }).join('');
        var body =
          '<div style="display:flex;flex-direction:column;gap:10px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">Wähle einen Mandanten, um seine Buchhaltung <strong>read-only</strong> zu öffnen.</div>' +
            rows +
            (inClient ? '<button class="btn" data-action="stb-exit" style="width:100%;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);">Zurück zu meinen eigenen Daten</button>' : '') +
          '</div>';
        App.showModal('Mandanten (Steuerberater)', body, '');
    }
    async function enterClient(ownerId) {
        try {
            var r = await _api({ action: 'list_grants' });
            var g = (r.json.grants || []).filter(function (x) { return x.ownerId === ownerId; })[0];
            if (!g) { _toast('Freigabe nicht gefunden.', 'error'); return; }
            var priv = _privJwk();
            if (!priv) { _toast('Kein lokaler Schlüssel — bitte neu anmelden.', 'error'); return; }
            var kb = await unwrapKey(g.envelope, priv);
            _toast('Lade Mandantendaten…', 'info');
            var cos = await CloudSync.foreignLoad(ownerId, new Uint8Array(kb));
            if (!cos.length) { _toast('Keine Daten dieses Mandanten gefunden.', 'warning'); return; }
            localStorage.setItem(LS_CLIENT, ownerId);
            localStorage.setItem('oyi_active_company', cos[0].id);
            location.reload();
        } catch (e) { console.error('[StbShare] enterClient', e); _toast('Mandantenansicht fehlgeschlagen: ' + (e && e.message || e), 'error', 6000); }
    }
    function exitClient() {
        try { if (typeof CloudSync !== 'undefined' && CloudSync.foreignUnload) CloudSync.foreignUnload(); } catch (e) {}
        localStorage.removeItem(LS_CLIENT);
        var own = _companies().filter(function (c) { return c && !c._readonly; })[0];
        if (own) localStorage.setItem('oyi_active_company', own.id); else localStorage.removeItem('oyi_active_company');
        location.reload();
    }

    // ── UI: erteilte Freigaben verwalten (Owner entzieht Zugriff) ─────────────
    async function manageFlow() {
        if (_noApp()) return;
        var r = await _api({ action: 'list_my_grantees' });
        if (r.status !== 200) { _toast('Abruf fehlgeschlagen (' + r.status + ').', 'error'); return; }
        var grantees = r.json.grantees || [];
        if (!grantees.length) { _toast('Du hast noch keinem Steuerberater Zugriff gewährt.', 'info'); return; }
        var rows = grantees.map(function (g) {
            var date = g.createdAt ? new Date(g.createdAt).toLocaleDateString('de-DE') : '';
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">' +
                '<div><div style="font-family:monospace;font-size:12px;word-break:break-all;">' + _esc(g.granteeId) + '</div>' +
                (date ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">seit ' + _esc(date) + '</div>' : '') + '</div>' +
                '<button class="btn btn-outline" style="color:var(--danger);border-color:rgba(239,68,68,.3);white-space:nowrap;flex-shrink:0;" data-action="stb-do-revoke" data-args="' + _esc(JSON.stringify([g.granteeId])).replace(/"/g, '&quot;') + '">Entziehen</button>' +
            '</div>';
        }).join('');
        var body =
          '<div style="display:flex;flex-direction:column;gap:4px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">Steuerberater mit Nur-Lese-Zugriff auf deine Buchhaltung.</div>' +
            rows +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:12px;line-height:1.5;">Hinweis: Entzogener Zugriff gilt für künftige Abrufe. Bereits geladene Snapshots kann ein Steuerberater mit seinem alten Schlüssel theoretisch weiter lesen, bis du deine Daten neu verschlüsselst.</div>' +
          '</div>';
        App.showModal('Freigaben verwalten', body, '');
    }
    async function _doRevoke(granteeId) {
        try {
            var r = await _api({ action: 'revoke', granteeId: granteeId });
            if (r.status !== 200) { _toast('Entziehen fehlgeschlagen (' + r.status + ').', 'error'); return; }
            _toast('Zugriff entzogen.', 'success');
            manageFlow();
        } catch (e) { console.error('[StbShare] revoke', e); _toast('Entziehen fehlgeschlagen.', 'error'); }
    }

    // ── Read-Only-Banner (beim Laden, wenn Mandantenansicht aktiv) ────────────
    function initReadonlyBanner() {
        if (!isReadonly() || document.getElementById('stbRoBanner')) return;
        document.body.classList.add('stb-readonly');
        var active = localStorage.getItem('oyi_active_company');
        var c = _companies().filter(function (x) { return x && x.id === active; })[0];
        var name = c ? (c.name || c.firmenname || 'Mandant') : 'Mandant';
        var bar = document.createElement('div');
        bar.id = 'stbRoBanner';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;background:#f59e0b;color:#111;font-size:13px;font-weight:600;padding:6px 14px;display:flex;align-items:center;justify-content:center;gap:14px;';
        bar.innerHTML = '🔒 Nur-Lese-Ansicht — Mandant: ' + _esc(name) +
            ' <button data-action="stb-exit" style="background:#111;color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;">Zurück zu meinen Daten</button>';
        document.body.appendChild(bar);
        // Schreib-Button-Ausblendung + padding-top liegen in css/style.css
        // (.stb-readonly …) — injiziertes <style> würde von der CSP geblockt.
    }

    return {
        genKeyPair: genKeyPair,
        wrapKey:    wrapKey,
        unwrapKey:  unwrapKey,
        registerPubkey: registerPubkey,
        checkGrants: checkGrants,
        isReadonly: isReadonly,
        blocks: blocks,
        showCode: showCode,
        inviteFlow: inviteFlow,
        clientsFlow: clientsFlow,
        enterClient: enterClient,
        exitClient: exitClient,
        manageFlow: manageFlow,
        initReadonlyBanner: initReadonlyBanner,
        _doInvite: _doInvite,
        _doRevoke: _doRevoke,
        _b64: _b64, _unb64: _unb64,
        _test: { genKeyPair: genKeyPair, wrapKey: wrapKey, unwrapKey: unwrapKey }
    };
})();

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (typeof window !== 'undefined' && window.Actions) Actions.register({
    'stb-my-code':   function () { StbShare.showCode(); },
    'stb-copy-code': function (code) { try { navigator.clipboard.writeText(code); if (typeof Utils !== 'undefined') Utils.showToast('Code kopiert', 'success'); } catch (e) {} },
    'stb-invite':    function () { StbShare.inviteFlow(); },
    'stb-do-invite': function () { StbShare._doInvite ? StbShare._doInvite() : 0; },
    'stb-clients':   function () { StbShare.clientsFlow(); },
    'stb-enter':     function (ownerId) { StbShare.enterClient(ownerId); },
    'stb-exit':      function () { StbShare.exitClient(); },
    'stb-manage':    function () { StbShare.manageFlow(); },
    'stb-do-revoke': function (granteeId) { StbShare._doRevoke ? StbShare._doRevoke(granteeId) : 0; }
});
if (typeof window !== 'undefined') window.StbShare = StbShare;
if (typeof module !== 'undefined' && module.exports) module.exports = StbShare;
