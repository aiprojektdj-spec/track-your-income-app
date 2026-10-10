// ============================================
// DomainUmzug — Daten von track-your-income-app.vercel.app nach getstackr.de
//
// Buchhaltungsdaten liegen local-first im Browser und haengen am Origin. Der Umzug geht
// Tab zu Tab per postMessage, ohne Server:
//   alte App: "Jetzt umziehen" -> oeffnet NEU/app.html?umzug=1
//   neue App: meldet "bereit" an den Opener (nur an ALT)
//   alte App: schickt BackupCrypto.buildBundle() (nur an NEU)
//   neue App: BackupCrypto.restore() — gleiche Allowlist und gleicher Merge wie der
//             Backup-Import, lokale Daten gewinnen, nichts wird ueberschrieben
// Kein Sync-Schluessel, kein Whop-Token: die Allowlist in backup-crypto.js laesst nur
// Buchhaltungsdaten durch. Plan: plan/domain-umzug-getstackr-2026-10-08.md
// ============================================
var DomainUmzug = (function () {
    'use strict';

    var ALT = 'https://track-your-income-app.vercel.app';
    var NEU = 'https://getstackr.de';
    var LS_UMZUG_AM = 'oyi_umzug_am';          // alte Domain: Datum des letzten Umzugs
    var LS_NEU_FRAGE = 'oyi_umzug_frage_v1';   // neue Domain: "neu oder schon Kunde?" beantwortet
    var TIMEOUT_MS = 30000;

    function _esc(s) { return (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(s)) : String(s); }
    function _ls(k, v) {
        try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
        return null;
    }
    function _datum(iso) {
        try { return new Date(iso).toLocaleDateString('de-DE'); } catch (e) { return ''; }
    }
    function _isPlainObject(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

    // ── Alte Domain: Banner + Senden ──────────────────────────────────────────
    var popup = null;

    function _onMessageAlt(e) {
        if (e.origin !== NEU || !popup || e.source !== popup) return;
        var d = e.data || {};
        if (d.type === 'stackr-umzug-bereit') {
            var bundle = BackupCrypto.buildBundle();
            popup.postMessage({ type: 'stackr-umzug-daten', v: 1, bundle: bundle }, NEU);
        } else if (d.type === 'stackr-umzug-fertig') {
            _ls(LS_UMZUG_AM, new Date().toISOString());
            _renderBanner();
        }
    }

    function starten() {
        popup = window.open(NEU + '/app.html?umzug=1', '_blank');
        if (!popup && typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('Das neue Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben und erneut klicken.', 'warning');
        }
    }

    function _renderBanner() {
        var el = document.getElementById('domainUmzugBanner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'domainUmzugBanner';
            el.setAttribute('role', 'region');
            el.setAttribute('aria-label', 'Neue Adresse');
            el.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;' +
                'padding:10px 16px;border-bottom:1px solid var(--border,#333);background:var(--surface,#111);' +
                'color:var(--text,#eee);font-size:14px;line-height:1.5;';
            document.body.insertBefore(el, document.body.firstChild);
        }
        var am = _ls(LS_UMZUG_AM);
        el.innerHTML = am
            ? '<span>Umgezogen am ' + _esc(_datum(am)) + '. Arbeite ab jetzt unter <strong>getstackr.de</strong> weiter, damit deine Daten nicht auseinanderlaufen.</span>' +
              '<a class="btn btn-primary btn-small" href="' + NEU + '/app.html">Zu getstackr.de</a>' +
              '<button type="button" class="btn btn-small" data-umzug="start">Erneut übertragen</button>'
            : '<span>Stackr hat eine neue Adresse: <strong>getstackr.de</strong>. Nimm deine Daten mit einem Klick mit, hier bleiben sie trotzdem erhalten.</span>' +
              '<button type="button" class="btn btn-primary btn-small" data-umzug="start">Jetzt umziehen</button>' +
              '<span style="font-size:12px;opacity:.8;">Musst du dich dort erst anmelden? Danach hier einfach noch einmal klicken.</span>';
        var btn = el.querySelector('[data-umzug="start"]');
        if (btn) btn.addEventListener('click', starten);
    }

    // ── Neue Domain: Empfangen ────────────────────────────────────────────────
    function _karte(titel, text, knoepfe) {
        var host = document.getElementById('onboarding') || document.body;
        host.innerHTML =
            '<div class="onboarding-overlay"><div class="onboarding-card" style="max-width:480px;">' +
              '<h2 style="text-align:center;">' + _esc(titel) + '</h2>' +
              '<div class="subtitle" style="text-align:center;" id="umzugText">' + text + '</div>' +
              '<div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;">' + (knoepfe || '') + '</div>' +
            '</div></div>';
        return host;
    }
    function _ohneUmzugWeiter(weiter) {
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        var host = document.getElementById('onboarding');
        if (host) host.innerHTML = '';
        weiter();
    }

    function _empfangen(weiter) {
        _karte('Daten übernehmen', 'Warte auf die Daten aus der bisherigen Adresse …', '');
        var fertig = false;
        var timer = setTimeout(function () {
            if (fertig) return;
            window.removeEventListener('message', onMsg);
            _fehler('Es kamen keine Daten an. Geh zurück zum Tab mit der bisherigen Adresse und klick dort noch einmal auf „Jetzt umziehen“.', weiter);
        }, TIMEOUT_MS);

        async function onMsg(e) {
            if (fertig || e.origin !== ALT || e.source !== window.opener) return;
            var d = e.data || {};
            if (d.type !== 'stackr-umzug-daten' || d.v !== 1 || !_isPlainObject(d.bundle)) return;
            fertig = true;
            clearTimeout(timer);
            window.removeEventListener('message', onMsg);
            try {
                await BackupCrypto.restore(d.bundle);
            } catch (err) {
                _fehler('Die Übernahme ist fehlgeschlagen: ' + _esc(err && err.message || err) + ' Deine Daten unter der bisherigen Adresse sind unverändert.', weiter);
                return;
            }
            var firmen = Object.keys(d.bundle).filter(function (k) { return k !== '__account'; }).length;
            try { window.opener.postMessage({ type: 'stackr-umzug-fertig', firmen: firmen }, ALT); } catch (e2) {}
            _karte('Umzug abgeschlossen',
                _esc(firmen) + (firmen === 1 ? ' Firma' : ' Firmen') + ' übernommen. Wer Cloud-Sync nutzt, gibt hier einmal seinen Wiederherstellungscode ein.',
                '<a class="btn btn-primary" style="width:100%;text-align:center;" href="/app.html">Zur App</a>');
        }
        window.addEventListener('message', onMsg);
        window.opener.postMessage({ type: 'stackr-umzug-bereit', v: 1 }, ALT);
    }

    function _fehler(text, weiter) {
        _karte('Umzug nicht abgeschlossen', text,
            '<button type="button" class="btn" id="umzugWeiter" style="width:100%;">Ohne Umzug weiter</button>');
        document.getElementById('umzugWeiter').addEventListener('click', function () { _ohneUmzugWeiter(weiter); });
    }

    // Neue Domain, noch keine Firma: Bestandskunden zur alten Adresse schicken, bevor das
    // Onboarding eine leere Firma anlegt.
    function _frageNeuOderBestand(weiter) {
        _karte('Willkommen bei Stackr',
            'Hast du Stackr bisher unter <strong>track-your-income-app.vercel.app</strong> genutzt? Dann liegen deine Daten noch dort. Melde dich dort an und klick oben auf „Jetzt umziehen“.',
            '<a class="btn btn-primary" style="width:100%;text-align:center;" href="' + ALT + '/app.html" id="umzugZuAlt">Zur bisherigen Adresse</a>' +
            '<button type="button" class="btn" id="umzugNeu" style="width:100%;">Ich bin neu bei Stackr</button>');
        document.getElementById('umzugNeu').addEventListener('click', function () {
            _ls(LS_NEU_FRAGE, '1');
            _ohneUmzugWeiter(weiter);
        });
    }

    // ── Einstieg: von App._continueInit() vor dem Boot aufgerufen ────────────
    // Gibt true zurueck, wenn der Umzug den Bildschirm uebernimmt; weiter() setzt den
    // normalen Boot fort.
    function vorDemStart(weiter) {
        var host = location.hostname;
        if ('https://' + host === ALT) {
            if (typeof BackupCrypto === 'undefined' || !BackupCrypto.buildBundle) return false;
            window.addEventListener('message', _onMessageAlt);
            _renderBanner();
            return false;
        }
        if ('https://' + host !== NEU) return false;
        if (typeof BackupCrypto === 'undefined' || !BackupCrypto.restore) return false;
        var umzug = new URLSearchParams(location.search).get('umzug') === '1';
        if (umzug) {
            if (!window.opener) {
                _fehler('Die Verbindung zur bisherigen Adresse ist durch die Anmeldung abgerissen. Geh zurück zum Tab mit der bisherigen Adresse und klick dort noch einmal auf „Jetzt umziehen“. Du bist jetzt angemeldet, beim zweiten Mal klappt es direkt.', weiter);
                return true;
            }
            _empfangen(weiter);
            return true;
        }
        var ohneFirma = typeof CompanyManager !== 'undefined' && CompanyManager.getAll().length === 0;
        if (ohneFirma && !_ls(LS_NEU_FRAGE)) {
            _frageNeuOderBestand(weiter);
            return true;
        }
        return false;
    }

    return { vorDemStart: vorDemStart, starten: starten, ALT: ALT, NEU: NEU };
})();
if (typeof window !== 'undefined') window.DomainUmzug = DomainUmzug;
if (typeof module !== 'undefined' && module.exports) module.exports = DomainUmzug;
