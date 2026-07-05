var Unternehmensdaten = (function() {

    // Mergt RechUnternehmen + Store.getSettings() als Fallback
    function _loadData() {
        var ud = Store.getRechUnternehmen();
        var s  = Store.getSettings();
        return {
            firmenname:           ud.firmenname           !== undefined ? ud.firmenname           : (s.firmenname   || ''),
            inhaber:              ud.inhaber               !== undefined ? ud.inhaber               : (s.name         || ''),
            adresse:              ud.adresse               !== undefined ? ud.adresse               : (s.adresse      || ''),
            plz:                  ud.plz                   !== undefined ? ud.plz                   : (s.plz          || ''),
            ort:                  ud.ort                   !== undefined ? ud.ort                   : (s.ort          || ''),
            land:                 ud.land                  !== undefined ? ud.land                  : 'Deutschland',
            steuernummer:         ud.steuernummer          !== undefined ? ud.steuernummer          : (s.steuernummer || ''),
            ustId:                ud.ustId                 !== undefined ? ud.ustId                 : (s.ustId        || ''),
            finanzamt:            ud.finanzamt             !== undefined ? ud.finanzamt             : '',
            hrNr:                 ud.hrNr                  !== undefined ? ud.hrNr                  : '',
            telefon:              ud.telefon               !== undefined ? ud.telefon               : (s.telefon      || ''),
            email:                ud.email                 !== undefined ? ud.email                 : (s.email        || ''),
            website:              ud.website               !== undefined ? ud.website               : '',
            bankname:             ud.bankname              !== undefined ? ud.bankname              : (s.bankname     || ''),
            iban:                 ud.iban                  !== undefined ? ud.iban                  : (s.iban         || ''),
            bic:                  ud.bic                   !== undefined ? ud.bic                   : (s.bic          || ''),
            logoBase64:           ud.logoBase64            !== undefined ? ud.logoBase64            : (s.logoBase64   || ''),
            invoiceHeaderColor:   ud.invoiceHeaderColor    !== undefined ? ud.invoiceHeaderColor    : (s.invoiceHeaderColor  || '#0e3b2e'),
            invoicePrimaryColor:  ud.invoicePrimaryColor   !== undefined ? ud.invoicePrimaryColor   : (s.invoicePrimaryColor || '#10b981'),
        };
    }

    function render() {
        var d = _loadData();

        // Vollständigkeits-Score (Pflichtfelder für eine rechtskonforme Rechnung)
        var pflicht = [d.firmenname, d.adresse, d.plz, d.ort, d.steuernummer || d.ustId, d.iban];
        var filled  = pflicht.filter(Boolean).length;
        var pct     = Math.round(filled / pflicht.length * 100);
        var barColor = pct === 100 ? 'var(--success)' : pct >= 67 ? '#f59e0b' : 'var(--danger)';

        var html = '';

        // ── Seitenheader ──────────────────────────────────────────────────
        html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">';
        html += '<div>';
        html += '<h2 style="margin:0;font-size:22px;font-weight:800;">&#9881; Unternehmensdaten</h2>';
        html += '<div style="font-size:13px;color:var(--text-secondary);margin-top:3px;">Absender-Informationen für deine Rechnungen & Angebote</div>';
        html += '</div>';
        html += '</div>';

        // ── Vollständigkeits-Balken ───────────────────────────────────────
        html += '<div class="card" style="margin-bottom:16px;padding:14px 20px;">';
        html += '<div style="display:flex;align-items:center;gap:16px;">';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px;">Vollständigkeit (Pflichtfelder)</div>';
        html += '<div style="height:7px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;">';
        html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width .4s;"></div>';
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:5px;">';
        html += filled + ' von ' + pflicht.length + ' Pflichtfeldern ausgefüllt';
        if (pct < 100) html += ' · Fehlt: ' + ['Firmenname','Adresse','PLZ','Ort','Steuernr. / USt-IdNr.','IBAN'].filter(function(_, i) { return !pflicht[i]; }).join(', ');
        html += '</div>';
        html += '</div>';
        html += '<div style="font-size:28px;font-weight:900;color:' + barColor + ';min-width:52px;text-align:right;">' + pct + '%</div>';
        html += '</div>';
        html += '</div>';

        // ── 1. Basis-Stammdaten ───────────────────────────────────────────
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-header"><div class="card-title">&#127970; Basis-Stammdaten</div></div>';
        html += '<div style="padding:1rem;">';

        html += '<div class="form-row">';
        html += '<div class="form-group" style="flex:2;">';
        html += '<label class="form-label">Firmenname <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_firmenname" value="' + Utils.escapeHtml(d.firmenname) + '" placeholder="z.B. Max Mustermann Einzelhandel">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">Inhaber / Geschäftsführer</label>';
        html += '<input class="form-input" id="ud_inhaber" value="' + Utils.escapeHtml(d.inhaber) + '" placeholder="Vor- und Nachname">';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group" style="flex:3;">';
        html += '<label class="form-label">Straße & Hausnummer <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_adresse" value="' + Utils.escapeHtml(d.adresse) + '" placeholder="Musterstraße 1">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">PLZ <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_plz" value="' + Utils.escapeHtml(d.plz) + '" placeholder="12345" style="width:90px;">';
        html += '</div>';
        html += '<div class="form-group" style="flex:2;">';
        html += '<label class="form-label">Ort <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_ort" value="' + Utils.escapeHtml(d.ort) + '" placeholder="Musterstadt">';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group" style="max-width:220px;">';
        html += '<label class="form-label">Land</label>';
        html += '<input class="form-input" id="ud_land" value="' + Utils.escapeHtml(d.land) + '" placeholder="Deutschland">';
        html += '</div>';
        html += '</div>';

        html += '</div></div>';

        // ── 2. Steuer & Rechtliches ───────────────────────────────────────
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-header"><div class="card-title">&#127962; Steuer &amp; Rechtliches</div></div>';
        html += '<div style="padding:1rem;">';

        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;padding:8px 12px;background:rgba(99,102,241,.06);border-radius:6px;border:1px solid rgba(99,102,241,.15);">';
        html += '&#128204; Steuernummer <em>oder</em> USt-IdNr. ist Pflichtangabe auf Rechnungen (§14 UStG).';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label class="form-label">Steuernummer <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_steuernummer" value="' + Utils.escapeHtml(d.steuernummer) + '" placeholder="z.B. 12/345/67890">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">USt-IdNr. <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_ustId" value="' + Utils.escapeHtml(d.ustId) + '" placeholder="z.B. DE123456789" data-uppercase>';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label class="form-label">Finanzamt</label>';
        html += '<input class="form-input" id="ud_finanzamt" value="' + Utils.escapeHtml(d.finanzamt) + '" placeholder="z.B. Finanzamt München">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">Handelsregisternummer (optional)</label>';
        html += '<input class="form-input" id="ud_hrNr" value="' + Utils.escapeHtml(d.hrNr) + '" placeholder="z.B. HRB 12345">';
        html += '</div>';
        html += '</div>';

        html += '</div></div>';

        // ── 3. Kontakt & Bankverbindung ───────────────────────────────────
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-header"><div class="card-title">&#128222; Kontakt &amp; Bankverbindung</div></div>';
        html += '<div style="padding:1rem;">';

        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label class="form-label">Telefon</label>';
        html += '<input class="form-input" id="ud_telefon" type="tel" value="' + Utils.escapeHtml(d.telefon) + '" placeholder="+49 xxx xxxxxxx">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">E-Mail</label>';
        html += '<input class="form-input" id="ud_email" type="email" value="' + Utils.escapeHtml(d.email) + '" placeholder="info@firma.de">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">Website</label>';
        html += '<input class="form-input" id="ud_website" value="' + Utils.escapeHtml(d.website) + '" placeholder="www.firma.de">';
        html += '</div>';
        html += '</div>';

        html += '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">';

        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label class="form-label">Bankname</label>';
        html += '<input class="form-input" id="ud_bankname" value="' + Utils.escapeHtml(d.bankname) + '" placeholder="z.B. Sparkasse München">';
        html += '</div>';
        html += '<div class="form-group" style="flex:2;">';
        html += '<label class="form-label">IBAN <span style="color:var(--danger);">*</span></label>';
        html += '<input class="form-input" id="ud_iban" value="' + Utils.escapeHtml(d.iban) + '" placeholder="DE00 0000 0000 0000 0000 00" data-uppercase>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">BIC</label>';
        html += '<input class="form-input" id="ud_bic" value="' + Utils.escapeHtml(d.bic) + '" placeholder="z.B. SSKMDEMMXXX" data-uppercase>';
        html += '</div>';
        html += '</div>';

        html += '</div></div>';

        // ── 4. Logo & Design ──────────────────────────────────────────────
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-header"><div class="card-title">&#127912; Logo &amp; Design</div></div>';
        html += '<div style="padding:1rem;">';

        // Logo upload area
        html += '<div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:18px;">';

        html += '<div id="ud_logoPreviewWrap" style="' + (d.logoBase64 ? '' : 'display:none;') + '">';
        html += '<div style="padding:10px;background:#fff;border-radius:8px;border:1px solid var(--border);display:inline-block;">';
        html += '<img id="ud_logoImg" src="' + (d.logoBase64 || '') + '" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain;">';
        html += '</div>';
        html += '</div>';

        html += '<div id="ud_logoPlaceholder" style="' + (d.logoBase64 ? 'display:none;' : '') + 'width:120px;height:80px;background:var(--bg-secondary);border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:30px;">&#128444;</div>';

        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
        html += '<div>';
        html += '<label class="form-label">Logo hochladen</label>';
        html += '<input type="file" class="form-input" id="ud_logo" accept="image/png,image/jpeg,image/gif,image/svg+xml" style="padding:6px;">';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">PNG, JPG, SVG · max. 2 MB · erscheint oben links auf Rechnungen</div>';
        html += '</div>';
        if (d.logoBase64) {
            html += '<button class="btn btn-small" id="ud_removeLogo" style="color:var(--danger);border-color:var(--danger);width:fit-content;">&#128465; Logo entfernen</button>';
        }
        html += '</div>';
        html += '</div>';

        // Colors
        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label class="form-label">Rechnungskopf-Farbe</label>';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<input type="color" id="ud_headerColor" value="' + d.invoiceHeaderColor + '" style="width:40px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px;">';
        html += '<div>';
        html += '<div style="font-size:13px;">Hintergrund-Balken</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);">Oben auf der Rechnung</div>';
        html += '</div>';
        html += '</div></div>';

        html += '<div class="form-group">';
        html += '<label class="form-label">Akzentfarbe</label>';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<input type="color" id="ud_primaryColor" value="' + d.invoicePrimaryColor + '" style="width:40px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px;">';
        html += '<div>';
        html += '<div style="font-size:13px;">Titel &amp; Akzente</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);">Rechnungstitel-Linie</div>';
        html += '</div>';
        html += '</div></div>';

        // Color preview
        html += '<div class="form-group">';
        html += '<label class="form-label">Vorschau</label>';
        html += '<div id="ud_colorPreview" style="border-radius:8px;overflow:hidden;border:1px solid var(--border);width:220px;">';
        html += '<div id="ud_previewBar" style="background:' + d.invoiceHeaderColor + ';padding:10px 14px;color:#fff;font-weight:700;font-size:13px;">' + Utils.escapeHtml(d.firmenname || 'Firmenname') + '</div>';
        html += '<div style="padding:8px 14px;font-size:12px;color:var(--text-primary);">';
        html += '<span id="ud_previewTitle" style="font-weight:700;color:' + d.invoicePrimaryColor + ';">RECHNUNG RE-2026-001</span>';
        html += '</div></div>';
        html += '</div>';

        html += '</div>'; // form-row

        html += '</div></div>';

        // ── Speichern ─────────────────────────────────────────────────────
        html += '<div class="form-actions" style="margin-top:8px;">';
        html += '<button class="btn btn-primary" id="udSave" style="border-radius:20px;padding:9px 24px;">&#128190; Speichern</button>';
        html += '<span id="udSaveHint" style="font-size:12px;color:var(--success);margin-left:14px;display:none;font-weight:600;">&#10003; Gespeichert!</span>';
        html += '</div>';

        return html;
    }

    function init() {
        // Speichern
        var saveBtn = document.getElementById('udSave');
        if (saveBtn) saveBtn.addEventListener('click', _save);

        // Logo entfernen
        var removeLogo = document.getElementById('ud_removeLogo');
        if (removeLogo) removeLogo.addEventListener('click', function() {
            var ud = Store.getRechUnternehmen();
            ud.logoBase64 = '';
            Store.saveRechUnternehmen(ud);
            RechApp.navigate('unternehmensdaten');
        });

        // Logo Upload → Vorschau
        var logoInput = document.getElementById('ud_logo');
        if (logoInput) logoInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                Utils.showToast('Logo zu groß — max. 2 MB', 'error');
                this.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function(ev) {
                var b64 = ev.target.result;
                // In field speichern
                logoInput._pendingBase64 = b64;
                // Vorschau zeigen
                var img = document.getElementById('ud_logoImg');
                var wrap = document.getElementById('ud_logoPreviewWrap');
                var placeholder = document.getElementById('ud_logoPlaceholder');
                if (!img) {
                    // Img noch nicht im DOM → Wrap anlegen
                    var previewWrap = document.getElementById('ud_logoPreviewWrap');
                    if (previewWrap) {
                        previewWrap.innerHTML = '<div style="padding:10px;background:#fff;border-radius:8px;border:1px solid var(--border);display:inline-block;"><img id="ud_logoImg" src="' + b64 + '" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain;"></div>';
                        previewWrap.style.display = '';
                    }
                } else {
                    img.src = b64;
                    if (wrap) wrap.style.display = '';
                }
                if (placeholder) placeholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });

        // Farb-Vorschau live aktualisieren
        var headerColorInput = document.getElementById('ud_headerColor');
        var primaryColorInput = document.getElementById('ud_primaryColor');
        var firmennameInput   = document.getElementById('ud_firmenname');

        function updatePreview() {
            var bar   = document.getElementById('ud_previewBar');
            var title = document.getElementById('ud_previewTitle');
            if (bar)   bar.style.background = (headerColorInput || {}).value || '#0e3b2e';
            if (bar && firmennameInput) bar.textContent = firmennameInput.value || 'Firmenname';
            if (title) title.style.color = (primaryColorInput || {}).value || '#10b981';
        }

        if (headerColorInput)  headerColorInput.addEventListener('input', updatePreview);
        if (primaryColorInput) primaryColorInput.addEventListener('input', updatePreview);
        if (firmennameInput)   firmennameInput.addEventListener('input', updatePreview);
    }

    function _save() {
        var logoInput = document.getElementById('ud_logo');
        var existingLogo = Store.getRechUnternehmen().logoBase64 || '';
        if (!existingLogo) existingLogo = Store.getSettings().logoBase64 || '';
        var logoBase64 = (logoInput && logoInput._pendingBase64) ? logoInput._pendingBase64 : existingLogo;

        function val(id) {
            var el = document.getElementById(id);
            return el ? el.value.trim() : '';
        }

        var firmenname = val('ud_firmenname');
        if (!firmenname) {
            Utils.showToast('Bitte Firmenname eingeben', 'warning');
            var el = document.getElementById('ud_firmenname');
            if (el) el.focus();
            return;
        }

        var ud = {
            firmenname:          firmenname,
            inhaber:             val('ud_inhaber'),
            adresse:             val('ud_adresse'),
            plz:                 val('ud_plz'),
            ort:                 val('ud_ort'),
            land:                val('ud_land') || 'Deutschland',
            steuernummer:        val('ud_steuernummer'),
            ustId:               val('ud_ustId'),
            finanzamt:           val('ud_finanzamt'),
            hrNr:                val('ud_hrNr'),
            telefon:             val('ud_telefon'),
            email:               val('ud_email'),
            website:             val('ud_website'),
            bankname:            val('ud_bankname'),
            iban:                val('ud_iban').replace(/\s/g, ''),
            bic:                 val('ud_bic'),
            logoBase64:          logoBase64,
            invoiceHeaderColor:  val('ud_headerColor') || '#0e3b2e',
            invoicePrimaryColor: val('ud_primaryColor') || '#10b981',
        };

        Store.saveRechUnternehmen(ud);
        Utils.showToast('&#10003; Unternehmensdaten gespeichert', 'success');

        var hint = document.getElementById('udSaveHint');
        if (hint) {
            hint.style.display = '';
            setTimeout(function() { hint.style.display = 'none'; }, 3000);
        }

        // Seite neu laden damit Vollständigkeits-Balken aktualisiert
        setTimeout(function() { RechApp.navigate('unternehmensdaten'); }, 400);
    }

    return { render: render, init: init };
})();
