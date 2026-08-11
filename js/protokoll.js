// ============================================
// Protokoll Module - Audit Log Viewer (GoBD)
// ============================================
const Protokoll = {
    _filterAction: '',
    _filterEntity: '',
    _filterVon: '',
    _filterBis: '',

    // ========================================================================
    // Datenträgerüberlassung "Z3" für die Betriebsprüfung (Fund T2, §147 Abs. 6 AO)
    // ========================================================================
    // §147 Abs. 6 AO gibt dem Prüfer das Recht, die steuerrelevanten Daten in einem
    // maschinell auswertbaren Format zu VERLANGEN — in der Praxis der GDPdU-/IDEA-Export:
    // ein Verzeichnis mit index.xml (Beschreibungsdatei) und je Tabelle eine CSV-Datei.
    // Suche nach gdpdu/index.xml/Z1/Z2/Z3 im Projekt ergab vorher null Treffer; der Prüfer
    // hätte mit den vorhandenen Exporten (PDF, Excel, JSON) nicht arbeiten können.
    //
    // Ohne ZIP-Bibliothek im Projekt werden die Dateien EINZELN ausgeliefert, mit der
    // Anweisung, sie in einen Ordner zu legen. Das ist genau die Struktur, die die
    // Prüfsoftware erwartet (index.xml neben den Datendateien) — nur eben ohne Archiv.
    //
    // Bewusst enthalten: die Grundaufzeichnungen (Einkäufe, Verkäufe, Ausgaben,
    // Kassenbuch, Rechnungen) und das Änderungsprotokoll mit der Hash-Kette. Letzteres
    // gehört dazu, weil es die Unveränderbarkeit nach GoBD Rz. 64 belegt.
    _Z3_TABLES: [
        {
            file: 'einkaeufe.csv', name: 'Einkaeufe', desc: 'Wareneinkäufe (Grundaufzeichnung)',
            get: () => Store.getAllPurchasesRaw(),
            cols: [
                ['id', 'Datensatz-ID', 'a'], ['datum', 'Belegdatum', 'd'], ['marke', 'Marke', 'a'],
                ['artikeltyp', 'Artikeltyp', 'a'], ['beschreibung', 'Bezeichnung', 'a'],
                ['einkaufspreis', 'Einkaufspreis (EUR)', 'n'], ['anzahl', 'Menge', 'n'],
                ['einkaufsquelle', 'Lieferant/Quelle', 'a'], ['belegNr', 'Belegnummer', 'a'],
                ['storniert', 'Storniert', 'a'], ['notizen', 'Bemerkung', 'a']
            ]
        },
        {
            file: 'verkaeufe.csv', name: 'Verkaeufe', desc: 'Warenverkäufe (Grundaufzeichnung)',
            get: () => Store.getAllSalesRaw(),
            cols: [
                ['id', 'Datensatz-ID', 'a'], ['datum', 'Belegdatum', 'd'], ['beschreibung', 'Bezeichnung', 'a'],
                ['verkaufspreis', 'Verkaufspreis (EUR)', 'n'], ['versandKaeufer', 'Versand Käufer (EUR)', 'n'],
                ['plattformgebuehr', 'Plattformgebühr (%)', 'n'], ['versandVerkaeufer', 'Versandkosten (EUR)', 'n'],
                ['verkaufsplattform', 'Verkaufsplattform', 'a'], ['kaeufer', 'Käufer', 'a'],
                ['belegNr', 'Belegnummer', 'a'], ['storniert', 'Storniert', 'a'], ['notizen', 'Bemerkung', 'a']
            ]
        },
        {
            file: 'ausgaben.csv', name: 'Ausgaben', desc: 'Betriebsausgaben (Grundaufzeichnung)',
            get: () => Store.getAllExpensesRaw(),
            cols: [
                ['id', 'Datensatz-ID', 'a'], ['datum', 'Belegdatum', 'd'], ['kategorie', 'Kategorie', 'a'],
                ['beschreibung', 'Bezeichnung', 'a'], ['betrag', 'Betrag (EUR)', 'n'],
                ['ustSatz', 'USt-Satz', 'a'], ['belegNr', 'Belegnummer', 'a'],
                ['storniert', 'Storniert', 'a'], ['notizen', 'Bemerkung', 'a']
            ]
        },
        {
            file: 'kassenbuch.csv', name: 'Kassenbuch', desc: 'Kassenbuch (Bareinnahmen/-ausgaben)',
            get: () => (Store.getKassenbuch ? Store.getKassenbuch() : []),
            cols: [
                ['id', 'Datensatz-ID', 'a'], ['datum', 'Belegdatum', 'd'], ['art', 'Art', 'a'],
                ['beschreibung', 'Bezeichnung', 'a'], ['betrag', 'Betrag (EUR)', 'n'],
                ['bestandNach', 'Kassenbestand nach Buchung (EUR)', 'n'],
                ['belegNr', 'Belegnummer', 'a'], ['storniert', 'Storniert', 'a']
            ]
        },
        {
            file: 'rechnungen.csv', name: 'Rechnungen', desc: 'Ausgangsrechnungen (Rechnungsbuch)',
            get: () => (Store.getInvoices ? Store.getInvoices() : []),
            cols: [
                ['id', 'Datensatz-ID', 'a'], ['nummer', 'Rechnungsnummer', 'a'], ['datum', 'Rechnungsdatum', 'd'],
                ['faelligkeit', 'Fälligkeit', 'd'], ['kundeId', 'Kunden-ID', 'a'],
                ['gesamtNetto', 'Netto (EUR)', 'n'], ['gesamtUst', 'Umsatzsteuer (EUR)', 'n'],
                ['gesamtBrutto', 'Brutto (EUR)', 'n'], ['status', 'Status', 'a'],
                ['leitwegId', 'Leitweg-ID', 'a'], ['storniert', 'Storniert', 'a']
            ]
        },
        {
            file: 'aenderungsprotokoll.csv', name: 'Aenderungsprotokoll',
            desc: 'Änderungsprotokoll mit Hash-Kette (Unveränderbarkeit, GoBD Rz. 64)',
            get: () => Store.getAuditLog(),
            cols: [
                ['id', 'Eintrags-ID', 'a'], ['timestamp', 'Zeitpunkt', 'a'], ['action', 'Vorgang', 'a'],
                ['entityType', 'Datensatzart', 'a'], ['entityId', 'Betroffener Datensatz', 'a'],
                ['details', 'Beschreibung', 'a'], ['_dev', 'Geraete-Kennung', 'a'],
                ['prevHash', 'Prüfsumme Vorgänger', 'a'], ['checksum', 'Prüfsumme', 'a'],
                ['_clockBack', 'Uhr-Ruecksprung erkannt', 'a']
            ]
        }
    ],

    // Feldwert → CSV-Zelle. Zahlen mit Komma als Dezimaltrennzeichen, weil index.xml genau das
    // deklariert; Wahrheitswerte als "ja"/"nein" statt true/false (der Prüfer liest Text);
    // Objekte/Arrays werden zu JSON, damit nichts still verschwindet.
    _z3Cell(rec, feld, typ) {
        var v = rec ? rec[feld] : '';
        if (v === undefined || v === null) return '';
        if (typ === 'n') {
            var n = parseFloat(v);
            return isNaN(n) ? '' : String(n).replace('.', ',');
        }
        if (typeof v === 'boolean') return v ? 'ja' : 'nein';
        if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return ''; } }
        return String(v);
    },

    // GDPdU-Beschreibungsdatei. Struktur nach der Beschreibungsstandard-DTD (gdpdu-01-09-2004),
    // die die gängige Prüfsoftware (IDEA, ACL, WinIDEA) einliest.
    _z3IndexXml(vonJahr, bisJahr, tabellen) {
        var esc = function (s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        var typMap = { a: 'AlphaNumeric', n: 'Numeric', d: 'Date' };
        var firma = '';
        try {
            var cos = JSON.parse(localStorage.getItem('oyi_companies') || '[]');
            var act = localStorage.getItem('oyi_active_company');
            var co = cos.filter(function (c) { return c && c.id === act; })[0];
            firma = co ? (co.name || '') : '';
        } catch (e) {}

        var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                  '<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">\n' +
                  '<DataSet>\n' +
                  '  <Version>1.0</Version>\n' +
                  '  <DataSupplier>\n' +
                  '    <Name>' + esc(firma || 'Unternehmen') + '</Name>\n' +
                  '    <Location>Deutschland</Location>\n' +
                  '    <Comment>Datenträgerüberlassung Z3 nach §147 Abs. 6 AO, erzeugt mit Stackr am ' +
                        esc(new Date().toLocaleDateString('de-DE')) + '</Comment>\n' +
                  '  </DataSupplier>\n' +
                  '  <Media>\n' +
                  '    <Name>Buchhaltungsdaten ' + esc(vonJahr === bisJahr ? vonJahr : vonJahr + '-' + bisJahr) + '</Name>\n';

        tabellen.forEach(function (t) {
            xml += '    <Table>\n' +
                   '      <URL>' + esc(t.file) + '</URL>\n' +
                   '      <Name>' + esc(t.name) + '</Name>\n' +
                   '      <Description>' + esc(t.desc) + '</Description>\n' +
                   '      <Validity><Range><From>' + vonJahr + '-01-01</From><To>' + bisJahr + '-12-31</To></Range></Validity>\n' +
                   '      <DecimalSymbol>,</DecimalSymbol>\n' +
                   '      <DigitGroupingSymbol>.</DigitGroupingSymbol>\n' +
                   '      <VariableLength>\n' +
                   '        <ColumnDelimiter>;</ColumnDelimiter>\n' +
                   '        <TextEncapsulator>"</TextEncapsulator>\n' +
                   '        <RecordDelimiter>&#13;&#10;</RecordDelimiter>\n';
            t.cols.forEach(function (c, i) {
                var tag = (i === 0) ? 'VariablePrimaryKey' : 'VariableColumn';
                xml += '        <' + tag + '>\n' +
                       '          <Name>' + esc(c[1]) + '</Name>\n' +
                       '          <' + typMap[c[2]] + '>' +
                            (c[2] === 'd' ? '<Format>YYYY-MM-DD</Format>' : (c[2] === 'n' ? '<Accuracy>2</Accuracy>' : '')) +
                            '</' + typMap[c[2]] + '>\n' +
                       '        </' + tag + '>\n';
            });
            xml += '      </VariableLength>\n    </Table>\n';
        });
        return xml + '  </Media>\n</DataSet>\n';
    },

    // Erzeugt den Z3-Satz. Jahresfilter, weil ein Prüfer immer einen Prüfungszeitraum nennt und
    // niemand ihm mehr Daten geben sollte, als er verlangt hat (Datenminimierung).
    exportZ3(vonJahr, bisJahr) {
        var von = String(vonJahr), bis = String(bisJahr || vonJahr);
        var imZeitraum = function (rec) {
            var j = String((rec && (rec.datum || rec.timestamp)) || '').slice(0, 4);
            return !j || (j >= von && j <= bis);   // Datensätze ohne Datum bleiben drin
        };
        var geliefert = [], leer = [];
        this._Z3_TABLES.forEach(function (t) {
            var recs;
            try { recs = t.get() || []; } catch (e) { recs = []; }
            recs = recs.filter(imZeitraum);
            if (!recs.length) { leer.push(t.name); return; }
            var rows = [t.cols.map(function (c) { return c[1]; })];
            var self = Protokoll;
            recs.forEach(function (r) {
                rows.push(t.cols.map(function (c) { return self._z3Cell(r, c[0], c[2]); }));
            });
            Utils.downloadCSV(rows, t.file);
            geliefert.push(t);
        });

        if (!geliefert.length) {
            Utils.showToast('Für ' + (von === bis ? von : von + '–' + bis) + ' liegen keine Daten vor.', 'warning', 6000);
            return;
        }
        Utils.downloadFile(this._z3IndexXml(von, bis, geliefert), 'index.xml', 'application/xml;charset=utf-8');
        Utils.showToast('✓ Z3-Export: ' + (geliefert.length + 1) + ' Dateien heruntergeladen (index.xml + ' +
                        geliefert.length + ' Tabellen). Alle in EINEN Ordner legen und diesen dem Prüfer übergeben.' +
                        (leer.length ? ' Ohne Daten im Zeitraum und daher nicht enthalten: ' + leer.join(', ') + '.' : ''),
                        'success', 12000);
    },

    openZ3Dialog() {
        if (typeof App === 'undefined' || !App.showModal) { Utils.showToast('Bitte im Haupt-Dashboard öffnen.', 'info'); return; }
        var jetzt = new Date().getFullYear();
        var opts = '';
        for (var j = jetzt; j >= jetzt - 10; j--) opts += '<option value="' + j + '">' + j + '</option>';
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.55;">' +
              'Erzeugt die <strong>Datenträgerüberlassung (Z3)</strong> nach §147 Abs. 6 AO: eine ' +
              '<code>index.xml</code> plus eine CSV-Datei je Tabelle, im GDPdU-Format, das die ' +
              'Prüfsoftware der Finanzverwaltung (IDEA) einliest.' +
            '</div>' +
            '<div style="display:flex;gap:10px;align-items:flex-end;">' +
              '<div class="form-group" style="flex:1;margin:0;"><label class="form-label" for="z3Von">Von Jahr</label>' +
                '<select class="form-select" id="z3Von">' + opts + '</select></div>' +
              '<div class="form-group" style="flex:1;margin:0;"><label class="form-label" for="z3Bis">Bis Jahr</label>' +
                '<select class="form-select" id="z3Bis">' + opts + '</select></div>' +
            '</div>' +
            '<div style="background:rgba(59,130,246,.10);border:1px solid rgba(59,130,246,.35);border-radius:8px;padding:11px;font-size:12px;line-height:1.5;">' +
              'Der Browser lädt die Dateien <strong>einzeln</strong> herunter. Lege sie anschließend ' +
              '<strong>alle in einen Ordner</strong> — die <code>index.xml</code> verweist auf die CSV-Dateien ' +
              'daneben und funktioniert nur so. Gib nur den Zeitraum heraus, den der Prüfer verlangt hat.' +
            '</div>' +
            '<button class="btn btn-primary" data-action="pr-do-z3" style="width:100%;">Z3-Datensatz erzeugen</button>' +
          '</div>';
        App.showModal('Betriebsprüfung: Datenträgerüberlassung (Z3)', body, '');
        var b = document.getElementById('z3Bis');
        if (b) b.value = String(jetzt);
    },

    _doZ3() {
        var v = document.getElementById('z3Von'), b = document.getElementById('z3Bis');
        var von = v ? parseInt(v.value, 10) : new Date().getFullYear();
        var bis = b ? parseInt(b.value, 10) : von;
        if (bis < von) { Utils.showToast('„Bis" darf nicht vor „Von" liegen.', 'warning'); return; }
        App.closeModal();
        this.exportZ3(von, bis);
    },

    render() {
        const log = Store.getAuditLog();
        const f = this;

        // Periodenabschluss / Festschreibung
        const closedYears = Store.getClosedYears();
        const allDates = [
            ...Store.getAllPurchasesRaw(),
            ...Store.getAllSalesRaw(),
            ...Store.getAllExpensesRaw()
        ].map(r => String(r.datum || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y));
        const years = [...new Set([...allDates, String(new Date().getFullYear())])].sort().reverse();

        let filtered = [...log];
        if (f._filterAction) filtered = filtered.filter(e => e.action === f._filterAction);
        if (f._filterEntity) filtered = filtered.filter(e => e.entityType === f._filterEntity);
        if (f._filterVon) filtered = filtered.filter(e => e.timestamp >= f._filterVon);
        if (f._filterBis) filtered = filtered.filter(e => e.timestamp <= f._filterBis + 'T23:59:59');

        filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        // Fund T4: Einträge mit erkanntem Uhr-Rücksprung (Store._clockBackFlag) und Zustand des
        // externen Zeitnachweises. CloudSync fehlt in Local 1.7 ganz — deshalb Existenzprüfung.
        //
        // isHealthy() statt eines bloßen "eingeschaltet"-Flags: nur ein frischer, konfliktfreier
        // Sync belegt, dass tatsächlich verankert WIRD. Dieselbe Schwelle nutzen die
        // Backup-Hinweise — ein "aktiv" zu behaupten, während seit Wochen nichts hochging, wäre
        // hier besonders schädlich, weil daran die Beweiskraft der Zeitstempel hängt.
        const clockBackCount = log.filter(e => e && e._clockBack).length;
        const anchorActive = (typeof CloudSync !== 'undefined' && CloudSync.isHealthy)
            ? !!CloudSync.isHealthy() : false;

        const actionLabel = (a) => {
            const map = { erstellt: 'Erstellt', bearbeitet: 'Bearbeitet', storniert: 'Storniert',
                status_geaendert: 'Status geaendert', import: 'Import', loeschung: 'Loeschung', bezahlt: 'Bezahlt' };
            return map[a] || a;
        };
        const actionBadge = (a) => {
            const cls = a === 'erstellt' ? 'badge-success' : a === 'storniert' ? 'badge-danger' :
                a === 'bearbeitet' ? 'badge-warning' : a === 'loeschung' ? 'badge-danger' : 'badge-info';
            return `<span class="badge ${cls}">${actionLabel(a)}</span>`;
        };
        const entityLabel = (t) => {
            const map = { einkauf: 'Einkauf', verkauf: 'Verkauf', ausgabe: 'Ausgabe',
                dokument: 'Dokument', kunde: 'Kunde', produkt: 'Produkt', system: 'System', eigenbeleg: 'Eigenbeleg' };
            return map[t] || t;
        };

        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="6" class="table-empty">Keine Protokolleintraege vorhanden</td></tr>';
        } else {
            rows = filtered.map(e => `
                <tr>
                    <td style="white-space:nowrap">${Utils.formatDate(e.timestamp)} ${new Date(e.timestamp).toLocaleTimeString('de-DE')}</td>
                    <td>${actionBadge(e.action)}</td>
                    <td>${entityLabel(e.entityType)}</td>
                    <td style="font-family:monospace;font-size:11px;">${Utils.escapeHtml(e.entityId || '')}</td>
                    <td>${Utils.escapeHtml(e.details || '')}</td>
                    <td>
                        ${e.oldValues || e.newValues ? `<button class="btn btn-small" data-detail="${e.id}">Details</button>` : ''}
                        <span class="audit-checksum" title="Pruefsumme: ${e.checksum || ''}">#${e.checksum || '-'}</span>
                    </td>
                </tr>
            `).join('');
        }

        const actions = [...new Set(log.map(e => e.action))].sort();
        const entities = [...new Set(log.map(e => e.entityType))].sort();

        return `
            <div class="page-header">
                <h2>Aenderungsprotokoll (Audit-Log)</h2>
                <div class="page-header-actions no-print">
                    <button class="btn" id="auditExportBtn">Protokoll exportieren</button>
                    <button class="btn" data-action="pr-z3" title="Datenträgerüberlassung nach §147 Abs. 6 AO für die Betriebsprüfung">Betriebsprüfung (Z3)</button>
                    <button class="btn" id="auditVerifyBtn">Integritaet pruefen</button>
                </div>
            </div>

            <div class="card audit-info-card" style="margin-bottom:20px;">
                <div style="padding:1rem;">
                    <strong>GoBD-Hinweis:</strong> Dieses Aenderungsprotokoll dokumentiert alle Erstellungen, Bearbeitungen und Stornierungen.
                    Eintraege koennen nicht geloescht oder veraendert werden. Jeder Eintrag besitzt eine Pruefsumme zur Integritaetssicherung.
                    <br><strong>Eintraege gesamt:</strong> ${log.length} | <strong>Gefiltert:</strong> ${filtered.length}
                    ${clockBackCount ? `<br><span style="color:var(--danger);"><strong>⚠ ${clockBackCount} Eintrag/Einträge</strong>
                        wurden angelegt, während die Systemuhr hinter dem vorherigen Eintrag lag — die Zeitstempel dort sind
                        nicht belastbar. Reihenfolge und Inhalt sind es weiterhin (Hash-Kette).</span>` : ''}
                </div>
            </div>

            <!-- Fund T4 (Steuer-Vergleich 2026-08-10): Der Zeitstempel stammt aus der Systemuhr des
                 Geräts. Die Hash-Kette verkettet Inhalte, nicht Zeiten — sie beweist die Reihenfolge,
                 nicht die Uhrzeit. Der externe Cloud-Anker ist die einzige Instanz, die ein Datum
                 unabhängig vom Gerät bezeugt, und er ist opt-in. Das gehört hier offen hingeschrieben,
                 statt als stille Option zu existieren. -->
            <div class="card" style="margin-bottom:20px;border:1px solid var(${anchorActive ? '--success' : '--warning'});">
                <div style="padding:1rem;font-size:13px;line-height:1.55;">
                    <strong>${anchorActive ? '✓ Externer Zeitnachweis aktiv' : 'Beweiskraft der Zeitstempel'}</strong><br>
                    ${anchorActive
                        ? `Cloud-Sync ist aktiv: die Prüfsummen deiner Protokolleinträge werden zusätzlich
                           mit einem <strong>serverseitigen</strong> Zeitstempel verankert. Damit ist eine
                           nachträgliche Änderung auch dann erkennbar, wenn sie auf diesem Gerät stattfindet.`
                        : `Die Zeitstempel im Protokoll kommen von der <strong>Uhr dieses Geräts</strong>. Die
                           Hash-Kette sichert Inhalt und Reihenfolge der Einträge, aber keine Uhrzeit — ohne
                           externen Zeugen ist die Kette nur <strong>geräteintern</strong> beweiskräftig.
                           Der <strong>Cloud-Anker</strong> schließt das: er hinterlegt zu jedem Eintrag einen
                           Prüfsummen-Zeitstempel auf dem Server, den dieses Gerät nicht rückwirkend ändern kann.
                           Zu aktivieren unter <strong>Backup &amp; Daten → Cloud-Sync</strong>.`}
                </div>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header"><div class="card-title">🔒 Periodenabschluss (Festschreibung)</div></div>
                <div style="padding:1rem;">
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                        Ein abgeschlossenes Jahr ist festgeschrieben: Buchungen darin können nur noch <strong>storniert</strong>, nicht mehr bearbeitet oder geloescht werden (GoBD-Unveraenderbarkeit). Eingereichte USt-Voranmeldungen sperren ihr Quartal automatisch.
                    </p>
                    <div class="table-container" style="border:none;">
                        <table class="data-table">
                            <thead><tr><th>Jahr</th><th>Status</th><th style="text-align:right">Aktion</th></tr></thead>
                            <tbody>
                                ${years.map(y => {
                                    const closed = closedYears.includes(parseInt(y, 10));
                                    return `<tr>
                                        <td><strong>${y}</strong></td>
                                        <td>${closed ? '<span class="badge badge-danger">🔒 Abgeschlossen</span>' : '<span class="badge badge-success">Offen</span>'}</td>
                                        <td style="text-align:right">${closed
                                            ? `<button class="btn btn-small" data-reopen-year="${y}">Wieder oeffnen</button>`
                                            : `<button class="btn btn-small btn-danger" data-close-year="${y}">Jahr abschliessen</button>`}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Aktion</label>
                    <select class="form-select" id="auditFilterAction">
                        <option value="">Alle</option>
                        ${actions.map(a => `<option value="${a}" ${f._filterAction === a ? 'selected' : ''}>${actionLabel(a)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Bereich</label>
                    <select class="form-select" id="auditFilterEntity">
                        <option value="">Alle</option>
                        ${entities.map(t => `<option value="${t}" ${f._filterEntity === t ? 'selected' : ''}>${entityLabel(t)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Von</label>
                    <input type="date" class="form-input" id="auditFilterVon" value="${f._filterVon}">
                </div>
                <div class="filter-group">
                    <label>Bis</label>
                    <input type="date" class="form-input" id="auditFilterBis" value="${f._filterBis}">
                </div>
            </div>

            <div class="table-container">
                <table class="audit-table">
                    <thead>
                        <tr>
                            <th>Zeitpunkt</th>
                            <th>Aktion</th>
                            <th>Bereich</th>
                            <th>ID</th>
                            <th>Details</th>
                            <th>Pruefung</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        const applyFilters = () => {
            this._filterAction = document.getElementById('auditFilterAction').value;
            this._filterEntity = document.getElementById('auditFilterEntity').value;
            this._filterVon = document.getElementById('auditFilterVon').value;
            this._filterBis = document.getElementById('auditFilterBis').value;
            document.getElementById('content').innerHTML = this.render();
            this.init();
        };

        ['auditFilterAction', 'auditFilterEntity', 'auditFilterVon', 'auditFilterBis'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilters);
        });

        // Detail buttons
        document.querySelectorAll('[data-detail]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.detail;
                const entry = Store.getAuditLog().find(e => e.id === id);
                if (!entry) return;
                let body = '<div class="audit-detail">';
                body += `<div class="form-group"><strong>Zeitpunkt:</strong> ${new Date(entry.timestamp).toLocaleString('de-DE')}</div>`;
                body += `<div class="form-group"><strong>Aktion:</strong> ${entry.action}</div>`;
                body += `<div class="form-group"><strong>Bereich:</strong> ${entry.entityType}</div>`;
                body += `<div class="form-group"><strong>ID:</strong> ${entry.entityId}</div>`;
                body += `<div class="form-group"><strong>Details:</strong> ${Utils.escapeHtml(entry.details || '')}</div>`;
                body += `<div class="form-group"><strong>Pruefsumme:</strong> <code>${entry.checksum || '-'}</code></div>`;
                if (entry.oldValues) {
                    body += '<div class="form-group"><strong>Vorherige Werte:</strong>';
                    body += '<pre class="audit-json">' + Utils.escapeHtml(JSON.stringify(entry.oldValues, null, 2)) + '</pre></div>';
                }
                if (entry.newValues) {
                    body += '<div class="form-group"><strong>Neue Werte:</strong>';
                    body += '<pre class="audit-json">' + Utils.escapeHtml(JSON.stringify(entry.newValues, null, 2)) + '</pre></div>';
                }
                body += '</div>';
                App.showModal('Protokoll-Detail', body, '<button class="btn" data-action="close-modal">Schliessen</button>');
            });
        });

        // Export
        const exportBtn = document.getElementById('auditExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const log = Store.getAuditLog();
                const data = JSON.stringify(log, null, 2);
                Utils.downloadFile(data, 'audit_log_' + Utils.todayISO() + '.json', 'application/json');
                Utils.showToast('Protokoll exportiert', 'success');
            });
        }

        // Integrity check — hash-chain (lokal) + optional Cloud-Anker (extern, faelschungssicherer)
        const verifyBtn = document.getElementById('auditVerifyBtn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', async () => {
                let issues = 0;
                const checks = [
                    { name: 'Einkaeufe', items: Store.getAllPurchasesRaw() },
                    { name: 'Verkaeufe', items: Store.getAllSalesRaw() },
                    { name: 'Ausgaben', items: Store.getAllExpensesRaw() }
                ];
                checks.forEach(c => {
                    c.items.forEach(item => {
                        if (!Store.verifyIntegrity(item)) issues++;
                    });
                });

                // Verify audit log hash chain (erkennt Datenkorruption; eine EIN-Geraet-Manipulation
                // mit Kenntnis der Formel kann die Kette selbst konsistent neu berechnen — siehe Cloud-Anker unten)
                const chainResult = Store.verifyAuditChain();
                if (!chainResult.valid) {
                    Utils.showToast(
                        `⚠ Audit-Log: ${chainResult.broken} Einträge mit gebrochener Hash-Kette (mögliche Manipulation)!`,
                        'error'
                    );
                    return;
                }

                // Cloud-Anker: externer, vom Gerät nicht rückwirkend veränderbarer Referenzpunkt.
                // Nur aussagekräftig, wenn Cloud-Sync aktiv ist — sonst gibt es keinen externen Zeugen.
                let anchorMsg = ' · kein Cloud-Anker (Cloud-Sync aus)';
                if (typeof CloudSync !== 'undefined') {
                    try {
                        const anchor = await CloudSync.verifyAuditAnchors();
                        if (anchor.enabled && !anchor.error) {
                            if (anchor.mismatches.length) {
                                Utils.showToast(
                                    `⚠ Cloud-Anker: ${anchor.mismatches.length} Eintrag/Einträge weichen vom extern gespeicherten Stand ab (Manipulationsverdacht)!`,
                                    'error'
                                );
                                return;
                            }
                            anchorMsg = anchor.notAnchored
                                ? ` · Cloud-Anker: ${anchor.ok} bestätigt, ${anchor.notAnchored} noch nicht verankert`
                                : ` · Cloud-Anker: alle ${anchor.ok} Einträge bestätigt`;
                        } else if (anchor.enabled && anchor.error) {
                            anchorMsg = ' · Cloud-Anker-Prüfung fehlgeschlagen (Server nicht erreichbar)';
                        }
                    } catch (e) { /* best-effort, blockiert die lokale Prüfung nicht */ }
                }

                if (issues > 0) {
                    Utils.showToast(`Warnung: ${issues} Datensätze mit ungültiger Prüfsumme!`, 'error');
                    return;
                }

                // Uhr-Rücksprünge (Fund T4): Kette intakt, aber mindestens ein Zeitstempel wurde
                // vor dem seines Vorgängers angelegt. Eigene Meldung statt Erfolgsmeldung — die
                // Kette beweist Reihenfolge und Inhalt, nicht die Uhrzeit.
                if (chainResult.clockBack > 0) {
                    Utils.showToast(
                        `⚠ Hash-Kette intakt (${chainResult.total} Einträge), aber ${chainResult.clockBack} Eintrag/Einträge ` +
                        `wurden mit einer zurückgestellten Uhr angelegt — Zeitstempel dort nicht belastbar${anchorMsg}`,
                        'warning', 9000
                    );
                    return;
                }

                Utils.showToast(
                    `✓ Integritätsprüfung bestanden — ${chainResult.total} Log-Einträge, Hash-Kette intakt${anchorMsg}`,
                    'success'
                );
            });
        }

        // Periodenabschluss: Jahr abschließen
        document.querySelectorAll('[data-close-year]').forEach(btn => {
            btn.addEventListener('click', () => {
                const y = btn.dataset.closeYear;
                if (!confirm(`Jahr ${y} abschließen? Buchungen aus ${y} können danach nur noch storniert (nicht mehr bearbeitet/gelöscht) werden.`)) return;
                Store.closeYear(y);
                Utils.showToast(`Jahr ${y} abgeschlossen`, 'success');
                document.getElementById('content').innerHTML = this.render();
                this.init();
            });
        });

        // Periodenabschluss: Jahr wieder öffnen (mit Begründung → protokolliert)
        document.querySelectorAll('[data-reopen-year]').forEach(btn => {
            btn.addEventListener('click', () => {
                const y = btn.dataset.reopenYear;
                const grund = prompt(`Jahr ${y} wieder öffnen — Grund (wird protokolliert):`);
                if (!grund) return;
                Store.reopenYear(y, grund);
                Utils.showToast(`Jahr ${y} wieder geöffnet`, 'success');
                document.getElementById('content').innerHTML = this.render();
                this.init();
            });
        });
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
// protokoll.js arbeitete bisher nur mit addEventListener auf festen IDs. Der Z3-Dialog wird
// dynamisch erzeugt, dessen Button braucht daher den zentralen Dispatcher (js/actions.js).
if (typeof window !== 'undefined' && window.Actions) Actions.register({
    'pr-z3':    function () { Protokoll.openZ3Dialog(); },
    'pr-do-z3': function () { Protokoll._doZ3(); }
});
