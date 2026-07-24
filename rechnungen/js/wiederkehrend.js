// ============================================================
// Wiederkehrende Rechnungen — Scheduler
// Verwaltet Intervall-Rechnungen (monatlich, quartalsweise, jährlich)
// ============================================================
var Wiederkehrend = (function () {

    // ── Helpers ─────────────────────────────────────────────────────────

    // Addiert Monate ohne Überlauf: Ziel-Tag wird auf den letzten Tag des Zielmonats
    // geclampt statt in den Folgemonat zu rutschen (z.B. 31. Jan monatlich -> 28./29. Feb,
    // nicht 3. März; 29. Feb jährlich -> 28. Feb in Nicht-Schaltjahren, nicht 1. März).
    function addMonthsClamped(d, n) {
        var day = d.getDate();
        var target = new Date(d.getFullYear(), d.getMonth() + n, 1);
        var daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        target.setDate(Math.min(day, daysInTarget));
        return target.toLocaleDateString('sv-SE');
    }

    function addInterval(dateStr, interval) {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        switch (interval) {
            case 'woechentlich': d.setDate(d.getDate() + 7); return d.toLocaleDateString('sv-SE');
            case 'monatlich':     return addMonthsClamped(d, 1);
            case 'quartal':       return addMonthsClamped(d, 3);
            case 'halbjaehrlich': return addMonthsClamped(d, 6);
            case 'jaehrlich':     return addMonthsClamped(d, 12);
            default:              return addMonthsClamped(d, 1);
        }
    }

    function addFaelligkeit(dateStr, interval) {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        d.setDate(d.getDate() + 14); // default 14 days
        return d.toLocaleDateString('sv-SE');
    }

    function intervalLabel(interval) {
        var map = {
            woechentlich: 'Wöchentlich',
            monatlich:    'Monatlich',
            quartal:      'Quartalsweise',
            halbjaehrlich:'Halbjährlich',
            jaehrlich:    'Jährlich'
        };
        return map[interval] || interval;
    }

    function isDue(rule) {
        if (!rule.enabled || !rule.nextDate) return false;
        var today = Utils.todayISO();
        return rule.nextDate <= today;
    }

    // ── Store helpers ───────────────────────────────────────────────────
    // Firmen-gescoped über Store._rechPrefix (wie alle anderen Rechnungsbuch-Daten),
    // nicht mehr im globalen (firmenübergreifenden) Key `rech_recurring_rules`.
    function getRules() {
        return Store.getRechRecurringRules ? Store.getRechRecurringRules() : [];
    }

    function saveRules(rules) {
        if (Store.saveRechRecurringRules) Store.saveRechRecurringRules(rules);
    }

    function saveRule(rule) {
        var rules = getRules();
        var idx = rules.findIndex(function (r) { return r.id === rule.id; });
        if (idx >= 0) rules[idx] = rule;
        else rules.push(rule);
        saveRules(rules);
    }

    function deleteRule(id) {
        var rules = getRules().filter(function (r) { return r.id !== id; });
        saveRules(rules);
    }

    // ── Create rule from invoice ────────────────────────────────────────
    function createRuleFromInvoice(inv, interval, startDate, endDate) {
        return {
            id:          Store.generateId(),
            invoiceTemplateId: inv.id,  // base invoice to copy from
            enabled:     true,
            interval:    interval,
            nextDate:    startDate || Utils.todayISO(),
            endDate:     endDate || null,
            kundeId:     inv.kundeId,
            positionen:  inv.positionen,
            zahlungsbedingungen: inv.zahlungsbedingungen,
            notizen:     inv.notizen,
            verkaufsplattform: inv.verkaufsplattform,
            datumsOption: inv.datumsOption,
            lastRunDate: null,
            lastInvoiceId: null,
            createdAt:   new Date().toISOString()
        };
    }

    // ── Lager-Verknüpfung beim Generieren auflösen ───────────────────────
    // rule.positionen ist die feste Vorlage der Regel und wird bei jeder Wiederholung
    // 1:1 kopiert. Ein verlinkter Lagerartikel ist aber ein physisches Einzelstück und darf
    // nur bei der ERSTEN Generierung tatsächlich "verkauft" werden — bei jeder weiteren
    // Wiederholung (Artikel dann schon verkauft/storniert) wird die Verknüpfung gekappt,
    // damit nicht derselbe Artikel wiederholt als verkauft gemeldet wird.
    function resolvePositionenFuerNeueRechnung(positionen) {
        var purchases = Store.getPurchases(true);
        return (positionen || []).map(function (pos) {
            var copy = Object.assign({}, pos);
            if (copy.lagerArtikelId) {
                var art = purchases.find(function (a) { return a.id === copy.lagerArtikelId; });
                if (art && !art.storniert && art.status === 'verfuegbar') {
                    Store.savePurchase(Object.assign({}, art, { status: 'verkauft', verkaufsdatum: Utils.todayISO() }));
                } else {
                    copy.lagerArtikelId = null;
                }
            }
            return copy;
        });
    }

    // ── Create invoice from rule ────────────────────────────────────────
    async function createInvoiceFromRule(rule) {
        var nummer = await Store.nextRechInvoiceNumber('rechnung');
        var invoice = {
            id:              Store.generateId(),
            typ:             'rechnung',
            isKlein:         Store.getSettings().ustMode === 'klein',
            nummer:          nummer,
            datum:           rule.nextDate,
            faelligkeit:     addFaelligkeit(rule.nextDate, rule.interval),
            datumsOption:    rule.datumsOption || 'faelligkeit',
            kundeId:         rule.kundeId,
            positionen:      resolvePositionenFuerNeueRechnung(rule.positionen),
            zahlungsbedingungen: rule.zahlungsbedingungen || 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.',
            notizen:         rule.notizen || '',
            verkaufsplattform: rule.verkaufsplattform || '',
            status:          'offen',
            mahnungen:       [],
            verknuepfteEigenbelege: [],
            createdAt:       new Date().toISOString(),
            _fromRecurringRule: rule.id
        };
        Store.saveRechInvoice(invoice);

        // Update rule
        rule.lastRunDate  = rule.nextDate;
        rule.lastInvoiceId = invoice.id;
        rule.nextDate     = addInterval(rule.nextDate, rule.interval);

        // Check if end date passed
        if (rule.endDate && rule.nextDate > rule.endDate) {
            rule.enabled = false;
        }

        saveRule(rule);
        return invoice;
    }

    // ── Auto-process all due rules (call on app start) ──────────────────
    async function processDueRules() {
        var rules = getRules();
        var created = [];
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (isDue(rule)) {
                var inv = await createInvoiceFromRule(rule);
                created.push({ invoice: inv, rule: rule });
            }
        }
        if (created.length > 0 && typeof Utils !== 'undefined') {
            Utils.showToast(created.length + ' wiederkehrende Rechnung(en) automatisch erstellt.', 'success');
        }
        return created;
    }

    // ── Render ──────────────────────────────────────────────────────────
    function render() {
        var rules    = getRules();
        var invoices = Store.getRechInvoices ? Store.getRechInvoices() : [];
        var customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        var customerMap = {};
        customers.forEach(function (c) { customerMap[c.id] = c; });

        var html = '<div class="page-header">';
        html += '<h2><i class="ti ti-repeat"></i> Wiederkehrende Rechnungen</h2>';
        html += '<div class="page-header-actions">';
        html += '<button class="btn btn-primary" id="wkNewRule"><i class="ti ti-plus"></i> Neue Regel</button>';
        html += '</div></div>';

        // Due rules notification
        var dueRules = rules.filter(isDue);
        if (dueRules.length > 0) {
            html += '<div style="padding:12px 16px;margin-bottom:16px;background:rgba(234,179,8,.08);border:1px solid rgba(234,179,8,.3);border-radius:var(--radius);display:flex;align-items:center;gap:12px;">';
            html += '<i class="ti ti-alarm" style="font-size:20px;color:var(--warning,#f59e0b);flex-shrink:0;"></i>';
            html += '<div style="flex:1;"><div style="font-weight:700;font-size:13px;">' + dueRules.length + ' Rechnung(en) fällig</div>';
            html += '<div style="font-size:12px;color:var(--text-muted);">Klicke auf "Jetzt erstellen" um die Rechnungen zu generieren.</div></div>';
            html += '<button class="btn btn-small btn-primary" id="wkProcessDue">Alle jetzt erstellen</button>';
            html += '</div>';
        }

        if (rules.length === 0) {
            html += '<div style="text-align:center;padding:52px 20px;">';
            html += '<i class="ti ti-repeat" style="font-size:48px;color:var(--text-muted);opacity:.3;"></i>';
            html += '<div style="font-size:16px;font-weight:700;margin:14px 0 6px;">Keine Regeln</div>';
            html += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">Erstelle eine Vorlage für Rechnungen die sich regelmäßig wiederholen (Miete, Abos, Wartungsverträge).</div>';
            html += '<button class="btn btn-primary" id="wkNewRuleEmpty"><i class="ti ti-plus"></i> Erste Regel erstellen</button>';
            html += '</div>';
            return html;
        }

        html += '<div class="table-container"><table><thead><tr>';
        html += '<th scope="col">Kunde</th><th scope="col">Intervall</th><th scope="col">Nächste Rechnung</th><th scope="col">Letzter Lauf</th><th scope="col">Status</th><th scope="col">Aktionen</th>';
        html += '</tr></thead><tbody>';

        rules.forEach(function (rule) {
            var kunde    = customerMap[rule.kundeId];
            var kundeName = kunde ? Utils.escapeHtml(kunde.firma || kunde.ansprechpartner || '') : '—';
            var isActive  = rule.enabled;
            var isDueNow  = isDue(rule);
            var nettoSum  = (rule.positionen || []).reduce(function (s, p) { return s + (p.menge || 1) * (p.einzelpreis || 0); }, 0);

            html += '<tr>';
            html += '<td><strong>' + kundeName + '</strong><br><span style="font-size:11px;color:var(--text-muted);">' + Utils.formatCurrency(nettoSum) + ' netto</span></td>';
            html += '<td><span style="padding:2px 8px;border-radius:10px;background:rgba(99,102,241,.12);color:var(--accent);font-size:12px;">' + intervalLabel(rule.interval) + '</span></td>';
            html += '<td style="font-weight:' + (isDueNow ? '700' : '400') + ';color:' + (isDueNow ? 'var(--warning,#f59e0b)' : 'inherit') + ';">' + Utils.formatDate(rule.nextDate) + (isDueNow ? ' <i class="ti ti-alarm" style="font-size:12px;"></i>' : '') + '</td>';
            html += '<td style="font-size:12px;color:var(--text-muted);">' + (rule.lastRunDate ? Utils.formatDate(rule.lastRunDate) : '—') + '</td>';
            html += '<td>';
            if (!isActive) {
                html += '<span style="padding:2px 8px;border-radius:10px;background:rgba(107,114,128,.12);color:var(--text-muted);font-size:12px;">Inaktiv</span>';
            } else if (isDueNow) {
                html += '<span style="padding:2px 8px;border-radius:10px;background:rgba(234,179,8,.12);color:var(--warning,#f59e0b);font-size:12px;">Fällig</span>';
            } else {
                html += '<span style="padding:2px 8px;border-radius:10px;background:rgba(16,185,129,.12);color:var(--success,#10b981);font-size:12px;">Aktiv</span>';
            }
            html += '</td>';
            html += '<td class="table-actions">';
            if (isDueNow) {
                html += '<button class="action-btn action-btn-accent wk-create" data-id="' + rule.id + '" title="Rechnung jetzt erstellen"><i class="ti ti-plus"></i></button> ';
            }
            html += '<button class="action-btn wk-toggle" data-id="' + rule.id + '" title="' + (isActive ? 'Pausieren' : 'Aktivieren') + '">';
            html += '<i class="ti ' + (isActive ? 'ti-player-pause' : 'ti-player-play') + '"></i></button> ';
            html += '<button class="action-btn action-btn-danger wk-delete" data-id="' + rule.id + '" title="Löschen"><i class="ti ti-trash"></i></button>';
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    function init() {
        var newBtn = document.getElementById('wkNewRule') || document.getElementById('wkNewRuleEmpty');
        if (newBtn) newBtn.addEventListener('click', showNewRuleModal);

        var processBtn = document.getElementById('wkProcessDue');
        if (processBtn) {
            processBtn.addEventListener('click', async function () {
                var created = await processDueRules();
                Utils.showToast(created.length + ' Rechnung(en) erstellt.', 'success');
                RechApp.navigate('wiederkehrend');
            });
        }

        document.querySelectorAll('.wk-create').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = this.getAttribute('data-id');
                var rules = getRules();
                var rule = rules.find(function (r) { return r.id === id; });
                if (!rule) return;
                var inv = await createInvoiceFromRule(rule);
                Utils.showToast('Rechnung ' + inv.nummer + ' erstellt!', 'success');
                RechApp.navigate('wiederkehrend');
            });
        });

        document.querySelectorAll('.wk-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                var rules = getRules();
                var rule = rules.find(function (r) { return r.id === id; });
                if (!rule) return;
                rule.enabled = !rule.enabled;
                saveRule(rule);
                RechApp.navigate('wiederkehrend');
            });
        });

        document.querySelectorAll('.wk-delete').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Wiederkehrende Rechnung wirklich löschen? (Bereits erstellte Rechnungen bleiben erhalten)')) return;
                deleteRule(this.getAttribute('data-id'));
                RechApp.navigate('wiederkehrend');
            });
        });
    }

    function showNewRuleModal() {
        var invoices  = Store.getRechInvoices ? Store.getRechInvoices() : [];
        var customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        var customerMap = {};
        customers.forEach(function (c) { customerMap[c.id] = c; });

        // Filter: only non-storniert invoices
        var validInvoices = invoices.filter(function (i) { return i.typ === 'rechnung' && i.status !== 'storniert'; });

        var invOptions = validInvoices.map(function (i) {
            var kunde = customerMap[i.kundeId];
            var kundeName = kunde ? (kunde.firma || kunde.ansprechpartner || '') : '—';
            return '<option value="' + i.id + '">' + Utils.escapeHtml(i.nummer + ' — ' + kundeName) + '</option>';
        }).join('');

        if (!invOptions) {
            Utils.showToast('Keine Rechnungen vorhanden. Erst eine Rechnung erstellen.', 'warning');
            return;
        }

        var body = '';
        body += '<div class="form-group"><label class="form-label" for="wkTemplate">Vorlage (Rechnung) <span style="color:var(--danger)">*</span></label>';
        body += '<select class="form-select" id="wkTemplate"><option value="">-- Rechnung wählen --</option>' + invOptions + '</select>';
        body += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Positionen, Kunde und Konditionen werden aus dieser Rechnung übernommen.</div></div>';

        body += '<div class="form-row">';
        body += '<div class="form-group"><label class="form-label" for="wkInterval">Intervall</label>';
        body += '<select class="form-select" id="wkInterval">';
        body += '<option value="woechentlich">Wöchentlich</option>';
        body += '<option value="monatlich" selected>Monatlich</option>';
        body += '<option value="quartal">Quartalsweise</option>';
        body += '<option value="halbjaehrlich">Halbjährlich</option>';
        body += '<option value="jaehrlich">Jährlich</option>';
        body += '</select></div>';

        body += '<div class="form-group"><label class="form-label" for="wkStartDate">Erste Ausführung</label>';
        body += '<input type="date" class="form-input" id="wkStartDate" value="' + Utils.todayISO() + '"></div>';

        body += '<div class="form-group"><label class="form-label" for="wkEndDate">Enddatum (optional)</label>';
        body += '<input type="date" class="form-input" id="wkEndDate"></div>';
        body += '</div>';

        body += '<div style="padding:10px 14px;background:rgba(99,102,241,.07);border-radius:8px;font-size:12px;color:var(--text-secondary);margin-top:4px;">';
        body += '<i class="ti ti-info-circle"></i> Die Rechnung wird automatisch erstellt sobald das Datum erreicht ist (beim nächsten App-Aufruf). Du erhältst eine Benachrichtigung.';
        body += '</div>';

        var footer = '<button class="btn btn-primary" id="wkSaveRule">Regel speichern</button> <button class="btn" data-action="rech-close-modal">Abbrechen</button>';
        RechApp.showModal('Wiederkehrende Rechnung einrichten', body, footer);

        document.getElementById('wkSaveRule').addEventListener('click', function () {
            var templateId = document.getElementById('wkTemplate').value;
            var interval   = document.getElementById('wkInterval').value;
            var startDate  = document.getElementById('wkStartDate').value;
            var endDate    = document.getElementById('wkEndDate').value;

            if (!templateId) { Utils.showToast('Bitte eine Vorlage wählen', 'warning'); return; }
            if (!startDate)  { Utils.showToast('Bitte Startdatum angeben', 'warning'); return; }

            var inv = invoices.find(function (i) { return i.id === templateId; });
            if (!inv) return;

            var rule = createRuleFromInvoice(inv, interval, startDate, endDate || null);
            saveRule(rule);
            Utils.showToast('Wiederkehrende Rechnung gespeichert!', 'success');
            RechApp.closeModal();
            RechApp.navigate('wiederkehrend');
        });
    }

    return {
        render:           render,
        init:             init,
        processDueRules:  processDueRules,
        getRules:         getRules,
        createInvoiceFromRule: createInvoiceFromRule
    };
})();
