// ============================================================================
// ServerUmzug — „Umzug in die Stackr-Cloud“ (Schritt R5, plan/server-umbau-2026-10-22.md §3)
// ============================================================================
// Ablauf je Firma (immer die aktive — Store-Protokoll und Anker-Abgleich hängen an ihr):
//   1. api/data.js 'status': Firma auf dem Server und umgezogen? Wenn nicht → Dialog mit
//      Erklärung (lesbar auf dem Server, Anbieter, Zweck) und ausdrücklicher Bestätigung.
//      Ohne Bestätigung kein Upload.
//   2. Datenquelle: lokaler Cache → wenn leer und Cloud-Sync aktiv: erst Cloud-Sync laden
//      lassen (vorhandener CloudSync-Code, Wiederherstellungscode nötig) → sonst Backup-Datei
//      über den vorhandenen Import (App.showBackupModal, auch .enc.json).
//   3. firma_anlegen, dann 'migrate' in Stücken (≤ 200 Ops, ≤ 3,5 MB). Ein schon vorhandener
//      Datensatz mit anderem Inhalt (Umzug abgebrochen und danach weitergearbeitet) geht als
//      'push' mit der Server-Version hinterher — der Browser führt bis R6.
//   4. 'migrate_commit' mit den Protokolleinträgen als Originaltext (JSON.stringify je Eintrag
//      = wortgleich zum gespeicherten Log), in Stücken; dann Abschluss mit der Prüfsumme des
//      Browsers und dem Anker-Abgleich (CloudSync.verifyAuditAnchors). Der Server prüft die
//      Kette aus der Datenbank, vergleicht die Prüfsummen und schreibt erst bei Gleichstand
//      den Eintrag „Datenübernahme aus Browser …“.
//   5. Danach: lokale Daten bleiben als Offline-Kopie, der P1-Spiegel (js/server-store.js)
//      wird für die Firma eingeschaltet.
//
// Annahme: Bis zum Livegang (R9) nur hinter dem Testschalter localStorage
// 'stackr_server_umzug' = '1' (sonst sähen echte Kunden einen Dialog, den Datenschutzerklärung
// und AGB noch nicht tragen). Von Hand: ServerUmzug.dialog().
// Annahme: Ein Kettenbruch hält den Umzug nicht auf, er steht im Protokolleintrag
// (User-Entscheidung 2026-10-28). Anhänge (Base64) gehen inline mit (User 2026-10-28); ein
// einzelner Datensatz über 3,5 MB bricht den Umzug mit Hinweis ab.
// Der Dialogtext ist ein Entwurf — Freigabe mit den Rechtstexten (R8, Anwalt).
// ============================================================================
const ServerUmzug = {
    LS_SCHALTER: 'stackr_server_umzug',
    MAX_OPS:     200,
    MAX_AUDIT:   2000,
    MAX_BYTES:   3.5 * 1024 * 1024,

    _bestaetigt: false,
    _laeuft: false,

    _company() { return (typeof Store !== 'undefined' && Store._companyId) || ''; },
    _esc(s) { return (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'); },

    // Nach dem Start: nur mit Testschalter, nie in der Steuerberater-Ansicht.
    async pruefe() {
        try { if (localStorage.getItem(this.LS_SCHALTER) !== '1') return null; } catch (e) { return null; }
        const company = this._company();
        if (!company || (Store._isReadonlyCompany && Store._isReadonlyCompany())) return null;
        const r = await ServerStore._api({ action: 'status', company });
        if (r.status !== 200) return null;
        if (r.json.firma && r.json.umgezogen_am) {
            if (!ServerStore.aktiv(company)) await ServerStore.spiegelEin(company);
            return r.json;
        }
        this.dialog();
        return r.json;
    },

    // ── Dialog ──────────────────────────────────────────────────────────────
    dialog() {
        const company = this._company();
        const co = (typeof Companies !== 'undefined' && Companies.getAll) ? Companies.getAll().find((c) => c.id === company) : null;
        const z = ServerAbbild.alleZeilen(company, Store._cache);
        const leer = !z.records.length && !z.settings.length;
        this._bestaetigt = false;
        let quelle;
        if (!leer) {
            quelle = '<p style="margin:0;">Gefunden auf diesem Gerät: <strong>' + z.records.length + ' Datensätze</strong>, ' +
                     z.settings.length + ' Einstellungen und ' + this._auditTexte(company).length + ' Protokolleinträge.</p>';
        } else if (this._cloudSyncAktiv()) {
            quelle = '<p style="margin:0;">Auf diesem Gerät liegen noch keine Daten dieser Firma. Lade sie zuerst aus deinem ' +
                     'Cloud-Sync (Wiederherstellungscode nötig) und starte den Umzug danach erneut.</p>' +
                     '<button class="btn btn-outline" data-action="umzug-cloudsync" style="width:100%;margin-top:10px;">Aus Cloud-Sync laden</button>';
        } else {
            quelle = '<p style="margin:0;">Auf diesem Gerät liegen keine Daten dieser Firma. Importiere zuerst deine ' +
                     'Backup-Datei (auch verschlüsselt, .enc.json) und starte den Umzug danach erneut.</p>' +
                     '<button class="btn btn-outline" data-action="umzug-backup" style="width:100%;margin-top:10px;">Backup-Datei importieren</button>';
        }
        const body =
            '<div style="display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.5;">' +
              '<p style="margin:0;">Stackr speichert deine Buchhaltung künftig auf unseren Servern statt nur in diesem Browser. ' +
              'Damit sind deine Daten auf jedem Gerät da, und Festschreibung, Nummernkreise und das GoBD-Protokoll führt der Server.</p>' +
              '<ul style="margin:0;padding-left:18px;color:var(--text-secondary);">' +
                '<li><strong>Lesbar auf dem Server:</strong> Die Daten liegen dort nicht mehr Ende-zu-Ende verschlüsselt, ' +
                    'sondern verschlüsselt gespeichert und für Stackr technisch lesbar — nötig, damit der Server rechnen und prüfen kann.</li>' +
                '<li><strong>Anbieter:</strong> Supabase (Datenbank, Rechenzentrum Frankfurt) und Vercel (Server-Funktionen, Frankfurt) ' +
                    'als Auftragsverarbeiter von Stackr.</li>' +
                '<li><strong>Zweck:</strong> Bereitstellung deiner Buchhaltung, geräteübergreifend, mit Prüfprotokoll.</li>' +
                '<li><strong>Dein Protokoll</strong> wird unverändert übernommen; der Server prüft die Kette und vermerkt die Übernahme.</li>' +
                '<li>Die Daten auf diesem Gerät bleiben als Offline-Kopie erhalten.</li>' +
              '</ul>' +
              '<div style="padding:10px;border:1px solid var(--border);border-radius:8px;">' +
                '<div style="font-weight:600;margin-bottom:4px;">Firma: ' + this._esc(co ? co.name : company) + '</div>' + quelle +
              '</div>' +
              (leer ? '' :
              '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;">' +
                '<input type="checkbox" id="umzugBestaetigung" data-action-change="umzug-bestaetigen" style="margin-top:3px;"> ' +
                '<span>Ich habe die Hinweise gelesen und möchte die Daten dieser Firma jetzt in die Stackr-Cloud übertragen.</span></label>' +
              '<button class="btn btn-primary" id="umzugStart" data-action="umzug-start" disabled style="width:100%;">Umzug starten</button>') +
              '<div id="umzugFortschritt" role="status" aria-live="polite" style="color:var(--text-secondary);"></div>' +
            '</div>';
        App.showModal('Umzug in die Stackr-Cloud', body, '');
    },

    bestaetigen(el) {
        this._bestaetigt = !!(el && el.checked);
        const b = document.getElementById('umzugStart');
        if (b) b.disabled = !this._bestaetigt;
    },

    _fortschritt(text) {
        const el = (typeof document !== 'undefined') && document.getElementById('umzugFortschritt');
        if (el) el.textContent = text;
    },

    _cloudSyncAktiv() {
        try { return localStorage.getItem('oyi_sync_enabled') === '1' && typeof CloudSync !== 'undefined' && CloudSync.hasKey(); }
        catch (e) { return false; }
    },

    // Originaltexte der Browser-Einträge: JSON.stringify je Element des gespeicherten Arrays
    // ergibt genau dessen Ausschnitt im gespeicherten Text (der selbst aus JSON.stringify stammt).
    _auditTexte(company) {
        const roh = Store._cache[company + '__audit_log'];
        if (!roh) return [];
        let log; try { log = JSON.parse(roh); } catch (e) { return []; }
        return Array.isArray(log) ? log.map((e) => JSON.stringify(e)) : [];
    },

    _stuecke(liste, maxAnz, groesse) {
        const out = []; let akt = [], bytes = 0;
        liste.forEach((x) => {
            const b = groesse(x);
            if (akt.length && (akt.length >= maxAnz || bytes + b > this.MAX_BYTES)) { out.push(akt); akt = []; bytes = 0; }
            akt.push(x); bytes += b;
        });
        if (akt.length) out.push(akt);
        return out;
    },

    // ── Umzug ───────────────────────────────────────────────────────────────
    // → { ok, protokoll, pruefsumme } | { ok: false, fehler: [...] }
    async starte() {
        if (!this._bestaetigt) return { ok: false, fehler: ['Bestätigung fehlt'] };
        if (this._laeuft) return { ok: false, fehler: ['Umzug läuft schon'] };
        this._laeuft = true;
        try { return await this._umzug(this._company()); }
        catch (e) { return this._ende({ ok: false, fehler: [(e && e.message) || String(e)] }); }
        finally { this._laeuft = false; }
    },

    async _umzug(company) {
        const api = (b) => ServerStore._api(Object.assign({ company }, b));
        const co = (typeof Companies !== 'undefined' && Companies.getAll) ? Companies.getAll().find((c) => c.id === company) : null;
        const z = ServerAbbild.alleZeilen(company, Store._cache);
        if (z.fehler.length) return this._ende({ ok: false, fehler: z.fehler });

        this._fortschritt('Firma wird angelegt …');
        let r = await api({ action: 'firma_anlegen', name: co ? co.name : '', land: co ? co.land : 'DE' });
        if (r.status !== 200) return this._ende({ ok: false, fehler: ['Firma anlegen: HTTP ' + r.status] });

        const ops = z.records.map((x) => ({ t: 'r', art: x.art, id: x.id, data: x.data }))
            .concat(z.settings.map((x) => ({ t: 's', key: x.key, data: x.data })));
        const groesse = (op) => JSON.stringify(op).length;
        const zuGross = ops.filter((op) => groesse(op) > this.MAX_BYTES);
        if (zuGross.length) {
            return this._ende({ ok: false, fehler: zuGross.map((op) => ServerStore._opKey(op) + ' ist größer als 3,5 MB (Anhang?) und kann so nicht übertragen werden') });
        }
        const versionen = {}, probleme = [];
        const stuecke = this._stuecke(ops, this.MAX_OPS, groesse);
        for (let i = 0; i < stuecke.length; i++) {
            this._fortschritt('Datensätze ' + (i + 1) + ' / ' + stuecke.length + ' …');
            r = await api({ action: 'migrate', ops: stuecke[i] });
            if (r.status !== 200 && r.status !== 409) return this._ende({ ok: false, fehler: ['Übertragen: HTTP ' + r.status] });
            const nachschieben = [];
            (r.json.results || []).forEach((x, k) => {
                const op = stuecke[i][k], ok = ServerStore._opKey(op);
                if (x.status === 'ok' || x.status === 'vorhanden') versionen[ok] = x.version;
                else if (x.status === 'konflikt' && x.version) nachschieben.push(Object.assign({}, op, { version: x.version }));
                else probleme.push(ok + ': ' + (x.status === 'doppelt' ? 'doppelter Shopify-Import (schon als ' + x.id + ')' : (x.status || 'keine Antwort')));
            });
            if (nachschieben.length) {
                const p = await api({ action: 'push', ops: nachschieben });
                ((p.json && p.json.results) || []).forEach((x, k) => {
                    const ok = ServerStore._opKey(nachschieben[k]);
                    if (x.status === 'ok') versionen[ok] = x.version; else probleme.push(ok + ': ' + (x.status || 'HTTP ' + p.status));
                });
            }
        }
        if (probleme.length) return this._ende({ ok: false, fehler: probleme });

        const texte = this._auditTexte(company);
        const teile = this._stuecke(texte, this.MAX_AUDIT, (t) => t.length);
        for (let i = 0; i < teile.length; i++) {
            this._fortschritt('Protokoll ' + (i + 1) + ' / ' + teile.length + ' …');
            r = await api({ action: 'migrate_commit', audit: teile[i] });
            if (r.status !== 200) return this._ende({ ok: false, fehler: ['Protokoll übertragen: HTTP ' + r.status] });
        }

        this._fortschritt('Prüfsummen werden verglichen …');
        const lokal = await ServerStore.lokalePruefsumme(company);
        let anker = null;
        try { if (typeof CloudSync !== 'undefined' && CloudSync.verifyAuditAnchors) anker = await CloudSync.verifyAuditAnchors(); } catch (e) { anker = { enabled: true, error: true }; }
        r = await api({ action: 'migrate_commit', abschluss: true, pruefsumme: lokal.pruefsumme, anker });
        if (r.status === 409) {
            return this._ende({ ok: false, fehler: ['Prüfsumme weicht ab: Browser ' + lokal.pruefsumme.slice(0, 12) + '… (' + lokal.records +
                ' Datensätze), Server ' + String(r.json.server && r.json.server.pruefsumme).slice(0, 12) + '… (' + (r.json.server && r.json.server.records) +
                ' Datensätze). Wurde während des Umzugs etwas geändert? Bitte erneut starten.'] });
        }
        if (r.status !== 200 || (r.json.status !== 'ok' && r.json.status !== 'vorhanden'))
            return this._ende({ ok: false, fehler: ['Abschluss: HTTP ' + r.status] });

        await ServerStore.spiegelEin(company, { versionen });
        return this._ende({ ok: true, protokoll: r.json.protokoll || '', pruefsumme: lokal.pruefsumme, kette: r.json.kette });
    },

    _ende(erg) {
        if (typeof App === 'undefined' || !App.showModal) return erg;
        const body = erg.ok
            ? '<div style="font-size:13px;line-height:1.5;"><p style="margin-top:0;"><strong>Umzug abgeschlossen.</strong> Die Daten dieser Firma liegen jetzt ' +
              'in der Stackr-Cloud; dieses Gerät behält eine Offline-Kopie.</p>' +
              (erg.protokoll ? '<p style="color:var(--text-secondary);word-break:break-word;">Protokoll: ' + this._esc(erg.protokoll) + '</p>' : '') + '</div>'
            : '<div style="font-size:13px;line-height:1.5;"><p style="margin-top:0;"><strong>Umzug nicht abgeschlossen.</strong> Auf dem Server ist noch ' +
              'nichts als übernommen vermerkt; du kannst es erneut versuchen, bereits übertragene Datensätze werden erkannt.</p><ul>' +
              erg.fehler.slice(0, 20).map((f) => '<li>' + this._esc(f) + '</li>').join('') +
              (erg.fehler.length > 20 ? '<li>… und ' + (erg.fehler.length - 20) + ' weitere</li>' : '') + '</ul></div>';
        App.showModal(erg.ok ? 'Umzug abgeschlossen' : 'Umzug nicht abgeschlossen', body, '');
        return erg;
    }
};

if (typeof window !== 'undefined') {
    window.ServerUmzug = ServerUmzug;
    if (window.Actions) Actions.register({
        'umzug-bestaetigen': function () { ServerUmzug.bestaetigen(this); },
        'umzug-start':       function () { ServerUmzug.starte(); },
        'umzug-cloudsync':   function () { if (typeof CloudSync !== 'undefined') CloudSync.syncNow(); },
        'umzug-backup':      function () { App.closeModal(); if (App.showBackupModal) App.showBackupModal(); }
    });
    setTimeout(() => { ServerUmzug.pruefe().catch((e) => console.warn('[ServerUmzug] pruefe:', e && e.message)); }, 4000);
}
if (typeof module !== 'undefined' && module.exports) module.exports = ServerUmzug;
