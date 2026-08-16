var RechProtokoll = (function() {

    var filterAction = '';
    var filterEntity = '';
    var filterVon = '';
    var filterBis = '';

    function render() {
        var log = Store.getAuditLog();

        var filtered = log.slice();
        // Nur Rechnungsbuch-relevante Eintraege
        var rechEntities = ['dokument', 'kunde', 'produkt', 'system'];
        filtered = filtered.filter(function(e) { return rechEntities.indexOf(e.entityType) >= 0; });

        if (filterAction) filtered = filtered.filter(function(e) { return e.action === filterAction; });
        if (filterEntity) filtered = filtered.filter(function(e) { return e.entityType === filterEntity; });
        if (filterVon) filtered = filtered.filter(function(e) { return e.timestamp >= filterVon; });
        if (filterBis) filtered = filtered.filter(function(e) { return e.timestamp <= filterBis + 'T23:59:59'; });

        filtered.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });

        var actionLabels = { erstellt: 'Erstellt', bearbeitet: 'Bearbeitet', storniert: 'Storniert',
            status_geaendert: 'Status geaendert', import: 'Import', loeschung: 'Loeschung' };
        var entityLabels = { dokument: 'Dokument', kunde: 'Kunde', produkt: 'Produkt', system: 'System' };

        function actionBadge(a) {
            var cls = a === 'erstellt' ? 'badge-success' : a === 'storniert' ? 'badge-danger' :
                a === 'bearbeitet' ? 'badge-warning' : 'badge-info';
            return '<span class="badge ' + cls + '">' + (actionLabels[a] || a) + '</span>';
        }

        var rows = '';
        if (filtered.length === 0) {
            // s. js/protokoll.js — Eintraege entstehen automatisch, kein CTA moeglich.
            var gefiltert = !!(filterAction || filterEntity || filterVon || filterBis);
            rows = gefiltert
                ? '<tr><td colspan="6" class="table-empty">Kein Protokolleintrag passt zu diesem Filter.</td></tr>'
                : '<tr><td colspan="6" class="table-empty">Noch keine Protokolleinträge — sie entstehen automatisch, sobald du Rechnungen, Angebote oder Gutschriften anlegst, änderst oder stornierst (§146 AO).</td></tr>';
        } else {
            filtered.forEach(function(e) {
                rows += '<tr>';
                rows += '<td style="white-space:nowrap">' + Utils.formatDate(e.timestamp) + ' ' + new Date(e.timestamp).toLocaleTimeString('de-DE') + '</td>';
                rows += '<td>' + actionBadge(e.action) + '</td>';
                rows += '<td>' + (entityLabels[e.entityType] || e.entityType) + '</td>';
                rows += '<td style="font-family:monospace;font-size:11px;">' + Utils.escapeHtml(e.entityId || '') + '</td>';
                rows += '<td>' + Utils.escapeHtml(e.details || '') + '</td>';
                rows += '<td>';
                if (e.oldValues || e.newValues) {
                    rows += '<button class="btn btn-small audit-detail-btn" data-id="' + e.id + '">Details</button> ';
                }
                rows += '<span class="audit-checksum" title="Pruefsumme: ' + (e.checksum || '') + '">#' + (e.checksum || '-') + '</span>';
                rows += '</td></tr>';
            });
        }

        var actions = [];
        var entities = [];
        log.forEach(function(e) {
            if (rechEntities.indexOf(e.entityType) >= 0) {
                if (actions.indexOf(e.action) < 0) actions.push(e.action);
                if (entities.indexOf(e.entityType) < 0) entities.push(e.entityType);
            }
        });

        var html = '<div class="page-header"><h2>Aenderungsprotokoll</h2>';
        html += '<div class="page-header-actions no-print">';
        html += '<button class="btn" id="rechAuditExport">Protokoll exportieren</button>';
        html += '</div></div>';

        html += '<div class="card audit-info-card" style="margin-bottom:20px;"><div style="padding:1rem;">';
        html += '<strong>GoBD-Hinweis:</strong> Dieses Protokoll dokumentiert alle Aenderungen an Dokumenten, Kunden und Produkten. ';
        html += 'Eintraege koennen nicht geloescht oder veraendert werden.';
        html += '<br><strong>Eintraege:</strong> ' + filtered.length;
        html += '</div></div>';

        html += '<div class="filter-bar no-print">';
        html += '<div class="filter-group"><label for="rechAuditAction">Aktion</label><select class="form-select" id="rechAuditAction"><option value="">Alle</option>';
        actions.forEach(function(a) {
            html += '<option value="' + a + '"' + (filterAction === a ? ' selected' : '') + '>' + (actionLabels[a] || a) + '</option>';
        });
        html += '</select></div>';
        html += '<div class="filter-group"><label for="rechAuditEntity">Bereich</label><select class="form-select" id="rechAuditEntity"><option value="">Alle</option>';
        entities.forEach(function(t) {
            html += '<option value="' + t + '"' + (filterEntity === t ? ' selected' : '') + '>' + (entityLabels[t] || t) + '</option>';
        });
        html += '</select></div>';
        html += '<div class="filter-group"><label for="rechAuditVon">Von</label><input type="date" class="form-input" id="rechAuditVon" value="' + filterVon + '"></div>';
        html += '<div class="filter-group"><label for="rechAuditBis">Bis</label><input type="date" class="form-input" id="rechAuditBis" value="' + filterBis + '"></div>';
        html += '</div>';

        html += '<div class="table-container"><table class="audit-table"><thead><tr>';
        html += '<th scope="col">Zeitpunkt</th><th scope="col">Aktion</th><th scope="col">Bereich</th><th scope="col">ID</th><th scope="col">Details</th><th scope="col">Pruefung</th>';
        html += '</tr></thead><tbody>' + rows + '</tbody></table></div>';

        return html;
    }

    function init() {
        ['rechAuditAction', 'rechAuditEntity', 'rechAuditVon', 'rechAuditBis'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', function() {
                filterAction = document.getElementById('rechAuditAction').value;
                filterEntity = document.getElementById('rechAuditEntity').value;
                filterVon = document.getElementById('rechAuditVon').value;
                filterBis = document.getElementById('rechAuditBis').value;
                document.getElementById('content').innerHTML = render();
                init();
            });
        });

        document.querySelectorAll('.audit-detail-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var entry = Store.getAuditLog().find(function(e) { return e.id === id; });
                if (!entry) return;
                var body = '<div class="audit-detail">';
                body += '<div class="form-group"><strong>Zeitpunkt:</strong> ' + new Date(entry.timestamp).toLocaleString('de-DE') + '</div>';
                body += '<div class="form-group"><strong>Aktion:</strong> ' + entry.action + '</div>';
                body += '<div class="form-group"><strong>Bereich:</strong> ' + entry.entityType + '</div>';
                body += '<div class="form-group"><strong>ID:</strong> ' + entry.entityId + '</div>';
                body += '<div class="form-group"><strong>Details:</strong> ' + Utils.escapeHtml(entry.details || '') + '</div>';
                body += '<div class="form-group"><strong>Pruefsumme:</strong> <code>' + (entry.checksum || '-') + '</code></div>';
                if (entry.oldValues) {
                    body += '<div class="form-group"><strong>Vorherige Werte:</strong>';
                    body += '<pre class="audit-json">' + Utils.escapeHtml(JSON.stringify(entry.oldValues, null, 2)) + '</pre></div>';
                }
                if (entry.newValues) {
                    body += '<div class="form-group"><strong>Neue Werte:</strong>';
                    body += '<pre class="audit-json">' + Utils.escapeHtml(JSON.stringify(entry.newValues, null, 2)) + '</pre></div>';
                }
                body += '</div>';
                RechApp.showModal('Protokoll-Detail', body, '<button class="btn" data-action="rech-close-modal">Schliessen</button>');
            });
        });

        var exportBtn = document.getElementById('rechAuditExport');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                var log = Store.getAuditLog();
                Utils.downloadFile(JSON.stringify(log, null, 2), 'audit_log_' + Utils.todayISO() + '.json', 'application/json');
                Utils.showToast('Protokoll exportiert', 'success');
            });
        }
    }

    return { render: render, init: init };
})();
