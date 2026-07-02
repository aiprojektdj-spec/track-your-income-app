var Kunden = (function() {

    var currentView = 'list'; // 'list' or 'detail'
    var detailCustomerId = null;
    var _showArchived = false;

    function calcCustomerUmsatz(customerId) {
        var invoices = Store.getRechInvoices();
        var settings = Store.getSettings();
        var isKlein = settings.ustMode === 'klein';
        var sum = 0;
        invoices.forEach(function(inv) {
            if (inv.kundeId === customerId && inv.typ === 'rechnung' && inv.status === 'bezahlt') {
                (inv.positionen || []).forEach(function(pos) {
                    var netto = pos.menge * pos.einzelpreis;
                    var mwst = isKlein ? 0 : (netto * pos.mwstSatz / 100);
                    sum += netto + mwst;
                });
            }
        });
        return sum;
    }

    function getCustomerInvoiceCount(customerId) {
        var invoices = Store.getRechInvoices();
        return invoices.filter(function(inv) { return inv.kundeId === customerId; }).length;
    }

    function nextKundennummer() {
        var customers = Store.getRechCustomers();
        var max = 0;
        customers.forEach(function(c) {
            var match = (c.kundennummer || '').match(/K-(\d+)/);
            if (match) {
                var num = parseInt(match[1]);
                if (num > max) max = num;
            }
        });
        return 'K-' + String(max + 1).padStart(3, '0');
    }

    function render() {
        if (currentView === 'detail' && detailCustomerId) {
            return renderDetail();
        }
        return renderList();
    }

    function renderList() {
        // includeStorniert=true so archived+storniert records are visible when _showArchived is on
        var customers = Store.getRechCustomers(true);

        var html = '<div class="page-header"><h2>Kunden</h2><div class="page-header-actions">';
        html += '<button class="btn' + (_showArchived ? ' btn-warning' : '') + '" id="toggleArchived">' + (_showArchived ? 'Archivierte verbergen' : 'Archivierte anzeigen') + '</button> ';
        html += '<button class="btn btn-primary" id="kundeNew">+ Neuer Kunde</button>';
        html += '</div></div>';

        if (!_showArchived) {
            customers = customers.filter(function(c) { return !c.archiviert && !c.storniert; });
        }

        if (customers.length === 0) {
            html += '<div class="empty-state">Noch keine Kunden angelegt.</div>';
            return html;
        }

        html += '<div class="table-container"><table><thead><tr>';
        html += '<th>Kundennr.</th><th>Firma</th><th>Ansprechpartner</th><th>Ort</th><th>E-Mail</th><th>Telefon</th><th>Umsatz</th><th>Aktionen</th>';
        html += '</tr></thead><tbody>';

        customers.forEach(function(c) {
            var umsatz = calcCustomerUmsatz(c.id);
            var rowStyle = 'cursor: pointer;' + (c.archiviert ? ' opacity:0.6;' : '');
            html += '<tr class="kunde-row" data-id="' + c.id + '" style="' + rowStyle + '">';
            html += '<td>' + Utils.escapeHtml(c.kundennummer || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(c.firma || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(c.ansprechpartner || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(c.ort || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(c.email || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(c.telefon || '') + '</td>';
            html += '<td>' + Utils.formatCurrency(umsatz) + '</td>';
            html += '<td class="table-actions">';
            if (c.storniert) {
                html += '<span class="badge badge-neutral">Storniert</span>';
            } else if (c.archiviert) {
                html += '<span class="badge badge-warning">Archiviert</span> ';
                html += '<button class="btn btn-small btn-success kunde-reaktivieren" data-id="' + c.id + '">Reaktivieren</button>';
            } else {
                var invoiceCount = getCustomerInvoiceCount(c.id);
                html += '<button class="btn btn-small btn-primary kunde-edit" data-id="' + c.id + '">Bearbeiten</button> ';
                html += '<button class="btn btn-small btn-warning kunde-archivieren" data-id="' + c.id + '">Archivieren</button>';
                if (invoiceCount === 0) {
                    html += ' <button class="btn btn-small btn-danger kunde-loeschen" data-id="' + c.id + '">L\u00F6schen</button>';
                }
            }
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    function renderDetail() {
        var customers = Store.getRechCustomers();
        var customer = customers.find(function(c) { return c.id === detailCustomerId; });
        if (!customer) {
            currentView = 'list';
            return renderList();
        }

        var invoices = Store.getRechInvoices().filter(function(i) { return i.kundeId === customer.id; });
        var settings = Store.getSettings();
        var isKlein = settings.ustMode === 'klein';

        var html = '<div class="page-header"><h2>Kunde: ' + Utils.escapeHtml(customer.firma || customer.ansprechpartner) + '</h2>';
        html += '<div class="page-header-actions"><button class="btn" id="kundeBack">Zur\u00FCck zur Liste</button></div></div>';

        html += '<div class="card"><div class="card-header"><div class="card-title">Kundendaten</div></div>';
        html += '<div style="padding: 1rem;">';
        html += '<div class="form-row">';
        html += '<div class="form-group"><strong>Kundennummer:</strong><br>' + Utils.escapeHtml(customer.kundennummer || '') + '</div>';
        html += '<div class="form-group"><strong>Firma:</strong><br>' + Utils.escapeHtml(customer.firma || '') + '</div>';
        html += '<div class="form-group"><strong>Ansprechpartner:</strong><br>' + Utils.escapeHtml(customer.ansprechpartner || '') + '</div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><strong>Adresse:</strong><br>' + Utils.escapeHtml(customer.strasse || '') + ', ' + Utils.escapeHtml(customer.plz || '') + ' ' + Utils.escapeHtml(customer.ort || '') + '</div>';
        html += '<div class="form-group"><strong>E-Mail:</strong><br>' + Utils.escapeHtml(customer.email || '') + '</div>';
        html += '<div class="form-group"><strong>Telefon:</strong><br>' + Utils.escapeHtml(customer.telefon || '') + '</div>';
        html += '</div>';
        html += '<div class="form-group"><strong>Gesamtumsatz:</strong> ' + Utils.formatCurrency(calcCustomerUmsatz(customer.id)) + '</div>';
        html += '</div></div>';

        html += '<div class="section"><div class="section-title">Dokumente dieses Kunden</div>';
        if (invoices.length === 0) {
            html += '<div class="empty-state">Keine Dokumente vorhanden.</div>';
        } else {
            html += '<div class="table-container"><table><thead><tr>';
            html += '<th>Nr.</th><th>Typ</th><th>Datum</th><th>Betrag</th><th>Status</th>';
            html += '</tr></thead><tbody>';
            invoices.forEach(function(inv) {
                var typLabel = inv.typ === 'rechnung' ? 'Rechnung' : inv.typ === 'angebot' ? 'Angebot' : 'Gutschrift';
                var statusClass = inv.status === 'bezahlt' ? 'badge-success' : inv.status === 'ueberfaellig' ? 'badge-danger' : inv.status === 'storniert' ? 'badge-neutral' : 'badge-info';
                var statusLabel = inv.status === 'bezahlt' ? 'Bezahlt' : inv.status === 'ueberfaellig' ? '\u00DCberf\u00E4llig' : inv.status === 'storniert' ? 'Storniert' : 'Offen';
                var brutto = 0;
                (inv.positionen || []).forEach(function(pos) {
                    var n = pos.menge * pos.einzelpreis;
                    brutto += n + (isKlein ? 0 : n * pos.mwstSatz / 100);
                });
                html += '<tr>';
                html += '<td>' + Utils.escapeHtml(inv.nummer || '') + '</td>';
                html += '<td>' + typLabel + '</td>';
                html += '<td>' + Utils.formatDate(inv.datum) + '</td>';
                html += '<td>' + Utils.formatCurrency(brutto) + '</td>';
                html += '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }
        html += '</div>';

        return html;
    }

    function showCustomerForm(customer) {
        var isEdit = !!customer;
        var body = '<div class="form-group"><label class="form-label">Kundennummer</label>';
        body += '<input class="form-input" id="cfKnr" value="' + Utils.escapeHtml(customer ? customer.kundennummer : nextKundennummer()) + '" readonly style="opacity: 0.7;"></div>';
        body += '<div class="form-row">';
        body += '<div class="form-group"><label class="form-label">Firma</label><input class="form-input" id="cfFirma" value="' + Utils.escapeHtml(customer ? customer.firma || '' : '') + '"></div>';
        body += '<div class="form-group"><label class="form-label">Ansprechpartner</label><input class="form-input" id="cfAnsprech" value="' + Utils.escapeHtml(customer ? customer.ansprechpartner || '' : '') + '"></div>';
        body += '</div>';
        body += '<div class="form-group"><label class="form-label">Stra\u00DFe</label><input class="form-input" id="cfStrasse" value="' + Utils.escapeHtml(customer ? customer.strasse || '' : '') + '"></div>';
        body += '<div class="form-row">';
        body += '<div class="form-group"><label class="form-label">PLZ</label><input class="form-input" id="cfPlz" value="' + Utils.escapeHtml(customer ? customer.plz || '' : '') + '"></div>';
        body += '<div class="form-group"><label class="form-label">Ort</label><input class="form-input" id="cfOrt" value="' + Utils.escapeHtml(customer ? customer.ort || '' : '') + '"></div>';
        body += '</div>';
        body += '<div class="form-row">';
        body += '<div class="form-group"><label class="form-label">E-Mail</label><input class="form-input" id="cfEmail" type="email" value="' + Utils.escapeHtml(customer ? customer.email || '' : '') + '"></div>';
        body += '<div class="form-group"><label class="form-label">Telefon</label><input class="form-input" id="cfTelefon" value="' + Utils.escapeHtml(customer ? customer.telefon || '' : '') + '"></div>';
        body += '</div>';
        body += '<div class="form-row">';
        body += '<div class="form-group"><label class="form-label">Land</label><input class="form-input" id="cfLand" maxlength="2" placeholder="DE" style="text-transform:uppercase;" value="' + Utils.escapeHtml(customer ? customer.land || 'DE' : 'DE') + '"></div>';
        body += '<div class="form-group"><label class="form-label">USt-IdNr. (B2B Ausland)</label><input class="form-input" id="cfUstIdNr" placeholder="z.B. FR12345678901" value="' + Utils.escapeHtml(customer ? customer.ustIdNr || '' : '') + '"></div>';
        body += '</div>';

        var footer = '<button class="btn btn-primary" id="cfSave">Speichern</button> <button class="btn" onclick="RechApp.closeModal()">Abbrechen</button>';
        RechApp.showModal(isEdit ? 'Kunde bearbeiten' : 'Neuer Kunde', body, footer);

        document.getElementById('cfSave').addEventListener('click', function() {
            var firma = document.getElementById('cfFirma').value.trim();
            var ansprech = document.getElementById('cfAnsprech').value.trim();
            if (!firma && !ansprech) {
                Utils.showToast('Bitte Firma oder Ansprechpartner angeben', 'warning');
                return;
            }
            var obj = {
                id: customer ? customer.id : Store.generateId(),
                firma: firma,
                ansprechpartner: ansprech,
                strasse: document.getElementById('cfStrasse').value.trim(),
                plz: document.getElementById('cfPlz').value.trim(),
                ort: document.getElementById('cfOrt').value.trim(),
                email: document.getElementById('cfEmail').value.trim(),
                telefon: document.getElementById('cfTelefon').value.trim(),
                land: (document.getElementById('cfLand').value.trim() || 'DE').toUpperCase(),
                ustIdNr: document.getElementById('cfUstIdNr').value.trim(),
                kundennummer: document.getElementById('cfKnr').value.trim(),
                createdAt: customer ? customer.createdAt : new Date().toISOString()
            };
            // Preserve archiviert flag if it exists on the original customer
            if (customer && customer.archiviert !== undefined) {
                obj.archiviert = customer.archiviert;
                obj.archiviertAm = customer.archiviertAm || null;
            }
            Store.saveRechCustomer(obj);
            Utils.showToast('Kunde gespeichert!', 'success');
            RechApp.closeModal();
            currentView = 'list';
            RechApp.navigate('kunden');
        });
    }

    function init() {
        if (currentView === 'detail') {
            var backBtn = document.getElementById('kundeBack');
            if (backBtn) backBtn.addEventListener('click', function() {
                currentView = 'list';
                detailCustomerId = null;
                RechApp.navigate('kunden');
            });
            return;
        }

        var toggleBtn = document.getElementById('toggleArchived');
        if (toggleBtn) toggleBtn.addEventListener('click', function() {
            _showArchived = !_showArchived;
            RechApp.navigate('kunden');
        });

        var newBtn = document.getElementById('kundeNew');
        if (newBtn) newBtn.addEventListener('click', function() { showCustomerForm(null); });

        document.querySelectorAll('.kunde-row').forEach(function(row) {
            row.addEventListener('click', function(e) {
                if (e.target.closest('.table-actions')) return;
                detailCustomerId = this.getAttribute('data-id');
                currentView = 'detail';
                RechApp.navigate('kunden');
            });
        });

        document.querySelectorAll('.kunde-edit').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-id');
                var customers = Store.getRechCustomers();
                var c = customers.find(function(cu) { return cu.id === id; });
                if (c) showCustomerForm(c);
            });
        });

        document.querySelectorAll('.kunde-archivieren').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-id');
                var customers = Store.getRechCustomers();
                var c = customers.find(function(cu) { return cu.id === id; });
                if (!c) return;
                c.archiviert = true;
                c.archiviertAm = new Date().toISOString();
                Store.saveRechCustomer(c);
                Utils.showToast('Kunde archiviert', 'success');
                RechApp.navigate('kunden');
            });
        });

        document.querySelectorAll('.kunde-loeschen').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-id');
                var invoiceCount = getCustomerInvoiceCount(id);
                if (invoiceCount > 0) {
                    Utils.showToast('Kunde hat Rechnungen und kann nicht gel\u00F6scht werden.', 'warning');
                    return;
                }
                var confirmed = confirm('Wirklich l\u00F6schen? Kunde hat keine Rechnungen.');
                if (!confirmed) return;
                Store.stornoRechCustomer(id, 'Physisch gel\u00F6scht - keine Rechnungen vorhanden');
                Utils.showToast('Kunde gel\u00F6scht', 'success');
                RechApp.navigate('kunden');
            });
        });

        document.querySelectorAll('.kunde-reaktivieren').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-id');
                var customers = Store.getRechCustomers();
                var c = customers.find(function(cu) { return cu.id === id; });
                if (!c) return;
                c.archiviert = false;
                c.archiviertAm = null;
                Store.saveRechCustomer(c);
                Utils.showToast('Kunde reaktiviert', 'success');
                RechApp.navigate('kunden');
            });
        });
    }

    return {
        render: render,
        init: init,
        resetView: function() { currentView = 'list'; detailCustomerId = null; }
    };
})();
