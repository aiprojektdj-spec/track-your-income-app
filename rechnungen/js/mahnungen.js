var Mahnungen = (function() {

    var highlightInvoiceId = null;

    // Zahlungsfrist je Mahnstufe — echte Werte statt in Fließtext hartcodierter Zahlen
    // (Fund 20, Vollaudit 2026-07-23), damit Text und gespeicherte Frist nie auseinanderlaufen.
    var MAHNFRIST_TAGE = { 1: 14, 2: 10, 3: 7 };

    function addTage(isoDatum, tage) {
        var d = new Date(isoDatum);
        d.setDate(d.getDate() + tage);
        return d.toLocaleDateString('sv-SE');
    }

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

    // Teilzahlungen (Fund 9) mindern die Mahn-/Zinsgrundlage — sonst wird auf den vollen
    // Ursprungsbetrag gemahnt/verzinst, obwohl der Kunde schon teilweise gezahlt hat.
    function teilzahlungSumme(invoice) {
        var sum = 0;
        (invoice.teilzahlungen || []).forEach(function(t) { sum += t.betrag || 0; });
        return sum;
    }

    function restbetrag(invoice) {
        return Math.max(0, calcBrutto(invoice) - teilzahlungSumme(invoice));
    }

    function daysOverdue(faelligkeit) {
        var today = new Date(Utils.todayISO());
        var due = new Date(faelligkeit);
        var diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    }

    // ── Verzugszinsen §288 BGB ──────────────────────────────────────────
    // Basiszinssatz nach §247 BGB (Bundesbank, halbjährlich zum 1.1./1.7. neu festgesetzt).
    // Aktueller Stand: 1,52% zum 01.07.2026 — als Fallback hinterlegt, in den Rechnungsbuch-
    // Einstellungen überschreibbar, damit spätere Anpassungen keinen Code-Change brauchen.
    var BASISZINS_FALLBACK = 1.52;

    function getBasiszinssatz() {
        var s = Store.getRechSettings ? Store.getRechSettings() : {};
        var v = parseFloat(s.basiszinssatzPct);
        return isNaN(v) ? BASISZINS_FALLBACK : v;
    }

    // B2B (+9 Prozentpunkte) vs. B2C (+5 Prozentpunkte): kein eigenes Kundentyp-Feld
    // vorhanden, daher Heuristik über Firmenfeld (Firma ausgefüllt = Unternehmer).
    function isB2BKunde(kunde) {
        return !!(kunde && kunde.firma && kunde.firma.trim());
    }

    function calcVerzugszinsen(invoice, kunde) {
        var days = daysOverdue(invoice.faelligkeit);
        if (days <= 0) return 0;
        var zuschlag = isB2BKunde(kunde) ? 9 : 5;
        var satz = getBasiszinssatz() + zuschlag;
        return restbetrag(invoice) * (satz / 100) * (days / 365);
    }

    function currentMahnLevel(invoice) {
        var mahnungen = invoice.mahnungen || [];
        if (mahnungen.length === 0) return 0;
        var maxStufe = 0;
        mahnungen.forEach(function(m) {
            if (m.stufe > maxStufe) maxStufe = m.stufe;
        });
        return maxStufe;
    }

    function totalMahngebuehren(invoice) {
        var sum = 0;
        (invoice.mahnungen || []).forEach(function(m) { sum += m.gebuehr || 0; });
        return sum;
    }

    function render(params) {
        params = params || {};
        if (params.invoiceId) highlightInvoiceId = params.invoiceId;

        var invoices = Store.getRechInvoices();
        var customers = Store.getRechCustomers();
        var customerMap = {};
        customers.forEach(function(c) { customerMap[c.id] = c; });

        var overdue = invoices.filter(function(i) {
            return i.typ === 'rechnung' && (i.status === 'ueberfaellig' || (i.status === 'offen' && !!i.faelligkeit && i.faelligkeit < Utils.todayISO()));
        });

        overdue.sort(function(a, b) {
            return (a.faelligkeit || '').localeCompare(b.faelligkeit || '');
        });

        var html = '<div class="page-header"><h2>Mahnungen</h2></div>';

        html += '<div style="padding:8px 14px;margin-bottom:14px;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:8px;">';
        html += '<span>Basiszinssatz §247 BGB (halbjährlich von der Bundesbank festgesetzt, für Verzugszinsberechnung):</span>';
        html += '<input type="number" step="0.01" id="mahnBasiszins" value="' + getBasiszinssatz() + '" style="width:70px;padding:2px 6px;">%';
        html += '</div>';

        if (overdue.length === 0) {
            html += '<div class="empty-state">Keine \u00FCberf\u00E4lligen Rechnungen vorhanden.</div>';
            return html;
        }

        html += '<div class="table-container"><table><thead><tr>';
        html += '<th scope="col">Rechnungsnr.</th><th scope="col">Kunde</th><th scope="col">F\u00E4llig am</th><th scope="col">Betrag</th><th scope="col">Tage \u00FCberf\u00E4llig</th><th scope="col">Mahnstufe</th><th scope="col">Mahngeb\u00FChren</th><th scope="col">Aktionen</th>';
        html += '</tr></thead><tbody>';

        overdue.forEach(function(inv) {
            var kunde = customerMap[inv.kundeId];
            var kundeName = kunde ? Utils.escapeHtml(kunde.firma || kunde.ansprechpartner || '') : '-';
            var days = daysOverdue(inv.faelligkeit);
            var level = currentMahnLevel(inv);
            var gebuehren = totalMahngebuehren(inv);

            var levelBadge = '';
            if (level === 0) levelBadge = '<span class="badge badge-neutral">Keine</span>';
            else if (level === 1) levelBadge = '<span class="badge badge-warning mahnung-level mahnung-1">1. Mahnung</span>';
            else if (level === 2) levelBadge = '<span class="badge badge-warning mahnung-level mahnung-2">2. Mahnung</span>';
            else levelBadge = '<span class="badge badge-danger mahnung-level mahnung-3">3. Mahnung</span>';

            var highlight = (inv.id === highlightInvoiceId) ? ' style="background: rgba(255,193,7,0.1);"' : '';

            html += '<tr' + highlight + '>';
            html += '<td>' + Utils.escapeHtml(inv.nummer || '') + '</td>';
            html += '<td>' + kundeName + '</td>';
            html += '<td>' + Utils.formatDate(inv.faelligkeit) + '</td>';
            html += '<td>' + Utils.formatCurrency(restbetrag(inv)) + (teilzahlungSumme(inv) > 0 ? ' <span style="font-size:10px;color:var(--text-muted);">(Rest)</span>' : '') + '</td>';
            html += '<td>' + days + ' Tage</td>';
            html += '<td>' + levelBadge + '</td>';
            html += '<td>' + Utils.formatCurrency(gebuehren) + '</td>';
            html += '<td class="table-actions">';
            if (level < 3) {
                html += '<button class="btn btn-small btn-warning mahn-create" data-id="' + inv.id + '">Mahnung erstellen</button> ';
            }
            if (level > 0) {
                html += '<button class="btn btn-small mahn-view" data-id="' + inv.id + '">Mahnung anzeigen</button> ';
            }
            html += '<button class="btn btn-small btn-success mahn-paid" data-id="' + inv.id + '">Als bezahlt</button>';
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    function showCreateMahnungModal(invoiceId) {
        var invoices = Store.getRechInvoices();
        var inv = invoices.find(function(i) { return i.id === invoiceId; });
        if (!inv) return;

        var level = currentMahnLevel(inv);
        var nextLevel = Math.min(level + 1, 3);
        var levelLabel = nextLevel === 1 ? '1. Mahnung (Zahlungserinnerung)' : nextLevel === 2 ? '2. Mahnung' : '3. Mahnung (Letzte Mahnung)';

        var body = '<div class="form-group"><strong>Rechnung:</strong> ' + Utils.escapeHtml(inv.nummer || '') + '</div>';
        body += '<div class="form-group"><strong>Mahnstufe:</strong> ' + levelLabel + '</div>';
        body += '<div class="form-group"><label class="form-label" for="mahnGebuehr">Mahngeb\u00FChr (\u20AC)</label>';
        body += '<input class="form-input" type="number" step="0.01" min="0" max="99999999" id="mahnGebuehr" value="' + (nextLevel === 1 ? '0' : nextLevel === 2 ? '5' : '10') + '"></div>';

        var footer = '<button class="btn btn-warning" id="mahnSave">Mahnung erstellen</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';
        RechApp.showModal('Mahnung erstellen', body, footer);

        document.getElementById('mahnSave').addEventListener('click', function() {
            var gebuehr = parseFloat(document.getElementById('mahnGebuehr').value) || 0;
            if (!inv.mahnungen) inv.mahnungen = [];
            var heute = Utils.todayISO();
            var fristTage = MAHNFRIST_TAGE[nextLevel] || 14;
            inv.mahnungen.push({
                stufe: nextLevel,
                datum: heute,
                gebuehr: gebuehr,
                frist: fristTage,
                fristDatum: addTage(heute, fristTage)
            });
            inv.status = 'ueberfaellig';
            Store.saveRechInvoice(inv);
            Utils.showToast(levelLabel + ' erstellt', 'success');
            RechApp.closeModal();
            RechApp.navigate('mahnungen');
        });
    }

    function showMahnungPreview(invoiceId) {
        var invoices = Store.getRechInvoices();
        var inv = invoices.find(function(i) { return i.id === invoiceId; });
        if (!inv) return;

        var customers = Store.getRechCustomers();
        var kunde = customers.find(function(c) { return c.id === inv.kundeId; });
        var settings = Store.getSettings();
        var level = currentMahnLevel(inv);
        var lastMahnung = null;
        (inv.mahnungen || []).forEach(function(m) {
            if (m.stufe === level) lastMahnung = m;
        });

        // Restbetrag statt vollem Rechnungsbetrag — Teilzahlungen (Fund 9) mindern die
        // Mahngrundlage, sonst würde auf einen bereits teilweise beglichenen Betrag gemahnt.
        var brutto = restbetrag(inv);
        var gebuehren = totalMahngebuehren(inv);
        var zinsen = calcVerzugszinsen(inv, kunde);

        // Frist aus der gespeicherten Mahnung lesen (echte Berechnung statt hartcodierter
        // Textzahl, Fund 20) \u2014 Fallback f\u00FCr Altdaten ohne frist-Feld.
        var fristTage = (lastMahnung && lastMahnung.frist) || MAHNFRIST_TAGE[level] || 14;
        var fristDatum = (lastMahnung && lastMahnung.fristDatum) || addTage(Utils.todayISO(), fristTage);
        var fristDatumFmt = Utils.formatDate(fristDatum);

        var title, greeting, bodyText, closing;
        if (level === 1) {
            title = 'Zahlungserinnerung';
            greeting = 'Sehr geehrte Damen und Herren,';
            bodyText = 'bei der \u00DCberpr\u00FCfung unserer Buchhaltung ist uns aufgefallen, dass die nachstehend aufgef\u00FChrte Rechnung noch nicht beglichen wurde. Sicherlich handelt es sich nur um ein Versehen. Wir m\u00F6chten Sie daher freundlich bitten, den ausstehenden Betrag innerhalb der n\u00E4chsten ' + fristTage + ' Tage (bis zum ' + fristDatumFmt + ') zu \u00FCberweisen.';
            closing = 'Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.';
        } else if (level === 2) {
            title = '2. Mahnung';
            greeting = 'Sehr geehrte Damen und Herren,';
            bodyText = 'trotz unserer ersten Zahlungserinnerung konnten wir leider noch keinen Zahlungseingang f\u00FCr die nachstehend aufgef\u00FChrte Rechnung feststellen. Wir bitten Sie nachdr\u00FCcklich, den offenen Betrag zzgl. anfallender Mahngeb\u00FChren innerhalb von ' + fristTage + ' Tagen (bis zum ' + fristDatumFmt + ') zu begleichen.';
            closing = 'Bitte nehmen Sie diese Mahnung ernst und veranlassen Sie die Zahlung umgehend.';
        } else {
            title = 'Letzte Mahnung';
            greeting = 'Sehr geehrte Damen und Herren,';
            bodyText = 'wir haben Sie bereits zweimal erfolglos zur Zahlung der unten aufgef\u00FChrten Rechnung aufgefordert. Wir fordern Sie hiermit letztmalig auf, den Gesamtbetrag inklusive aller Mahngeb\u00FChren innerhalb von ' + fristTage + ' Tagen (bis zum ' + fristDatumFmt + ') zu \u00FCberweisen. Sollte die Zahlung nicht fristgerecht eingehen, sehen wir uns gezwungen, die Angelegenheit ohne weitere Ank\u00FCndigung an unseren Rechtsanwalt bzw. ein Inkassounternehmen zu \u00FCbergeben.';
            closing = 'Wir hoffen, dass Sie es nicht soweit kommen lassen und die Zahlung umgehend veranlassen.';
        }

        var html = '<div class="invoice-preview-new">';

        // Header bar
        html += '<div class="invoice-header-bar">';
        html += '<div>';
        html += '<div class="company-name">' + Utils.escapeHtml(settings.firmenname || '') + '</div>';
        html += '<div class="company-address">';
        if (settings.name) html += Utils.escapeHtml(settings.name) + '<br>';
        html += Utils.escapeHtml(settings.adresse || '') + '<br>';
        html += Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || '');
        html += '</div>';
        html += '</div>';
        html += '<div class="doc-info">';
        html += '<div class="doc-type">' + title.toUpperCase() + '</div>';
        html += '<div class="doc-meta">';
        html += 'Datum: ' + Utils.formatDate(lastMahnung ? lastMahnung.datum : Utils.todayISO()) + '<br>';
        html += 'Rechnungsnr.: ' + Utils.escapeHtml(inv.nummer || '');
        html += '</div>';
        html += '</div>';
        html += '</div>';

        // Body content
        html += '<div class="invoice-body-content">';

        // Sender line
        html += '<div class="invoice-sender-line">' + Utils.escapeHtml(settings.firmenname || '') + ' \u00B7 ' + Utils.escapeHtml(settings.adresse || '') + ' \u00B7 ' + Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || '') + '</div>';

        // Recipient
        html += '<div class="invoice-recipient">';
        if (kunde) {
            html += '<strong>' + Utils.escapeHtml(kunde.firma || '') + '</strong><br>';
            if (kunde.ansprechpartner) html += Utils.escapeHtml(kunde.ansprechpartner) + '<br>';
            html += Utils.escapeHtml(kunde.strasse || '') + '<br>';
            html += Utils.escapeHtml(kunde.plz || '') + ' ' + Utils.escapeHtml(kunde.ort || '');
        }
        html += '</div>';

        // Title line
        html += '<div class="invoice-title-line">' + title + '</div>';

        // Meta info
        html += '<div style="margin-bottom: 1rem; font-size: 0.9rem; color: #555;">';
        html += 'Rechnungsdatum: ' + Utils.formatDate(inv.datum) + ' | F\u00E4llig seit: ' + Utils.formatDate(inv.faelligkeit);
        html += '</div>';

        // Letter body
        html += '<div style="margin: 1.5rem 0; line-height: 1.7;">';
        html += '<p>' + greeting + '</p>';
        html += '<p>' + bodyText + '</p>';
        html += '</div>';

        // Amount box
        html += '<div style="margin: 1.5rem 0; border: 1px solid #ccc; border-radius: 4px; padding: 1rem; background: #f9f9f9;">';
        html += '<div><strong>Rechnungsbetrag:</strong> ' + Utils.formatCurrency(brutto) + '</div>';
        if (gebuehren > 0) {
            html += '<div><strong>Mahngeb\u00FChren:</strong> ' + Utils.formatCurrency(gebuehren) + '</div>';
        }
        if (zinsen > 0) {
            html += '<div><strong>Verzugszinsen</strong> (' + (getBasiszinssatz() + (isB2BKunde(kunde) ? 9 : 5)) + '% p.a. seit F\u00E4lligkeit): ' + Utils.formatCurrency(zinsen) + '</div>';
        }
        if (gebuehren > 0 || zinsen > 0) {
            html += '<div style="font-size: 1.1em; font-weight: bold; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #ccc;"><strong>Gesamtbetrag:</strong> ' + Utils.formatCurrency(brutto + gebuehren + zinsen) + '</div>';
        }
        html += '</div>';

        // Closing
        html += '<div style="margin: 1.5rem 0; line-height: 1.7;">';
        html += '<p>' + closing + '</p>';
        html += '<p>Mit freundlichen Gr\u00FC\u00DFen<br><br>' + Utils.escapeHtml(settings.firmenname || '') + '</p>';
        html += '</div>';

        // Bank info
        if (settings.bankname || settings.iban) {
            html += '<div class="invoice-bank-info">';
            html += '<strong>Bankverbindung</strong><br>';
            var bankParts = [];
            if (settings.bankname) bankParts.push('Bank: ' + Utils.escapeHtml(settings.bankname));
            if (settings.iban) bankParts.push('IBAN: ' + Utils.escapeHtml(settings.iban));
            if (settings.bic) bankParts.push('BIC: ' + Utils.escapeHtml(settings.bic));
            html += bankParts.join(' | ') + '<br>';
            html += 'Verwendungszweck: ' + Utils.escapeHtml(inv.nummer || '');
            html += '</div>';
        }

        // Footer bar
        html += '<div class="invoice-footer-bar">';
        var footerParts = [];
        footerParts.push(Utils.escapeHtml(settings.firmenname || ''));
        footerParts.push(Utils.escapeHtml(settings.adresse || '') + ', ' + Utils.escapeHtml(settings.plz || '') + ' ' + Utils.escapeHtml(settings.ort || ''));
        if (settings.telefon) footerParts.push('Tel: ' + Utils.escapeHtml(settings.telefon));
        if (settings.email) footerParts.push(Utils.escapeHtml(settings.email));
        html += footerParts.join(' | ');
        html += '</div>';

        html += '</div>'; // invoice-body-content
        html += '</div>'; // invoice-preview-new

        var overlay = document.getElementById('modalOverlay');
        var modal = document.getElementById('modal');

        modal.innerHTML = html;
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
        printBtn.addEventListener('click', function() { window.print(); });
        closeBtn.addEventListener('click', closePreview);
        overlay.addEventListener('click', overlayHandler);
    }

    function init(params) {
        params = params || {};
        if (params.invoiceId) highlightInvoiceId = params.invoiceId;

        var basiszinsInput = document.getElementById('mahnBasiszins');
        if (basiszinsInput) {
            basiszinsInput.addEventListener('change', function() {
                var v = parseFloat(this.value);
                if (isNaN(v)) return;
                var s = Store.getRechSettings ? Store.getRechSettings() : {};
                s.basiszinssatzPct = v;
                if (Store.saveRechSettings) Store.saveRechSettings(s);
                Utils.showToast('Basiszinssatz gespeichert', 'success');
                RechApp.navigate('mahnungen');
            });
        }

        document.querySelectorAll('.mahn-create').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showCreateMahnungModal(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.mahn-view').forEach(function(btn) {
            btn.addEventListener('click', function() {
                showMahnungPreview(this.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.mahn-paid').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var invoices = Store.getRechInvoices();
                var inv = invoices.find(function(i) { return i.id === id; });
                if (!inv) return;
                // Gleicher Pfad wie im Dokumente-Modul: Lager-/Verkaufs-Sync-Modal statt
                // Status direkt zu setzen — sonst synct ein aus Mahnungen bezahlter
                // Verkauf keine Lagerartikel (Fund 13, Vollaudit 2026-07-23).
                if (typeof Dokumente !== 'undefined' && Dokumente.showBezahltModal) {
                    Dokumente.showBezahltModal(inv);
                } else {
                    inv.status = 'bezahlt';
                    Store.saveRechInvoice(inv);
                    Utils.showToast('Als bezahlt markiert', 'success');
                    RechApp.navigate('mahnungen');
                }
            });
        });

        // Auto-open create modal if navigated with specific invoice
        if (params.invoiceId && highlightInvoiceId) {
            var invoices = Store.getRechInvoices();
            var inv = invoices.find(function(i) { return i.id === params.invoiceId; });
            if (inv && currentMahnLevel(inv) < 3) {
                setTimeout(function() { showCreateMahnungModal(params.invoiceId); }, 100);
            }
            highlightInvoiceId = null;
        }
    }

    return { render: render, init: init };
})();
