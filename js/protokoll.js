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
                dokument: 'Dokument', kunde: 'Kunde', produkt: 'Produkt', system: 'System' };
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
                App.showModal('Protokoll-Detail', body, '<button class="btn" onclick="App.closeModal()">Schliessen</button>');
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
    }
};
