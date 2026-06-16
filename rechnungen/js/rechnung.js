var Rechnung = (function() {

    var currentTyp = 'rechnung';
    var editingInvoice = null;
    var positionCount = 0;

    // Mergt Unternehmensdaten (Rechnungen-Tab) mit allgemeinen Settings.
    // Unternehmensdaten haben Vorrang, leere Werte fallen auf Settings zurück.
    function mergeRechSettings() {
        var base = Store.getSettings();
        var ud   = Store.getRechUnternehmen();
        var merged = Object.assign({}, base);
        Object.keys(ud).forEach(function(k) {
            if (ud[k] !== '' && ud[k] !== null && ud[k] !== undefined) {
                merged[k] = ud[k];
            }
        });
        // inhaber → name Mapping
        if (ud.inhaber) merged.name = ud.inhaber;
        // ustMode immer aus getSettings() (Kleinunternehmer-Einstellung)
        merged.ustMode = base.ustMode;
        return merged;
    }

    function getDefaultFaelligkeit() {
        var d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString().split('T')[0];
    }

    function calcBrutto(invoice) {
        var settings = Store.getSettings();
        var isCH = settings.land === 'CH';
        var isKlein = isCH ? ((settings.chMwstMode || 'klein') === 'klein') : (settings.ustMode === 'klein');
        var sum = 0;
        (invoice.positionen || []).forEach(function(pos) {
            var netto = pos.menge * pos.einzelpreis;
            var mwst = isKlein ? 0 : (netto * pos.mwstSatz / 100);
            sum += netto + mwst;
        });
        return sum;
    }

    function render(params) {
        params = params || {};
        var settings = mergeRechSettings();
        var customers = Store.getRechCustomers().filter(function(c) { return !c.archiviert && !c.storniert; });
        var products = Store.getRechProducts();

        if (params.invoiceId) {
            var invoices = Store.getRechInvoices();
            editingInvoice = invoices.find(function(i) { return i.id === params.invoiceId; }) || null;
            if (editingInvoice) currentTyp = editingInvoice.typ || 'rechnung';
        } else {
            editingInvoice = null;
            if (params.typ) currentTyp = params.typ;
        }

        var typLabel = currentTyp === 'rechnung' ? 'Rechnung' : currentTyp === 'angebot' ? 'Angebot' : 'Gutschrift';
        var title = editingInvoice ? (typLabel + ' bearbeiten') : ('Neue ' + (currentTyp === 'gutschrift' ? 'Gutschrift' : (currentTyp === 'angebot' ? 'Neues Angebot' : 'Neue Rechnung')));
        if (editingInvoice) title = typLabel + ' bearbeiten: ' + Utils.escapeHtml(editingInvoice.nummer || '');
        else title = currentTyp === 'angebot' ? 'Neues Angebot' : currentTyp === 'gutschrift' ? 'Neue Gutschrift' : 'Neue Rechnung';

        var nummer = editingInvoice ? editingInvoice.nummer : '';
        var datum = editingInvoice ? editingInvoice.datum : Utils.todayISO();
        var faelligkeit = editingInvoice ? editingInvoice.faelligkeit : getDefaultFaelligkeit();
        var kundeId = editingInvoice ? editingInvoice.kundeId : '';
        var zahlungsbedingungen = editingInvoice ? editingInvoice.zahlungsbedingungen : 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.';
        var notizen = editingInvoice ? editingInvoice.notizen : '';
        var status = editingInvoice ? editingInvoice.status : 'offen';
        var positionen = editingInvoice ? editingInvoice.positionen : [];
        var datumsOption = editingInvoice ? (editingInvoice.datumsOption || 'faelligkeit') : 'faelligkeit';
        var lieferdatum = editingInvoice ? (editingInvoice.lieferdatum || '') : '';
        var lieferVon = editingInvoice ? (editingInvoice.lieferVon || '') : '';
        var lieferBis = editingInvoice ? (editingInvoice.lieferBis || '') : '';

        var html = '<div class="page-header"><h2>' + title + '</h2></div>';

        html += '<div class="card"><div class="card-header"><div class="card-title">Dokumentdetails</div></div>';
        html += '<div style="padding: 1rem;">';

        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">Dokumenttyp</label>';
        html += '<select class="form-select" id="invTyp">';
        html += '<option value="rechnung"' + (currentTyp === 'rechnung' ? ' selected' : '') + '>Rechnung</option>';
        html += '<option value="angebot"' + (currentTyp === 'angebot' ? ' selected' : '') + '>Angebot</option>';
        html += '<option value="gutschrift"' + (currentTyp === 'gutschrift' ? ' selected' : '') + '>Gutschrift</option>';
        html += '</select></div>';

        html += '<div class="form-group"><label class="form-label">Nummer</label>';
        html += '<input class="form-input" id="invNummer" value="' + Utils.escapeHtml(nummer) + '" placeholder="Wird automatisch generiert"></div>';

        html += '<div class="form-group"><label class="form-label">Datum</label>';
        html += '<input class="form-input" type="date" id="invDatum" value="' + datum + '"></div>';

        html += '<div class="form-group" id="invFaelligkeitGroup"' + (datumsOption !== 'faelligkeit' ? ' style="display:none;"' : '') + '><label class="form-label">F\u00E4lligkeitsdatum</label>';
        html += '<input class="form-input" type="date" id="invFaelligkeit" value="' + faelligkeit + '"></div>';
        html += '<div class="form-group" id="invLieferdatumGroup"' + (datumsOption !== 'lieferdatum' ? ' style="display:none;"' : '') + '><label class="form-label">Lieferdatum</label>';
        html += '<input class="form-input" type="date" id="invLieferdatum" value="' + lieferdatum + '"></div>';
        html += '<div class="form-group" id="invLieferzeitraumGroup"' + (datumsOption !== 'lieferzeitraum' ? ' style="display:none;"' : '') + '><label class="form-label">Lieferzeitraum Von</label>';
        html += '<input class="form-input" type="date" id="invLieferVon" value="' + lieferVon + '" style="margin-bottom:4px;">';
        html += '<label class="form-label">bis</label>';
        html += '<input class="form-input" type="date" id="invLieferBis" value="' + lieferBis + '"></div>';
        html += '<div class="form-group"><label class="form-label">Datumsoptionen</label>';
        html += '<select class="form-select" id="invDatumsOption">';
        html += '<option value="nur_datum"' + (datumsOption === 'nur_datum' ? ' selected' : '') + '>Nur Rechnungsdatum</option>';
        html += '<option value="faelligkeit"' + (datumsOption === 'faelligkeit' ? ' selected' : '') + '>Rechnungsdatum + F\u00E4lligkeitsdatum</option>';
        html += '<option value="lieferdatum"' + (datumsOption === 'lieferdatum' ? ' selected' : '') + '>Rechnungsdatum + Lieferdatum</option>';
        html += '<option value="lieferzeitraum"' + (datumsOption === 'lieferzeitraum' ? ' selected' : '') + '>Rechnungsdatum + Lieferzeitraum</option>';
        html += '</select></div>';
        html += '<div class="form-group"><label class="form-label">Verkaufsplattform</label>';
        html += '<select class="form-select" id="invPlattform">';
        var plattformen = Store.getPlatforms();
        plattformen.forEach(function(pl) {
            var sel = (editingInvoice && editingInvoice.verkaufsplattform === pl) ? ' selected' : '';
            html += '<option value="' + Utils.escapeHtml(pl) + '"' + sel + '>' + Utils.escapeHtml(pl) + '</option>';
        });
        html += '</select></div>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group" style="flex:2"><label class="form-label">Kunde</label>';
        html += '<select class="form-select" id="invKunde">';
        html += '<option value="">-- Kunde w\u00E4hlen --</option>';
        customers.forEach(function(c) {
            var sel = kundeId === c.id ? ' selected' : '';
            html += '<option value="' + c.id + '"' + sel + '>' + Utils.escapeHtml(c.firma || c.ansprechpartner) + ' (' + Utils.escapeHtml(c.kundennummer || '') + ')</option>';
        });
        html += '<option value="__new__">+ Neuen Kunden anlegen</option>';
        html += '</select></div>';
        html += '</div>';

        // Inline new customer fields (hidden by default)
        html += '<div id="newCustomerFields" style="display:none; border: 1px solid var(--border-color, #444); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">';
        html += '<div class="section-title">Neuer Kunde</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">Firma</label><input class="form-input" id="ncFirma"></div>';
        html += '<div class="form-group"><label class="form-label">Ansprechpartner</label><input class="form-input" id="ncAnsprech"></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">Stra\u00DFe</label><input class="form-input" id="ncStrasse"></div>';
        html += '<div class="form-group"><label class="form-label">PLZ</label><input class="form-input" id="ncPlz"></div>';
        html += '<div class="form-group"><label class="form-label">Ort</label><input class="form-input" id="ncOrt"></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">E-Mail</label><input class="form-input" id="ncEmail" type="email"></div>';
        html += '<div class="form-group"><label class="form-label">Telefon</label><input class="form-input" id="ncTelefon"></div>';
        html += '</div>';
        html += '</div>';

        // Absender Info
        if (settings.firmenname) {
            html += '<div style="padding: 0.5rem; margin-bottom: 1rem; opacity: 0.7; font-size: 0.85rem;">';
            html += '<strong>Absender:</strong> ' + Utils.escapeHtml(settings.firmenname || '') + ', ' + Utils.escapeHtml(settings.adresse || '') + ', ' + Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || '');
            html += '</div>';
        }

        html += '</div></div>';

        // Positionen
        html += '<div class="card"><div class="card-header"><div class="card-title">Positionen</div></div>';
        html += '<div style="padding: 1rem;">';
        html += '<div id="positionenContainer">';

        if (positionen.length === 0) {
            positionCount = 1;
            html += renderPositionRow(0, {});
        } else {
            positionCount = positionen.length;
            positionen.forEach(function(pos, idx) {
                html += renderPositionRow(idx, pos);
            });
        }

        html += '</div>';
        html += '<button class="btn btn-primary" id="addPosition" style="margin-top: 0.5rem;">+ Position hinzuf\u00FCgen</button>';

        // Summenblock
        html += '<div id="summenBlock" style="margin-top: 1.5rem; text-align: right;"></div>';
        html += '</div></div>';

        // Footer fields
        html += '<div class="card"><div class="card-header"><div class="card-title">Zus\u00E4tzliche Angaben</div></div>';
        html += '<div style="padding: 1rem;">';
        html += '<div class="form-group"><label class="form-label">Zahlungsbedingungen</label>';
        html += '<textarea class="form-textarea" id="invZahlung" rows="2">' + Utils.escapeHtml(zahlungsbedingungen) + '</textarea></div>';
        html += '<div class="form-group"><label class="form-label">Notizen</label>';
        html += '<textarea class="form-textarea" id="invNotizen" rows="2">' + Utils.escapeHtml(notizen) + '</textarea></div>';
        html += '</div></div>';

        // Eigenbelege-Verknüpfung
        var verknuepfteEB = editingInvoice ? (editingInvoice.verknuepfteEigenbelege || []) : [];
        html += '<div class="card"><div class="card-header"><div class="card-title">🧾 Verknüpfte Eigenbelege <span style="font-weight:400;font-size:12px;color:var(--text-muted);">(optional)</span></div></div>';
        html += '<div style="padding: 1rem;">';
        html += '<p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Eigenbelege verknüpfen die Einkaufskosten direkt mit dieser Rechnung – ideal für vollständige Gewinnübersicht.</p>';
        html += renderEigenbelegAuswahl(verknuepfteEB);
        html += '</div></div>';

        // Actions
        html += '<div class="form-actions" style="margin-top: 1rem;">';
        html += '<button class="btn btn-primary" id="invSave">Speichern</button> ';
        html += '<button class="btn btn-success" id="invPreview">Vorschau & PDF</button> ';
        html += '<button class="btn" id="invCancel">Abbrechen</button>';
        html += '</div>';

        return html;
    }

    function renderPositionRow(idx, pos) {
        var products = Store.getRechProducts();
        // Lager-Artikel Info für bestehende Verknüpfungen
        var lagerArtikelId = pos.lagerArtikelId || '';
        var lagerBtnLabel = '🔗';
        var lagerBtnTitle = 'Lagerartikel verknüpfen';
        if (lagerArtikelId) {
            var allArts = Store.getPurchases(true);
            var linkedArt = allArts.find(function(a) { return a.id === lagerArtikelId; });
            if (linkedArt) {
                lagerBtnLabel = '🔗 ' + Utils.escapeHtml(linkedArt.artikelNr || (linkedArt.marke + ' ' + linkedArt.artikeltyp).trim().slice(0, 12));
                lagerBtnTitle = 'Verknüpft: ' + Utils.escapeHtml((linkedArt.marke || '') + ' ' + (linkedArt.artikeltyp || '') + ' ' + (linkedArt.beschreibung || ''));
            }
        }

        var html = '<div class="form-row position-row" data-idx="' + idx + '" style="align-items: flex-end; border-bottom: 1px solid var(--border-color, #333); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">';

        html += '<div class="form-group" style="flex: 1.5;">';
        if (idx === 0) html += '<label class="form-label">Produkt</label>';
        html += '<div style="display:flex;align-items:center;">';
        html += '<select class="form-select pos-product" data-idx="' + idx + '" style="flex:1;">';
        html += '<option value="">Manuell</option>';
        products.forEach(function(p) {
            html += '<option value="' + p.id + '">' + Utils.escapeHtml(p.name) + '</option>';
        });
        html += '</select>';
        html += '<button class="btn btn-small btn-primary pos-new-prod" data-idx="' + idx + '" title="Neues Produkt anlegen" style="margin-left:4px;">\u2795</button>';
        html += '</div></div>';

        html += '<div class="form-group" style="flex: 2;">';
        if (idx === 0) html += '<label class="form-label">Beschreibung</label>';
        html += '<input class="form-input pos-beschreibung" data-idx="' + idx + '" value="' + Utils.escapeHtml(pos.beschreibung || '') + '"></div>';

        html += '<div class="form-group" style="flex: 0.7;">';
        if (idx === 0) html += '<label class="form-label">Menge</label>';
        html += '<input class="form-input pos-menge" type="number" step="0.01" min="0" data-idx="' + idx + '" value="' + (pos.menge || 1) + '"></div>';

        html += '<div class="form-group" style="flex: 0.8;">';
        if (idx === 0) html += '<label class="form-label">Einheit</label>';
        html += '<select class="form-select pos-einheit" data-idx="' + idx + '">';
        html += '<option value="St\u00FCck"' + ((pos.einheit || 'St\u00FCck') === 'St\u00FCck' ? ' selected' : '') + '>St\u00FCck</option>';
        html += '<option value="Std."' + (pos.einheit === 'Std.' ? ' selected' : '') + '>Std.</option>';
        html += '<option value="pauschal"' + (pos.einheit === 'pauschal' ? ' selected' : '') + '>pauschal</option>';
        html += '</select></div>';

        html += '<div class="form-group" style="flex: 1;">';
        if (idx === 0) html += '<label class="form-label">Einzelpreis</label>';
        html += '<input class="form-input pos-einzelpreis" type="number" step="0.01" min="0" data-idx="' + idx + '" value="' + (pos.einzelpreis || 0) + '"></div>';

        html += '<div class="form-group" style="flex: 0.7;">';
        var _posIsCH = (Store.getSettings().land === 'CH');
        if (idx === 0) html += '<label class="form-label">' + (_posIsCH ? 'MWST' : 'MwSt') + '</label>';
        html += '<select class="form-select pos-mwst" data-idx="' + idx + '">';
        if (_posIsCH) {
            var _chDef = parseFloat(Store.getSettings().chMwstSatzDefault) || 8.1;
            var _chSel = function(v) { return (pos.mwstSatz === undefined ? _chDef === v : pos.mwstSatz === v) ? ' selected' : ''; };
            html += '<option value="8.1"'  + _chSel(8.1) + '>8.1%</option>';
            html += '<option value="2.6"'  + _chSel(2.6) + '>2.6%</option>';
            html += '<option value="3.8"'  + _chSel(3.8) + '>3.8%</option>';
            html += '<option value="0"'    + _chSel(0)   + '>0%</option>';
        } else {
            html += '<option value="19"' + ((pos.mwstSatz === undefined || pos.mwstSatz === 19) ? ' selected' : '') + '>19%</option>';
            html += '<option value="7"'  + (pos.mwstSatz === 7 ? ' selected' : '') + '>7%</option>';
            html += '<option value="0"'  + (pos.mwstSatz === 0 ? ' selected' : '') + '>0%</option>';
        }
        html += '</select></div>';

        html += '<div class="form-group" style="flex: 1;">';
        if (idx === 0) html += '<label class="form-label">Gesamt</label>';
        var gesamt = (pos.menge || 1) * (pos.einzelpreis || 0);
        html += '<input class="form-input pos-gesamt" data-idx="' + idx + '" value="' + gesamt.toFixed(2) + '" readonly style="opacity: 0.7;"></div>';

        // Lager-Verknüpfungs-Spalte
        html += '<div class="form-group" style="flex: 0.5;">';
        if (idx === 0) html += '<label class="form-label">Lager</label>';
        html += '<input type="hidden" class="pos-lager-id" data-idx="' + idx + '" value="' + Utils.escapeHtml(lagerArtikelId) + '">';
        html += '<button class="btn btn-small pos-lager-btn" data-idx="' + idx + '" title="' + lagerBtnTitle + '" style="font-size:11px;white-space:nowrap;overflow:hidden;max-width:90px;' + (lagerArtikelId ? 'background:rgba(16,185,129,0.15);border-color:var(--success,#10b981);color:var(--success,#10b981);' : '') + '">' + lagerBtnLabel + '</button>';
        html += '</div>';

        html += '<div class="form-group" style="flex: 0.3;">';
        if (idx === 0) html += '<label class="form-label">&nbsp;</label>';
        html += '<button class="btn btn-danger btn-small pos-remove" data-idx="' + idx + '" title="Entfernen">\u2715</button></div>';

        html += '</div>';
        return html;
    }

    // ---- Lager-Artikel-Picker ----
    function showLagerPicker(row) {
        var allArts = Store.getPurchases(true);
        var available = allArts.filter(function(a) { return !a.storniert && a.status === 'verfuegbar'; });
        var currentId = row.querySelector('.pos-lager-id').value;

        var rows = '';
        if (available.length === 0) {
            rows = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Keine verfügbaren Lagerartikel</td></tr>';
        } else {
            rows = available.map(function(a) {
                var isSelected = a.id === currentId;
                return '<tr style="cursor:pointer;' + (isSelected ? 'background:rgba(124,58,237,0.1);' : '') + '" data-art-id="' + a.id + '" class="lager-picker-row">' +
                    '<td><span style="font-family:monospace;font-size:11px;color:var(--accent);">' + Utils.escapeHtml(a.artikelNr || '—') + '</span></td>' +
                    '<td>' + Utils.escapeHtml((a.marke || '') + ' ' + (a.artikeltyp || '')) + '</td>' +
                    '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">' + Utils.escapeHtml(a.beschreibung || '') + '</td>' +
                    '<td>' + Utils.escapeHtml(a.groesse || '') + '</td>' +
                    '<td style="text-align:right;">' + Utils.formatCurrency(a.einkaufspreis) + '</td>' +
                    '<td>' + (isSelected ? '<span style="color:var(--success);">✓ Aktiv</span>' : '<button class="btn btn-small btn-primary lp-select" data-id="' + a.id + '">Auswählen</button>') + '</td>' +
                    '</tr>';
            }).join('');
        }

        // Aktuelle Verknüpfung aufheben Button
        var clearBtn = currentId ? '<button class="btn btn-small btn-danger" id="lpClearBtn" style="margin-left:8px;">🗑 Verknüpfung entfernen</button>' : '';

        var body = '<div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary);">Wähle einen verfügbaren Lagerartikel für diese Position aus. Beim Bezahlen der Rechnung wird der Artikel automatisch als <em>Verkauft</em> markiert.</div>';
        body += '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;"><thead><tr><th>Art.-Nr.</th><th>Artikel</th><th>Beschreibung</th><th>Größe</th><th>EK-Preis</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';

        var footer = clearBtn + ' <button class="btn" onclick="RechApp.closeModal()">Schließen</button>';
        RechApp.showModal('Lagerartikel verknüpfen', body, footer);

        // Events binden
        document.querySelectorAll('.lp-select').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var artId = this.getAttribute('data-id');
                var art = allArts.find(function(a) { return a.id === artId; });
                if (!art) return;
                // Verknüpfung speichern
                row.querySelector('.pos-lager-id').value = artId;
                // Button-Label aktualisieren
                var lagerBtn = row.querySelector('.pos-lager-btn');
                if (lagerBtn) {
                    lagerBtn.textContent = '🔗 ' + (art.artikelNr || (art.marke + ' ' + art.artikeltyp).trim().slice(0, 12));
                    lagerBtn.title = 'Verknüpft: ' + Utils.escapeHtml((art.marke || '') + ' ' + (art.artikeltyp || '') + ' ' + (art.beschreibung || ''));
                    lagerBtn.style.background = 'rgba(16,185,129,0.15)';
                    lagerBtn.style.borderColor = 'var(--success,#10b981)';
                    lagerBtn.style.color = 'var(--success,#10b981)';
                }
                // Beschreibung auto-fill wenn leer
                var beschEl = row.querySelector('.pos-beschreibung');
                if (beschEl && !beschEl.value.trim()) {
                    beschEl.value = ((art.marke || '') + ' ' + (art.artikeltyp || '') + (art.beschreibung ? ' – ' + art.beschreibung : '') + (art.groesse ? ' (Gr. ' + art.groesse + ')' : '')).trim();
                }
                Utils.showToast('Lagerartikel verknüpft: ' + (art.artikelNr || art.marke), 'success');
                RechApp.closeModal();
            });
        });

        var clearBtnEl = document.getElementById('lpClearBtn');
        if (clearBtnEl) {
            clearBtnEl.addEventListener('click', function() {
                row.querySelector('.pos-lager-id').value = '';
                var lagerBtn = row.querySelector('.pos-lager-btn');
                if (lagerBtn) {
                    lagerBtn.textContent = '🔗';
                    lagerBtn.title = 'Lagerartikel verknüpfen';
                    lagerBtn.style.background = '';
                    lagerBtn.style.borderColor = '';
                    lagerBtn.style.color = '';
                }
                Utils.showToast('Verknüpfung entfernt', 'info');
                RechApp.closeModal();
            });
        }
    }

    function collectPositionen() {
        var rows = document.querySelectorAll('.position-row');
        var positionen = [];
        rows.forEach(function(row) {
            var idx = row.getAttribute('data-idx');
            var beschreibung = row.querySelector('.pos-beschreibung').value.trim();
            var menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
            var einheit = row.querySelector('.pos-einheit').value;
            var einzelpreis = parseFloat(row.querySelector('.pos-einzelpreis').value) || 0;
            var mwstSatz = parseFloat(row.querySelector('.pos-mwst').value) || 0;
            var lagerIdEl = row.querySelector('.pos-lager-id');
            var lagerArtikelId = lagerIdEl ? (lagerIdEl.value || null) : null;
            if (beschreibung || einzelpreis > 0) {
                positionen.push({
                    beschreibung: beschreibung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    mwstSatz: mwstSatz,
                    lagerArtikelId: lagerArtikelId
                });
            }
        });
        return positionen;
    }

    function updateSummen() {
        var positionen = collectPositionen();
        var settings = Store.getSettings();
        var isCH = settings.land === 'CH';
        var isKlein = isCH ? ((settings.chMwstMode || 'klein') === 'klein') : (settings.ustMode === 'klein');

        var netto = 0;
        var mwstMap = {};
        positionen.forEach(function(pos) {
            var lineNetto = pos.menge * pos.einzelpreis;
            netto += lineNetto;
            if (!isKlein && pos.mwstSatz > 0) {
                if (!mwstMap[pos.mwstSatz]) mwstMap[pos.mwstSatz] = 0;
                mwstMap[pos.mwstSatz] += lineNetto * pos.mwstSatz / 100;
            }
        });

        var totalMwst = 0;
        var mwstHtml = '';
        Object.keys(mwstMap).sort().forEach(function(satz) {
            totalMwst += mwstMap[satz];
            mwstHtml += '<div>' + satz + '% ' + (isCH ? 'MWST' : 'MwSt') + ': ' + Utils.formatCurrency(mwstMap[satz]) + '</div>';
        });

        var brutto = netto + totalMwst;

        var html = '<div style="font-size: 0.95rem;">';
        html += '<div>Zwischensumme (netto): <strong>' + Utils.formatCurrency(netto) + '</strong></div>';
        if (isKlein) {
            html += '<div style="font-style: italic; opacity: 0.7;">' + (isCH ? 'Nicht MWST-pflichtig gem. Art. 10 Abs. 2 MWSTG.' : 'Gem. \u00A719 UStG wird keine Umsatzsteuer berechnet.') + '</div>';
            html += '<div style="font-size: 1.2rem; margin-top: 0.5rem;"><strong>Gesamtbetrag: ' + Utils.formatCurrency(netto) + '</strong></div>';
        } else {
            html += mwstHtml;
            html += '<div style="font-size: 1.2rem; margin-top: 0.5rem;"><strong>Gesamtbetrag: ' + Utils.formatCurrency(brutto) + '</strong></div>';
        }
        html += '</div>';

        var block = document.getElementById('summenBlock');
        if (block) block.innerHTML = html;
    }

    function updateRowGesamt(row) {
        var menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
        var preis = parseFloat(row.querySelector('.pos-einzelpreis').value) || 0;
        var gesamt = menge * preis;
        row.querySelector('.pos-gesamt').value = gesamt.toFixed(2);
    }

    function autoGenerateNumber() {
        var typ = document.getElementById('invTyp').value;
        if (!editingInvoice) {
            var numField = document.getElementById('invNummer');
            if (numField && !numField.dataset.userEdited) {
                numField.value = Store.nextRechInvoiceNumber(typ);
            }
        }
    }

    function init(params) {
        autoGenerateNumber();
        updateSummen();

        document.getElementById('invTyp').addEventListener('change', function() {
            currentTyp = this.value;
            autoGenerateNumber();
        });

        document.getElementById('invNummer').addEventListener('input', function() {
            this.dataset.userEdited = 'true';
        });

        document.getElementById('invKunde').addEventListener('change', function() {
            var ncf = document.getElementById('newCustomerFields');
            if (this.value === '__new__') {
                ncf.style.display = 'block';
            } else {
                ncf.style.display = 'none';
            }
        });

        function applyDatumsOption(val) {
            var faelligkeitGroup = document.getElementById('invFaelligkeitGroup');
            var lieferdatumGroup = document.getElementById('invLieferdatumGroup');
            var lieferzeitraumGroup = document.getElementById('invLieferzeitraumGroup');
            if (faelligkeitGroup) faelligkeitGroup.style.display = (val === 'faelligkeit') ? '' : 'none';
            if (lieferdatumGroup) lieferdatumGroup.style.display = (val === 'lieferdatum') ? '' : 'none';
            if (lieferzeitraumGroup) lieferzeitraumGroup.style.display = (val === 'lieferzeitraum') ? '' : 'none';
        }

        var datumsOptionEl = document.getElementById('invDatumsOption');
        if (datumsOptionEl) {
            datumsOptionEl.addEventListener('change', function() {
                applyDatumsOption(this.value);
            });
            applyDatumsOption(datumsOptionEl.value);
        }

        document.getElementById('addPosition').addEventListener('click', function() {
            var container = document.getElementById('positionenContainer');
            var div = document.createElement('div');
            div.innerHTML = renderPositionRow(positionCount, {});
            var newRow = div.firstChild;
            container.appendChild(newRow);
            positionCount++;
            bindPositionEvents(newRow);
        });

        document.querySelectorAll('.position-row').forEach(function(row) {
            bindPositionEvents(row);
        });

        document.getElementById('invSave').addEventListener('click', saveInvoice);
        document.getElementById('invPreview').addEventListener('click', function() {
            var inv = buildInvoiceObject();
            if (!inv) return;
            showInvoicePreview(inv);
        });
        document.getElementById('invCancel').addEventListener('click', function() {
            RechApp.navigate('dokumente');
        });
    }

    function bindPositionEvents(row) {
        var productSelect = row.querySelector('.pos-product');
        if (productSelect) {
            productSelect.addEventListener('change', function() {
                var pid = this.value;
                if (!pid) return;
                var products = Store.getRechProducts();
                var prod = products.find(function(p) { return p.id === pid; });
                if (prod) {
                    row.querySelector('.pos-beschreibung').value = prod.name + (prod.beschreibung ? ' - ' + prod.beschreibung : '');
                    row.querySelector('.pos-einzelpreis').value = prod.preis;
                    row.querySelector('.pos-einheit').value = prod.einheit || 'St\u00FCck';
                    row.querySelector('.pos-mwst').value = prod.mwstSatz !== undefined ? prod.mwstSatz : 19;
                    updateRowGesamt(row);
                    updateSummen();
                }
            });
        }

        row.querySelectorAll('.pos-menge, .pos-einzelpreis').forEach(function(input) {
            input.addEventListener('input', function() {
                updateRowGesamt(row);
                updateSummen();
            });
        });

        row.querySelector('.pos-mwst').addEventListener('change', function() {
            updateSummen();
        });

        var removeBtn = row.querySelector('.pos-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                var rows = document.querySelectorAll('.position-row');
                if (rows.length <= 1) {
                    Utils.showToast('Mindestens eine Position erforderlich', 'warning');
                    return;
                }
                row.remove();
                updateSummen();
            });
        }

        var lagerBtn = row.querySelector('.pos-lager-btn');
        if (lagerBtn) {
            lagerBtn.addEventListener('click', function(e) {
                e.preventDefault();
                showLagerPicker(row);
            });
        }

        var newProdBtn = row.querySelector('.pos-new-prod');
        if (newProdBtn) {
            newProdBtn.addEventListener('click', function(e) {
                e.preventDefault();
                var modalBody = '<div class="form-group"><label class="form-label">Name <span style="color:red;">*</span></label><input class="form-input" id="npName"></div>';
                modalBody += '<div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="npBeschreibung" rows="2"></textarea></div>';
                modalBody += '<div class="form-row">';
                modalBody += '<div class="form-group"><label class="form-label">Preis</label><input class="form-input" id="npPreis" type="number" step="0.01" min="0" value="0"></div>';
                modalBody += '<div class="form-group"><label class="form-label">Einheit</label><select class="form-select" id="npEinheit"><option value="St\u00FCck">St\u00FCck</option><option value="Std.">Std.</option><option value="pauschal">pauschal</option></select></div>';
                var _npIsCH = (Store.getSettings().land === 'CH');
                modalBody += '<div class="form-group"><label class="form-label">' + (_npIsCH ? 'MWST-Satz' : 'MwSt-Satz') + '</label><select class="form-select" id="npMwst">' + (_npIsCH ? '<option value="8.1">8.1%</option><option value="2.6">2.6%</option><option value="3.8">3.8%</option><option value="0">0%</option>' : '<option value="19">19%</option><option value="7">7%</option><option value="0">0%</option>') + '</select></div>';
                modalBody += '</div>';

                var modalFooter = '<button class="btn btn-primary" id="npSave">Speichern</button> <button class="btn" onclick="RechApp.closeModal()">Abbrechen</button>';
                RechApp.showModal('Neues Produkt anlegen', modalBody, modalFooter);

                document.getElementById('npSave').addEventListener('click', function() {
                    var name = document.getElementById('npName').value.trim();
                    if (!name) {
                        Utils.showToast('Name ist erforderlich', 'warning');
                        return;
                    }
                    var newProd = {
                        id: Store.generateId(),
                        name: name,
                        beschreibung: document.getElementById('npBeschreibung').value.trim(),
                        preis: parseFloat(document.getElementById('npPreis').value) || 0,
                        einheit: document.getElementById('npEinheit').value,
                        mwstSatz: parseInt(document.getElementById('npMwst').value)
                    };
                    Store.saveRechProduct(newProd);
                    RechApp.closeModal();

                    // Rebuild the product dropdown in this row and select the new product
                    var allProducts = Store.getRechProducts();
                    var productSelect = row.querySelector('.pos-product');
                    if (productSelect) {
                        var optHtml = '<option value="">Manuell</option>';
                        allProducts.forEach(function(p) {
                            var sel = p.id === newProd.id ? ' selected' : '';
                            optHtml += '<option value="' + p.id + '"' + sel + '>' + Utils.escapeHtml(p.name) + '</option>';
                        });
                        productSelect.innerHTML = optHtml;
                    }

                    // Fill in position fields from the new product
                    row.querySelector('.pos-beschreibung').value = newProd.name + (newProd.beschreibung ? ' - ' + newProd.beschreibung : '');
                    row.querySelector('.pos-einzelpreis').value = newProd.preis;
                    row.querySelector('.pos-einheit').value = newProd.einheit || 'St\u00FCck';
                    row.querySelector('.pos-mwst').value = newProd.mwstSatz !== undefined ? newProd.mwstSatz : 19;
                    updateRowGesamt(row);
                    updateSummen();
                    Utils.showToast('Produkt angelegt und ausgewählt', 'success');
                });
            });
        }
    }

    function buildInvoiceObject() {
        var typ = document.getElementById('invTyp').value;
        var nummer = document.getElementById('invNummer').value.trim();
        var datum = document.getElementById('invDatum').value;
        var faelligkeit = document.getElementById('invFaelligkeit').value;
        var datumsOption = document.getElementById('invDatumsOption') ? document.getElementById('invDatumsOption').value : 'faelligkeit';
        var lieferdatum = document.getElementById('invLieferdatum') ? document.getElementById('invLieferdatum').value : '';
        var lieferVon = document.getElementById('invLieferVon') ? document.getElementById('invLieferVon').value : '';
        var lieferBis = document.getElementById('invLieferBis') ? document.getElementById('invLieferBis').value : '';
        var kundeId = document.getElementById('invKunde').value;
        var zahlungsbedingungen = document.getElementById('invZahlung').value.trim();
        var notizen = document.getElementById('invNotizen').value.trim();
        var verkaufsplattform = document.getElementById('invPlattform') ? document.getElementById('invPlattform').value : '';

        // Handle new customer creation
        if (kundeId === '__new__') {
            var firma = document.getElementById('ncFirma').value.trim();
            var ansprech = document.getElementById('ncAnsprech').value.trim();
            if (!firma && !ansprech) {
                Utils.showToast('Bitte Kundendaten angeben', 'warning');
                return null;
            }
            var existingCustomers = Store.getRechCustomers(true);
            var maxKNum = 0;
            existingCustomers.forEach(function(ec) {
                var m = (ec.kundennummer || '').match(/K-(\d+)/);
                if (m) { var n = parseInt(m[1]); if (n > maxKNum) maxKNum = n; }
            });
            var kundennummer = 'K-' + String(maxKNum + 1).padStart(3, '0');
            var newCustomer = {
                id: Store.generateId(),
                firma: firma,
                ansprechpartner: ansprech,
                strasse: document.getElementById('ncStrasse').value.trim(),
                plz: document.getElementById('ncPlz').value.trim(),
                ort: document.getElementById('ncOrt').value.trim(),
                email: document.getElementById('ncEmail').value.trim(),
                telefon: document.getElementById('ncTelefon').value.trim(),
                kundennummer: kundennummer,
                createdAt: new Date().toISOString()
            };
            Store.saveRechCustomer(newCustomer);
            kundeId = newCustomer.id;
        }

        if (!kundeId) {
            Utils.showToast('Bitte Kunden ausw\u00E4hlen', 'warning');
            return null;
        }

        // \u00A714 UStG \u2014 warn if required fields missing on invoices
        if (typ === 'rechnung') {
            var kd = Store.getRechCustomers().find(function(c) { return c.id === kundeId; });
            if (kd && (!kd.strasse || !kd.plz || !kd.ort)) {
                Utils.showToast('\u26A0\uFE0F Kundenadresse unvollst\u00E4ndig (Stra\u00DFe, PLZ, Ort) \u2014 \u00A714 UStG Pflichtangabe.', 'warning');
            }
            var s14 = Store.getRechUnternehmen ? Store.getRechUnternehmen() : {};
            var _s14isCH = (Store.getSettings().land === 'CH');
            if (!_s14isCH && !s14.steuernummer && !s14.ustId) {
                Utils.showToast('\u26A0\uFE0F Keine Steuernummer / USt-IdNr. hinterlegt \u2014 \u00A714 UStG Pflichtangabe.', 'warning');
            }
        }

        if (!nummer) {
            nummer = Store.nextRechInvoiceNumber(typ);
        }

        var positionen = collectPositionen();
        if (positionen.length === 0) {
            Utils.showToast('Mindestens eine Position erforderlich', 'warning');
            return null;
        }

        var invoice = {
            id: editingInvoice ? editingInvoice.id : Store.generateId(),
            typ: typ,
            nummer: nummer,
            datum: datum,
            faelligkeit: faelligkeit,
            datumsOption: datumsOption,
            lieferdatum: lieferdatum,
            lieferVon: lieferVon,
            lieferBis: lieferBis,
            kundeId: kundeId,
            positionen: positionen,
            zahlungsbedingungen: zahlungsbedingungen,
            notizen: notizen,
            verkaufsplattform: verkaufsplattform,
            status: editingInvoice ? editingInvoice.status : 'offen',
            mahnungen: editingInvoice ? (editingInvoice.mahnungen || []) : [],
            verknuepfteEigenbelege: collectLinkedEigenbelege(),
            createdAt: editingInvoice ? editingInvoice.createdAt : new Date().toISOString()
        };

        return invoice;
    }

    // ---- Eigenbelege-Auswahl ----
    function renderEigenbelegAuswahl(selectedIds) {
        var belege = [];
        try {
            belege = JSON.parse(localStorage.getItem('eigenbelege_belege') || '[]');
        } catch(e) {}

        if (belege.length === 0) {
            return '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">Keine Eigenbelege vorhanden. <a href="../eigenbelege/" target="_blank" style="color:var(--accent);">Eigenbeleg erstellen →</a></div>';
        }

        // Neueste 20 Eigenbelege anzeigen
        var sorted = belege.slice().sort(function(a, b) { return (b.belegDatum || '').localeCompare(a.belegDatum || ''); }).slice(0, 20);

        var html = '<div id="eb-auswahl-chips" style="display:flex;flex-wrap:wrap;gap:8px;">';
        sorted.forEach(function(b) {
            var checked = selectedIds.indexOf(b.id) >= 0;
            var label = Utils.escapeHtml((b.belegDatum ? b.belegDatum + ' – ' : '') + (b.zweck || b.id.slice(0, 8)));
            var betrag = b.betragBrutto ? ' (' + Utils.formatCurrency(b.betragBrutto) + ')' : '';
            html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border);border-radius:100px;cursor:pointer;font-size:12px;' + (checked ? 'background:rgba(124,58,237,0.12);border-color:var(--accent);color:var(--accent-light);' : 'background:var(--bg-card);') + '">';
            html += '<input type="checkbox" class="eb-link-check" value="' + Utils.escapeHtml(b.id) + '"' + (checked ? ' checked' : '') + ' style="margin:0;">';
            html += label + betrag;
            html += '</label>';
        });
        html += '</div>';
        if (belege.length > 20) {
            html += '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Zeigt die 20 neuesten Eigenbelege. Ältere sind nicht aufgelistet.</div>';
        }
        return html;
    }

    function collectLinkedEigenbelege() {
        var checked = document.querySelectorAll('.eb-link-check:checked');
        var ids = [];
        checked.forEach(function(cb) { if (cb.value) ids.push(cb.value); });
        return ids;
    }

    function saveInvoice() {
        var invoice = buildInvoiceObject();
        if (!invoice) return;
        Store.saveRechInvoice(invoice);
        Utils.showToast('Dokument gespeichert!', 'success');
        RechApp.navigate('dokumente');
    }

    function generatePreviewHtml(inv, watermarkText) {
        var settings = mergeRechSettings();
        var logoBase64 = settings.logoBase64 || '';
        var accentColor = settings.invoicePrimaryColor || '#4f46e5';
        var customers = Store.getRechCustomers();
        var kunde = customers.find(function(c) { return c.id === inv.kundeId; });
        var isCH = settings.land === 'CH';
        var isKlein = isCH ? ((settings.chMwstMode || 'klein') === 'klein') : (settings.ustMode === 'klein');
        var isStorno = inv.typ === 'stornorechnung';
        if (isStorno) accentColor = '#dc2626';

        var typLabel = isStorno ? 'STORNORECHNUNG' :
                       inv.typ === 'rechnung' ? 'RECHNUNG' :
                       inv.typ === 'angebot' ? 'ANGEBOT' : 'GUTSCHRIFT';

        var wm = watermarkText || (inv.status === 'storniert' ? 'STORNIERT' : '');

        // Embedded styles \u2014 self-contained for both in-app preview and print
        var css = '<style>'
            + '.inv-wrap{background:#fff;color:#1e293b;max-width:794px;margin:0 auto;font-size:13px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;position:relative;}'
            + '.inv-accent{height:5px;width:100%;display:block;}'
            + '.inv-header{display:flex;justify-content:space-between;align-items:flex-start;padding:28px 36px 22px;gap:20px;}'
            + '.inv-logo{max-height:55px;max-width:140px;object-fit:contain;display:block;margin-bottom:10px;}'
            + '.inv-co-name{font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-.3px;margin-bottom:3px;}'
            + '.inv-co-addr{font-size:11.5px;color:#64748b;line-height:1.65;}'
            + '.inv-doc{text-align:right;flex-shrink:0;}'
            + '.inv-doc-type{font-size:21px;font-weight:800;letter-spacing:1.5px;margin-bottom:12px;}'
            + '.inv-meta{font-size:12px;}'
            + '.inv-meta-row{display:flex;justify-content:flex-end;gap:14px;padding:2.5px 0;}'
            + '.inv-meta-lbl{color:#94a3b8;}'
            + '.inv-meta-val{color:#1e293b;font-weight:500;min-width:80px;text-align:right;}'
            + 'hr.inv-sep{border:none;border-top:2px solid #e2e8f0;margin:0 36px;}'
            + '.inv-body{padding:26px 36px 36px;}'
            + '.inv-sender{font-size:9px;color:#94a3b8;border-bottom:1px solid #f1f5f9;padding-bottom:5px;margin-bottom:10px;letter-spacing:.3px;}'
            + '.inv-rcpt{font-size:13px;line-height:1.65;color:#1e293b;margin-bottom:28px;}'
            + '.inv-rcpt strong{font-size:14px;font-weight:700;}'
            + '.inv-storno-box{margin-bottom:16px;padding:10px 14px;background:rgba(220,38,38,.06);border-left:3px solid #dc2626;border-radius:0 4px 4px 0;font-size:12px;color:#b91c1c;}'
            + '.inv-tax{font-size:11.5px;color:#64748b;margin-bottom:20px;}'
            + '.inv-tax strong{color:#334155;}'
            + '.inv-tbl{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12.5px;}'
            + '.inv-tbl thead tr{border-bottom:2px solid #e2e8f0;}'
            + '.inv-tbl th{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:#64748b;padding:8px 10px;text-align:left;background:#f8fafc;}'
            + '.inv-tbl th.r,.inv-tbl td.r{text-align:right;}'
            + '.inv-tbl td{padding:9px 10px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:top;}'
            + '.inv-tbl tbody tr:last-child td{border-bottom:2px solid #e2e8f0;}'
            + '.inv-tbl .pos{width:34px;color:#94a3b8;font-size:11.5px;}'
            + '.inv-totals{margin-left:auto;width:255px;padding-top:6px;margin-bottom:24px;}'
            + '.inv-tr{display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;color:#334155;}'
            + '.inv-tr.grand{border-top:2px solid #1e293b;margin-top:8px;padding-top:10px;font-size:15px;font-weight:700;color:#0f172a;}'
            + '.inv-klein{font-size:11.5px;color:#64748b;padding:9px 13px;background:#f8fafc;border-radius:4px;margin-bottom:18px;}'
            + '.inv-note{margin-bottom:14px;font-size:12.5px;color:#334155;}'
            + '.inv-bank{margin-top:22px;padding:14px 18px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;}'
            + '.inv-bank-hd{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-bottom:8px;}'
            + '.inv-bank-row{display:flex;flex-wrap:wrap;gap:20px;font-size:12.5px;color:#334155;margin-bottom:4px;}'
            + '.inv-bank-row em{font-style:normal;color:#94a3b8;font-size:10.5px;margin-right:3px;}'
            + '.inv-bank-ref{font-size:11px;color:#64748b;margin-top:5px;}'
            + '.inv-footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;line-height:1.9;}'
            + '</style>';

        var html = css;
        html += '<div class="inv-wrap">';
        if (wm) {
            html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;font-weight:900;color:rgba(220,38,38,.10);pointer-events:none;white-space:nowrap;z-index:0;letter-spacing:4px;">' + wm + '</div>';
        }
        html += '<div class="inv-accent" style="background:' + accentColor + '"></div>';

        // Header: company left, doc info right
        html += '<div class="inv-header">';
        html += '<div>';
        if (logoBase64) html += '<img src="' + logoBase64 + '" alt="Logo" class="inv-logo">';
        var displayName = settings.firmenname || '';
        var _gbrE = (typeof Store !== 'undefined') ? (Store.get('gbr_einstellungen') || {}) : {};
        if (_gbrE.firmenform === 'UG' && displayName && displayName.indexOf('haftungsbeschr') === -1) displayName += ' UG (haftungsbeschränkt)';
        html += '<div class="inv-co-name">' + Utils.escapeHtml(displayName) + '</div>';
        html += '<div class="inv-co-addr">';
        if (settings.name) html += Utils.escapeHtml(settings.name) + '<br>';
        html += Utils.escapeHtml(settings.adresse || '') + '<br>';
        html += Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || '');
        html += '</div>';
        html += '</div>';
        html += '<div class="inv-doc">';
        html += '<div class="inv-doc-type" style="color:' + accentColor + '">' + typLabel + '</div>';
        html += '<div class="inv-meta">';
        html += '<div class="inv-meta-row"><span class="inv-meta-lbl">Nummer</span><span class="inv-meta-val">' + Utils.escapeHtml(inv.nummer || '') + '</span></div>';
        html += '<div class="inv-meta-row"><span class="inv-meta-lbl">Datum</span><span class="inv-meta-val">' + Utils.formatDate(inv.datum) + '</span></div>';
        if (inv.typ !== 'angebot') {
            var dOpt = inv.datumsOption || 'faelligkeit';
            if (dOpt === 'faelligkeit') {
                html += '<div class="inv-meta-row"><span class="inv-meta-lbl">F\u00E4llig am</span><span class="inv-meta-val">' + Utils.formatDate(inv.faelligkeit) + '</span></div>';
            } else if (dOpt === 'lieferdatum' && inv.lieferdatum) {
                html += '<div class="inv-meta-row"><span class="inv-meta-lbl">Lieferdatum</span><span class="inv-meta-val">' + Utils.formatDate(inv.lieferdatum) + '</span></div>';
            } else if (dOpt === 'lieferzeitraum' && (inv.lieferVon || inv.lieferBis)) {
                html += '<div class="inv-meta-row"><span class="inv-meta-lbl">Lieferzeitraum</span><span class="inv-meta-val">' + Utils.formatDate(inv.lieferVon) + ' \u2013 ' + Utils.formatDate(inv.lieferBis) + '</span></div>';
            }
        }
        html += '</div>';
        html += '</div>';
        html += '</div>'; // inv-header

        html += '<hr class="inv-sep">';

        // Body
        html += '<div class="inv-body">';

        // Sender line above recipient address
        html += '<div class="inv-sender">' + Utils.escapeHtml(settings.firmenname || '') + ' \u00B7 ' + Utils.escapeHtml(settings.adresse || '') + ' \u00B7 ' + Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || '') + '</div>';
        html += '<div class="inv-rcpt">';
        if (kunde) {
            html += '<strong>' + Utils.escapeHtml(kunde.firma || '') + '</strong><br>';
            if (kunde.ansprechpartner) html += Utils.escapeHtml(kunde.ansprechpartner) + '<br>';
            html += Utils.escapeHtml(kunde.strasse || '') + '<br>';
            html += Utils.escapeHtml(kunde.plz || '') + ' ' + Utils.escapeHtml(kunde.ort || '');
        }
        html += '</div>';

        // Storno reference
        if (isStorno && inv.originalRechnungNummer) {
            html += '<div class="inv-storno-box">';
            html += '<strong>Stornorechnung zu:</strong> ' + Utils.escapeHtml(inv.originalRechnungNummer);
            if (inv.originalDatum) html += ' vom ' + Utils.formatDate(inv.originalDatum);
            if (inv.stornierungsGrund) {
                var grundLabels = { fehler: 'Falsche Angaben / Tippfehler', doppelt: 'Doppelt ausgestellt', auftrag: 'Auftrag storniert', ware_zurueck: 'Ware zur\u00FCckgegeben', einigung: 'Einigung mit Kunde', sonstiges: 'Sonstiges' };
                html += '<br><strong>Grund:</strong> ' + (grundLabels[inv.stornierungsGrund] || inv.stornierungsGrund);
                if (inv.stornierungsGrundText) html += ': ' + Utils.escapeHtml(inv.stornierungsGrundText);
            }
            html += '</div>';
        }

        // Tax line
        if (isCH) {
            if (settings.chMwstNr) {
                html += '<div class="inv-tax">MWST-Nr.: <strong>' + Utils.escapeHtml(settings.chMwstNr) + '</strong></div>';
            }
        } else if (settings.steuernummer || settings.ustId) {
            html += '<div class="inv-tax">';
            if (settings.steuernummer) html += 'Steuernr.: <strong>' + Utils.escapeHtml(settings.steuernummer) + '</strong>';
            if (settings.steuernummer && settings.ustId) html += '&nbsp;&nbsp;';
            if (settings.ustId) html += 'USt-IdNr.: <strong>' + Utils.escapeHtml(settings.ustId) + '</strong>';
            html += '</div>';
        }

        // Positions table
        html += '<table class="inv-tbl"><thead><tr>';
        html += '<th class="pos r">Pos.</th>';
        html += '<th>Beschreibung</th>';
        html += '<th class="r">Menge</th>';
        html += '<th>Einheit</th>';
        html += '<th class="r">Einzelpreis</th>';
        if (!isKlein) html += '<th class="r">' + (isCH ? 'MWST' : 'MwSt') + '</th>';
        html += '<th class="r">Gesamt (netto)</th>';
        html += '</tr></thead><tbody>';

        var netto = 0;
        var mwstMap = {};
        (inv.positionen || []).forEach(function(pos, idx) {
            var lineNetto = pos.menge * pos.einzelpreis;
            netto += lineNetto;
            if (!isKlein && pos.mwstSatz > 0) {
                if (!mwstMap[pos.mwstSatz]) mwstMap[pos.mwstSatz] = 0;
                mwstMap[pos.mwstSatz] += lineNetto * pos.mwstSatz / 100;
            }
            html += '<tr>';
            html += '<td class="pos r">' + (idx + 1) + '</td>';
            html += '<td>' + Utils.escapeHtml(pos.beschreibung || '') + '</td>';
            html += '<td class="r">' + Utils.formatNumber(pos.menge) + '</td>';
            html += '<td>' + Utils.escapeHtml(pos.einheit || '') + '</td>';
            html += '<td class="r">' + Utils.formatCurrency(pos.einzelpreis) + '</td>';
            if (!isKlein) html += '<td class="r">' + pos.mwstSatz + '%</td>';
            html += '<td class="r">' + Utils.formatCurrency(lineNetto) + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';

        // Totals block
        var totalMwst = 0;
        html += '<div class="inv-totals">';
        html += '<div class="inv-tr"><span>Nettobetrag</span><span>' + Utils.formatCurrency(netto) + '</span></div>';
        if (isKlein) {
            html += '<div class="inv-tr grand" style="color:' + accentColor + '"><span>GESAMTBETRAG</span><span>' + Utils.formatCurrency(netto) + '</span></div>';
        } else {
            Object.keys(mwstMap).sort().forEach(function(satz) {
                totalMwst += mwstMap[satz];
                html += '<div class="inv-tr"><span>' + (isCH ? 'MWST ' : 'MwSt. ') + satz + '%</span><span>' + Utils.formatCurrency(mwstMap[satz]) + '</span></div>';
            });
            html += '<div class="inv-tr grand" style="color:' + accentColor + '"><span>GESAMTBETRAG</span><span>' + Utils.formatCurrency(netto + totalMwst) + '</span></div>';
        }
        html += '</div>';

        // Kleinunternehmer notice
        if (isKlein) {
            html += isCH
                ? '<div class="inv-klein">Nicht MWST-pflichtig gem. Art. 10 Abs. 2 MWSTG.</div>'
                : '<div class="inv-klein">Gem\u00E4\u00DF \u00A719 UStG wird keine Umsatzsteuer berechnet.</div>';
        }

        // Payment terms & notes
        if (inv.zahlungsbedingungen) {
            html += '<div class="inv-note"><strong>Zahlungsbedingungen:</strong><br>' + Utils.escapeHtml(inv.zahlungsbedingungen) + '</div>';
        }
        if (inv.notizen) {
            html += '<div class="inv-note"><strong>Hinweise:</strong><br>' + Utils.escapeHtml(inv.notizen) + '</div>';
        }

        // Bank info
        if (settings.bankname || settings.iban) {
            html += '<div class="inv-bank">';
            html += '<div class="inv-bank-hd">Bankverbindung</div>';
            html += '<div class="inv-bank-row">';
            if (settings.bankname) html += '<span><em>Bank</em> ' + Utils.escapeHtml(settings.bankname) + '</span>';
            if (settings.iban) html += '<span><em>IBAN</em> ' + Utils.escapeHtml(settings.iban) + '</span>';
            if (settings.bic) html += '<span><em>BIC</em> ' + Utils.escapeHtml(settings.bic) + '</span>';
            html += '</div>';
            html += '<div class="inv-bank-ref">Verwendungszweck: ' + Utils.escapeHtml(inv.nummer || '') + '</div>';
            html += '</div>';
        }

        // Swiss QR-Rechnung payment slip (QR-bill)
        if (isCH && settings.iban && inv.typ === 'rechnung') {
            var rawIban = (settings.iban || '').replace(/\s/g, '');
            var fmtIban = rawIban.match(/.{1,4}/g).join(' ');
            var totalBrutto = isKlein ? netto : (netto + totalMwst);

            html += '<div style="border-top:2px dashed #aaa;margin-top:28px;page-break-inside:avoid;">';
            html += '<div style="text-align:center;font-size:9px;color:#aaa;padding:3px 0;letter-spacing:1.5px;">✂ &nbsp; Hier abtrennen &nbsp; ✂</div>';
            html += '<div style="display:flex;border-top:1px solid #000;font-family:Arial,Helvetica,sans-serif;min-height:88mm;">';

            // Empfangsschein (left, 62mm ≈ 220px at 96dpi but we use flex)
            html += '<div style="width:28%;max-width:220px;border-right:1px solid #000;padding:5mm 4mm;font-size:7pt;">';
            html += '<div style="font-weight:700;font-size:9pt;margin-bottom:4mm;">Empfangsschein</div>';
            html += '<div style="font-size:6pt;color:#555;margin-bottom:1mm;">Konto / Zahlbar an</div>';
            html += '<div style="margin-bottom:3mm;">' + Utils.escapeHtml(fmtIban) + '<br>'
                + Utils.escapeHtml(settings.firmenname || '') + '<br>'
                + Utils.escapeHtml((settings.adresse || '') + ', ' + (settings.plz || '') + ' ' + (settings.ort || '')) + '</div>';
            html += '<div style="font-size:6pt;color:#555;margin-bottom:1mm;">Referenz</div>';
            html += '<div style="margin-bottom:3mm;">' + Utils.escapeHtml(inv.nummer || '') + '</div>';
            html += '<div style="font-size:6pt;color:#555;margin-bottom:1mm;">Zahlbar durch</div>';
            html += '<div style="height:12mm;border-bottom:1px solid #aaa;"></div>';
            html += '<div style="display:flex;justify-content:space-between;margin-top:3mm;">';
            html += '<div><div style="font-size:6pt;color:#555;">Währung</div><div style="font-weight:700;">CHF</div></div>';
            html += '<div><div style="font-size:6pt;color:#555;">Betrag</div><div style="font-weight:700;">' + totalBrutto.toLocaleString('de-CH',{minimumFractionDigits:2}) + '</div></div>';
            html += '</div>';
            html += '<div style="font-size:6pt;color:#999;text-align:right;margin-top:16mm;">Annahmestelle</div>';
            html += '</div>'; // Empfangsschein

            // Zahlteil (right)
            html += '<div style="flex:1;padding:5mm 6mm;font-size:8pt;">';
            html += '<div style="font-weight:700;font-size:9pt;margin-bottom:4mm;">Zahlteil</div>';
            html += '<div style="display:flex;gap:5mm;">';

            // QR code area (46mm × 46mm per SPS 2023)
            var _qrLines = [
                'SPC', '0200', '1',
                rawIban,
                'K',
                (settings.firmenname || '').substring(0, 70),
                (settings.adresse || '').substring(0, 70),
                ((settings.plz || '') + ' ' + (settings.ort || '')).trim().substring(0, 70),
                '', '', 'CH',
                '', '', '', '', '', '', '',
                totalBrutto.toFixed(2), 'CHF',
                '', '', '', '', '', '', '',
                'NON', '', (inv.nummer || '').substring(0, 140), 'EPD'
            ];
            var _qrPayload = _qrLines.join('\r\n');
            html += '<div style="flex-shrink:0;">';
            html += '<div style="position:relative;width:175px;height:175px;">';
            html += _generateChQrSvg(_qrPayload);
            html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;background:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;">';
            html += '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><rect fill="#FF0000" x="6" y="0" width="6" height="18"/><rect fill="#FF0000" x="0" y="6" width="18" height="6"/></svg>';
            html += '</div>';
            html += '</div>';
            // Currency + amount below QR
            html += '<div style="display:flex;gap:6mm;margin-top:2mm;">';
            html += '<div><div style="font-size:6pt;color:#555;">Währung</div><div style="font-weight:700;">CHF</div></div>';
            html += '<div><div style="font-size:6pt;color:#555;">Betrag</div><div style="font-weight:700;">' + totalBrutto.toLocaleString('de-CH',{minimumFractionDigits:2}) + '</div></div>';
            html += '</div>';
            html += '</div>'; // QR area

            // Payment details
            html += '<div style="flex:1;">';
            html += '<div style="font-size:6pt;color:#555;margin-bottom:1mm;">Konto / Zahlbar an</div>';
            html += '<div style="margin-bottom:4mm;">' + Utils.escapeHtml(fmtIban) + '<br>'
                + Utils.escapeHtml(settings.firmenname || '') + '<br>'
                + Utils.escapeHtml((settings.adresse || '') + '<br>' + (settings.plz || '') + ' ' + (settings.ort || '')) + '</div>';
            html += '<div style="font-size:6pt;color:#555;margin-bottom:1mm;">Referenz</div>';
            html += '<div style="margin-bottom:4mm;">' + Utils.escapeHtml(inv.nummer || '') + '</div>';
            html += '<div style="font-size:6pt;color:#555;margin-bottom:1mm;">Zahlbar durch</div>';
            html += '<div style="height:14mm;border-bottom:1px solid #aaa;"></div>';
            html += '</div>'; // Payment details

            html += '</div>'; // flex row
            html += '</div>'; // Zahlteil
            html += '</div>'; // main flex
            html += '</div>'; // QR-Rechnung container
        }

        // Footer
        html += '<div class="inv-footer">';
        var footerParts = [];
        if (settings.firmenname) footerParts.push(Utils.escapeHtml(settings.firmenname));
        if (settings.adresse) footerParts.push(Utils.escapeHtml(settings.adresse) + ', ' + Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || ''));
        if (settings.telefon) {
            var tel = settings.telefon;
            if (tel && tel.charAt(0) !== '+') tel = '+' + tel;
            footerParts.push('Tel: ' + Utils.escapeHtml(tel));
        }
        if (settings.email) footerParts.push(Utils.escapeHtml(settings.email));
        html += footerParts.join(' \u00B7 ');

        // Rechtsform-Pflichtangaben (\u00A737a HGB / \u00A735a GmbHG)
        var gbrEinst = (typeof Store !== 'undefined') ? (Store.get('gbr_einstellungen') || {}) : {};
        var rechtsformParts = [];
        var form = gbrEinst.firmenform || '';
        if (['OHG','KG','GmbH','UG','GmbH & Co. KG'].includes(form)) {
            if (gbrEinst.handelsregisterNr) rechtsformParts.push(Utils.escapeHtml(gbrEinst.handelsregisterNr));
            if (gbrEinst.handelsregisterGericht) rechtsformParts.push(Utils.escapeHtml(gbrEinst.handelsregisterGericht));
            if (gbrEinst.sitz) rechtsformParts.push('Sitz: ' + Utils.escapeHtml(gbrEinst.sitz));
            if (gbrEinst.geschaeftsfuehrer) rechtsformParts.push('GF: ' + Utils.escapeHtml(gbrEinst.geschaeftsfuehrer));
            if (['GmbH','UG'].includes(form) && gbrEinst.stammkapital) rechtsformParts.push('Stammkapital: ' + Utils.formatCurrency(gbrEinst.stammkapital));
        } else if (form === 'eGbR') {
            if (gbrEinst.eGbrRegisternummer) rechtsformParts.push(Utils.escapeHtml(gbrEinst.eGbrRegisternummer));
            if (gbrEinst.eGbrRegistergericht) rechtsformParts.push(Utils.escapeHtml(gbrEinst.eGbrRegistergericht));
        }
        if (rechtsformParts.length > 0) {
            html += '<br>' + rechtsformParts.join(' \u00B7 ');
        }

        html += '</div>';

        html += '</div>'; // inv-body
        html += '</div>'; // inv-wrap
        return html;
    }

    function _generateChQR(box) {
        var el = box;
        while (el && !el.getAttribute('data-qr')) el = el.parentElement;
        if (!el) return;
        var qrData = decodeURIComponent(el.getAttribute('data-qr'));
        function doQR() {
            box.innerHTML = '';
            new QRCode(box, { text: qrData, width: 175, height: 175, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
        }
        if (typeof QRCode !== 'undefined') {
            doQR();
        } else {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
            s.onload = doQR;
            document.head.appendChild(s);
        }
    }

    function printInvoiceWindow(invoiceHtml, asPdf, watermarkText) {
        // watermarkText is embedded in invoiceHtml already via generatePreviewHtml
        var invoiceCss = `
            * { box-sizing: border-box; }
            body { background: white; margin: 0; padding: 0; }
            @page { size: A4; margin: 8mm; }
            @media print { .inv-wrap { max-width: 100% !important; } }
        `;
        var qrScript = '<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>';
        var qrInit = '<script>(function(){function tryQR(){var box=document.getElementById("ch-qr-box");if(!box||typeof QRCode==="undefined")return;var el=box;while(el&&!el.getAttribute("data-qr"))el=el.parentElement;if(el){var d=decodeURIComponent(el.getAttribute("data-qr"));box.innerHTML="";new QRCode(box,{text:d,width:175,height:175,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",tryQR);}else{tryQR();}}());<\/script>';
        var fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rechnung</title>' + qrScript + '<style>' + invoiceCss + '</style></head><body>' + invoiceHtml + qrInit + '</body></html>';

        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0;';
        document.body.appendChild(iframe);
        var idoc = iframe.contentDocument || iframe.contentWindow.document;
        idoc.write(fullHtml);
        idoc.close();
        setTimeout(function() {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch(e) { console.error(e); }
            var cleanup = function() {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            };
            iframe.contentWindow.addEventListener('afterprint', cleanup);
            setTimeout(cleanup, 30000);
        }, 500);
    }

    function _generateChQrSvg(payload) {
        if (typeof qrcode === 'undefined') {
            return '<div style="width:175px;height:175px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:9px;text-align:center;border:1px solid #ccc;flex-direction:column;"><div>QR-Code</div><div style="font-size:8px;">(Offline)</div></div>';
        }
        try {
            var qr = qrcode(0, 'M');
            qr.addData(payload, 'Byte');
            qr.make();
            var svg = qr.createSvgTag(4, 0);
            return svg.replace('<svg ', '<svg style="width:175px;height:175px;" ');
        } catch(e) {
            return '<div style="width:175px;height:175px;background:#fee;color:#c00;font-size:8px;padding:4px;word-break:break-all;">QR-Fehler</div>';
        }
    }

    function showInvoicePreview(inv) {
        var overlay = document.getElementById('modalOverlay');
        var modal = document.getElementById('modal');

        modal.innerHTML = generatePreviewHtml(inv);
        modal.style.padding = '0';
        modal.style.overflow = 'auto';
        modal.style.maxHeight = '90vh';

        // Floating toolbar \u2014 outside the invoice, not printed
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

        printBtn.addEventListener('click', function() { printInvoiceWindow(generatePreviewHtml(inv), false); });
        closeBtn.addEventListener('click', closePreview);
        overlay.addEventListener('click', overlayHandler);
    }

    return {
        render: render,
        init: init,
        currentTyp: currentTyp,
        generatePreviewHtml: generatePreviewHtml,
        printInvoiceWindow: printInvoiceWindow,
        showInvoicePreview: showInvoicePreview
    };
})();

// ─── Testrechnung / Musterrechnung ───────────────────────────────────────────
var TestRechnung = (function() {

    function buildMockInvoice() {
        var settings = Store.getSettings();
        var customers = Store.getRechCustomers().filter(function(c) { return !c.archiviert; });
        var products = Store.getRechProducts();
        var year = new Date().getFullYear();

        // Use first real customer if available, otherwise a dummy
        var kundeId = customers.length ? customers[0].id : null;
        if (!kundeId) {
            // inject temp dummy customer just for preview
            kundeId = '__TEST__';
        }

        var positionen = [];
        if (products.length) {
            positionen.push({ beschreibung: products[0].bezeichnung || products[0].beschreibung, menge: 1, einheit: products[0].einheit || 'Stk', einzelpreis: products[0].preis || 99.00, mwstSatz: products[0].mwstSatz || 19 });
            if (products.length > 1) {
                positionen.push({ beschreibung: products[1].bezeichnung || products[1].beschreibung, menge: 2, einheit: products[1].einheit || 'Stk', einzelpreis: products[1].preis || 49.50, mwstSatz: products[1].mwstSatz || 19 });
            }
        } else {
            positionen = [
                { beschreibung: 'Beispielleistung / Produkt A', menge: 1, einheit: 'Stk', einzelpreis: 120.00, mwstSatz: 19 },
                { beschreibung: 'Beratungsleistung (2 Std.)', menge: 2, einheit: 'Std', einzelpreis: 85.00, mwstSatz: 19 }
            ];
        }

        var today = new Date();
        var faellig = new Date(today); faellig.setDate(faellig.getDate() + 14);

        return {
            id: '__TEST__',
            typ: 'rechnung',
            nummer: 'TEST-' + year + '-0001',
            datum: today.toISOString().split('T')[0],
            faelligkeit: faellig.toISOString().split('T')[0],
            datumsOption: 'faelligkeit',
            kundeId: kundeId,
            positionen: positionen,
            status: 'offen',
            zahlungsbedingungen: 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.',
            notizen: 'Dies ist eine Muster-/Testrechnung ohne rechtliche G\u00FCltigkeit.',
            versendet: false,
            versandDatum: null,
            _isTest: true
        };
    }

    var DUMMY_KUNDE = { id: '__TEST__', firma: 'Musterfirma GmbH', ansprechpartner: 'Max Mustermann', strasse: 'Musterstra\u00DFe 1', plz: '12345', ort: 'Musterstadt', email: 'max@musterfirma.de' };

    function render() {
        var mockInv = buildMockInvoice();
        var customers = Store.getRechCustomers();
        var hasKunde = customers.find(function(c) { return c.id === mockInv.kundeId; });
        var _origGet;
        if (!hasKunde) {
            _origGet = Store.getRechCustomers.bind(Store);
            Store.getRechCustomers = function() {
                return _origGet().concat([DUMMY_KUNDE]);
            };
        }

        var previewHtml = Rechnung.generatePreviewHtml(mockInv, 'MUSTER');

        if (!hasKunde && _origGet) {
            Store.getRechCustomers = _origGet;
        }

        var html = '<div class="page-header"><h2>\uD83E\uDDEA Testrechnung / Musterrechnung</h2>';
        html += '<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Vorschau deiner Rechnungsvorlage \u2013 wird <strong>nicht gespeichert</strong>.</div></div>';

        html += '<div style="display:flex;gap:12px;margin-bottom:16px;">';
        html += '<button class="btn btn-primary" id="testPrint">\uD83D\uDDA8 Drucken / PDF</button>';
        html += '<span style="font-size:12px;color:var(--text-muted);align-self:center;">';
        html += '\u2139\uFE0F Diese Rechnung tr\u00E4gt den Vermerk MUSTER und hat keine rechtliche G\u00FCltigkeit.';
        html += '</span></div>';

        html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;">';
        html += previewHtml;
        html += '</div>';

        return html;
    }

    function init() {
        var btn = document.getElementById('testPrint');
        if (!btn) return;
        btn.addEventListener('click', function() {
            var mockInv = buildMockInvoice();
            var customers = Store.getRechCustomers();
            var hasKunde = customers.find(function(c) { return c.id === mockInv.kundeId; });
            var _origGet;
            if (!hasKunde) {
                _origGet = Store.getRechCustomers.bind(Store);
                Store.getRechCustomers = function() { return _origGet().concat([DUMMY_KUNDE]); };
            }
            var html = Rechnung.generatePreviewHtml(mockInv, 'MUSTER');
            if (!hasKunde && _origGet) Store.getRechCustomers = _origGet;
            Rechnung.printInvoiceWindow(html, false);
        });
    }

    return { render: render, init: init };
})();
