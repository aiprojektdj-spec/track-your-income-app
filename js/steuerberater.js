// ============================================================
// Steuerberater-Zugang — Read-Only Export Bundle
// Erstellt ein eigenständiges HTML-Dokument mit allen
// steuerrelevanten Daten (EÜR, Rechnungen, Ausgaben)
// ============================================================
var Steuerberater = (function () {

    function render() {
        var html = '<div class="page-header">';
        html += '<h2><i class="ti ti-user-check"></i> Steuerberater-Zugang</h2>';
        html += '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Erstellt einen verschlüsselten Read-Only-Export für deinen Steuerberater</div>';
        html += '</div>';

        var curYear = new Date().getFullYear();
        var years = [];
        for (var y = curYear; y >= curYear - 4; y--) years.push(y);

        html += '<div class="card" style="padding:20px;">';
        html += '<div style="font-weight:700;font-size:15px;margin-bottom:4px;"><i class="ti ti-shield-lock"></i> Steuerberater-Paket erstellen</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:18px;">Exportiert alle steuerrelevanten Daten als eigenständiges HTML-Dokument, das dein Steuerberater ohne Stackr-Zugang öffnen kann.</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">Steuerjahr</label>';
        html += '<select class="form-select" id="stbYear">';
        years.forEach(function (y) { html += '<option value="' + y + '">' + y + '</option>'; });
        html += '</select></div>';

        html += '<div class="form-group"><label class="form-label">Zugriffspin (optional)</label>';
        // type="text" statt "number": maxlength wirkt bei number-Inputs NICHT — die Begrenzung
        // sah aus, als waere sie da, und tat nichts. Ausserdem verschluckt number fuehrende
        // Nullen, eine PIN "0042" wurde zu "42". inputmode/pattern halten die Ziffern-Tastatur
        // auf dem Telefon. Die Leseseite (buildAndDownload) nimmt ohnehin den String.
        html += '<input type="text" inputmode="numeric" pattern="[0-9]*" class="form-input" id="stbPin" placeholder="z.B. 1234" maxlength="8" style="max-width:140px;">';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Leer = kein PIN. Der Steuerberater gibt diesen PIN beim Öffnen ein.</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label class="form-label">Enthaltene Daten</label>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        var sections = [
            { id: 'stb_eur',      label: 'EÜR / Gewinn & Verlust', checked: true },
            { id: 'stb_invoices', label: 'Rechnungen',              checked: true },
            { id: 'stb_expenses', label: 'Ausgaben / Betriebskosten', checked: true },
            { id: 'stb_purchases', label: 'Wareneinkäufe',          checked: true },
            { id: 'stb_afa',      label: 'AfA / Anlagevermögen',    checked: true },
            { id: 'stb_audit',    label: 'Änderungsprotokoll (GoBD)', checked: false },
        ];
        sections.forEach(function (s) {
            html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid var(--border);border-radius:100px;cursor:pointer;font-size:12px;background:var(--bg-card);">';
            html += '<input type="checkbox" id="' + s.id + '"' + (s.checked ? ' checked' : '') + '>';
            html += Utils.escapeHtml(s.label) + '</label>';
        });
        html += '</div></div>';

        html += '<div style="display:flex;gap:10px;margin-top:16px;">';
        html += '<button class="btn btn-primary" id="stbExportBtn"><i class="ti ti-file-export"></i> HTML-Paket erstellen & herunterladen</button>';
        html += '</div>';
        html += '</div>';

        html += '<div class="card" style="padding:16px;margin-top:16px;background:rgba(99,102,241,.04);">';
        html += '<div style="font-weight:700;font-size:13px;margin-bottom:8px;"><i class="ti ti-info-circle"></i> So funktioniert es</div>';
        html += '<ol style="font-size:12px;color:var(--text-secondary);margin:0;padding-left:18px;line-height:2;">';
        html += '<li>Wähle das Steuerjahr und optionalen PIN</li>';
        html += '<li>Klicke auf "HTML-Paket erstellen" → eine .html-Datei wird heruntergeladen</li>';
        html += '<li>Sende die Datei per E-Mail oder Dateitransfer an deinen Steuerberater</li>';
        html += '<li>Der Steuerberater öffnet die Datei im Browser — keine Software-Installation nötig</li>';
        html += '<li>Optional: PIN schützt den Inhalt vor unbefugtem Zugriff</li>';
        html += '</ol>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">⚠️ Das Paket enthält keine Passwörter oder Zugangsdaten. Es ist eine Nur-Lese-Ansicht deiner Buchungen.</div>';
        html += '</div>';

        return html;
    }

    function init() {
        var exportBtn = document.getElementById('stbExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', buildAndDownload);
        }
    }

    function buildAndDownload() {
        var year    = parseInt(document.getElementById('stbYear').value);
        var pin     = (document.getElementById('stbPin').value || '').trim();
        var inclEur      = document.getElementById('stb_eur').checked;
        var inclInvoices = document.getElementById('stb_invoices').checked;
        var inclExpenses = document.getElementById('stb_expenses').checked;
        var inclPurch    = document.getElementById('stb_purchases').checked;
        var inclAfa      = document.getElementById('stb_afa').checked;
        var inclAudit    = document.getElementById('stb_audit').checked;

        var vonDate = year + '-01-01';
        var bisDate = year + '-12-31';

        var settings  = Store.getSettings ? Store.getSettings() : {};
        var isKlein   = settings.ustMode === 'klein';

        // ── Collect data ────────────────────────────────────────────────
        var purchases = (Store.getAllPurchasesRaw ? Store.getAllPurchasesRaw() : [])
            .filter(function (p) { return !p.storniert && p.datum >= vonDate && p.datum <= bisDate; });

        var sales = (Store.getAllSalesRaw ? Store.getAllSalesRaw() : [])
            .filter(function (s) { return !s.storniert && s.datum >= vonDate && s.datum <= bisDate; });

        var expenses = (Store.getAllExpensesRaw ? Store.getAllExpensesRaw() : [])
            .filter(function (e) { return !e.storniert && e.datum >= vonDate && e.datum <= bisDate; });

        var invoices = (Store.getRechInvoices ? Store.getRechInvoices() : [])
            .filter(function (i) { return (i.datum || '') >= vonDate && (i.datum || '') <= bisDate; });

        var customers = (Store.getRechCustomers ? Store.getRechCustomers() : []);
        var customerMap = {};
        customers.forEach(function (c) { customerMap[c.id] = c; });

        var afaAnlagen = (Store.getAfaAnlagen ? Store.getAfaAnlagen() : []).filter(function (a) { return !a.storniert; });

        var auditLog = inclAudit ? (Store.getAuditLog ? Store.getAuditLog() : []).slice(-500) : [];

        // ── EÜR calculation ─────────────────────────────────────────────
        var einnahmen = sales.reduce(function (s, x) { return s + (parseFloat(x.verkaufspreis) || 0) + (parseFloat(x.versandkostenKaeufer) || 0); }, 0);
        var wareneinkauf = purchases.reduce(function (s, p) { return s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1); }, 0);
        var sonstigeAusgaben = expenses.reduce(function (s, e) { return s + (parseFloat(e.betrag) || 0); }, 0);
        var gewinn = einnahmen - wareneinkauf - sonstigeAusgaben;

        // ── Build HTML ──────────────────────────────────────────────────
        var companyName = Utils.escapeHtml(settings.firmenname || 'Mein Unternehmen');
        var generatedAt = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        var sections = '';

        if (inclEur) {
            sections += buildEurSection(year, einnahmen, wareneinkauf, sonstigeAusgaben, gewinn, isKlein, sales, purchases, expenses);
        }

        if (inclInvoices) {
            sections += buildInvoicesSection(invoices, customerMap);
        }

        if (inclExpenses) {
            sections += buildExpensesSection(expenses);
        }

        if (inclPurch) {
            sections += buildPurchasesSection(purchases);
        }

        if (inclAfa) {
            sections += buildAfaSection(afaAnlagen, year);
        }

        if (inclAudit && auditLog.length) {
            sections += buildAuditSection(auditLog);
        }

        // Wrap in PIN-protected HTML
        var html = buildHtmlWrapper(companyName, year, generatedAt, sections, pin);

        var filename = 'Stackr_Steuerberater_' + year + '_' + companyName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) + '.html';
        Utils.downloadFile(html, filename, 'text/html; charset=utf-8');
        Utils.showToast('Steuerberater-Paket exportiert: ' + filename, 'success');
    }

    function fmtCur(n) { return parseFloat(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }); }
    function fmtDt(s) { if (!s) return '—'; var p = s.split('-'); if (p.length < 3) return s; return p[2] + '.' + p[1] + '.' + p[0]; }
    function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function buildEurSection(year, ein, ek, ba, gew, isKlein, sales, purchases, expenses) {
        var rows = [
            ['Betriebseinnahmen (Verkäufe)', ein, '#16a34a'],
            ['− Wareneinkauf', ek, '#dc2626'],
            ['− Betriebsausgaben', ba, '#dc2626'],
            ['= Gewinn / Überschuss', gew, gew >= 0 ? '#16a34a' : '#dc2626'],
        ];
        var rowHtml = rows.map(function (r) {
            return '<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">' + r[0] + '</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:' + r[2] + ';">' + fmtCur(r[1]) + '</td></tr>';
        }).join('');
        return '<section id="s_eur"><h2 style="margin:24px 0 8px;">📊 EÜR — Steuerjahr ' + year + '</h2>'
            + '<table style="width:100%;max-width:480px;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
            + '<thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;">Position</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;">Betrag</th></tr></thead>'
            + '<tbody>' + rowHtml + '</tbody></table>'
            + (isKlein ? '<p style="font-size:12px;color:#6b7280;margin-top:8px;">§19 UStG: Keine Umsatzsteuer ausgewiesen (Kleinunternehmer).</p>' : '')
            + '</section>';
    }

    function buildInvoicesSection(invoices, customerMap) {
        if (!invoices.length) return '<section id="s_inv"><h2 style="margin:24px 0 8px;">🧾 Rechnungen</h2><p style="color:#6b7280;font-size:13px;">Keine Rechnungen im Zeitraum.</p></section>';
        var rows = invoices.map(function (inv) {
            var kunde = customerMap[inv.kundeId];
            var kundeName = kunde ? (kunde.firma || kunde.ansprechpartner || '') : '—';
            var netto = (inv.positionen || []).reduce(function (s, p) { return s + p.menge * p.einzelpreis; }, 0);
            var statusCls = inv.status === 'bezahlt' ? '#16a34a' : inv.status === 'ueberfaellig' ? '#dc2626' : '#6b7280';
            return '<tr><td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + esc(inv.nummer) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + fmtDt(inv.datum) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + esc(kundeName) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;">' + fmtCur(netto) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:' + statusCls + ';">' + esc(inv.status) + '</td>'
                + '</tr>';
        }).join('');
        return '<section id="s_inv"><h2 style="margin:24px 0 8px;">🧾 Rechnungen (' + invoices.length + ')</h2>'
            + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">'
            + '<thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#6b7280;"><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Nr.</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Datum</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Kunde</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Netto</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div></section>';
    }

    function buildExpensesSection(expenses) {
        if (!expenses.length) return '<section id="s_exp"><h2 style="margin:24px 0 8px;">💼 Betriebsausgaben</h2><p style="color:#6b7280;font-size:13px;">Keine Ausgaben im Zeitraum.</p></section>';
        var rows = expenses.map(function (e) {
            return '<tr><td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + fmtDt(e.datum) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + esc(e.kategorie || 'Sonstiges') + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + esc(e.beschreibung || '') + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;color:#dc2626;">' + fmtCur(e.betrag) + '</td>'
                + '</tr>';
        }).join('');
        var total = expenses.reduce(function (s, e) { return s + (parseFloat(e.betrag) || 0); }, 0);
        return '<section id="s_exp"><h2 style="margin:24px 0 8px;">💼 Betriebsausgaben (' + expenses.length + ') — ' + fmtCur(total) + '</h2>'
            + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">'
            + '<thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#6b7280;"><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Datum</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Kategorie</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Beschreibung</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Betrag</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div></section>';
    }

    function buildPurchasesSection(purchases) {
        if (!purchases.length) return '<section id="s_pur"><h2 style="margin:24px 0 8px;">🛒 Wareneinkäufe</h2><p style="color:#6b7280;font-size:13px;">Keine Einkäufe im Zeitraum.</p></section>';
        var rows = purchases.map(function (p) {
            var total = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
            return '<tr><td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + fmtDt(p.datum) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;font-family:monospace;">' + esc(p.artikelNr || '—') + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + esc((p.marke || '') + ' ' + (p.artikeltyp || '')) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;">' + (parseInt(p.anzahl) || 1) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;color:#dc2626;">' + fmtCur(total) + '</td>'
                + '</tr>';
        }).join('');
        var total = purchases.reduce(function (s, p) { return s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1); }, 0);
        return '<section id="s_pur"><h2 style="margin:24px 0 8px;">🛒 Wareneinkäufe (' + purchases.length + ') — ' + fmtCur(total) + '</h2>'
            + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">'
            + '<thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#6b7280;"><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Datum</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Art.-Nr.</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Artikel</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Menge</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Gesamt EK</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div></section>';
    }

    function buildAfaSection(anlagen, year) {
        if (!anlagen.length) return '<section id="s_afa"><h2 style="margin:24px 0 8px;">📉 AfA / Anlagevermögen</h2><p style="color:#6b7280;font-size:13px;">Kein Anlagevermögen erfasst — Wirtschaftsgüter über 800 € netto gehören ins Anlagenverzeichnis (§6 Abs. 2 EStG), erfassbar unter „AfA".</p></section>';
        var rows = anlagen.map(function (a) {
            var jahresAfa = 0;
            if (typeof Afa !== 'undefined' && Afa._calcJahresAfa) {
                jahresAfa = Afa._calcJahresAfa(a, year);
            } else {
                jahresAfa = (parseFloat(a.anschaffungskosten) || 0) / (parseInt(a.nutzungsdauer) || 1);
            }
            return '<tr><td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + esc(a.bezeichnung) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + fmtDt(a.anschaffungsdatum) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;">' + fmtCur(a.anschaffungskosten) + '</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;">' + (a.nutzungsdauer || '—') + ' Jahre</td>'
                + '<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;color:#dc2626;">' + fmtCur(jahresAfa) + '</td>'
                + '</tr>';
        }).join('');
        return '<section id="s_afa"><h2 style="margin:24px 0 8px;">📉 AfA / Anlagevermögen (' + anlagen.length + ' Anlagen)</h2>'
            + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">'
            + '<thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#6b7280;"><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Bezeichnung</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Anschaffung</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">AK</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">ND</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Jahres-AfA</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div></section>';
    }

    function buildAuditSection(auditLog) {
        var rows = auditLog.slice(0, 200).map(function (e) {
            return '<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;white-space:nowrap;">' + esc(e.timestamp ? e.timestamp.replace('T', ' ').substring(0, 16) : '') + '</td>'
                + '<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;">' + esc(e.action || '') + '</td>'
                + '<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;">' + esc(e.entityType || '') + '</td>'
                + '<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + esc((e.details || '').substring(0, 80)) + '</td>'
                + '</tr>';
        }).join('');
        return '<section id="s_audit"><h2 style="margin:24px 0 8px;">🔒 Änderungsprotokoll (GoBD) — ' + auditLog.length + ' Einträge</h2>'
            + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">'
            + '<thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#6b7280;"><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Zeitpunkt</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Aktion</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Bereich</th><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Details</th></tr></thead>'
            + '<tbody>' + rows + '</tbody></table></div>'
            + (auditLog.length > 200 ? '<p style="font-size:11px;color:#6b7280;margin-top:6px;">Zeigt die letzten 200 von ' + auditLog.length + ' Einträgen.</p>' : '')
            + '</section>';
    }

    function buildHtmlWrapper(companyName, year, generatedAt, sections, pin) {
        var pinScript = '';
        var pinOverlay = '';

        if (pin) {
            pinOverlay = '<div id="pinOverlay" style="position:fixed;inset:0;background:#1e293b;z-index:9999;display:flex;align-items:center;justify-content:center;">'
                + '<div style="background:#fff;border-radius:12px;padding:32px;text-align:center;max-width:320px;width:90%;">'
                + '<div style="font-size:32px;margin-bottom:12px;">🔐</div>'
                + '<div style="font-weight:800;font-size:18px;margin-bottom:6px;">Steuerberater-Paket</div>'
                + '<div style="font-size:13px;color:#6b7280;margin-bottom:20px;">' + esc(companyName) + ' · ' + year + '</div>'
                + '<input type="password" id="pinInput" placeholder="PIN eingeben" style="width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:16px;text-align:center;box-sizing:border-box;margin-bottom:12px;" autofocus>'
                + '<button onclick="checkPin()" style="width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Öffnen</button>'
                + '<div id="pinError" style="color:#dc2626;font-size:12px;margin-top:8px;display:none;">Falscher PIN. Bitte erneut versuchen.</div>'
                + '<div style="font-size:10.5px;color:#9ca3af;margin-top:14px;line-height:1.4;">Hinweis: Die PIN ist ein Sichtschutz gegen zufälliges Öffnen, keine Verschlüsselung. Diese Datei nur über einen vertrauenswürdigen Kanal teilen.</div>'
                + '</div></div>';

            pinScript = '<script>'
                + 'var _pin="' + String(pin).replace(/"/g, '') + '";'
                + 'function checkPin(){'
                + 'var v=document.getElementById("pinInput").value.trim();'
                + 'if(v===_pin){'
                + 'document.getElementById("pinOverlay").style.display="none";'
                + '}else{'
                + 'document.getElementById("pinError").style.display="block";'
                + 'document.getElementById("pinInput").value="";'
                + 'document.getElementById("pinInput").focus();'
                + '}'
                + '}'
                + 'document.addEventListener("DOMContentLoaded",function(){'
                + 'document.getElementById("pinInput").addEventListener("keydown",function(e){if(e.key==="Enter")checkPin();});'
                + '});'
                + '<\/script>';
        }

        return '<!DOCTYPE html>\n<html lang="de">\n<head>\n'
            + '<meta charset="UTF-8">\n'
            + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
            + '<title>Stackr — Steuerberater-Paket ' + year + ' — ' + esc(companyName) + '</title>\n'
            + '<style>'
            + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0;padding:0;background:#f8fafc;color:#1e293b;line-height:1.6;}'
            + 'header{background:#4f46e5;color:#fff;padding:20px 32px;}'
            + 'header h1{margin:0;font-size:22px;font-weight:800;}'
            + 'header .sub{font-size:13px;opacity:.8;margin-top:4px;}'
            + '.nav{background:#fff;border-bottom:1px solid #e5e7eb;padding:0 32px;display:flex;gap:4px;flex-wrap:wrap;}'
            + '.nav a{display:block;padding:10px 14px;font-size:12px;font-weight:600;color:#6b7280;text-decoration:none;border-bottom:2px solid transparent;}'
            + '.nav a:hover{color:#4f46e5;border-bottom-color:#4f46e5;}'
            + 'main{max-width:1100px;margin:0 auto;padding:24px 32px;}'
            + 'h2{font-size:18px;font-weight:800;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;}'
            + 'section{margin-bottom:32px;}'
            + 'table{font-size:13px;}'
            + 'footer{margin-top:40px;padding:16px 32px;font-size:11px;color:#94a3b8;border-top:1px solid #e5e7eb;text-align:center;}'
            + '@media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.nav{display:none;}}'
            + '</style>\n'
            + '</head>\n<body>\n'
            + pinOverlay
            + '<header>'
            + '<h1>📊 Steuerberater-Paket — ' + esc(companyName) + '</h1>'
            + '<div class="sub">Steuerjahr ' + year + ' · Erstellt am ' + esc(generatedAt) + ' · Erstellt mit Stackr</div>'
            + '</header>'
            + '<nav class="nav">'
            + '<a href="#s_eur">EÜR</a>'
            + '<a href="#s_inv">Rechnungen</a>'
            + '<a href="#s_exp">Ausgaben</a>'
            + '<a href="#s_pur">Einkäufe</a>'
            + '<a href="#s_afa">AfA</a>'
            + '<a href="#s_audit">Protokoll</a>'
            + '</nav>'
            + '<main>'
            + sections
            + '</main>'
            + '<footer>Dieses Dokument wurde automatisch von Stackr generiert. Es enthält keine Zugangsdaten. '
            + 'Alle Daten sind unverbindlich — die Verantwortung für die korrekte steuerliche Einordnung liegt beim Steuerberater. '
            + '§ 5 StBerG: Keine Steuerberatung durch Stackr.</footer>'
            + pinScript
            + '\n</body>\n</html>';
    }

    return { render: render, init: init };
})();
