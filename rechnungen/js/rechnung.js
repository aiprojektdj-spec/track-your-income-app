var Rechnung = (function() {

    var currentTyp = 'rechnung';
    var editingInvoice = null;
    var positionCount = 0;
    var originalLinkedLagerIds = []; // Lager-Verknüpfungen der geladenen Rechnung (vor dieser Bearbeitungssitzung)

    // EU-Mitgliedstaaten für die §13b-Reverse-Charge-Erkennung. Fallback nötig, weil die
    // Standalone-Rechnungsseite js/vorsteuer.js (Quelle von Vorsteuer.EU_LAENDER) nicht lädt —
    // mit leerem Fallback wäre die RC-Automatik dort komplett wirkungslos.
    var EU_LAENDER_FALLBACK = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
    function rcEuLaender() {
        return (typeof Vorsteuer !== 'undefined') ? Vorsteuer.EU_LAENDER : EU_LAENDER_FALLBACK;
    }

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
        return d.toLocaleDateString('sv-SE');
    }

    function calcBrutto(invoice) {
        var settings = Store.getSettings();
        var isKlein = invoice.isKlein !== undefined ? invoice.isKlein : (settings.ustMode === 'klein');
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
        originalLinkedLagerIds = editingInvoice
            ? (editingInvoice.positionen || []).map(function(p) { return p.lagerArtikelId; }).filter(Boolean)
            : [];

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
        var leitwegId = editingInvoice ? (editingInvoice.leitwegId || '') : '';
        var status = editingInvoice ? editingInvoice.status : 'offen';
        var positionen = editingInvoice ? editingInvoice.positionen : [];
        var datumsOption = editingInvoice ? (editingInvoice.datumsOption || 'faelligkeit') : 'faelligkeit';
        var lieferdatum = editingInvoice ? (editingInvoice.lieferdatum || '') : '';
        var lieferVon = editingInvoice ? (editingInvoice.lieferVon || '') : '';
        var lieferBis = editingInvoice ? (editingInvoice.lieferBis || '') : '';

        var html = '<div class="page-header"><h2>' + title + '</h2></div>';

        // §14 UStG: dieselbe Pruefung, die weiter unten das Speichern blockiert, schon BEIM
        // OEFFNEN als Banner. Vorher erfuhr der Nutzer erst nach Kunde, Datum und allen Positionen,
        // dass die Steuernummer fehlt — und es gibt keine Entwurfssicherung, die Rechnung war weg.
        // Nur ein Hinweis, kein Blocker: Angebote brauchen die Angabe nicht, und wer sie gleich
        // nachtraegt, soll hier nicht ausgesperrt werden.
        if (currentTyp === 'rechnung' || currentTyp === 'gutschrift') {
            var ud14 = Store.getRechUnternehmen ? Store.getRechUnternehmen() : {};
            if (!ud14.steuernummer && !ud14.ustId) {
                html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:20px;';
                html += 'background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius);">';
                html += '<i class="ti ti-alert-triangle" style="font-size:22px;color:var(--warning);flex-shrink:0;"></i>';
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:700;font-size:13px;">Steuernummer oder USt-IdNr. fehlt noch</div>';
                html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">§14 UStG verlangt die Angabe auf jeder Rechnung. Ohne sie lässt sich dieses Dokument am Ende nicht speichern — am besten jetzt gleich ergänzen.</div>';
                html += '</div>';
                html += '<button class="btn btn-small btn-outline" data-rech-page="unternehmensdaten" data-action="rech-navigate" style="white-space:nowrap;"><i class="ti ti-settings" style="font-size:13px;"></i> Jetzt ergänzen</button>';
                html += '</div>';
            }
        }

        html += '<div class="card"><div class="card-header"><div class="card-title">Dokumentdetails</div></div>';
        html += '<div style="padding: 1rem;">';

        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label" for="invTyp">Dokumenttyp</label>';
        html += '<select class="form-select" id="invTyp">';
        html += '<option value="rechnung"' + (currentTyp === 'rechnung' ? ' selected' : '') + '>Rechnung</option>';
        html += '<option value="angebot"' + (currentTyp === 'angebot' ? ' selected' : '') + '>Angebot</option>';
        html += '<option value="gutschrift"' + (currentTyp === 'gutschrift' ? ' selected' : '') + '>Gutschrift</option>';
        html += '</select></div>';

        html += '<div class="form-group"><label class="form-label" for="invNummer">Nummer</label>';
        html += '<input class="form-input" id="invNummer" value="' + Utils.escapeHtml(nummer) + '" placeholder="Wird automatisch generiert"></div>';

        html += '<div class="form-group"><label class="form-label" for="invDatum">Datum</label>';
        html += '<input class="form-input" type="date" id="invDatum" value="' + datum + '"></div>';

        html += '<div class="form-group" id="invFaelligkeitGroup"' + (datumsOption !== 'faelligkeit' ? ' style="display:none;"' : '') + '><label class="form-label" for="invFaelligkeit">F\u00E4lligkeitsdatum</label>';
        html += '<input class="form-input" type="date" id="invFaelligkeit" value="' + faelligkeit + '"></div>';
        html += '<div class="form-group" id="invLieferdatumGroup"' + (datumsOption !== 'lieferdatum' ? ' style="display:none;"' : '') + '><label class="form-label" for="invLieferdatum">Lieferdatum</label>';
        html += '<input class="form-input" type="date" id="invLieferdatum" value="' + lieferdatum + '"></div>';
        html += '<div class="form-group" id="invLieferzeitraumGroup"' + (datumsOption !== 'lieferzeitraum' ? ' style="display:none;"' : '') + '><label class="form-label" for="invLieferVon">Lieferzeitraum Von</label>';
        html += '<input class="form-input" type="date" id="invLieferVon" value="' + lieferVon + '" style="margin-bottom:4px;">';
        html += '<label class="form-label" for="invLieferBis">bis</label>';
        html += '<input class="form-input" type="date" id="invLieferBis" value="' + lieferBis + '"></div>';
        html += '<div class="form-group"><label class="form-label" for="invDatumsOption">Datumsoptionen</label>';
        html += '<select class="form-select" id="invDatumsOption">';
        html += '<option value="nur_datum"' + (datumsOption === 'nur_datum' ? ' selected' : '') + '>Nur Rechnungsdatum</option>';
        html += '<option value="faelligkeit"' + (datumsOption === 'faelligkeit' ? ' selected' : '') + '>Rechnungsdatum + F\u00E4lligkeitsdatum</option>';
        html += '<option value="lieferdatum"' + (datumsOption === 'lieferdatum' ? ' selected' : '') + '>Rechnungsdatum + Lieferdatum</option>';
        html += '<option value="lieferzeitraum"' + (datumsOption === 'lieferzeitraum' ? ' selected' : '') + '>Rechnungsdatum + Lieferzeitraum</option>';
        html += '</select></div>';
        html += '<div class="form-group"><label class="form-label" for="invPlattform">Verkaufsplattform</label>';
        html += '<select class="form-select" id="invPlattform">';
        var plattformen = Store.getPlatforms();
        plattformen.forEach(function(pl) {
            var sel = (editingInvoice && editingInvoice.verkaufsplattform === pl) ? ' selected' : '';
            html += '<option value="' + Utils.escapeHtml(pl) + '"' + sel + '>' + Utils.escapeHtml(pl) + '</option>';
        });
        html += '</select></div>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group" style="flex:2"><label class="form-label" for="invKundeSearch">Kunde</label>';
        html += '<input class="form-input" type="text" id="invKundeSearch" placeholder="Kunde suchen…" autocomplete="off" style="margin-bottom:4px;">';
        html += '<select class="form-select" id="invKunde">';
        html += '<option value="">-- Kunde w\u00E4hlen --</option>';
        customers.forEach(function(c) {
            var sel = kundeId === c.id ? ' selected' : '';
            html += '<option value="' + c.id + '"' + sel + '>' + Utils.escapeHtml(c.firma || c.ansprechpartner) + ' (' + Utils.escapeHtml(c.kundennummer || '') + ')</option>';
        });
        html += '<option value="__new__">+ Neuen Kunden anlegen</option>';
        html += '</select></div>';
        html += '</div>';
        html += '<div id="reverseChargeHint" style="display:none;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);">';
        html += 'ℹ️ <strong>§13b UStG – Reverse Charge:</strong> EU-Geschäftskunde mit USt-IdNr. erkannt. Steuerschuldnerschaft geht auf den Empfänger über, USt-Sätze wurden auf 0% gesetzt. Bitte bei jeder Position unten „Art des Umsatzes" wählen (entscheidet Kz. 41 vs. Kz. 21 – eine Rechnung kann Ware <em>und</em> Leistung an denselben Kunden mischen).';
        html += '</div>';
        // §14 UStG (Wachstumschancengesetz): seit 01.01.2025 müssen inländische Unternehmen (auch KU)
        // strukturierte E-Rechnungen empfangen können; die aktive Versandpflicht greift gestaffelt ab 2027/2028.
        // Export: „XR"-Button je Rechnung in der Dokumente-Übersicht. Empfang: eigener „E-Rechnung"-Tab.
        html += '<div style="background:rgba(148,163,184,0.08);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text-muted);">';
        html += 'ℹ️ <strong>E-Rechnungspflicht (B2B):</strong> Seit 01.01.2025 muss jedes inländische Unternehmen — auch Kleinunternehmer — strukturierte E-Rechnungen (XRechnung/ZUGFeRD) <em>empfangen</em> können; die Versandpflicht folgt gestaffelt ab 2027. Stackr exportiert XRechnung über den „XR"-Button in der Dokumente-Übersicht und empfängt eingehende E-Rechnungen im Tab „E-Rechnung".';
        html += '</div>';

        // Inline new customer fields (hidden by default)
        html += '<div id="newCustomerFields" style="display:none; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">';
        html += '<div class="section-title">Neuer Kunde</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label" for="ncFirma">Firma</label><input class="form-input" id="ncFirma"></div>';
        html += '<div class="form-group"><label class="form-label" for="ncAnsprech">Ansprechpartner</label><input class="form-input" id="ncAnsprech"></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label" for="ncStrasse">Stra\u00DFe</label><input class="form-input" id="ncStrasse"></div>';
        html += '<div class="form-group"><label class="form-label" for="ncPlz">PLZ</label><input class="form-input" id="ncPlz"></div>';
        html += '<div class="form-group"><label class="form-label" for="ncOrt">Ort</label><input class="form-input" id="ncOrt"></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label" for="ncEmail">E-Mail</label><input class="form-input" id="ncEmail" type="email"></div>';
        html += '<div class="form-group"><label class="form-label" for="ncTelefon">Telefon</label><input class="form-input" id="ncTelefon"></div>';
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
        html += '<button class="btn btn-primary" id="addPosition" style="margin-top: 0.5rem;">+ Position hinzuf\u00FCgen</button> ';
        html += '<button class="btn" id="addFromLager" style="margin-top: 0.5rem;">\uD83D\uDCE6 Artikel aus Lager</button>';

        // Summenblock
        html += '<div id="summenBlock" style="margin-top: 1.5rem; text-align: right;"></div>';
        html += '</div></div>';

        // Footer fields
        html += '<div class="card"><div class="card-header"><div class="card-title">Zus\u00E4tzliche Angaben</div></div>';
        html += '<div style="padding: 1rem;">';
        html += '<div class="form-group"><label class="form-label" for="invZahlung">Zahlungsbedingungen</label>';
        html += '<textarea class="form-textarea" id="invZahlung" rows="2" placeholder="z.B. Zahlbar innerhalb 14 Tagen. 2% Skonto bei Zahlung innerhalb 7 Tagen.">' + Utils.escapeHtml(zahlungsbedingungen) + '</textarea>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Vereinbarte Skontobedingungen hier angeben (§14 Abs. 4 Nr. 7 UStG) – nur wenn beim Vertragsschluss vereinbart, nicht als nachträgliche Zahlungserinnerung.</div></div>';
        html += '<div class="form-group"><label class="form-label" for="invNotizen">Notizen</label>';
        html += '<textarea class="form-textarea" id="invNotizen" rows="2" maxlength="1000">' + Utils.escapeHtml(notizen) + '</textarea></div>';
        // Leitweg-ID (Fund T6, Steuer-Vergleich 2026-08-10): rechnungen/js/xrechnung.js schreibt
        // <ram:BuyerReference> seit je korrekt, WENN inv.leitwegId gesetzt ist — ein Eingabefeld
        // gab es aber nirgends. Damit war der B2G-Fall (Rechnung an eine Behörde) praktisch
        // nicht bedienbar, obwohl die halbe Arbeit getan war. Die Leitweg-ID ist bei
        // Rechnungen an öffentliche Auftraggeber Pflichtangabe; ohne sie weist die
        // Rechnungseingangsplattform des Bundes/der Länder die XRechnung zurück.
        html += '<div class="form-group"><label class="form-label" for="invLeitwegId">Leitweg-ID <span style="font-weight:400;color:var(--text-muted);">(nur bei Rechnungen an Behörden)</span></label>';
        html += '<input class="form-input" type="text" id="invLeitwegId" maxlength="80" placeholder="z.B. 04011000-1234512345-06" value="' + Utils.escapeHtml(leitwegId) + '">';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Teilt dir der öffentliche Auftraggeber mit. Landet als <code>BuyerReference</code> in der XRechnung — ohne sie weisen die Rechnungseingangsplattformen des Bundes und der Länder die Rechnung zurück.</div></div>';
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

        var html = '<div class="form-row position-row" data-idx="' + idx + '" style="align-items: flex-end; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">';

        html += '<div class="form-group" style="flex: 1.5;">';
        if (idx === 0) html += '<label class="form-label">Produkt</label>';
        html += '<div style="display:flex;align-items:center;">';
        html += '<select class="form-select pos-product" data-idx="' + idx + '" aria-label="Produkt" style="flex:1;">';
        html += '<option value="">Manuell</option>';
        products.forEach(function(p) {
            html += '<option value="' + p.id + '">' + Utils.escapeHtml(p.name) + '</option>';
        });
        html += '</select>';
        html += '<button class="btn btn-small btn-primary pos-new-prod" data-idx="' + idx + '" title="Neues Produkt anlegen" style="margin-left:4px;">\u2795</button>';
        html += '</div></div>';

        html += '<div class="form-group" style="flex: 2;">';
        if (idx === 0) html += '<label class="form-label">Beschreibung</label>';
        html += '<input class="form-input pos-beschreibung" maxlength="500" data-idx="' + idx + '" aria-label="Beschreibung" value="' + Utils.escapeHtml(pos.beschreibung || '') + '"></div>';

        html += '<div class="form-group" style="flex: 0.7;">';
        if (idx === 0) html += '<label class="form-label">Menge</label>';
        html += '<input class="form-input pos-menge" type="number" step="0.01" min="0" max="999999" data-idx="' + idx + '" aria-label="Menge" value="' + (pos.menge != null ? pos.menge : 1) + '"></div>';

        html += '<div class="form-group" style="flex: 0.8;">';
        if (idx === 0) html += '<label class="form-label">Einheit</label>';
        html += '<select class="form-select pos-einheit" data-idx="' + idx + '" aria-label="Einheit">';
        html += '<option value="St\u00FCck"' + ((pos.einheit || 'St\u00FCck') === 'St\u00FCck' ? ' selected' : '') + '>St\u00FCck</option>';
        html += '<option value="Std."' + (pos.einheit === 'Std.' ? ' selected' : '') + '>Std.</option>';
        html += '<option value="pauschal"' + (pos.einheit === 'pauschal' ? ' selected' : '') + '>pauschal</option>';
        html += '</select></div>';

        html += '<div class="form-group" style="flex: 1;">';
        if (idx === 0) html += '<label class="form-label">Einzelpreis</label>';
        html += '<input class="form-input pos-einzelpreis" type="number" step="0.01" min="0" max="99999999" data-idx="' + idx + '" aria-label="Einzelpreis" value="' + (pos.einzelpreis || 0) + '"></div>';

        html += '<div class="form-group pos-mwst-wrap" style="flex: 0.7;display:' + (pos.differenzbesteuert ? 'none' : '') + ';">';
        if (idx === 0) html += '<label class="form-label">MwSt</label>';
        html += '<select class="form-select pos-mwst" data-idx="' + idx + '" aria-label="MwSt-Satz">';
        html += '<option value="19"' + ((pos.mwstSatz === undefined || pos.mwstSatz === 19) ? ' selected' : '') + '>19%</option>';
        html += '<option value="7"'  + (pos.mwstSatz === 7 ? ' selected' : '') + '>7%</option>';
        html += '<option value="0"'  + (pos.mwstSatz === 0 ? ' selected' : '') + '>0%</option>';
        html += '</select></div>';
        html += '<div class="form-group pos-diff25a-label" style="flex: 0.7;display:' + (pos.differenzbesteuert ? '' : 'none') + ';">';
        if (idx === 0) html += '<label class="form-label">MwSt</label>';
        html += '<span style="font-size:12px;color:var(--text-muted);" title="Differenzbesteuerung §25a UStG — kein offener USt-Ausweis">Diff. §25a</span></div>';

        // Differenzbesteuerung §25a UStG — Checkbox pro Position (für manuelle Positionen ohne
        // Lager-Bezug; bei Lager-Verknüpfung wird das Flag von addPositionFromLagerArt() gesetzt).
        html += '<div class="form-group pos-diff25a-wrap" style="flex: 1.4;">';
        if (idx === 0) html += '<label class="form-label">§25a</label>';
        html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:400;white-space:nowrap;">';
        html += '<input type="checkbox" class="pos-diff25a" data-idx="' + idx + '"' + (pos.differenzbesteuert ? ' checked' : '') + '> Diff.';
        html += '</label>';
        html += '<select class="form-select pos-warenart" data-idx="' + idx + '" aria-label="Warenart (§25a)" title="v1 rechnet pauschal 19% USt auf die Marge. Bei Kunst/Sammlerstücken kann §25a Abs. 3 UStG i.V.m. Anlage 2 UStG auch 7% vorsehen — im Zweifel Steuerberater konsultieren." style="display:' + (pos.differenzbesteuert ? '' : 'none') + ';font-size:11px;margin-top:2px;">';
        html += '<option value="gebraucht"' + (pos.warenart === 'gebraucht' ? ' selected' : '') + '>Gebrauchtgeg.</option>';
        html += '<option value="kunst"' + (pos.warenart === 'kunst' ? ' selected' : '') + '>Kunstgeg.</option>';
        html += '<option value="sammlerstueck"' + (pos.warenart === 'sammlerstueck' ? ' selected' : '') + '>Sammlerst./Antiq.</option>';
        html += '</select>';
        html += '<input type="number" step="0.01" min="0" class="form-input pos-diff-ek" data-idx="' + idx + '" aria-label="Einkaufspreis" placeholder="EK-Preis" value="' + (pos.einkaufspreis != null ? pos.einkaufspreis : '') + '" style="display:' + ((pos.differenzbesteuert && !lagerArtikelId) ? '' : 'none') + ';font-size:11px;margin-top:2px;">';
        html += '</div>';

        // Nur relevant bei EU-B2B-Reverse-Charge (§13b) — Sichtbarkeit steuert applyReverseChargeCheck().
        // Pro Position statt pro Rechnung, weil eine Rechnung Ware UND Leistung an denselben EU-Kunden
        // mischen kann (Kz. 41 vs. Kz. 21 sind pro Position zu ermitteln).
        html += '<div class="form-group pos-igart-wrap" style="flex: 1.3;display:none;">';
        if (idx === 0) html += '<label class="form-label">Art (EU)</label>';
        html += '<select class="form-select pos-igart" data-idx="' + idx + '" aria-label="Art (EU)">';
        html += '<option value=""' + (pos.igArt ? '' : ' selected') + ' disabled>-- wählen --</option>';
        html += '<option value="ware"' + (pos.igArt === 'ware' ? ' selected' : '') + '>Ware (Kz.41)</option>';
        html += '<option value="leistung"' + (pos.igArt === 'leistung' ? ' selected' : '') + '>Leistung (Kz.21)</option>';
        html += '</select></div>';

        html += '<div class="form-group" style="flex: 1;">';
        if (idx === 0) html += '<label class="form-label">Gesamt</label>';
        var gesamt = (pos.menge != null ? pos.menge : 1) * (pos.einzelpreis || 0);
        html += '<input class="form-input pos-gesamt" data-idx="' + idx + '" aria-label="Gesamtbetrag" value="' + gesamt.toFixed(2) + '" readonly style="opacity: 0.7;"></div>';

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

    // ---- Lager-Status-Helfer ----
    // Ein Lagerartikel gilt ab dem Verknüpfen mit einer Rechnungsposition als verkauft
    // (nicht erst beim Bezahlen) — verhindert, dass derselbe Artikel in einer zweiten,
    // parallel offenen Rechnung erneut ausgewählt werden kann.
    function markLagerVerkauft(artId) {
        if (!artId) return;
        var art = Store.getPurchases(true).find(function(a) { return a.id === artId; });
        if (!art) return;
        Store.savePurchase(Object.assign({}, art, { status: 'verkauft', verkaufsdatum: art.verkaufsdatum || Utils.todayISO() }));
    }

    function markLagerVerfuegbar(artId) {
        if (!artId) return;
        var art = Store.getPurchases(true).find(function(a) { return a.id === artId; });
        if (!art || art.status !== 'verkauft') return;
        Store.savePurchase(Object.assign({}, art, { status: 'verfuegbar', verkaufsdatum: '' }));
    }

    // ---- Lager-Artikel-Picker ----
    // row === null -> "Artikel aus Lager hinzufügen": legt für jede Auswahl eine neue Position an.
    // row = <element> -> verknüpft den gewählten Lagerartikel mit dieser bestehenden Position.
    function showLagerPicker(row) {
        var isNewMode = !row;
        var allArts = Store.getPurchases(true);
        var linkedElsewhere = isNewMode
            ? Array.prototype.map.call(document.querySelectorAll('.pos-lager-id'), function(el) { return el.value; }).filter(Boolean)
            : [];
        var available = allArts.filter(function(a) {
            return !a.storniert && a.status === 'verfuegbar' && linkedElsewhere.indexOf(a.id) === -1;
        });
        var currentId = isNewMode ? '' : row.querySelector('.pos-lager-id').value;

        // Volle Filter wie in der Lager-Übersicht (nur Werte zeigen, die unter den
        // verfügbaren Artikeln tatsächlich vorkommen) + Vorschaubild pro Zeile.
        var pickerFilters = { search: '', kategorie: '', zielgruppe: '', haendler: '' };
        var kategorienOpts = Array.from(new Set(available.map(function(a){ return a.warenkategorie; }).filter(Boolean))).sort();
        var haendlerOpts   = Array.from(new Set(available.map(function(a){ return a.haendler; }).filter(Boolean))).sort();
        var zielgruppenOpts = (typeof Store !== 'undefined' && Store.ZIELGRUPPEN) || [];

        function filterAvailable() {
            var s = pickerFilters.search.toLowerCase();
            return available.filter(function(a) {
                if (pickerFilters.kategorie && a.warenkategorie !== pickerFilters.kategorie) return false;
                if (pickerFilters.zielgruppe && a.zielgruppe !== pickerFilters.zielgruppe) return false;
                if (pickerFilters.haendler && a.haendler !== pickerFilters.haendler) return false;
                if (s) {
                    var hay = [a.artikelNr, a.marke, a.artikeltyp, a.beschreibung, a.groesse].join(' ').toLowerCase();
                    if (hay.indexOf(s) === -1) return false;
                }
                return true;
            });
        }

        function renderRows(list) {
            if (list.length === 0) {
                return '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Keine verfügbaren Lagerartikel</td></tr>';
            }
            return list.map(function(a) {
                var isSelected = !isNewMode && a.id === currentId;
                var actionCell;
                if (isSelected) {
                    actionCell = '<span style="color:var(--success);">✓ Aktiv</span>';
                } else {
                    actionCell = '<button class="btn btn-small btn-primary lp-select" data-id="' + a.id + '">' + (isNewMode ? '+ Hinzufügen' : 'Auswählen') + '</button>';
                }
                var photoCell = a.foto
                    ? '<img src="' + a.foto + '" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:4px;">'
                    : '<div style="width:32px;height:32px;border-radius:4px;background:var(--bg-secondary,rgba(255,255,255,.05));"></div>';
                return '<tr data-art-id="' + a.id + '" class="lager-picker-row">' +
                    '<td>' + photoCell + '</td>' +
                    '<td><span style="font-family:monospace;font-size:11px;color:var(--accent);">' + Utils.escapeHtml(a.artikelNr || '—') + '</span></td>' +
                    '<td>' + Utils.escapeHtml((a.marke || '') + ' ' + (a.artikeltyp || '')) + '</td>' +
                    '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">' + Utils.escapeHtml(a.beschreibung || '') + '</td>' +
                    '<td>' + Utils.escapeHtml(a.groesse || '') + '</td>' +
                    '<td style="text-align:right;">' + Utils.formatCurrency(a.einkaufspreis) + '</td>' +
                    '<td>' + actionCell + '</td>' +
                    '</tr>';
            }).join('');
        }

        // Aktuelle Verknüpfung aufheben Button
        var clearBtn = currentId ? '<button class="btn btn-small btn-danger" id="lpClearBtn" style="margin-left:8px;">🗑 Verknüpfung entfernen</button>' : '';

        var introText = isNewMode
            ? 'Wähle einen oder mehrere verfügbare Lagerartikel aus – für jeden wird eine neue Position angelegt.'
            : 'Wähle einen verfügbaren Lagerartikel für diese Position aus.';
        var body = '<div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary);">' + introText + ' Der Artikel wird sofort als <em>Verkauft</em> markiert, damit er nicht versehentlich in einer zweiten Rechnung verwendet wird.</div>';
        body += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
            '<input type="text" class="form-input" id="lpFilterSearch" placeholder="Suche… (Enter)" style="max-width:150px;">' +
            '<select class="form-select" id="lpFilterKategorie" style="max-width:140px;"><option value="">Alle Kategorien</option>' + kategorienOpts.map(function(k){ return '<option value="' + Utils.escapeHtml(k) + '">' + Utils.escapeHtml(k) + '</option>'; }).join('') + '</select>' +
            '<select class="form-select" id="lpFilterZielgruppe" style="max-width:130px;"><option value="">Alle Zielgruppen</option>' + zielgruppenOpts.map(function(z){ return '<option value="' + Utils.escapeHtml(z) + '">' + Utils.escapeHtml(z) + '</option>'; }).join('') + '</select>' +
            '<select class="form-select" id="lpFilterHaendler" style="max-width:140px;"><option value="">Alle Händler</option>' + haendlerOpts.map(function(h){ return '<option value="' + Utils.escapeHtml(h) + '">' + Utils.escapeHtml(h) + '</option>'; }).join('') + '</select>' +
            '</div>';
        body += '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;"><thead><tr><th scope="col"></th><th scope="col">Art.-Nr.</th><th scope="col">Artikel</th><th scope="col">Beschreibung</th><th scope="col">Größe</th><th scope="col">EK-Preis</th><th scope="col"></th></tr></thead><tbody id="lagerPickerBody">' + renderRows(available) + '</tbody></table></div>';

        var footer = clearBtn + ' <button class="btn" data-action="rech-close-modal">' + (isNewMode ? 'Fertig' : 'Schließen') + '</button>';
        RechApp.showModal('Lagerartikel ' + (isNewMode ? 'hinzufügen' : 'verknüpfen'), body, footer);

        function applyPickerFilter() {
            var tbody = document.getElementById('lagerPickerBody');
            if (tbody) tbody.innerHTML = renderRows(filterAvailable());
            bindSelectButtons();
        }
        var lpSearchEl = document.getElementById('lpFilterSearch');
        var lpKatEl    = document.getElementById('lpFilterKategorie');
        var lpZgEl     = document.getElementById('lpFilterZielgruppe');
        var lpHdEl     = document.getElementById('lpFilterHaendler');
        if (lpSearchEl) lpSearchEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { pickerFilters.search = lpSearchEl.value.trim(); applyPickerFilter(); }
        });
        if (lpKatEl) lpKatEl.addEventListener('change', function() { pickerFilters.kategorie = lpKatEl.value; applyPickerFilter(); });
        if (lpZgEl)  lpZgEl.addEventListener('change',  function() { pickerFilters.zielgruppe = lpZgEl.value; applyPickerFilter(); });
        if (lpHdEl)  lpHdEl.addEventListener('change',  function() { pickerFilters.haendler = lpHdEl.value; applyPickerFilter(); });

        function bindSelectButtons() {
            document.querySelectorAll('.lp-select').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var artId = this.getAttribute('data-id');
                    var art = allArts.find(function(a) { return a.id === artId; });
                    if (!art) return;

                    if (isNewMode) {
                        addPositionFromLagerArt(art);
                        available = available.filter(function(a) { return a.id !== artId; });
                        applyPickerFilter();
                        Utils.showToast('Position aus Lagerartikel angelegt: ' + (art.artikelNr || art.marke), 'success');
                        return;
                    }

                    // Verknüpfung speichern (alten Artikel ggf. wieder freigeben, neuen als verkauft markieren)
                    var oldArtId = row.querySelector('.pos-lager-id').value;
                    row.querySelector('.pos-lager-id').value = artId;
                    markLagerVerkauft(artId);
                    if (oldArtId && oldArtId !== artId) markLagerVerfuegbar(oldArtId);
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
        }
        bindSelectButtons();

        var clearBtnEl = document.getElementById('lpClearBtn');
        if (clearBtnEl) {
            clearBtnEl.addEventListener('click', function() {
                var oldArtId = row.querySelector('.pos-lager-id').value;
                row.querySelector('.pos-lager-id').value = '';
                markLagerVerfuegbar(oldArtId);
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

    function addPositionFromLagerArt(art) {
        var beschreibung = ((art.artikelNr ? '[' + art.artikelNr + '] ' : '') + (art.marke || '') + ' ' + (art.artikeltyp || '') + (art.beschreibung ? ' – ' + art.beschreibung : '') + (art.groesse ? ' (Gr. ' + art.groesse + ')' : '')).trim();
        var pos;
        var isEuB2B = false;
        if (art.differenzbesteuert) {
            // §25a UStG: kein offener USt-Ausweis, Regel-Satz für den Ausweis irrelevant.
            pos = { beschreibung: beschreibung, menge: 1, einheit: 'Stück', einzelpreis: 0, mwstSatz: null, lagerArtikelId: art.id, differenzbesteuert: true, warenart: art.warenart || 'gebraucht' };
        } else {
            // Bei aktivem Reverse Charge (§13b) darf die neue Position nicht mit 19% starten
            var hint = document.getElementById('reverseChargeHint');
            isEuB2B = !!(hint && hint.style.display === 'block');
            var mwstSatz = isEuB2B ? 0 : 19;
            pos = { beschreibung: beschreibung, menge: 1, einheit: 'Stück', einzelpreis: 0, mwstSatz: mwstSatz, lagerArtikelId: art.id };
        }

        var container = document.getElementById('positionenContainer');
        var div = document.createElement('div');
        div.innerHTML = renderPositionRow(positionCount, pos);
        var newRow = div.firstChild;
        container.appendChild(newRow);
        positionCount++;
        var igArtWrap = newRow.querySelector('.pos-igart-wrap');
        if (igArtWrap) igArtWrap.style.display = isEuB2B ? '' : 'none';
        bindPositionEvents(newRow);
        markLagerVerkauft(art.id);
        updateSummen();
    }

    function collectPositionen() {
        var rows = document.querySelectorAll('.position-row');
        var positionen = [];
        var skipped = 0;
        rows.forEach(function(row) {
            var idx = row.getAttribute('data-idx');
            var beschreibung = row.querySelector('.pos-beschreibung').value.trim();
            var menge = parseFloat(row.querySelector('.pos-menge').value) || 0;
            var einheit = row.querySelector('.pos-einheit').value;
            var einzelpreis = parseFloat(row.querySelector('.pos-einzelpreis').value) || 0;
            var mwstSatz = parseFloat(row.querySelector('.pos-mwst').value) || 0;
            var lagerIdEl = row.querySelector('.pos-lager-id');
            var lagerArtikelId = lagerIdEl ? (lagerIdEl.value || null) : null;
            var igArtEl = row.querySelector('.pos-igart');
            var igArt = igArtEl ? igArtEl.value : '';
            var diff25aEl = row.querySelector('.pos-diff25a');
            var differenzbesteuert = !!(diff25aEl && diff25aEl.checked);
            var warenartEl = row.querySelector('.pos-warenart');
            var warenart = differenzbesteuert && warenartEl ? warenartEl.value : undefined;
            var diffEkEl = row.querySelector('.pos-diff-ek');
            var diffEinkaufspreis = differenzbesteuert
                ? (lagerArtikelId ? undefined : (parseFloat(diffEkEl && diffEkEl.value) || 0))
                : undefined;
            if (beschreibung || einzelpreis > 0) {
                positionen.push({
                    beschreibung: beschreibung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    mwstSatz: differenzbesteuert ? null : mwstSatz,
                    lagerArtikelId: lagerArtikelId,
                    igArt: igArt || undefined,
                    differenzbesteuert: differenzbesteuert || undefined,
                    warenart: warenart,
                    einkaufspreis: diffEinkaufspreis
                });
            } else if (menge !== 1 || lagerArtikelId) {
                // Zeile wurde erkennbar bearbeitet (Menge geändert / Lagerartikel verknüpft),
                // aber ohne Beschreibung+Preis beim Speichern still verworfen — Nutzer warnen
                // statt kommentarlos zu löschen (Fund 19, Vollaudit 2026-07-23).
                skipped++;
            }
        });
        if (skipped > 0) {
            Utils.showToast(skipped === 1
                ? 'Eine leere Position (ohne Beschreibung/Preis) wurde nicht übernommen.'
                : skipped + ' leere Positionen (ohne Beschreibung/Preis) wurden nicht übernommen.', 'warning');
        }
        return positionen;
    }

    function updateSummen() {
        var positionen = collectPositionen();
        var settings = Store.getSettings();
        var isKlein = editingInvoice && editingInvoice.isKlein !== undefined ? editingInvoice.isKlein : (settings.ustMode === 'klein');

        var netto = 0;
        var mwstMap = {};
        positionen.forEach(function(pos) {
            // Auf Cent gerundet akkumulieren, nicht mit voller Gleitkomma-Präzision — sonst
            // kann die Gesamtsumme um 1 Cent von der Summe der einzeln angezeigten (gerundeten)
            // Positionsbeträge abweichen (Fund 18, Vollaudit 2026-07-23).
            var lineNetto = Math.round(pos.menge * pos.einzelpreis * 100) / 100;
            netto += lineNetto;
            if (!isKlein && !pos.differenzbesteuert && pos.mwstSatz > 0) {
                if (!mwstMap[pos.mwstSatz]) mwstMap[pos.mwstSatz] = 0;
                mwstMap[pos.mwstSatz] += lineNetto * pos.mwstSatz / 100;
            }
        });

        var totalMwst = 0;
        var mwstHtml = '';
        Object.keys(mwstMap).sort(function(a, b) { return a - b; }).forEach(function(satz) {
            totalMwst += mwstMap[satz];
            mwstHtml += '<div>' + satz + '% MwSt: ' + Utils.formatCurrency(mwstMap[satz]) + '</div>';
        });

        var brutto = netto + totalMwst;

        var html = '<div style="font-size: 0.95rem;">';
        html += '<div>Zwischensumme (netto): <strong>' + Utils.formatCurrency(netto) + '</strong></div>';
        if (isKlein) {
            html += '<div style="font-style: italic; opacity: 0.7;">Gem. \u00A719 UStG wird keine Umsatzsteuer berechnet.</div>';
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

    // Zeigt nur eine Vorschau der nächsten Nummer — verbraucht KEINEN Counter-Wert.
    // Fix: rief vorher nextRechInvoiceNumber() auf, bei JEDEM Öffnen/Typ-Wechsel des Formulars —
    // Abbrechen/Wegnavigieren ohne Speichern verbrannte die Nummer trotzdem dauerhaft (Lücke,
    // §14 Abs.4 Nr.4 UStG/GoBD). Die Nummer wird jetzt erst in buildInvoiceObject() beim
    // tatsächlichen Speichern fixiert (gleiches "Peek zuerst"-Muster wie bei Storno-Nummern).
    function autoGenerateNumber() {
        var typ = document.getElementById('invTyp').value;
        if (!editingInvoice) {
            var numField = document.getElementById('invNummer');
            if (numField && !numField.dataset.userEdited) {
                numField.value = Store.peekRechInvoiceNumber(typ);
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

        // §13b UStG – bei EU-B2B-Kunde (Ausland + USt-IdNr.) automatisch Reverse Charge: USt auf 0%
        // forceApply nur bei aktivem Kundenwechsel true — beim initialen Laden (auch beim Bearbeiten
        // einer bestehenden Rechnung) werden bereits gespeicherte MwSt-Sätze nicht überschrieben.
        function applyReverseChargeCheck(forceApply) {
            var hint = document.getElementById('reverseChargeHint');
            var kundeId = document.getElementById('invKunde').value;
            var customers = Store.getRechCustomers();
            var kunde = customers.find(function(c) { return c.id === kundeId; });
            var euLaender = rcEuLaender();
            var settings = mergeRechSettings();
            var isKlein = editingInvoice && editingInvoice.isKlein !== undefined ? editingInvoice.isKlein : (settings.ustMode === 'klein');
            var isEuB2B = !isKlein && kunde && kunde.ustIdNr && kunde.land && kunde.land !== 'DE' && euLaender.indexOf(kunde.land) !== -1;
            if (hint) hint.style.display = isEuB2B ? 'block' : 'none';
            document.querySelectorAll('.pos-igart-wrap').forEach(function(w) { w.style.display = isEuB2B ? '' : 'none'; });
            if (isEuB2B && forceApply) {
                document.querySelectorAll('.pos-mwst').forEach(function(sel) {
                    sel.value = '0';
                });
                updateSummen();
            }
        }

        // Kunden-Autocomplete: filtert die vorhandenen <option>-Elemente per Textsuche,
        // ohne das bestehende <select>-Verhalten (.value, change-Event, __new__-Sentinel) an
        // den übrigen Stellen anzufassen (Fund 22, Vollaudit 2026-07-23).
        var invKundeSearchEl = document.getElementById('invKundeSearch');
        if (invKundeSearchEl) {
            invKundeSearchEl.addEventListener('input', function() {
                var q = this.value.trim().toLowerCase();
                document.querySelectorAll('#invKunde option').forEach(function(opt) {
                    if (!opt.value || opt.value === '__new__') return;
                    opt.style.display = (!q || opt.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
                });
            });
        }

        document.getElementById('invKunde').addEventListener('change', function() {
            var ncf = document.getElementById('newCustomerFields');
            if (this.value === '__new__') {
                ncf.style.display = 'block';
            } else {
                ncf.style.display = 'none';
            }
            applyReverseChargeCheck(true);
        });
        applyReverseChargeCheck(false);

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
            // Bei aktivem Reverse Charge (§13b) darf die neue Position nicht mit 19% starten
            applyReverseChargeCheck(true);
        });

        var addFromLagerBtn = document.getElementById('addFromLager');
        if (addFromLagerBtn) {
            addFromLagerBtn.addEventListener('click', function() {
                showLagerPicker(null);
            });
        }

        document.querySelectorAll('.position-row').forEach(function(row) {
            bindPositionEvents(row);
        });

        document.getElementById('invSave').addEventListener('click', saveInvoice);
        document.getElementById('invPreview').addEventListener('click', async function() {
            var inv = await buildInvoiceObject();
            if (!inv) return;
            showInvoicePreview(inv);
        });
        document.getElementById('invCancel').addEventListener('click', function() {
            if (!confirm('Eingaben verwerfen und zurück zu den Dokumenten?')) return;
            reconcileLagerOnCancel();
            if (RechApp.markClean) RechApp.markClean();
            RechApp.navigate('dokumente');
        });
    }

    // Beim Abbrechen der Bearbeitung müssen Lager-Statusänderungen, die nur als
    // Nebeneffekt des Editierens (Verknüpfen/Entfernen) passiert sind, rückgängig
    // gemacht bzw. wiederhergestellt werden — die gespeicherte Rechnung bleibt unverändert.
    function reconcileLagerOnCancel() {
        var currentIds = Array.prototype.map.call(document.querySelectorAll('.pos-lager-id'), function(el) { return el.value; }).filter(Boolean);
        currentIds.forEach(function(id) {
            if (originalLinkedLagerIds.indexOf(id) === -1) markLagerVerfuegbar(id); // neu verlinkt, nie gespeichert
        });
        originalLinkedLagerIds.forEach(function(id) {
            if (currentIds.indexOf(id) === -1) markLagerVerkauft(id); // während der Bearbeitung entfernt, Rechnung aber unverändert
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

        // Differenzbesteuerung §25a: Haken blendet MwSt-Auswahl aus (kein offener USt-Ausweis),
        // zeigt stattdessen Warenart-Auswahl + ggf. EK-Preis-Feld (falls keine Lager-Verknüpfung).
        var diff25aCheckbox = row.querySelector('.pos-diff25a');
        if (diff25aCheckbox) {
            diff25aCheckbox.addEventListener('change', function() {
                var checked = this.checked;
                var mwstWrap = row.querySelector('.pos-mwst-wrap');
                var diffLabel = row.querySelector('.pos-diff25a-label');
                var warenartSel = row.querySelector('.pos-warenart');
                var ekInput = row.querySelector('.pos-diff-ek');
                var lagerIdEl = row.querySelector('.pos-lager-id');
                var hasLagerLink = !!(lagerIdEl && lagerIdEl.value);
                if (mwstWrap) mwstWrap.style.display = checked ? 'none' : '';
                if (diffLabel) diffLabel.style.display = checked ? '' : 'none';
                if (warenartSel) warenartSel.style.display = checked ? '' : 'none';
                if (ekInput) ekInput.style.display = (checked && !hasLagerLink) ? '' : 'none';
                updateSummen();
            });
        }

        var removeBtn = row.querySelector('.pos-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                var rows = document.querySelectorAll('.position-row');
                if (rows.length <= 1) {
                    Utils.showToast('Mindestens eine Position erforderlich', 'warning');
                    return;
                }
                var lagerIdEl = row.querySelector('.pos-lager-id');
                if (lagerIdEl && lagerIdEl.value) markLagerVerfuegbar(lagerIdEl.value);
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
                var modalBody = '<div class="form-group"><label class="form-label" for="npName">Name <span style="color:red;">*</span></label><input class="form-input" id="npName"></div>';
                modalBody += '<div class="form-group"><label class="form-label" for="npBeschreibung">Beschreibung</label><textarea class="form-textarea" id="npBeschreibung" rows="2"></textarea></div>';
                modalBody += '<div class="form-row">';
                modalBody += '<div class="form-group"><label class="form-label" for="npPreis">Preis</label><input class="form-input" id="npPreis" type="number" step="0.01" min="0" max="99999999" value="0"></div>';
                modalBody += '<div class="form-group"><label class="form-label" for="npEinheit">Einheit</label><select class="form-select" id="npEinheit"><option value="St\u00FCck">St\u00FCck</option><option value="Std.">Std.</option><option value="pauschal">pauschal</option></select></div>';
                modalBody += '<div class="form-group"><label class="form-label" for="npMwst">MwSt-Satz</label><select class="form-select" id="npMwst"><option value="19">19%</option><option value="7">7%</option><option value="0">0%</option></select></div>';
                modalBody += '</div>';

                var modalFooter = '<button class="btn btn-primary" id="npSave">Speichern</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';
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

    async function buildInvoiceObject() {
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
        var leitwegIdEl = document.getElementById('invLeitwegId');
        var leitwegId = leitwegIdEl ? leitwegIdEl.value.trim() : '';
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

        // \u00A714 UStG \u2014 Pflichtangaben, blockiert das Speichern statt nur zu warnen
        // (Fix: Toast allein verhinderte das Speichern nicht \u2014 eine Rechnung ohne
        // vollst\u00E4ndige Empf\u00E4ngeranschrift oder ohne Steuernummer/USt-IdNr. des Ausstellers
        // konnte bisher vollst\u00E4ndig erstellt, exportiert und versendet werden).
        if (typ === 'rechnung' || typ === 'gutschrift') {
            // \u00A714a UStG verlangt dieselben Pflichtangaben auch f\u00FCr Gutschriften (Kreditnoten) \u2014
            // der Gate lief vorher nur f\u00FCr typ==='rechnung', Gutschriften konnten ihn umgehen.
            var kd = Store.getRechCustomers().find(function(c) { return c.id === kundeId; });
            if (kd && (!kd.strasse || !kd.plz || !kd.ort)) {
                Utils.showToast('\u26A0\uFE0F Kundenadresse unvollst\u00E4ndig (Stra\u00DFe, PLZ, Ort) \u2014 \u00A714 UStG Pflichtangabe. Bitte in den Kundendaten erg\u00E4nzen.', 'error');
                return null;
            }
            var s14 = Store.getRechUnternehmen ? Store.getRechUnternehmen() : {};
            if (!s14.steuernummer && !s14.ustId) {
                Utils.showToast('\u26A0\uFE0F Keine Steuernummer / USt-IdNr. hinterlegt \u2014 \u00A714 UStG Pflichtangabe. Bitte in den Unternehmensdaten erg\u00E4nzen.', 'error');
                return null;
            }
        }

        // Wurde die Nummer nur automatisch vorgeschlagen (nicht vom Nutzer editiert)? Dann ist es bis
        // hierher nur eine unverbindliche Vorschau (s. autoGenerateNumber/peekRechInvoiceNumber) — der
        // tatsächliche Counter-Verbrauch passiert erst ganz am Ende, NACH allen Validierungen unten, die
        // das Speichern noch mit return null abbrechen können (sonst würde bei einem Validierungsfehler
        // trotzdem eine Nummer verbrannt — exakt der Lücken-Bug, den dieser Fix beheben soll).
        var numFieldEl = document.getElementById('invNummer');
        var wasAutoPreview = !editingInvoice && numFieldEl && !numFieldEl.dataset.userEdited;

        var positionen = collectPositionen();
        if (positionen.length === 0) {
            Utils.showToast('Mindestens eine Position erforderlich', 'warning');
            return null;
        }
        if (positionen.some(function(p) { return !Number.isFinite(p.menge) || !Number.isFinite(p.einzelpreis) || p.menge < 0 || p.einzelpreis < 0 || p.menge > 999999 || p.einzelpreis > 99999999; })) {
            Utils.showToast('Menge und Einzelpreis müssen gültige, nicht-negative Zahlen in einem plausiblen Bereich sein.', 'error');
            return null;
        }

        // §13b UStG EU-B2B: "Art des Umsatzes" muss pro 0%-Position explizit gewählt sein (Kz. 41 vs.
        // Kz. 21) — kein Silent-Default, da eine Rechnung Ware und Leistung an denselben Kunden mischen kann.
        var kd13b = Store.getRechCustomers().find(function(c) { return c.id === kundeId; });
        var settings13b = mergeRechSettings();
        var isKlein13b = editingInvoice && editingInvoice.isKlein !== undefined ? editingInvoice.isKlein : (settings13b.ustMode === 'klein');
        var isEuB2B13b = !isKlein13b && kd13b && kd13b.ustIdNr && kd13b.land && kd13b.land !== 'DE' && rcEuLaender().indexOf(kd13b.land) !== -1;
        if (isEuB2B13b && positionen.some(function(p) { return p.mwstSatz === 0 && !p.igArt; })) {
            Utils.showToast('Bitte bei jeder 0%-Position „Art des Umsatzes" (Ware/Leistung) wählen — entscheidet Kz. 41 vs. Kz. 21.', 'error');
            return null;
        }
        // §13b UStG — bei Reverse Charge darf KEINE deutsche USt ausgewiesen werden (sonst §14c Abs.1
        // UStG: unrichtiger Steuerausweis, Steuerschuld trotzdem). Guard deckte bisher nur die 0%-igArt-
        // Pflicht ab, nicht den Fall, dass eine Position noch einen Steuersatz &gt;0% trägt (z.B. nach
        // nachträglicher USt-IdNr. beim Kunden oder Produkt-Einfügen mit fixem 19%-Satz).
        if (isEuB2B13b && positionen.some(function(p) { return p.mwstSatz > 0; })) {
            Utils.showToast('Reverse-Charge-Kunde (EU-Ausland mit USt-IdNr.): Positionen dürfen keine deutsche USt tragen. Bitte MwSt-Satz auf 0% setzen.', 'error');
            return null;
        }

        // Duplikatsprüfung nur für vom Nutzer selbst eingetragene Nummern nötig — eine automatisch
        // vergebene Nummer (s.u.) ist durch Store.nextRechInvoiceNumber()'s eigene Prüfung immer eindeutig.
        if (!wasAutoPreview && nummer && Store.getRechInvoices(true).some(function(d) {
            return d.nummer === nummer && (!editingInvoice || d.id !== editingInvoice.id);
        })) {
            Utils.showToast('Rechnungsnummer "' + nummer + '" ist bereits vergeben.', 'error');
            return null;
        }

        // Jetzt, nach allen Validierungen, die Nummer final fixieren (Counter tatsächlich verbrauchen).
        if (!nummer || wasAutoPreview) {
            nummer = await Store.nextRechInvoiceNumber(typ);
        }

        var isKleinFinal = editingInvoice && editingInvoice.isKlein !== undefined ? editingInvoice.isKlein : (Store.getSettings().ustMode === 'klein');
        // §19 UStG: Kleinunternehmer-Rechnung darf NIE einen Steuerbetrag ausweisen (§14c Abs.1 UStG
        // Risiko sonst). mwstSatz hart auf 0 erzwingen statt darauf zu vertrauen, dass jeder Konsument
        // (PDF, xrechnung.js, Sale-Sync, ...) isKlein selbst vor mwstSatz prüft.
        if (isKleinFinal) {
            positionen = positionen.map(function(p) { return Object.assign({}, p, { mwstSatz: 0 }); });
        }

        var invoice = {
            id: editingInvoice ? editingInvoice.id : Store.generateId(),
            isKlein: isKleinFinal,
            typ: typ,
            nummer: nummer,
            datum: datum,
            // Fälligkeitsdatum nur speichern, wenn dieser Modus aktiv gewählt wurde — sonst
            // hält das Feld einen versteckten Default-Wert (+14 Tage), gegen den mahnungen.js
            // trotzdem prüft und Lieferdatum-Rechnungen fälschlich als überfällig markiert
            // (Fund 14, Vollaudit 2026-07-23).
            faelligkeit: datumsOption === 'faelligkeit' ? faelligkeit : '',
            datumsOption: datumsOption,
            lieferdatum: lieferdatum,
            lieferVon: lieferVon,
            lieferBis: lieferBis,
            kundeId: kundeId,
            positionen: positionen,
            zahlungsbedingungen: zahlungsbedingungen,
            notizen: notizen,
            leitwegId: leitwegId,
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
            var _ebCo = localStorage.getItem('oyi_active_company') || '';
            var _ebKey = (_ebCo?_ebCo+'__':'')+'eigenbelege_belege';
            // Eigenbelege liegen jetzt im IDB-Cache (Store), localStorage nur noch Fallback
            belege = ((typeof Store !== 'undefined' ? Store._syncReadRaw(_ebKey) : JSON.parse(localStorage.getItem(_ebKey) || '[]')) || []).filter(function(b){ return !b.storniert; });
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

    async function saveInvoice() {
        // Doppelklick-Schutz: buildInvoiceObject() awaited jetzt den Web-Locks-Nummernzug,
        // ohne Sperre koennte ein zweiter Klick waehrend des Awaits eine zweite Nummer ziehen.
        var btn = document.getElementById('invSave');
        if (btn) { if (btn.disabled) return; btn.disabled = true; }
        try {
            var invoice = await buildInvoiceObject();
            if (!invoice) return;
            var saved = Store.saveRechInvoice(invoice);
            if (RechApp.markClean) RechApp.markClean();
            if (!saved) {
                Utils.showToast('Nicht gespeichert — Dokument ist bereits gestellt/gesperrt (GoBD §14 UStG).', 'error');
                RechApp.navigate('dokumente');
                return;
            }
            Utils.showToast('Dokument gespeichert!', 'success');
            RechApp.navigate('dokumente');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function generatePreviewHtml(inv, watermarkText) {
        var settings = mergeRechSettings();
        var logoBase64 = settings.logoBase64 || '';
        var accentColor = settings.invoicePrimaryColor || '#4f46e5';
        var customers = Store.getRechCustomers();
        var kunde = customers.find(function(c) { return c.id === inv.kundeId; });
        var isKlein = inv.isKlein !== undefined ? inv.isKlein : (settings.ustMode === 'klein');
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
            // Fund 25 (Vollaudit 2026-07-23): Kopfzeile wiederholt sich auf Folgeseiten,
            // Zeilen/Summenblock werden nicht mitten durch einen Seitenumbruch zerschnitten.
            + '.inv-tbl thead{display:table-header-group;}'
            + '.inv-tbl tr{page-break-inside:avoid;break-inside:avoid;}'
            + '.inv-totals,.inv-bank,.inv-footer{page-break-inside:avoid;break-inside:avoid;}'
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
            } else {
                // \u00a714 Abs.4 Nr.6 UStG verlangt zwingend einen Leistungszeitpunkt \u2014 ohne F\u00e4llig-/Liefer-
                // angabe (dOpt 'nur_datum') fehlte dieser Pflichthinweis bisher komplett auf der Rechnung.
                html += '<div class="inv-meta-row"><span class="inv-meta-lbl">Leistungsdatum</span><span class="inv-meta-val">entspricht Rechnungsdatum</span></div>';
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
                html += '<br><strong>Grund:</strong> ' + Utils.escapeHtml(grundLabels[inv.stornierungsGrund] || inv.stornierungsGrund);
                if (inv.stornierungsGrundText) html += ': ' + Utils.escapeHtml(inv.stornierungsGrundText);
            }
            html += '</div>';
        }

        // Tax line
        if (settings.steuernummer || settings.ustId) {
            html += '<div class="inv-tax">';
            if (settings.steuernummer) html += 'Steuernr.: <strong>' + Utils.escapeHtml(settings.steuernummer) + '</strong>';
            if (settings.steuernummer && settings.ustId) html += '&nbsp;&nbsp;';
            if (settings.ustId) html += 'USt-IdNr.: <strong>' + Utils.escapeHtml(settings.ustId) + '</strong>';
            html += '</div>';
        }

        // Positions table
        html += '<table class="inv-tbl"><thead><tr>';
        html += '<th scope="col" class="pos r">Pos.</th>';
        html += '<th scope="col">Beschreibung</th>';
        html += '<th scope="col" class="r">Menge</th>';
        html += '<th scope="col">Einheit</th>';
        html += '<th scope="col" class="r">Einzelpreis</th>';
        if (!isKlein) html += '<th scope="col" class="r">MwSt</th>';
        html += '<th scope="col" class="r">Gesamt (netto)</th>';
        html += '</tr></thead><tbody>';

        var netto = 0;
        var mwstMap = {};
        (inv.positionen || []).forEach(function(pos, idx) {
            // Auf Cent gerundet akkumulieren, nicht mit voller Gleitkomma-Präzision — sonst
            // kann die Gesamtsumme um 1 Cent von der Summe der einzeln angezeigten (gerundeten)
            // Positionsbeträge abweichen (Fund 18, Vollaudit 2026-07-23).
            var lineNetto = Math.round(pos.menge * pos.einzelpreis * 100) / 100;
            netto += lineNetto;
            if (!isKlein && !pos.differenzbesteuert && pos.mwstSatz > 0) {
                if (!mwstMap[pos.mwstSatz]) mwstMap[pos.mwstSatz] = 0;
                mwstMap[pos.mwstSatz] += lineNetto * pos.mwstSatz / 100;
            }
            html += '<tr>';
            html += '<td class="pos r">' + (idx + 1) + '</td>';
            html += '<td>' + Utils.escapeHtml(pos.beschreibung || '') + '</td>';
            html += '<td class="r">' + Utils.formatNumber(pos.menge) + '</td>';
            html += '<td>' + Utils.escapeHtml(pos.einheit || '') + '</td>';
            html += '<td class="r">' + Utils.formatCurrency(pos.einzelpreis) + '</td>';
            if (!isKlein) html += '<td class="r">' + (pos.differenzbesteuert ? 'Diff. §25a' : (pos.mwstSatz + '%')) + '</td>';
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
            Object.keys(mwstMap).sort(function(a, b) { return a - b; }).forEach(function(satz) {
                totalMwst += mwstMap[satz];
                html += '<div class="inv-tr"><span>MwSt. ' + satz + '%</span><span>' + Utils.formatCurrency(mwstMap[satz]) + '</span></div>';
            });
            html += '<div class="inv-tr grand" style="color:' + accentColor + '"><span>GESAMTBETRAG</span><span>' + Utils.formatCurrency(netto + totalMwst) + '</span></div>';
        }
        html += '</div>';

        // Kleinunternehmer notice
        if (isKlein) {
            html += '<div class="inv-klein">Gem\u00E4\u00DF \u00A719 UStG wird keine Umsatzsteuer berechnet.</div>';
        }

        // ig. Lieferung (\u00A76a UStG, Ware) vs. \u00A713b UStG Reverse Charge (Leistung) \u2014 getrennte
        // Pflichttexte statt pauschal \u00A713b f\u00FCr alles: bei Warenlieferungen ins EU-Ausland gilt die
        // steuerfreie innergemeinschaftliche Lieferung, NICHT die Steuerschuldnerschaft des Empf\u00E4ngers.
        var _rcEuLaender = rcEuLaender();
        var _istIgKunde = !isKlein && kunde && kunde.ustIdNr && kunde.land && kunde.land !== 'DE' && _rcEuLaender.indexOf(kunde.land) !== -1;
        if (_istIgKunde) {
            var _igPositionen = (inv.positionen || []).filter(function (p) { return parseInt(p.mwstSatz) === 0; });
            var _hatWare     = _igPositionen.some(function (p) { return (p.igArt || inv.igArt || 'ware') === 'ware'; });
            var _hatLeistung = _igPositionen.some(function (p) { return (p.igArt || inv.igArt || 'ware') === 'leistung'; });
            if (_hatWare) {
                html += '<div class="inv-klein">Steuerfreie innergemeinschaftliche Lieferung gem\u00E4\u00DF \u00A74 Nr. 1b i.V.m. \u00A76a UStG. USt-IdNr. Empf\u00E4nger: ' + Utils.escapeHtml(kunde.ustIdNr) + '</div>';
            }
            if (_hatLeistung) {
                html += '<div class="inv-klein">Steuerschuldnerschaft des Leistungsempf\u00E4ngers gem\u00E4\u00DF \u00A713b UStG (Reverse Charge). USt-IdNr. Leistungsempf\u00E4nger: ' + Utils.escapeHtml(kunde.ustIdNr) + '</div>';
            }
        }

        // \u00A725a UStG Differenzbesteuerung \u2014 Pflichthinweis, sobald mind. eine Position betroffen ist.
        // Je Warenart eigener Pflichttext (\u00A725a Abs. 2/3 UStG); mehrere Warenarten auf einer
        // Rechnung \u2192 alle zutreffenden Texte anzeigen.
        var diff25aWarenarten = Array.from(new Set((inv.positionen || []).filter(function(p) { return p.differenzbesteuert; }).map(function(p) { return p.warenart || 'gebraucht'; })));
        if (diff25aWarenarten.length) {
            var diff25aLabels = {
                gebraucht: 'Gebrauchtgegenst\u00E4nde/Sonderregelung',
                kunst: 'Kunstgegenst\u00E4nde/Sonderregelung',
                sammlerstueck: 'Sammlungsst\u00FCcke und Antiquit\u00E4ten/Sonderregelung'
            };
            diff25aWarenarten.forEach(function(w) {
                html += '<div class="inv-klein">' + (diff25aLabels[w] || diff25aLabels.gebraucht) + '</div>';
            });
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

    function printInvoiceWindow(invoiceHtml, asPdf, watermarkText) {
        // watermarkText is embedded in invoiceHtml already via generatePreviewHtml
        var invoiceCss = `
            * { box-sizing: border-box; }
            body { background: white; margin: 0; padding: 0; }
            @page { size: A4; margin: 8mm; }
            @media print { .inv-wrap { max-width: 100% !important; } }
        `;
        var fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rechnung</title><style>' + invoiceCss + '</style></head><body>' + invoiceHtml + '</body></html>';

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
            datum: today.toLocaleDateString('sv-SE'),
            faelligkeit: faellig.toLocaleDateString('sv-SE'),
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
