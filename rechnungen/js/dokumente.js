var Dokumente = (function() {

    function calcBrutto(invoice) {
        var isKlein = invoice.isKlein !== undefined ? invoice.isKlein : (Store.getSettings().ustMode === 'klein');
        var sum = 0;
        (invoice.positionen || []).forEach(function(pos) {
            var netto = pos.menge * pos.einzelpreis;
            var mwst = isKlein ? 0 : (netto * pos.mwstSatz / 100);
            sum += netto + mwst;
        });
        return sum;
    }

    // Teilzahlungen (Fund 9, Vollaudit 2026-07-23): additiv, ändert bewusst NICHT den
    // bestehenden Status-Enum (offen/bezahlt/ueberfaellig/storniert/versendet) — eine
    // Rechnung mit Teilzahlung bleibt "offen"/"ueberfaellig" (zählt weiter korrekt in
    // Dashboard/Mahnwesen als ausstehend), zeigt aber zusätzlich den Restbetrag an.
    function teilzahlungSumme(invoice) {
        var sum = 0;
        (invoice.teilzahlungen || []).forEach(function(t) { sum += t.betrag || 0; });
        return sum;
    }

    function restbetrag(invoice) {
        return Math.max(0, calcBrutto(invoice) - teilzahlungSumme(invoice));
    }

    function render() {
        var invoices = Store.getRechInvoices();
        var customers = Store.getRechCustomers();
        var customerMap = {};
        customers.forEach(function(c) { customerMap[c.id] = c; });

        var html = '<div class="page-header"><h2>Dokumente</h2><div class="page-header-actions">';
        html += '<button class="btn btn-primary" id="docNewInvoice">+ Neue Rechnung</button> ';
        html += '<button class="btn btn-success" id="docNewOffer">Neues Angebot</button>';
        html += '</div></div>';

        // Filter bar
        html += '<div class="filter-bar">';

        // Search
        html += '<div class="filter-group filter-search">';
        html += '<label class="form-label" for="filterSearch"><i class="ti ti-search"></i> Suche</label>';
        html += '<div class="filter-search-wrap"><i class="ti ti-search"></i>';
        html += '<input class="form-input" type="text" id="filterSearch" placeholder="Nr., Kunde, Betrag\u2026" autocomplete="off">';
        html += '</div></div>';

        // Typ
        html += '<div class="filter-group"><label class="form-label" for="filterTyp">Typ</label>';
        html += '<select class="form-select" id="filterTyp"><option value="">Alle Typen</option>';
        html += '<option value="rechnung">Rechnung</option><option value="angebot">Angebot</option>';
        html += '<option value="gutschrift">Gutschrift</option><option value="stornorechnung">Stornorechnung</option>';
        html += '</select></div>';

        // Status
        html += '<div class="filter-group"><label class="form-label" for="filterStatus">Status</label>';
        html += '<select class="form-select" id="filterStatus"><option value="">Alle Status</option>';
        html += '<option value="offen">Offen</option><option value="versendet">Versendet</option>';
        html += '<option value="bezahlt">Bezahlt</option><option value="ueberfaellig">\u00DCberf\u00E4llig</option>';
        html += '<option value="storniert">Storniert</option>';
        html += '</select></div>';

        // Von
        html += '<div class="filter-group"><label class="form-label" for="filterVon">Von</label>';
        html += '<input class="form-input" type="date" id="filterVon" style="min-width:130px;"></div>';

        // Bis
        html += '<div class="filter-group"><label class="form-label" for="filterBis">Bis</label>';
        html += '<input class="form-input" type="date" id="filterBis" style="min-width:130px;"></div>';

        // Kunde
        html += '<div class="filter-group"><label class="form-label" for="filterKunde">Kunde</label>';
        html += '<select class="form-select" id="filterKunde"><option value="">Alle Kunden</option>';
        customers.forEach(function(c) {
            html += '<option value="' + c.id + '">' + Utils.escapeHtml(c.firma || c.ansprechpartner) + '</option>';
        });
        html += '</select></div>';

        // Reset button
        html += '<div class="filter-group" style="justify-content:flex-end;">';
        html += '<label class="form-label">&nbsp;</label>';
        html += '<button class="btn btn-small btn-outline" id="filterReset" title="Filter zur\u00FCcksetzen" style="height:34px;padding:0 12px;"><i class="ti ti-filter-off"></i></button>';
        html += '</div>';

        html += '</div>';

        // Table
        html += '<div class="table-container"><table><thead><tr>';
        html += '<th scope="col">Nr.</th><th scope="col">Typ</th><th scope="col">Kunde</th><th scope="col">Datum</th><th scope="col">F\u00E4lligkeit</th><th scope="col">Betrag</th><th scope="col">Status</th><th scope="col">Aktionen</th>';
        html += '</tr></thead><tbody id="docTableBody">';

        var sorted = invoices.slice().sort(function(a, b) {
            return (b.datum || '').localeCompare(a.datum || '');
        });

        if (sorted.length === 0) {
            html += '<tr><td colspan="8" class="table-empty">Keine Dokumente vorhanden.</td></tr>';
        } else {
            sorted.forEach(function(inv) {
                html += renderRow(inv, customerMap);
            });
        }

        html += '</tbody></table></div>';
        return html;
    }

    function renderRow(inv, customerMap) {
        var kunde = customerMap[inv.kundeId];
        var kundeName = kunde ? Utils.escapeHtml(kunde.firma || kunde.ansprechpartner || '') : '-';

        var typLabel;
        if (inv.typ === 'rechnung') typLabel = 'Rechnung';
        else if (inv.typ === 'angebot') typLabel = 'Angebot';
        else if (inv.typ === 'gutschrift') typLabel = 'Gutschrift';
        else if (inv.typ === 'stornorechnung') typLabel = '<span style="color:#dc2626;">Stornorechnung</span>';
        else typLabel = inv.typ || '';

        var statusClass, statusLabel;
        switch (inv.status) {
            case 'bezahlt':    statusClass = 'badge-success'; statusLabel = 'Bezahlt'; break;
            case 'ueberfaellig': statusClass = 'badge-danger'; statusLabel = '\u00DCberf\u00E4llig'; break;
            case 'storniert':  statusClass = 'badge-neutral'; statusLabel = 'Storniert'; break;
            case 'versendet':  statusClass = 'badge-warning'; statusLabel = 'Versendet'; break;
            default:           statusClass = 'badge-info';    statusLabel = 'Offen';
        }

        var rowClass = '';
        if (inv.status === 'storniert') rowClass = 'row-storniert';
        else if (inv.typ === 'stornorechnung') rowClass = 'row-storno';

        var searchText = [(inv.nummer||''), kundeName, Utils.formatCurrency(calcBrutto(inv)), Utils.formatDate(inv.datum)].join(' ').toLowerCase();
        var html = '<tr data-id="' + inv.id + '" class="' + rowClass + '" data-typ="' + inv.typ + '" data-status="' + inv.status + '" data-kunde="' + (inv.kundeId || '') + '" data-datum="' + (inv.datum || '') + '" data-search="' + Utils.escapeHtml(searchText) + '">';
        html += '<td>' + Utils.escapeHtml(inv.nummer || '') + '</td>';
        html += '<td>' + typLabel + '</td>';
        html += '<td>' + kundeName + '</td>';
        html += '<td>' + Utils.formatDate(inv.datum) + '</td>';
        html += '<td>' + Utils.formatDate(inv.faelligkeit) + '</td>';
        html += '<td>' + Utils.formatCurrency(calcBrutto(inv));
        if (teilzahlungSumme(inv) > 0 && inv.status !== 'bezahlt' && inv.status !== 'storniert') {
            html += '<div style="font-size:11px;color:var(--text-muted);">davon gezahlt: ' + Utils.formatCurrency(teilzahlungSumme(inv)) + ' — Rest: <strong style="color:var(--text-secondary);">' + Utils.formatCurrency(restbetrag(inv)) + '</strong></div>';
        }
        html += '</td>';
        html += '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span>';
        if (inv.versendet && inv.versandDatum) {
            html += ' <span style="font-size:11px;color:var(--text-muted);"><i class="ti ti-send"></i> ' + Utils.formatDate(inv.versandDatum) + '</span>';
        }
        // Lager-Verknüpfungs-Badges
        var lagerIds = (inv.positionen || []).map(function(p) { return p.lagerArtikelId; }).filter(Boolean);
        var ebIds = (inv.verknuepfteEigenbelege || []).length;
        if (lagerIds.length > 0) {
            html += ' <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:var(--success,#10b981);" title="' + lagerIds.length + ' Lagerartikel verknüpft"><i class="ti ti-package"></i> ' + lagerIds.length + '</span>';
        }
        if (ebIds > 0) {
            html += ' <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,0.12);color:var(--accent);" title="' + ebIds + ' Eigenbelege verknüpft"><i class="ti ti-receipt"></i> ' + ebIds + '</span>';
        }
        if (inv.typ === 'angebot' && inv._convertedToInvoiceId) {
            html += ' <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:var(--success,#10b981);" title="Bereits in Rechnung umgewandelt"><i class="ti ti-arrow-right"></i> Rechnung erstellt</span>';
        }
        html += '</td>';
        html += '<td class="table-actions" style="white-space:nowrap;">';
        html += '<button class="action-btn doc-view" data-id="' + inv.id + '" title="Vorschau"><i class="ti ti-eye"></i></button> ';

        if (inv.typ !== 'stornorechnung' && !Store._isRechInvoiceLocked(inv)) {
            html += '<button class="action-btn action-btn-accent doc-edit" data-id="' + inv.id + '" title="Bearbeiten"><i class="ti ti-pencil"></i></button> ';
        } else if (inv.typ !== 'stornorechnung' && inv.status !== 'storniert') {
            html += '<span class="action-btn" title="Gestellte Rechnung — nur per Storno korrigierbar (§14 UStG)" style="opacity:.5;cursor:not-allowed;"><i class="ti ti-lock"></i></span> ';
        }
        if (inv.status === 'offen' || inv.status === 'ueberfaellig' || inv.status === 'versendet') {
            html += '<button class="action-btn action-btn-success doc-paid" data-id="' + inv.id + '" title="Als bezahlt markieren"><i class="ti ti-check"></i></button> ';
        }
        if (inv.typ === 'rechnung' && (inv.status === 'offen' || inv.status === 'ueberfaellig' || inv.status === 'versendet')) {
            html += '<button class="action-btn doc-teilzahlung" data-id="' + inv.id + '" title="Teilzahlung erfassen"><i class="ti ti-cash"></i></button> ';
        }
        if (inv.typ === 'rechnung' && (inv.status === 'offen' || inv.status === 'ueberfaellig' || inv.status === 'versendet')) {
            html += '<button class="action-btn action-btn-warning doc-mahnung" data-id="' + inv.id + '" title="Mahnung erstellen"><i class="ti ti-bell-ringing"></i></button> ';
            html += '<button class="action-btn doc-send" data-id="' + inv.id + '" title="Versenden"><i class="ti ti-send"></i></button> ';
        }
        if (inv.typ === 'angebot' && inv.status === 'offen' && !inv._convertedToInvoiceId) {
            html += '<button class="action-btn action-btn-accent doc-convert" data-id="' + inv.id + '" title="In Rechnung umwandeln"><i class="ti ti-arrow-right"></i></button> ';
        }
        if (inv.typ === 'rechnung' || inv.typ === 'angebot') {
            html += '<button class="action-btn doc-duplicate" data-id="' + inv.id + '" title="Duplizieren"><i class="ti ti-copy"></i></button> ';
        }
        html += '<button class="action-btn doc-pdf" data-id="' + inv.id + '" title="PDF / Drucken"><i class="ti ti-file-download"></i></button> ';
        if (inv.typ === 'rechnung' || inv.typ === 'gutschrift') {
            html += '<button class="action-btn doc-xrechnung" data-id="' + inv.id + '" title="XRechnung XML exportieren (EN 16931)" style="font-size:10px;font-weight:700;letter-spacing:.3px;">XR</button> ';
        }
        if (inv.typ !== 'stornorechnung' && inv.status !== 'storniert') {
            html += '<button class="action-btn action-btn-danger doc-cancel" data-id="' + inv.id + '" title="Stornieren"><i class="ti ti-ban"></i></button> ';
        }
        html += '</td></tr>';
        return html;
    }

    function applyFilters() {
        var typ = document.getElementById('filterTyp').value;
        var status = document.getElementById('filterStatus').value;
        var von = document.getElementById('filterVon').value;
        var bis = document.getElementById('filterBis').value;
        var kunde = document.getElementById('filterKunde').value;
        var searchEl = document.getElementById('filterSearch');
        var search = searchEl ? searchEl.value.trim().toLowerCase() : '';

        var rows = document.querySelectorAll('#docTableBody tr');
        rows.forEach(function(row) {
            if (!row.getAttribute('data-id')) return;
            var show = true;
            if (typ && row.getAttribute('data-typ') !== typ) show = false;
            if (status && row.getAttribute('data-status') !== status) show = false;
            if (kunde && row.getAttribute('data-kunde') !== kunde) show = false;
            var rowDate = row.getAttribute('data-datum') || '';
            if (von && rowDate < von) show = false;
            if (bis && rowDate > bis) show = false;
            if (search) {
                var rowSearch = (row.getAttribute('data-search') || '').toLowerCase();
                if (rowSearch.indexOf(search) === -1) show = false;
            }
            row.style.display = show ? '' : 'none';
        });
    }

    function showPreview(id) {
        var invoices = Store.getRechInvoices();
        var inv = invoices.find(function(i) { return i.id === id; });
        if (!inv) return;

        var overlay = document.getElementById('modalOverlay');
        var modal = document.getElementById('modal');

        modal.innerHTML = Rechnung.generatePreviewHtml(inv);
        modal.style.padding = '0';
        modal.style.overflow = 'auto';
        modal.style.maxHeight = '90vh';

        var toolbar = document.createElement('div');
        toolbar.style.cssText = 'position:fixed;top:14px;right:14px;z-index:10001;display:flex;gap:8px;align-items:center;';

        var printBtn = document.createElement('button');
        printBtn.innerHTML = '&#x1F4BE; PDF / Drucken';
        printBtn.style.cssText = 'background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);';

        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = 'background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);';

        toolbar.appendChild(printBtn);
        toolbar.appendChild(closeBtn);
        document.body.appendChild(toolbar);

        overlay.classList.add('active');

        function closePreview() {
            overlay.classList.remove('active');
            modal.innerHTML = '';
            modal.style.padding = '';
            modal.style.overflow = '';
            modal.style.maxHeight = '';
            if (toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
            overlay.removeEventListener('click', overlayHandler);
        }
        function overlayHandler(e) { if (e.target === overlay) closePreview(); }

        printBtn.addEventListener('click', function() { Rechnung.printInvoiceWindow(Rechnung.generatePreviewHtml(inv), false); });
        closeBtn.addEventListener('click', closePreview);
        overlay.addEventListener('click', overlayHandler);
    }

    function showStornoModal(id) {
        var invoices = Store.getRechInvoices();
        var inv = invoices.find(function(i) { return i.id === id; });
        if (!inv) return;

        var previewNr = Store.peekStornoNumber();

        var body = '<div style="margin-bottom:12px;">';
        body += '<p style="color:var(--text-secondary);font-size:13px;">Rechnung <strong>' + Utils.escapeHtml(inv.nummer || '') + '</strong> stornieren.</p>';
        body += '<p style="color:var(--text-secondary);font-size:13px;margin-top:6px;">Es wird automatisch eine Stornorechnung <strong>' + Utils.escapeHtml(previewNr) + '</strong> mit negativen Betr\u00E4gen erstellt. Die urspr\u00FCngliche Rechnung wird als <em>storniert</em> markiert.</p>';
        body += '</div>';

        body += '<div class="form-group"><label class="form-label" for="stornoGrund">Stornogrund <span style="color:var(--danger,#dc2626)">*</span></label>';
        body += '<select class="form-select" id="stornoGrund">';
        body += '<option value="">-- Bitte w\u00E4hlen --</option>';
        body += '<option value="fehler">Falsche Angaben / Tippfehler</option>';
        body += '<option value="doppelt">Doppelt ausgestellt</option>';
        body += '<option value="auftrag">Auftrag storniert</option>';
        body += '<option value="ware_zurueck">Ware zur\u00FCckgegeben</option>';
        body += '<option value="einigung">Einigung mit Kunde</option>';
        body += '<option value="sonstiges">Sonstiges</option>';
        body += '</select></div>';

        body += '<div class="form-group" id="stornoFreitextGroup" style="display:none;"><label class="form-label" for="stornoFreitext">Freitext Begr\u00FCndung</label>';
        body += '<input class="form-input" type="text" id="stornoFreitext" placeholder="Bitte Grund eingeben..."></div>';

        body += '<div style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:10px 14px;margin-top:8px;font-size:12px;color:#b91c1c;">';
        body += '\u26A0\uFE0F Diese Aktion kann nicht r\u00FCckg\u00E4ngig gemacht werden (GoBD-Konformit\u00E4t).';
        body += '</div>';

        var footer = '<button class="btn btn-danger" id="confirmStorno">Stornorechnung erstellen</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';

        RechApp.showModal('Rechnung stornieren', body, footer);

        document.getElementById('stornoGrund').addEventListener('change', function() {
            document.getElementById('stornoFreitextGroup').style.display = this.value === 'sonstiges' ? '' : 'none';
        });

        document.getElementById('confirmStorno').addEventListener('click', async function() {
            var grund = document.getElementById('stornoGrund').value;
            if (!grund) {
                Utils.showToast('Bitte einen Stornogrund ausw\u00E4hlen.', 'error');
                return;
            }
            var grundText = '';
            if (grund === 'sonstiges') {
                grundText = (document.getElementById('stornoFreitext').value || '').trim();
                if (!grundText) {
                    Utils.showToast('Bitte einen Freitext-Grund eingeben.', 'error');
                    return;
                }
            }
            if (this.disabled) return;
            this.disabled = true;
            await Store.createStornoRechnung(id, grund, grundText);
            Utils.showToast('Stornorechnung erstellt.', 'success');
            RechApp.closeModal();
            RechApp.navigate('dokumente');
        });
    }

    function showSendModal(id) {
        var invoices = Store.getRechInvoices();
        var inv = invoices.find(function(i) { return i.id === id; });
        if (!inv) return;
        var settings = Store.getSettings();
        var customers = Store.getRechCustomers();
        var kunde = customers.find(function(c) { return c.id === inv.kundeId; });
        var kundeEmail = kunde ? (kunde.email || '') : '';
        var brutto = 0;
        var isKlein = inv.isKlein !== undefined ? inv.isKlein : (settings.ustMode === 'klein');
        (inv.positionen || []).forEach(function(pos) {
            var netto = pos.menge * pos.einzelpreis;
            var mwst = isKlein ? 0 : (netto * pos.mwstSatz / 100);
            brutto += netto + mwst;
        });

        var subject = 'Rechnung ' + (inv.nummer || '') + ' von ' + (settings.firmenname || '');
        var mailBody = 'Sehr geehrte Damen und Herren,\n\nbitte begleichen Sie beigef\u00FCgte Rechnung ' + (inv.nummer || '') + ' \u00FCber ' + Utils.formatCurrency(brutto) + '.\n\nF\u00E4lligkeitsdatum: ' + Utils.formatDate(inv.faelligkeit) + '\nIBAN: ' + (settings.iban || '-') + '\nVerwendungszweck: ' + (inv.nummer || '') + '\n\nMit freundlichen Gr\u00FC\u00DFen\n' + (settings.firmenname || '');
        var mailtoHref = 'mailto:' + encodeURIComponent(kundeEmail) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(mailBody);

        var alreadySent = inv.versendet;

        var body = '';
        if (alreadySent) {
            body += '<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#065f46;">';
            body += '\u2705 Diese Rechnung wurde bereits am ' + Utils.formatDate(inv.versandDatum) + ' als versendet markiert.';
            body += '</div>';
        }

        body += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">Rechnung <strong>' + Utils.escapeHtml(inv.nummer || '') + '</strong> \u2013 ' + Utils.formatCurrency(brutto) + '</div>';

        body += '<div style="display:flex;flex-direction:column;gap:10px;">';

        // Option A: PDF print
        body += '<div style="border:1px solid var(--border);border-radius:8px;padding:14px;">';
        body += '<div style="font-weight:600;margin-bottom:6px;">\uD83D\uDCE5 PDF herunterladen / drucken</div>';
        body += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">PDF in neuem Fenster \u00F6ffnen und speichern oder drucken.</div>';
        body += '<button class="btn btn-primary" id="sendOptPdf">PDF \u00F6ffnen</button>';
        body += '</div>';

        // Option B: mailto
        body += '<div style="border:1px solid var(--border);border-radius:8px;padding:14px;">';
        body += '<div style="font-weight:600;margin-bottom:6px;">\uD83D\uDCE7 Per E-Mail senden</div>';
        if (kundeEmail) {
            body += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">E-Mail-Client \u00F6ffnen mit vorausgef\u00FClltem Betreff und Text.</div>';
            body += '<a class="btn btn-success" href="' + mailtoHref + '" target="_blank" id="sendOptMail">E-Mail \u00F6ffnen</a>';
        } else {
            body += '<div style="font-size:12px;color:var(--text-muted);">Keine E-Mail-Adresse beim Kunden hinterlegt.</div>';
        }
        body += '</div>';

        // Option C: copy text
        body += '<div style="border:1px solid var(--border);border-radius:8px;padding:14px;">';
        body += '<div style="font-weight:600;margin-bottom:6px;">\uD83D\uDCCB Text kopieren</div>';
        body += '<textarea class="form-input" id="sendCopyText" rows="6" style="font-size:11px;font-family:monospace;" readonly>' + Utils.escapeHtml(mailBody) + '</textarea>';
        body += '<button class="btn" id="sendOptCopy" style="margin-top:8px;">In Zwischenablage kopieren</button>';
        body += '</div>';

        body += '</div>'; // options

        // Versand bestätigen
        body += '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">';
        body += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">';
        body += '<input type="checkbox" id="sendConfirmCheck"' + (alreadySent ? ' checked disabled' : '') + '>';
        body += 'Ich habe die Rechnung versendet \u2013 als <em>Versendet</em> markieren';
        body += '</label>';
        body += '</div>';

        var footer = '<button class="btn btn-success" id="confirmSendStatus">Speichern &amp; Schlie\u00DFen</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';

        RechApp.showModal('Rechnung versenden', body, footer);

        // Versand-Checkbox nach jeder Versandaktion automatisch vorbelegen — sonst bleibt der
        // Status trotz tatsächlichem Versand auf "Offen", wenn die separate Checkbox vergessen
        // wird (Fund 12, Vollaudit 2026-07-23). Nutzer kann sie weiterhin manuell abwählen.
        function markSendConfirmed() {
            var check = document.getElementById('sendConfirmCheck');
            if (check && !alreadySent) check.checked = true;
        }

        document.getElementById('sendOptPdf').addEventListener('click', function() {
            Rechnung.printInvoiceWindow(Rechnung.generatePreviewHtml(inv), false);
            markSendConfirmed();
        });

        var sendOptMailEl = document.getElementById('sendOptMail');
        if (sendOptMailEl) sendOptMailEl.addEventListener('click', markSendConfirmed);

        document.getElementById('sendOptCopy').addEventListener('click', function() {
            var ta = document.getElementById('sendCopyText');
            ta.select();
            try {
                navigator.clipboard.writeText(ta.value).catch(function() { document.execCommand('copy'); });
            } catch(e) { document.execCommand('copy'); }
            Utils.showToast('Text kopiert!', 'success');
            markSendConfirmed();
        });

        document.getElementById('confirmSendStatus').addEventListener('click', function() {
            if (document.getElementById('sendConfirmCheck').checked && !alreadySent) {
                var s14 = Store.getRechUnternehmen ? Store.getRechUnternehmen() : {};
                if (inv.typ === 'rechnung' && settings.land !== 'CH' && !s14.steuernummer && !s14.ustId) {
                    Utils.showToast('⛔ Steuernummer/USt-IdNr. fehlt – §14 UStG Pflichtangabe. Bitte in Einstellungen ergänzen.', 'error');
                    return;
                }
                Store.setVersandStatus(id);
                Utils.showToast('Als versendet markiert.', 'success');
            }
            RechApp.closeModal();
            RechApp.navigate('dokumente');
        });
    }

    function showBezahltModal(inv) {
        var platforms = Store.getPlatforms();
        var purchases = Store.getPurchases();
        var invPlattform = inv.verkaufsplattform || '';

        var platOptions = platforms.map(function(p) {
            return '<option value="' + Utils.escapeHtml(p) + '"' + (p === invPlattform ? ' selected' : '') + '>' + Utils.escapeHtml(p) + '</option>';
        }).join('');

        // Bereits in Positionen verknüpfte Lager-Artikel ermitteln — diese wurden beim
        // Verknüpfen in der Rechnung bereits als "verkauft" markiert (nicht erst hier),
        // daher hier bewusst ohne Status-Filter suchen.
        var posLinkedIds = (inv.positionen || [])
            .map(function(p) { return p.lagerArtikelId; })
            .filter(Boolean);
        var posLinkedArts = posLinkedIds.map(function(id) {
            return purchases.find(function(p) { return p.id === id; });
        }).filter(Boolean);

        var lagerOptions = '<option value="">-- Kein weiterer Lagerartikel --</option>';
        purchases.forEach(function(p) {
            if (p.status === 'verfuegbar' && posLinkedIds.indexOf(p.id) === -1) {
                lagerOptions += '<option value="' + p.id + '">' + Utils.escapeHtml((p.marke || '') + ' ' + (p.artikeltyp || '') + ' ' + (p.beschreibung || '')) + ' (' + Utils.formatCurrency(p.einkaufspreis) + ')</option>';
            }
        });

        var body = '<div class="form-group"><p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">Rechnung <strong>' + Utils.escapeHtml(inv.nummer || '') + '</strong> als bezahlt markieren und automatisch als Verkauf im Reselling-Tool eintragen.</p></div>';

        // Verknüpfte Artikel aus Positionen anzeigen
        if (posLinkedArts.length > 0) {
            body += '<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px 14px;margin-bottom:14px;">';
            body += '<div style="font-weight:600;font-size:12px;color:#065f46;margin-bottom:6px;">✅ ' + posLinkedArts.length + ' Lagerartikel aus Positionen sind bereits als <em>Verkauft</em> markiert (Verkaufsdatum wird auf das Zahlungsdatum aktualisiert):</div>';
            posLinkedArts.forEach(function(a) {
                body += '<div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">• <span style="font-family:monospace;color:var(--accent);">' + Utils.escapeHtml(a.artikelNr || '—') + '</span> ' + Utils.escapeHtml((a.marke || '') + ' ' + (a.artikeltyp || '') + (a.beschreibung ? ' – ' + a.beschreibung : '')) + ' (' + Utils.formatCurrency(a.einkaufspreis) + ')</div>';
            });
            body += '</div>';
        }

        body += '<div class="form-group"><label class="form-label" for="bezahltPlattform">Verkaufsplattform</label>';
        body += '<select class="form-select" id="bezahltPlattform">' + platOptions + '</select></div>';

        body += '<div class="form-group"><label class="form-label" for="bezahltEkTyp">Einkaufspreis (fuer Marge)</label>';
        body += '<select class="form-select" id="bezahltEkTyp">';
        if (posLinkedArts.length > 0) {
            body += '<option value="keine" selected>Automatisch aus Lager-Verknüpfung</option>';
        } else {
            body += '<option value="keine">Kein EK eintragen</option>';
        }
        body += '<option value="lager">Weiteren Lagerartikel verknüpfen</option>';
        body += '<option value="manuell">Manuell eingeben</option>';
        body += '</select></div>';

        body += '<div class="form-group" id="bezahltLagerGroup" style="display:none;"><label class="form-label" for="bezahltPurchaseId">Lagerartikel auswaehlen</label>';
        body += '<select class="form-select" id="bezahltPurchaseId">' + lagerOptions + '</select></div>';

        body += '<div class="form-group" id="bezahltManualGroup" style="display:none;"><label class="form-label" for="bezahltManualEK">Einkaufspreis (\u20AC)</label>';
        body += '<input type="number" step="0.01" min="0" max="99999999" class="form-input" id="bezahltManualEK" placeholder="0,00"></div>';

        var footer = '<button class="btn btn-success" id="confirmBezahlt">Bezahlt markieren &amp; Verkauf eintragen</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';

        RechApp.showModal('Als bezahlt markieren', body, footer);

        document.getElementById('bezahltEkTyp').addEventListener('change', function() {
            document.getElementById('bezahltLagerGroup').style.display = this.value === 'lager' ? '' : 'none';
            document.getElementById('bezahltManualGroup').style.display = this.value === 'manuell' ? '' : 'none';
        });

        document.getElementById('confirmBezahlt').addEventListener('click', function() {
            var platform = document.getElementById('bezahltPlattform').value;
            var ekTyp = document.getElementById('bezahltEkTyp').value;
            var purchaseId = ekTyp === 'lager' ? document.getElementById('bezahltPurchaseId').value : null;
            var manualEK = ekTyp === 'manuell' ? document.getElementById('bezahltManualEK').value : null;

            // Lagerartikel aus Positionen automatisch als verkauft markieren
            posLinkedArts.forEach(function(art) {
                var updated = Object.assign({}, art, { status: 'verkauft', verkaufsdatum: Utils.todayISO() });
                Store.savePurchase(updated);
            });

            inv.status = 'bezahlt';
            inv.bezahltAm = Utils.todayISO();
            inv.verkaufsplattform = platform;
            Store.saveRechInvoice(inv);

            // EK aus erstem verknüpften Positions-Artikel nehmen, falls kein manueller EK
            var ekPurchaseId = purchaseId;
            if (!ekPurchaseId && posLinkedArts.length > 0 && !manualEK) {
                ekPurchaseId = posLinkedArts[0].id;
            }
            Store.createSaleFromInvoice(inv, platform, ekPurchaseId || null, manualEK);

            var msg = 'Als bezahlt markiert und Verkauf eingetragen!';
            if (posLinkedArts.length > 0) msg += ' ' + posLinkedArts.length + ' Lagerartikel als verkauft markiert.';
            Utils.showToast(msg, 'success');
            RechApp.closeModal();
            RechApp.navigate('dokumente');
        });
    }

    // Baut aus einem bestehenden Dokument eine neue Kopie (neue Nummer/ID, heutiges Datum,
    // Status "offen"). Mahnungen/Teilzahlungen/Eigenbeleg-Verknüpfungen werden NICHT übernommen
    // (gehören zum Original). Lager-Verknüpfungen werden gekappt, sonst würde ein bereits
    // verkaufter Artikel auf der Kopie erneut als verfügbar/verkauft geführt.
    // Für: Fund 22 (Duplizieren) und Fund 15 (Angebot→Rechnung), Vollaudit 2026-07-23.
    async function buildDocumentCopy(orig, targetTyp) {
        var nummer = await Store.nextRechInvoiceNumber(targetTyp);
        var heute = Utils.todayISO();
        var faelligkeit = '';
        if (orig.datumsOption === 'faelligkeit') {
            var d = new Date(heute);
            d.setDate(d.getDate() + 14);
            faelligkeit = d.toLocaleDateString('sv-SE');
        }
        return {
            id: Store.generateId(),
            typ: targetTyp,
            isKlein: orig.isKlein,
            nummer: nummer,
            datum: heute,
            faelligkeit: faelligkeit,
            datumsOption: orig.datumsOption,
            lieferdatum: orig.lieferdatum,
            lieferVon: orig.lieferVon,
            lieferBis: orig.lieferBis,
            kundeId: orig.kundeId,
            positionen: (orig.positionen || []).map(function(p) {
                var c = Object.assign({}, p);
                c.lagerArtikelId = null;
                return c;
            }),
            zahlungsbedingungen: orig.zahlungsbedingungen,
            notizen: orig.notizen,
            verkaufsplattform: orig.verkaufsplattform,
            status: 'offen',
            mahnungen: [],
            teilzahlungen: [],
            verknuepfteEigenbelege: [],
            createdAt: new Date().toISOString()
        };
    }

    async function duplicateInvoice(id) {
        var invoices = Store.getRechInvoices();
        var orig = invoices.find(function(i) { return i.id === id; });
        if (!orig) return;

        var copy = await buildDocumentCopy(orig, orig.typ);
        Store.saveRechInvoice(copy);
        Utils.showToast((orig.typ === 'angebot' ? 'Angebot' : 'Rechnung') + ' ' + copy.nummer + ' als Kopie erstellt', 'success');
        RechApp.navigate('rechnung-edit', { invoiceId: copy.id });
    }

    // Angebot → Rechnung, 1-Klick (Fund 15). Angebot bleibt bestehen, bekommt aber einen
    // Verweis auf die erzeugte Rechnung (_convertedToInvoiceId) für die Anzeige.
    async function convertAngebotToRechnung(id) {
        var invoices = Store.getRechInvoices();
        var orig = invoices.find(function(i) { return i.id === id; });
        if (!orig || orig.typ !== 'angebot') return;

        var rechnung = await buildDocumentCopy(orig, 'rechnung');
        Store.saveRechInvoice(rechnung);

        orig._convertedToInvoiceId = rechnung.id;
        Store.saveRechInvoice(orig);

        Utils.showToast('Rechnung ' + rechnung.nummer + ' aus Angebot erstellt', 'success');
        RechApp.navigate('rechnung-edit', { invoiceId: rechnung.id });
    }

    function showTeilzahlungModal(id) {
        var invoices = Store.getRechInvoices();
        var inv = invoices.find(function(i) { return i.id === id; });
        if (!inv) return;

        var brutto = calcBrutto(inv);
        var bezahltBisher = teilzahlungSumme(inv);
        var rest = restbetrag(inv);

        var body = '<div class="form-group"><p style="color:var(--text-secondary);font-size:13px;">Rechnung <strong>' + Utils.escapeHtml(inv.nummer || '') + '</strong> — Gesamtbetrag ' + Utils.formatCurrency(brutto) + '</p></div>';
        if (bezahltBisher > 0) {
            body += '<div class="form-group"><p style="color:var(--text-secondary);font-size:13px;">Bisher gezahlt: ' + Utils.formatCurrency(bezahltBisher) + ' — Rest: <strong>' + Utils.formatCurrency(rest) + '</strong></p></div>';
        }
        body += '<div class="form-group"><label class="form-label" for="teilzBetrag">Zahlungseingang (€)</label>';
        body += '<input class="form-input" type="number" step="0.01" min="0.01" max="' + rest.toFixed(2) + '" id="teilzBetrag" placeholder="0,00"></div>';
        body += '<div class="form-group"><label class="form-label" for="teilzDatum">Zahlungsdatum</label>';
        body += '<input class="form-input" type="date" id="teilzDatum" value="' + Utils.todayISO() + '"></div>';

        var footer = '<button class="btn btn-success" id="confirmTeilzahlung">Zahlungseingang erfassen</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';
        RechApp.showModal('Teilzahlung erfassen', body, footer);

        document.getElementById('confirmTeilzahlung').addEventListener('click', function() {
            var betrag = parseFloat(document.getElementById('teilzBetrag').value);
            var datum = document.getElementById('teilzDatum').value || Utils.todayISO();
            if (!betrag || betrag <= 0) {
                Utils.showToast('Bitte einen gültigen Betrag angeben.', 'warning');
                return;
            }
            if (betrag >= rest - 0.001) {
                // Restschuld gedeckt: statt Sackgasse direkt in den bestehenden Bezahlt-Flow
                // (inkl. Lager-Sync/EK-Erfassung) überleiten, keine zweite Statuslogik pflegen.
                RechApp.closeModal();
                showBezahltModal(inv);
                Utils.showToast('Restbetrag gedeckt — bitte Zahlung final bestätigen.', 'info');
                return;
            }
            if (!inv.teilzahlungen) inv.teilzahlungen = [];
            inv.teilzahlungen.push({ datum: datum, betrag: betrag });
            // Rückgabewert prüfen statt blind Erfolg zu melden — saveRechInvoice liefert null,
            // wenn die Rechnung GoBD-gesperrt ist (versendet-Status oder abgeschlossene Periode),
            // sonst würde die Teilzahlung still verworfen und trotzdem "erfasst" gemeldet.
            var saved = Store.saveRechInvoice(inv);
            if (!saved) {
                inv.teilzahlungen.pop();
                Utils.showToast('⛔ Konnte nicht gespeichert werden — Rechnung ist GoBD-gesperrt (versendet oder Periode abgeschlossen).', 'error');
                return;
            }
            Utils.showToast('Teilzahlung erfasst — Rest: ' + Utils.formatCurrency(restbetrag(inv)), 'success');
            RechApp.closeModal();
            RechApp.navigate('dokumente');
        });
    }

    function init() {
        document.getElementById('docNewInvoice').addEventListener('click', function() { RechApp.navigate('rechnung-neu'); });
        document.getElementById('docNewOffer').addEventListener('click', function() { RechApp.navigate('angebot-neu'); });

        ['filterTyp', 'filterStatus', 'filterVon', 'filterBis', 'filterKunde'].forEach(function(fid) {
            var el = document.getElementById(fid);
            if (el) el.addEventListener('change', applyFilters);
        });
        var searchEl = document.getElementById('filterSearch');
        if (searchEl) searchEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') applyFilters();
            else if (e.key === 'Escape') { searchEl.value = ''; applyFilters(); }
        });

        var resetBtn = document.getElementById('filterReset');
        if (resetBtn) resetBtn.addEventListener('click', function() {
            ['filterTyp','filterStatus','filterVon','filterBis','filterKunde'].forEach(function(fid) {
                var el = document.getElementById(fid); if (el) el.value = '';
            });
            if (searchEl) searchEl.value = '';
            applyFilters();
        });

        document.querySelectorAll('.doc-view').forEach(function(btn) {
            btn.addEventListener('click', function() { showPreview(this.getAttribute('data-id')); });
        });

        document.querySelectorAll('.doc-edit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var invoices = Store.getRechInvoices();
                var inv = invoices.find(function(i) { return i.id === id; });
                if (inv && (inv.status === 'bezahlt' || inv.status === 'storniert' || inv.status === 'versendet')) {
                    var statusLabel = { bezahlt:'Bezahlt', storniert:'Storniert', versendet:'Versendet' }[inv.status] || inv.status;
                    alert('Dieses Dokument ist gesperrt.\n\nStatus: ' + statusLabel + '\nGrund: GoBD §146 – Buchungen müssen unveränderlich sein.\n\nFür Korrekturen: Dokument stornieren und neu ausstellen.');
                    return;
                }
                RechApp.navigate('rechnung-edit', { invoiceId: id });
            });
        });

        document.querySelectorAll('.doc-duplicate').forEach(function(btn) {
            btn.addEventListener('click', function() {
                duplicateInvoice(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.doc-convert').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!confirm('Angebot in eine neue Rechnung umwandeln?')) return;
                convertAngebotToRechnung(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.doc-teilzahlung').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showTeilzahlungModal(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.doc-paid').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var invoices = Store.getRechInvoices();
                var inv = invoices.find(function(i) { return i.id === id; });
                if (!inv) return;
                if (inv.typ === 'rechnung') {
                    showBezahltModal(inv);
                } else {
                    inv.status = 'bezahlt';
                    inv.bezahltAm = Utils.todayISO();
                    Store.saveRechInvoice(inv);
                    Utils.showToast('Als bezahlt markiert', 'success');
                    RechApp.navigate('dokumente');
                }
            });
        });

        document.querySelectorAll('.doc-mahnung').forEach(function(btn) {
            btn.addEventListener('click', function() {
                RechApp.navigate('mahnungen', { invoiceId: this.getAttribute('data-id') });
            });
        });

        document.querySelectorAll('.doc-send').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showSendModal(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.doc-cancel').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showStornoModal(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.doc-pdf').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showPreview(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.doc-xrechnung').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var invoices = Store.getRechInvoices();
                var inv = invoices.find(function(i) { return i.id === id; });
                if (inv && typeof XRechnung !== 'undefined') {
                    XRechnung.download(inv);
                } else {
                    Utils.showToast('XRechnung-Modul nicht geladen', 'error');
                }
            });
        });
    }

    return { render: render, init: init, showPreview: showPreview, showStornoModal: showStornoModal, showSendModal: showSendModal, showBezahltModal: showBezahltModal };
})();
