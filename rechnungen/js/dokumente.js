var Dokumente = (function() {

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
        var customers = Store.getRechCustomers();
        var customerMap = {};
        customers.forEach(function(c) { customerMap[c.id] = c; });

        var html = '<div class="page-header"><h2>Dokumente</h2><div class="page-header-actions">';
        html += '<button class="btn btn-primary" id="docNewInvoice">+ Neue Rechnung</button> ';
        html += '<button class="btn btn-success" id="docNewOffer">Neues Angebot</button>';
        html += '</div></div>';

        // Filter bar
        html += '<div class="filter-bar">';
        html += '<div class="filter-group"><label class="form-label">Typ</label>';
        html += '<select class="form-select" id="filterTyp"><option value="">Alle</option>';
        html += '<option value="rechnung">Rechnung</option><option value="angebot">Angebot</option>';
        html += '<option value="gutschrift">Gutschrift</option><option value="stornorechnung">Stornorechnung</option>';
        html += '</select></div>';

        html += '<div class="filter-group"><label class="form-label">Status</label>';
        html += '<select class="form-select" id="filterStatus"><option value="">Alle</option>';
        html += '<option value="offen">Offen</option>';
        html += '<option value="versendet">Versendet</option>';
        html += '<option value="bezahlt">Bezahlt</option>';
        html += '<option value="ueberfaellig">\u00DCberf\u00E4llig</option>';
        html += '<option value="storniert">Storniert</option>';
        html += '</select></div>';

        html += '<div class="filter-group"><label class="form-label">Von</label>';
        html += '<input class="form-input" type="date" id="filterVon"></div>';

        html += '<div class="filter-group"><label class="form-label">Bis</label>';
        html += '<input class="form-input" type="date" id="filterBis"></div>';

        html += '<div class="filter-group"><label class="form-label">Kunde</label>';
        html += '<select class="form-select" id="filterKunde"><option value="">Alle</option>';
        customers.forEach(function(c) {
            html += '<option value="' + c.id + '">' + Utils.escapeHtml(c.firma || c.ansprechpartner) + '</option>';
        });
        html += '</select></div>';
        html += '</div>';

        // Table
        html += '<div class="table-container"><table><thead><tr>';
        html += '<th>Nr.</th><th>Typ</th><th>Kunde</th><th>Datum</th><th>F\u00E4lligkeit</th><th>Betrag</th><th>Status</th><th>Aktionen</th>';
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

        var html = '<tr data-id="' + inv.id + '" class="' + rowClass + '" data-typ="' + inv.typ + '" data-status="' + inv.status + '" data-kunde="' + (inv.kundeId || '') + '" data-datum="' + (inv.datum || '') + '">';
        html += '<td>' + Utils.escapeHtml(inv.nummer || '') + '</td>';
        html += '<td>' + typLabel + '</td>';
        html += '<td>' + kundeName + '</td>';
        html += '<td>' + Utils.formatDate(inv.datum) + '</td>';
        html += '<td>' + Utils.formatDate(inv.faelligkeit) + '</td>';
        html += '<td>' + Utils.formatCurrency(calcBrutto(inv)) + '</td>';
        html += '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span>';
        if (inv.versendet && inv.versandDatum) {
            html += ' <span style="font-size:11px;color:var(--text-muted);">📤 ' + Utils.formatDate(inv.versandDatum) + '</span>';
        }
        // Lager-Verknüpfungs-Badges
        var lagerIds = (inv.positionen || []).map(function(p) { return p.lagerArtikelId; }).filter(Boolean);
        var ebIds = (inv.verknuepfteEigenbelege || []).length;
        if (lagerIds.length > 0) {
            html += ' <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:var(--success,#10b981);" title="' + lagerIds.length + ' Lagerartikel verknüpft">📦 ' + lagerIds.length + '</span>';
        }
        if (ebIds > 0) {
            html += ' <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,0.12);color:var(--accent);" title="' + ebIds + ' Eigenbelege verknüpft">🧾 ' + ebIds + '</span>';
        }
        html += '</td>';
        html += '<td class="table-actions">';
        html += '<button class="btn btn-small doc-view" data-id="' + inv.id + '">Anzeigen</button> ';

        if (inv.typ !== 'stornorechnung') {
            html += '<button class="btn btn-small btn-primary doc-edit" data-id="' + inv.id + '">Bearbeiten</button> ';
        }
        if (inv.status === 'offen' || inv.status === 'ueberfaellig' || inv.status === 'versendet') {
            html += '<button class="btn btn-small btn-success doc-paid" data-id="' + inv.id + '">Bezahlt</button> ';
        }
        if (inv.typ === 'rechnung' && (inv.status === 'offen' || inv.status === 'ueberfaellig' || inv.status === 'versendet')) {
            html += '<button class="btn btn-small btn-warning doc-mahnung" data-id="' + inv.id + '">Mahnung</button> ';
            html += '<button class="btn btn-small doc-send" data-id="' + inv.id + '" title="Rechnung versenden">\uD83D\uDCE4 Senden</button> ';
        }
        if (inv.typ !== 'stornorechnung' && inv.status !== 'storniert') {
            html += '<button class="btn btn-small doc-cancel" data-id="' + inv.id + '" style="background:var(--danger,#dc2626);color:#fff;border-color:transparent;">Stornieren</button> ';
        }
        html += '<button class="btn btn-small doc-pdf" data-id="' + inv.id + '">PDF</button> ';
        html += '</td></tr>';
        return html;
    }

    function applyFilters() {
        var typ = document.getElementById('filterTyp').value;
        var status = document.getElementById('filterStatus').value;
        var von = document.getElementById('filterVon').value;
        var bis = document.getElementById('filterBis').value;
        var kunde = document.getElementById('filterKunde').value;

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

        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10001;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:22px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(closeBtn);

        overlay.classList.add('active');

        function closePreview() {
            overlay.classList.remove('active');
            modal.innerHTML = '';
            modal.style.padding = '';
            modal.style.overflow = '';
            modal.style.maxHeight = '';
            if (closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn);
            overlay.removeEventListener('click', overlayHandler);
        }
        function overlayHandler(e) { if (e.target === overlay) closePreview(); }
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

        body += '<div class="form-group"><label class="form-label">Stornogrund <span style="color:var(--danger,#dc2626)">*</span></label>';
        body += '<select class="form-select" id="stornoGrund">';
        body += '<option value="">-- Bitte w\u00E4hlen --</option>';
        body += '<option value="fehler">Falsche Angaben / Tippfehler</option>';
        body += '<option value="doppelt">Doppelt ausgestellt</option>';
        body += '<option value="auftrag">Auftrag storniert</option>';
        body += '<option value="ware_zurueck">Ware zur\u00FCckgegeben</option>';
        body += '<option value="einigung">Einigung mit Kunde</option>';
        body += '<option value="sonstiges">Sonstiges</option>';
        body += '</select></div>';

        body += '<div class="form-group" id="stornoFreitextGroup" style="display:none;"><label class="form-label">Freitext Begr\u00FCndung</label>';
        body += '<input class="form-input" type="text" id="stornoFreitext" placeholder="Bitte Grund eingeben..."></div>';

        body += '<div style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:10px 14px;margin-top:8px;font-size:12px;color:#b91c1c;">';
        body += '\u26A0\uFE0F Diese Aktion kann nicht r\u00FCckg\u00E4ngig gemacht werden (GoBD-Konformit\u00E4t).';
        body += '</div>';

        var footer = '<button class="btn btn-danger" id="confirmStorno">Stornorechnung erstellen</button> <button class="btn" onclick="RechApp.closeModal()">Abbrechen</button>';

        RechApp.showModal('Rechnung stornieren', body, footer);

        document.getElementById('stornoGrund').addEventListener('change', function() {
            document.getElementById('stornoFreitextGroup').style.display = this.value === 'sonstiges' ? '' : 'none';
        });

        document.getElementById('confirmStorno').addEventListener('click', function() {
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
            Store.createStornoRechnung(id, grund, grundText);
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
        var isKlein = settings.ustMode === 'klein';
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

        var footer = '<button class="btn btn-success" id="confirmSendStatus">Speichern &amp; Schlie\u00DFen</button> <button class="btn" onclick="RechApp.closeModal()">Abbrechen</button>';

        RechApp.showModal('Rechnung versenden', body, footer);

        document.getElementById('sendOptPdf').addEventListener('click', function() {
            Rechnung.printInvoiceWindow(Rechnung.generatePreviewHtml(inv), false);
        });

        document.getElementById('sendOptCopy').addEventListener('click', function() {
            var ta = document.getElementById('sendCopyText');
            ta.select();
            try {
                navigator.clipboard.writeText(ta.value).catch(function() { document.execCommand('copy'); });
            } catch(e) { document.execCommand('copy'); }
            Utils.showToast('Text kopiert!', 'success');
        });

        document.getElementById('confirmSendStatus').addEventListener('click', function() {
            if (document.getElementById('sendConfirmCheck').checked && !alreadySent) {
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

        // Bereits in Positionen verknüpfte Lager-Artikel ermitteln
        var posLinkedIds = (inv.positionen || [])
            .map(function(p) { return p.lagerArtikelId; })
            .filter(Boolean);
        var posLinkedArts = posLinkedIds.map(function(id) {
            return purchases.find(function(p) { return p.id === id && p.status === 'verfuegbar'; });
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
            body += '<div style="font-weight:600;font-size:12px;color:#065f46;margin-bottom:6px;">✅ ' + posLinkedArts.length + ' Lagerartikel aus Positionen werden automatisch als <em>Verkauft</em> markiert:</div>';
            posLinkedArts.forEach(function(a) {
                body += '<div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">• <span style="font-family:monospace;color:var(--accent);">' + Utils.escapeHtml(a.artikelNr || '—') + '</span> ' + Utils.escapeHtml((a.marke || '') + ' ' + (a.artikeltyp || '') + (a.beschreibung ? ' – ' + a.beschreibung : '')) + ' (' + Utils.formatCurrency(a.einkaufspreis) + ')</div>';
            });
            body += '</div>';
        }

        body += '<div class="form-group"><label class="form-label">Verkaufsplattform</label>';
        body += '<select class="form-select" id="bezahltPlattform">' + platOptions + '</select></div>';

        body += '<div class="form-group"><label class="form-label">Einkaufspreis (fuer Marge)</label>';
        body += '<select class="form-select" id="bezahltEkTyp">';
        if (posLinkedArts.length > 0) {
            body += '<option value="keine" selected>Automatisch aus Lager-Verknüpfung</option>';
        } else {
            body += '<option value="keine">Kein EK eintragen</option>';
        }
        body += '<option value="lager">Weiteren Lagerartikel verknüpfen</option>';
        body += '<option value="manuell">Manuell eingeben</option>';
        body += '</select></div>';

        body += '<div class="form-group" id="bezahltLagerGroup" style="display:none;"><label class="form-label">Lagerartikel auswaehlen</label>';
        body += '<select class="form-select" id="bezahltPurchaseId">' + lagerOptions + '</select></div>';

        body += '<div class="form-group" id="bezahltManualGroup" style="display:none;"><label class="form-label">Einkaufspreis (\u20AC)</label>';
        body += '<input type="number" step="0.01" min="0" class="form-input" id="bezahltManualEK" placeholder="0,00"></div>';

        var footer = '<button class="btn btn-success" id="confirmBezahlt">Bezahlt markieren &amp; Verkauf eintragen</button> <button class="btn" onclick="RechApp.closeModal()">Abbrechen</button>';

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

    function init() {
        document.getElementById('docNewInvoice').addEventListener('click', function() { RechApp.navigate('rechnung-neu'); });
        document.getElementById('docNewOffer').addEventListener('click', function() { RechApp.navigate('angebot-neu'); });

        ['filterTyp', 'filterStatus', 'filterVon', 'filterBis', 'filterKunde'].forEach(function(fid) {
            var el = document.getElementById(fid);
            if (el) el.addEventListener('change', applyFilters);
        });

        document.querySelectorAll('.doc-view').forEach(function(btn) {
            btn.addEventListener('click', function() { showPreview(this.getAttribute('data-id')); });
        });

        document.querySelectorAll('.doc-edit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var invoices = Store.getRechInvoices();
                var inv = invoices.find(function(i) { return i.id === id; });
                if (inv && (inv.status === 'bezahlt' || inv.status === 'storniert')) {
                    alert('Dieses Dokument ist gesperrt und kann nicht mehr bearbeitet werden.');
                    return;
                }
                RechApp.navigate('rechnung-edit', { invoiceId: id });
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
    }

    return { render: render, init: init, showPreview: showPreview, showStornoModal: showStornoModal, showSendModal: showSendModal };
})();
