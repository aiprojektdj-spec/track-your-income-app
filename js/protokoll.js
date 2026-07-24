// ============================================
// Protokoll Module - Audit Log Viewer (GoBD)
// ============================================
const Protokoll = {
    _filterAction: '',
    _filterEntity: '',
    _filterVon: '',
    _filterBis: '',

    render() {
        const log = Store.getAuditLog();
        const f = this;

        // Periodenabschluss / Festschreibung
        const closedYears = Store.getClosedYears();
        const allDates = [
            ...Store.getAllPurchasesRaw(),
            ...Store.getAllSalesRaw(),
            ...Store.getAllExpensesRaw()
        ].map(r => String(r.datum || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y));
        const years = [...new Set([...allDates, String(new Date().getFullYear())])].sort().reverse();

        let filtered = [...log];
        if (f._filterAction) filtered = filtered.filter(e => e.action === f._filterAction);
        if (f._filterEntity) filtered = filtered.filter(e => e.entityType === f._filterEntity);
        if (f._filterVon) filtered = filtered.filter(e => e.timestamp >= f._filterVon);
        if (f._filterBis) filtered = filtered.filter(e => e.timestamp <= f._filterBis + 'T23:59:59');

        filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        const actionLabel = (a) => {
            const map = { erstellt: 'Erstellt', bearbeitet: 'Bearbeitet', storniert: 'Storniert',
                status_geaendert: 'Status geaendert', import: 'Import', loeschung: 'Loeschung', bezahlt: 'Bezahlt' };
            return map[a] || a;
        };
        const actionBadge = (a) => {
            const cls = a === 'erstellt' ? 'badge-success' : a === 'storniert' ? 'badge-danger' :
                a === 'bearbeitet' ? 'badge-warning' : a === 'loeschung' ? 'badge-danger' : 'badge-info';
            return `<span class="badge ${cls}">${actionLabel(a)}</span>`;
        };
        const entityLabel = (t) => {
            const map = { einkauf: 'Einkauf', verkauf: 'Verkauf', ausgabe: 'Ausgabe',
                dokument: 'Dokument', kunde: 'Kunde', produkt: 'Produkt', system: 'System', eigenbeleg: 'Eigenbeleg' };
            return map[t] || t;
        };

        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="6" class="table-empty">Keine Protokolleintraege vorhanden</td></tr>';
        } else {
            rows = filtered.map(e => `
                <tr>
                    <td style="white-space:nowrap">${Utils.formatDate(e.timestamp)} ${new Date(e.timestamp).toLocaleTimeString('de-DE')}</td>
                    <td>${actionBadge(e.action)}</td>
                    <td>${entityLabel(e.entityType)}</td>
                    <td style="font-family:monospace;font-size:11px;">${Utils.escapeHtml(e.entityId || '')}</td>
                    <td>${Utils.escapeHtml(e.details || '')}</td>
                    <td>
                        ${e.oldValues || e.newValues ? `<button class="btn btn-small" data-detail="${e.id}">Details</button>` : ''}
                        <span class="audit-checksum" title="Pruefsumme: ${e.checksum || ''}">#${e.checksum || '-'}</span>
                    </td>
                </tr>
            `).join('');
        }

        const actions = [...new Set(log.map(e => e.action))].sort();
        const entities = [...new Set(log.map(e => e.entityType))].sort();

        return `
            <div class="page-header">
                <h2>Aenderungsprotokoll (Audit-Log)</h2>
                <div class="page-header-actions no-print">
                    <button class="btn" id="auditExportBtn">Protokoll exportieren</button>
                    <button class="btn" id="auditVerifyBtn">Integritaet pruefen</button>
                </div>
            </div>

            <div class="card audit-info-card" style="margin-bottom:20px;">
                <div style="padding:1rem;">
                    <strong>GoBD-Hinweis:</strong> Dieses Aenderungsprotokoll dokumentiert alle Erstellungen, Bearbeitungen und Stornierungen.
                    Eintraege koennen nicht geloescht oder veraendert werden. Jeder Eintrag besitzt eine Pruefsumme zur Integritaetssicherung.
                    <br><strong>Eintraege gesamt:</strong> ${log.length} | <strong>Gefiltert:</strong> ${filtered.length}
                </div>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header"><div class="card-title">🔒 Periodenabschluss (Festschreibung)</div></div>
                <div style="padding:1rem;">
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                        Ein abgeschlossenes Jahr ist festgeschrieben: Buchungen darin können nur noch <strong>storniert</strong>, nicht mehr bearbeitet oder geloescht werden (GoBD-Unveraenderbarkeit). Eingereichte USt-Voranmeldungen sperren ihr Quartal automatisch.
                    </p>
                    <div class="table-container" style="border:none;">
                        <table class="data-table">
                            <thead><tr><th>Jahr</th><th>Status</th><th style="text-align:right">Aktion</th></tr></thead>
                            <tbody>
                                ${years.map(y => {
                                    const closed = closedYears.includes(parseInt(y, 10));
                                    return `<tr>
                                        <td><strong>${y}</strong></td>
                                        <td>${closed ? '<span class="badge badge-danger">🔒 Abgeschlossen</span>' : '<span class="badge badge-success">Offen</span>'}</td>
                                        <td style="text-align:right">${closed
                                            ? `<button class="btn btn-small" data-reopen-year="${y}">Wieder oeffnen</button>`
                                            : `<button class="btn btn-small btn-danger" data-close-year="${y}">Jahr abschliessen</button>`}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Aktion</label>
                    <select class="form-select" id="auditFilterAction">
                        <option value="">Alle</option>
                        ${actions.map(a => `<option value="${a}" ${f._filterAction === a ? 'selected' : ''}>${actionLabel(a)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Bereich</label>
                    <select class="form-select" id="auditFilterEntity">
                        <option value="">Alle</option>
                        ${entities.map(t => `<option value="${t}" ${f._filterEntity === t ? 'selected' : ''}>${entityLabel(t)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Von</label>
                    <input type="date" class="form-input" id="auditFilterVon" value="${f._filterVon}">
                </div>
                <div class="filter-group">
                    <label>Bis</label>
                    <input type="date" class="form-input" id="auditFilterBis" value="${f._filterBis}">
                </div>
            </div>

            <div class="table-container">
                <table class="audit-table">
                    <thead>
                        <tr>
                            <th>Zeitpunkt</th>
                            <th>Aktion</th>
                            <th>Bereich</th>
                            <th>ID</th>
                            <th>Details</th>
                            <th>Pruefung</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        const applyFilters = () => {
            this._filterAction = document.getElementById('auditFilterAction').value;
            this._filterEntity = document.getElementById('auditFilterEntity').value;
            this._filterVon = document.getElementById('auditFilterVon').value;
            this._filterBis = document.getElementById('auditFilterBis').value;
            document.getElementById('content').innerHTML = this.render();
            this.init();
        };

        ['auditFilterAction', 'auditFilterEntity', 'auditFilterVon', 'auditFilterBis'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilters);
        });

        // Detail buttons
        document.querySelectorAll('[data-detail]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.detail;
                const entry = Store.getAuditLog().find(e => e.id === id);
                if (!entry) return;
                let body = '<div class="audit-detail">';
                body += `<div class="form-group"><strong>Zeitpunkt:</strong> ${new Date(entry.timestamp).toLocaleString('de-DE')}</div>`;
                body += `<div class="form-group"><strong>Aktion:</strong> ${entry.action}</div>`;
                body += `<div class="form-group"><strong>Bereich:</strong> ${entry.entityType}</div>`;
                body += `<div class="form-group"><strong>ID:</strong> ${entry.entityId}</div>`;
                body += `<div class="form-group"><strong>Details:</strong> ${Utils.escapeHtml(entry.details || '')}</div>`;
                body += `<div class="form-group"><strong>Pruefsumme:</strong> <code>${entry.checksum || '-'}</code></div>`;
                if (entry.oldValues) {
                    body += '<div class="form-group"><strong>Vorherige Werte:</strong>';
                    body += '<pre class="audit-json">' + Utils.escapeHtml(JSON.stringify(entry.oldValues, null, 2)) + '</pre></div>';
                }
                if (entry.newValues) {
                    body += '<div class="form-group"><strong>Neue Werte:</strong>';
                    body += '<pre class="audit-json">' + Utils.escapeHtml(JSON.stringify(entry.newValues, null, 2)) + '</pre></div>';
                }
                body += '</div>';
                App.showModal('Protokoll-Detail', body, '<button class="btn" data-action="close-modal">Schliessen</button>');
            });
        });

        // Export
        const exportBtn = document.getElementById('auditExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const log = Store.getAuditLog();
                const data = JSON.stringify(log, null, 2);
                Utils.downloadFile(data, 'audit_log_' + Utils.todayISO() + '.json', 'application/json');
                Utils.showToast('Protokoll exportiert', 'success');
            });
        }

        // Integrity check — now also verifies audit log hash-chain
        const verifyBtn = document.getElementById('auditVerifyBtn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                let issues = 0;
                const checks = [
                    { name: 'Einkaeufe', items: Store.getAllPurchasesRaw() },
                    { name: 'Verkaeufe', items: Store.getAllSalesRaw() },
                    { name: 'Ausgaben', items: Store.getAllExpensesRaw() }
                ];
                checks.forEach(c => {
                    c.items.forEach(item => {
                        if (!Store.verifyIntegrity(item)) issues++;
                    });
                });

                // Verify audit log hash chain (new — detects retroactive tampering)
                const chainResult = Store.verifyAuditChain();
                if (!chainResult.valid) {
                    Utils.showToast(
                        `⚠ Audit-Log: ${chainResult.broken} Einträge mit gebrochener Hash-Kette (mögliche Manipulation)!`,
                        'error'
                    );
                    return;
                }

                if (issues === 0) {
                    Utils.showToast(
                        `✓ Integritätsprüfung bestanden — ${chainResult.total} Log-Einträge, Hash-Kette intakt`,
                        'success'
                    );
                } else {
                    Utils.showToast(`Warnung: ${issues} Datensätze mit ungültiger Prüfsumme!`, 'error');
                }
            });
        }

        // Periodenabschluss: Jahr abschließen
        document.querySelectorAll('[data-close-year]').forEach(btn => {
            btn.addEventListener('click', () => {
                const y = btn.dataset.closeYear;
                if (!confirm(`Jahr ${y} abschließen? Buchungen aus ${y} können danach nur noch storniert (nicht mehr bearbeitet/gelöscht) werden.`)) return;
                Store.closeYear(y);
                Utils.showToast(`Jahr ${y} abgeschlossen`, 'success');
                document.getElementById('content').innerHTML = this.render();
                this.init();
            });
        });

        // Periodenabschluss: Jahr wieder öffnen (mit Begründung → protokolliert)
        document.querySelectorAll('[data-reopen-year]').forEach(btn => {
            btn.addEventListener('click', () => {
                const y = btn.dataset.reopenYear;
                const grund = prompt(`Jahr ${y} wieder öffnen — Grund (wird protokolliert):`);
                if (!grund) return;
                Store.reopenYear(y, grund);
                Utils.showToast(`Jahr ${y} wieder geöffnet`, 'success');
                document.getElementById('content').innerHTML = this.render();
                this.init();
            });
        });
    }
};
