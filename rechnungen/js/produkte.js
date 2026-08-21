var Produkte = (function() {

    function render() {
        var products = Store.getRechProducts();

        var html = '<div class="page-header"><h2>Produkte & Leistungen</h2><div class="page-header-actions">';
        html += '<button class="btn btn-primary" id="prodNew">+ Neues Produkt</button>';
        html += '</div></div>';

        if (products.length === 0) {
            // Fund U7: sagen, wofuer der Bestand gut ist, nicht nur dass er leer ist.
            html += '<div class="empty-state">Noch keine Produkte oder Leistungen angelegt.<br>'
                  + 'Hinterlege wiederkehrende Positionen einmal mit Preis, Einheit und '
                  + 'Steuersatz — danach genügt beim Schreiben einer Rechnung die Auswahl.<br>'
                  + '<button class="btn btn-primary btn-small" id="prodNewEmpty" style="margin-top:12px;">'
                  + '<i class="ti ti-plus"></i> Erstes Produkt anlegen</button></div>';
            return html;
        }

        html += '<div class="table-container"><table><thead><tr>';
        html += '<th scope="col">Name</th><th scope="col">Beschreibung</th><th scope="col">Preis</th><th scope="col">Einheit</th><th scope="col">MwSt</th><th scope="col">Aktionen</th>';
        html += '</tr></thead><tbody>';

        products.forEach(function(p) {
            html += '<tr' + (p.storniert ? ' class="row-storniert"' : '') + '>';
            html += '<td>' + Utils.escapeHtml(p.name || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(p.beschreibung || '') + '</td>';
            html += '<td>' + Utils.formatCurrency(p.preis || 0) + '</td>';
            html += '<td>' + Utils.escapeHtml(p.einheit || 'St\u00FCck') + '</td>';
            html += '<td>' + (p.mwstSatz !== undefined ? p.mwstSatz : 19) + '%</td>';
            html += '<td class="table-actions">';
            if (p.storniert) {
                html += '<span class="badge badge-neutral">Storniert</span>';
            } else {
                html += '<button class="btn btn-small btn-primary prod-edit" data-id="' + p.id + '">Bearbeiten</button> ';
                html += '<button class="btn btn-small btn-danger prod-delete" data-id="' + p.id + '">Stornieren</button>';
            }
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    function showProductForm(product) {
        var isEdit = !!product;
        var body = '<div class="form-group"><label class="form-label" for="pfName">Name *</label>';
        body += '<input class="form-input" id="pfName" maxlength="200" value="' + Utils.escapeHtml(product ? product.name || '' : '') + '"></div>';
        body += '<div class="form-group"><label class="form-label" for="pfBeschr">Beschreibung</label>';
        body += '<textarea class="form-textarea" id="pfBeschr" maxlength="1000" rows="2">' + Utils.escapeHtml(product ? product.beschreibung || '' : '') + '</textarea></div>';
        body += '<div class="form-row">';
        body += '<div class="form-group"><label class="form-label" for="pfPreis">Preis (netto)</label>';
        body += '<input class="form-input" type="number" step="0.01" min="0" max="99999999" id="pfPreis" value="' + (product ? product.preis || 0 : 0) + '"></div>';
        body += '<div class="form-group"><label class="form-label" for="pfEinheit">Einheit</label>';
        body += '<select class="form-select" id="pfEinheit">';
        var einheit = product ? product.einheit || 'St\u00FCck' : 'St\u00FCck';
        body += '<option value="St\u00FCck"' + (einheit === 'St\u00FCck' ? ' selected' : '') + '>St\u00FCck</option>';
        body += '<option value="Std."' + (einheit === 'Std.' ? ' selected' : '') + '>Std.</option>';
        body += '<option value="pauschal"' + (einheit === 'pauschal' ? ' selected' : '') + '>pauschal</option>';
        body += '</select></div>';
        body += '<div class="form-group"><label class="form-label" for="pfMwst">MwSt-Satz</label>';
        body += '<select class="form-select" id="pfMwst">';
        var mwst = product ? (product.mwstSatz !== undefined ? product.mwstSatz : 19) : 19;
        body += '<option value="19"' + (mwst === 19 ? ' selected' : '') + '>19%</option>';
        body += '<option value="7"' + (mwst === 7 ? ' selected' : '') + '>7%</option>';
        body += '<option value="0"' + (mwst === 0 ? ' selected' : '') + '>0%</option>';
        body += '</select></div>';
        body += '</div>';

        var footer = '<button class="btn btn-primary" id="pfSave">Speichern</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';
        RechApp.showModal(isEdit ? 'Produkt bearbeiten' : 'Neues Produkt', body, footer);

        document.getElementById('pfSave').addEventListener('click', function() {
            var name = document.getElementById('pfName').value.trim();
            if (!name) {
                Utils.showToast('Bitte einen Namen angeben', 'warning');
                return;
            }
            var obj = {
                id: product ? product.id : Store.generateId(),
                name: name,
                beschreibung: document.getElementById('pfBeschr').value.trim(),
                preis: parseFloat(document.getElementById('pfPreis').value) || 0,
                einheit: document.getElementById('pfEinheit').value,
                mwstSatz: parseInt(document.getElementById('pfMwst').value),
                createdAt: product ? product.createdAt : new Date().toISOString()
            };
            Store.saveRechProduct(obj);
            Utils.showToast('Produkt gespeichert!', 'success');
            RechApp.closeModal();
            RechApp.navigate('produkte');
        });
    }

    function init() {
        var newBtn = document.getElementById('prodNew');
        if (newBtn) newBtn.addEventListener('click', function() { showProductForm(null); });

        // CTA aus dem Leerzustand — s. rechnungen/js/kunden.js zur eigenen ID.
        var newBtnEmpty = document.getElementById('prodNewEmpty');
        if (newBtnEmpty) newBtnEmpty.addEventListener('click', function() { showProductForm(null); });

        document.querySelectorAll('.prod-edit').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var products = Store.getRechProducts();
                var p = products.find(function(pr) { return pr.id === id; });
                if (p) showProductForm(p);
            });
        });

        document.querySelectorAll('.prod-delete').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var grund = prompt('Stornogrund angeben (Pflicht fuer Revisionssicherheit):');
                if (!grund) return;
                Store.stornoRechProduct(this.getAttribute('data-id'), grund);
                Utils.showToast('Produkt storniert', 'success');
                RechApp.navigate('produkte');
            });
        });
    }

    return { render: render, init: init };
})();
