var RechDashboard = (function() {

    function calcBrutto(invoice) {
        var settings = Store.getSettings();
        var isKlein = settings.ustMode === 'klein';
        var sum = 0;
        (invoice.positionen || []).forEach(function(pos) {
            var netto = pos.menge * pos.einzelpreis;
            var mwst = isKlein ? 0 : (netto * pos.mwstSatz / 100);
            sum += netto + mwst;
        });
        return sum;
    }

    function render() {
        var invoices = Store.getRechInvoices();
        var ud = Store.getRechUnternehmen();
        var hasUd = !!(ud.firmenname);

        var offeneRechnungen = invoices.filter(function(i) { return i.typ === 'rechnung' && i.status === 'offen'; });
        var offeneSum = offeneRechnungen.reduce(function(s, i) { return s + calcBrutto(i); }, 0);

        var today = Utils.todayISO();
        var currentMonth = today.substring(0, 7);
        var bezahlteRechnungen = invoices.filter(function(i) {
            return i.typ === 'rechnung' && i.status === 'bezahlt' && (i.datum || '').substring(0, 7) === currentMonth;
        });
        var bezahlteSum = bezahlteRechnungen.reduce(function(s, i) { return s + calcBrutto(i); }, 0);

        var ueberfaellige = invoices.filter(function(i) { return i.typ === 'rechnung' && i.status === 'ueberfaellig'; });
        var ueberfaelligeSum = ueberfaellige.reduce(function(s, i) { return s + calcBrutto(i); }, 0);

        var offeneAngebote = invoices.filter(function(i) { return i.typ === 'angebot' && i.status === 'offen'; });
        var angeboteSum = offeneAngebote.reduce(function(s, i) { return s + calcBrutto(i); }, 0);

        var recent = invoices.slice().sort(function(a, b) {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        }).slice(0, 10);

        var customers = Store.getRechCustomers();
        var customerMap = {};
        customers.forEach(function(c) { customerMap[c.id] = c; });

        var html = '';

        // ── Header ────────────────────────────────────────────────────────
        html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">';
        html += '<div>';
        html += '<h2 style="margin:0;font-size:22px;font-weight:800;">Dashboard</h2>';
        html += '<div style="font-size:13px;color:var(--text-secondary);margin-top:3px;">Übersicht deiner Rechnungen &amp; Angebote</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:8px;">';
        html += '<button class="btn btn-primary" id="dashNewInvoice" style="border-radius:20px;padding:8px 18px;">&#xFF0B; Neue Rechnung</button>';
        html += '<button class="btn btn-success" id="dashNewOffer" style="border-radius:20px;padding:8px 18px;">&#xFF0B; Neues Angebot</button>';
        html += '</div>';
        html += '</div>';

        // ── Unternehmensdaten-Hinweis (nur wenn noch nicht ausgefüllt) ────
        if (!hasUd) {
            html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:20px;';
            html += 'background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.25);border-radius:10px;">';
            html += '<div style="font-size:24px;">🏢</div>';
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:700;font-size:13px;">Unternehmensdaten noch nicht eingerichtet</div>';
            html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Füge Firmenname, Adresse, Bankverbindung & Logo hinzu — sie erscheinen automatisch auf deinen Rechnungen.</div>';
            html += '</div>';
            html += '<button class="btn btn-small btn-outline" id="dashGoUd" style="white-space:nowrap;">&#9881; Jetzt einrichten</button>';
            html += '</div>';
        }

        // ── E-Rechnung Hinweis (ab 2025 Pflicht für B2B) ─────────────────
        var curYear = new Date().getFullYear();
        if (curYear >= 2025) {
            html += '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;margin-bottom:16px;';
            html += 'background:rgba(234,179,8,.07);border:1px solid rgba(234,179,8,.25);border-radius:10px;">';
            html += '<div style="font-size:22px;padding-top:1px;">📋</div>';
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:700;font-size:13px;color:#fbbf24;">E-Rechnung ab 2025 Pflicht (B2B)</div>';
            html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;line-height:1.5;">';
            html += 'Für Rechnungen zwischen Unternehmen (B2B) ist ab dem 1.&nbsp;Januar&nbsp;2025 die Empfangspflicht für strukturierte E-Rechnungen (XRechnung / ZUGFeRD) in Kraft. ';
            html += 'Ab&nbsp;2027 auch Ausstellungspflicht für Umsätze >&nbsp;0&nbsp;€. ';
            html += '<a href="https://www.bundesfinanzministerium.de/Content/DE/FAQ/2024-03-22-steuerforum-e-rechnung.html" target="_blank" rel="noopener" style="color:#fbbf24;">Mehr Info →</a>';
            html += '</div></div></div>';
        }

        // ── Stat-Kacheln ─────────────────────────────────────────────────
        var cards = [
            { label: 'Offene Rechnungen',   count: offeneRechnungen.length, amount: offeneSum,   color: '#3b82f6', icon: '📄' },
            { label: 'Bezahlt (dieser Monat)', count: bezahlteRechnungen.length, amount: bezahlteSum, color: '#22c55e', icon: '✅' },
            { label: 'Überfällige Rechnungen', count: ueberfaellige.length,   amount: ueberfaelligeSum, color: '#ef4444', icon: '⚠️' },
            { label: 'Offene Angebote',      count: offeneAngebote.length,   amount: angeboteSum,  color: '#f59e0b', icon: '📝' },
        ];

        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-bottom:28px;">';
        cards.forEach(function(c) {
            html += '<div style="background:var(--bg-card,var(--bg-secondary));border:1px solid var(--border);border-radius:12px;padding:18px 20px;position:relative;overflow:hidden;">';
            // top accent bar
            html += '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:' + c.color + ';border-radius:12px 12px 0 0;"></div>';
            html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;">';
            html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-muted);line-height:1.4;">' + c.label + '</div>';
            html += '<div style="font-size:20px;line-height:1;">' + c.icon + '</div>';
            html += '</div>';
            html += '<div style="font-size:34px;font-weight:900;color:var(--text-primary);line-height:1;margin-top:10px;">' + c.count + '</div>';
            html += '<div style="font-size:13px;font-weight:600;color:' + c.color + ';margin-top:5px;">' + Utils.formatCurrency(c.amount) + '</div>';
            html += '</div>';
        });
        html += '</div>';

        // ── Letzte Dokumente ──────────────────────────────────────────────
        html += '<div style="background:var(--bg-card,var(--bg-secondary));border:1px solid var(--border);border-radius:12px;overflow:hidden;">';

        // Section header
        html += '<div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="font-size:14px;font-weight:700;">Letzte Dokumente</div>';
        if (recent.length > 0) {
            html += '<button class="btn btn-small btn-outline" id="dashGoDoc" style="font-size:11px;border-radius:20px;padding:4px 12px;">Alle anzeigen →</button>';
        }
        html += '</div>';

        if (recent.length === 0) {
            // Nice empty state
            html += '<div style="padding:52px 20px;text-align:center;">';
            html += '<div style="font-size:44px;margin-bottom:14px;opacity:.5;">📄</div>';
            html += '<div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">Noch keine Dokumente</div>';
            html += '<div style="font-size:13px;color:var(--text-muted);">Erstelle deine erste Rechnung oder dein erstes Angebot.</div>';
            html += '<div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">';
            html += '<button class="btn btn-primary" id="emptyNewInvoice">&#xFF0B; Neue Rechnung</button>';
            html += '<button class="btn btn-outline" id="emptyNewOffer">&#xFF0B; Neues Angebot</button>';
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div style="overflow-x:auto;">';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<thead><tr style="background:var(--bg-secondary);">';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);text-align:left;">Nr.</th>';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);text-align:left;">Typ</th>';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);text-align:left;">Kunde</th>';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);text-align:left;">Datum</th>';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);text-align:right;">Betrag</th>';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);text-align:left;">Status</th>';
            html += '<th style="padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted);">&nbsp;</th>';
            html += '</tr></thead><tbody>';

            recent.forEach(function(inv, i) {
                var kunde = customerMap[inv.kundeId];
                var kundeName = kunde ? Utils.escapeHtml(kunde.firma || kunde.ansprechpartner || '') : '—';
                var typLabel  = inv.typ === 'rechnung' ? 'Rechnung' : inv.typ === 'angebot' ? 'Angebot' : 'Gutschrift';
                var typColor  = inv.typ === 'rechnung' ? '#3b82f6' : inv.typ === 'angebot' ? '#f59e0b' : '#8b5cf6';

                var statusMap = {
                    bezahlt:     { label: 'Bezahlt',    bg: 'rgba(34,197,94,.15)',  color: '#16a34a' },
                    ueberfaellig:{ label: 'Überfällig', bg: 'rgba(239,68,68,.15)',  color: '#dc2626' },
                    storniert:   { label: 'Storniert',  bg: 'rgba(107,114,128,.15)',color: '#6b7280' },
                    offen:       { label: 'Offen',      bg: 'rgba(59,130,246,.12)', color: '#3b82f6' },
                    versendet:   { label: 'Versendet',  bg: 'rgba(245,158,11,.15)', color: '#d97706' },
                };
                var st = statusMap[inv.status] || statusMap['offen'];

                html += '<tr style="border-top:1px solid var(--border);' + (i % 2 === 1 ? 'background:rgba(0,0,0,.02);' : '') + '">';
                html += '<td style="padding:10px 14px;font-weight:700;font-size:13px;">' + Utils.escapeHtml(inv.nummer || '—') + '</td>';
                html += '<td style="padding:10px 14px;">';
                html += '<span style="font-size:12px;font-weight:600;color:' + typColor + ';">' + typLabel + '</span>';
                html += '</td>';
                html += '<td style="padding:10px 14px;font-size:13px;">' + kundeName + '</td>';
                html += '<td style="padding:10px 14px;font-size:12px;color:var(--text-muted);">' + Utils.formatDate(inv.datum) + '</td>';
                html += '<td style="padding:10px 14px;text-align:right;font-weight:700;font-size:13px;">' + Utils.formatCurrency(calcBrutto(inv)) + '</td>';
                html += '<td style="padding:10px 14px;">';
                html += '<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>';
                html += '</td>';
                html += '<td style="padding:10px 14px;white-space:nowrap;text-align:right;">';
                html += '<button class="btn btn-small dash-view" data-id="' + inv.id + '" style="font-size:11px;border-radius:20px;padding:4px 10px;">Anzeigen</button> ';
                html += '<button class="btn btn-small btn-primary dash-edit" data-id="' + inv.id + '" style="font-size:11px;border-radius:20px;padding:4px 10px;">Bearbeiten</button>';
                html += '</td></tr>';
            });

            html += '</tbody></table></div>';
        }

        html += '</div>'; // card

        return html;
    }

    function init() {
        var btn1 = document.getElementById('dashNewInvoice');
        if (btn1) btn1.addEventListener('click', function() { RechApp.navigate('rechnung-neu'); });

        var btn2 = document.getElementById('dashNewOffer');
        if (btn2) btn2.addEventListener('click', function() { RechApp.navigate('angebot-neu'); });

        var btnUd = document.getElementById('dashGoUd');
        if (btnUd) btnUd.addEventListener('click', function() { RechApp.navigate('unternehmensdaten'); });

        var btnDoc = document.getElementById('dashGoDoc');
        if (btnDoc) btnDoc.addEventListener('click', function() { RechApp.navigate('dokumente'); });

        var e1 = document.getElementById('emptyNewInvoice');
        if (e1) e1.addEventListener('click', function() { RechApp.navigate('rechnung-neu'); });
        var e2 = document.getElementById('emptyNewOffer');
        if (e2) e2.addEventListener('click', function() { RechApp.navigate('angebot-neu'); });

        document.querySelectorAll('.dash-view').forEach(function(b) {
            b.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                Dokumente.showPreview(id);
            });
        });

        document.querySelectorAll('.dash-edit').forEach(function(b) {
            b.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                RechApp.navigate('rechnung-edit', { invoiceId: id });
            });
        });
    }

    return { render: render, init: init };
})();
