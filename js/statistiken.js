// ============================================
// Statistiken Module - Charts & Analytics
// ============================================
const Statistiken = {
    _charts: [],
    _period: String(new Date().getFullYear()),
    _selectedYear: new Date().getFullYear(),
    _customStart: '',
    _customEnd: '',

    render() {
        const years = Array.from({length: 16}, (_, i) => 2020 + i);
        return `
            <div class="page-header">
                <h2>Statistiken</h2>
            </div>

            <div class="filter-bar no-print" style="margin-bottom:20px;">
                <div class="filter-group">
                    <label>Zeitraum</label>
                    <select class="form-select" id="statPeriod">
                        ${years.map(y => `<option value="${y}" ${this._period === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
                        <option value="all" ${this._period === 'all' ? 'selected' : ''}>Gesamte Zeit</option>
                        <option value="custom" ${this._period === 'custom' ? 'selected' : ''}>Benutzerdefiniert</option>
                    </select>
                </div>
                <div class="filter-group" id="statCustomStart" style="${this._period === 'custom' ? '' : 'display:none'}">
                    <label>Von</label>
                    <input type="date" class="form-input" id="statStart" value="${this._customStart}">
                </div>
                <div class="filter-group" id="statCustomEnd" style="${this._period === 'custom' ? '' : 'display:none'}">
                    <label>Bis</label>
                    <input type="date" class="form-input" id="statEnd" value="${this._customEnd}">
                </div>
            </div>

            <div id="platAnalyseSection"></div>

            <div id="matStatSection"></div>

            <div id="profitabilitaetSection"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="card">
                    <div class="card-header"><div class="card-title">Gewinn pro Marke</div></div>
                    <div class="chart-container"><canvas id="chartBrand"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Gewinn pro Plattform</div></div>
                    <div class="chart-container"><canvas id="chartPlatform"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Meistverkaufte Artikeltypen</div></div>
                    <div class="chart-container"><canvas id="chartTypes"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Beste Monate (Gewinn)</div></div>
                    <div class="chart-container"><canvas id="chartMonths"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Durchschnittlicher EK vs VK</div></div>
                    <div class="chart-container"><canvas id="chartAvg"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">ROI pro Kategorie (%)</div></div>
                    <div class="chart-container"><canvas id="chartROI"></canvas></div>
                </div>
            </div>
        `;
    },

    init() {
        const periodSel = document.getElementById('statPeriod');
        periodSel.addEventListener('change', () => {
            this._period = periodSel.value;
            document.getElementById('statCustomStart').style.display = this._period === 'custom' ? '' : 'none';
            document.getElementById('statCustomEnd').style.display = this._period === 'custom' ? '' : 'none';
            if (this._period !== 'custom') this._renderCharts();
        });


        const startInput = document.getElementById('statStart');
        const endInput = document.getElementById('statEnd');
        if (startInput) startInput.addEventListener('change', () => { this._customStart = startInput.value; this._renderCharts(); });
        if (endInput) endInput.addEventListener('change', () => { this._customEnd = endInput.value; this._renderCharts(); });

        this._renderCharts();
    },

    _getFilteredData() {
        let sales = Store.getSales();
        let purchases = Store.getPurchases();

        const yearNum = parseInt(this._period);
        if (!isNaN(yearNum)) {
            const start = `${yearNum}-01-01`;
            const end = `${yearNum}-12-31`;
            sales = sales.filter(s => Utils.isInPeriod(s.datum, start, end));
            purchases = purchases.filter(p => Utils.isInPeriod(p.datum, start, end));
        } else if (this._period === 'custom' && this._customStart && this._customEnd) {
            sales = sales.filter(s => Utils.isInPeriod(s.datum, this._customStart, this._customEnd));
            purchases = purchases.filter(p => Utils.isInPeriod(p.datum, this._customStart, this._customEnd));
        }

        // Bezahlte Rechnungen, die noch nicht als Verkauf gesynct sind (gleiches Pattern wie euer.js/dashboard.js).
        // Nur als Umsatz-Summand nutzbar — Rechnungen haben keine Plattform/Marke/EK, fließen daher
        // nicht in die Plattform-/Marken-/Typ-Aufschlüsselungen ein (dokumentierte Limitation).
        const syncedInvoiceIds = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedRevenue = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (inv.typ !== 'rechnung' && inv.typ !== 'gutschrift') return false;
            if (syncedInvoiceIds.has(inv.id)) return false;
            const d = inv.bezahltAm || inv.datum;
            if (this._period === 'custom' && this._customStart && this._customEnd) return Utils.isInPeriod(d, this._customStart, this._customEnd);
            if (!isNaN(yearNum)) return Utils.isInPeriod(d, `${yearNum}-01-01`, `${yearNum}-12-31`);
            return true;
        }).reduce((sum, inv) => {
            const sign = inv.typ === 'gutschrift' ? -1 : 1; // §17 UStG: Gutschrift mindert den Umsatz
            return sum + sign * (inv.positionen || []).reduce((s2, p) => s2 + (p.menge || 0) * (p.einzelpreis || 0), 0);
        }, 0);

        return { sales, purchases, allPurchases: Store.getPurchases(), unsyncedRevenue };
    },

    _destroyCharts() {
        this._charts.forEach(c => c.destroy());
        this._charts = [];
    },

    _createChart(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const chart = new Chart(canvas, config);
        this._charts.push(chart);
    },

    _getThemeColors() {
        const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        return {
            textColor: isLight ? '#64748b' : '#94a3b8',
            gridColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(45,45,68,0.5)'
        };
    },

    _defaultOptions(horizontal) {
        const { textColor, gridColor } = this._getThemeColors();
        return {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        };
    },

    _renderPlatformAnalyse(sales, allPurchases) {
        const platData = {};
        sales.forEach(s => {
            const p = s.verkaufsplattform || 'Unbekannt';
            if (!platData[p]) platData[p] = { umsatz: 0, count: 0, gewinn: 0, ek: 0 };
            platData[p].umsatz += parseFloat(s.verkaufspreis) || 0;
            platData[p].count++;
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => { const p2 = allPurchases.find(x => x.id === pid); if (p2) ek += parseFloat(p2.einkaufspreis) || 0; });
            } else if (s.purchaseId) {
                const p2 = allPurchases.find(x => x.id === s.purchaseId);
                ek = p2 ? (parseFloat(p2.einkaufspreis) || 0) : 0;
            }
            platData[p].ek += ek;
            const net = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            platData[p].gewinn += net - ek;
        });

        const entries = Object.entries(platData).sort((a, b) => b[1].umsatz - a[1].umsatz);
        if (entries.length === 0) return;

        // PStTG status
        const pstpgRows = entries.map(([plat, v]) => {
            const pflicht = v.count >= 30 || v.umsatz >= 2000;
            const avgVK = v.count > 0 ? v.umsatz / v.count : 0;
            return `<tr>
                <td>${Utils.escapeHtml(plat)}</td>
                <td style="text-align:right">${v.count}</td>
                <td style="text-align:right">${Utils.formatCurrency(v.umsatz)}</td>
                <td style="text-align:right">${Utils.formatCurrency(avgVK)}</td>
                <td style="text-align:right;color:${v.gewinn >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(v.gewinn)}</td>
                <td><span class="badge ${pflicht ? 'badge-danger' : 'badge-success'}">${pflicht ? '⚠️ Meldepflicht' : '✓ OK'}</span></td>
            </tr>`;
        }).join('');

        const bestPlat = entries[0];

        const section = document.getElementById('platAnalyseSection');
        if (!section) return;
        section.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
            <div class="card-header">
                <div class="card-title">Plattform-Analyse</div>
                <div style="font-size:12px;color:var(--text-muted);">PStTG: Meldepflicht ab 30 Verkäufe oder 2.000 € je Plattform</div>
            </div>
            ${bestPlat ? `<div style="margin-bottom:12px;padding:10px;background:rgba(16,185,129,0.08);border:1px solid var(--success);border-radius:6px;font-size:13px;">
                🏆 <strong>Beste Plattform:</strong> ${Utils.escapeHtml(bestPlat[0])} — ${Utils.formatCurrency(bestPlat[1].umsatz)} Umsatz, ${bestPlat[1].count} Verkäufe
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                <div><canvas id="chartPlatPie" style="max-height:200px;"></canvas></div>
                <div><canvas id="chartPlatGewinn" style="max-height:200px;"></canvas></div>
            </div>
            <div class="table-container" style="border:none;">
                <table>
                    <thead><tr><th>Plattform</th><th style="text-align:right">Verkäufe</th><th style="text-align:right">Umsatz</th><th style="text-align:right">Ø VK</th><th style="text-align:right">Gewinn</th><th>PStTG</th></tr></thead>
                    <tbody>${pstpgRows}</tbody>
                </table>
            </div>
        </div>`;

        // Pie chart: Umsatz per platform
        const colors = ['#10b981', '#3b82f6', '#8b93f8', '#f5a623', '#ef5350', '#14b8a6', '#0891b2', '#f97316'];
        const { textColor } = this._getThemeColors();
        const platLabels = entries.map(([p]) => p);
        this._createChart('chartPlatPie', {
            type: 'doughnut',
            data: {
                labels: platLabels,
                datasets: [{ data: entries.map(([, v]) => v.umsatz), backgroundColor: platLabels.map((_, i) => colors[i % colors.length]) }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, padding: 10, font: { size: 11 } } } } }
        });
        this._createChart('chartPlatGewinn', {
            type: 'bar',
            data: {
                labels: platLabels,
                datasets: [{ label: 'Gewinn', data: entries.map(([, v]) => v.gewinn), backgroundColor: entries.map(([, v]) => v.gewinn >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'), borderWidth: 1 }]
            },
            options: { ...this._defaultOptions(false), plugins: { legend: { display: false } } }
        });
    },

    _renderMaterialStats(sales, unsyncedRevenue) {
        const section = document.getElementById('matStatSection');
        if (!section) return;

        const bestand = Store.getMaterialBestand();
        const verbrauch = Store.getMaterialVerbrauch().filter(v => !v.storniert && v.grund === 'verkauf');
        if (!bestand.length && !verbrauch.length) { section.innerHTML = ''; return; }

        const totalVerbrauchKosten = verbrauch.reduce((s, v) => s + (parseFloat(v.kosten) || 0), 0);
        const totalUmsatz = sales.reduce((s, x) => s + (parseFloat(x.verkaufspreis) || 0), 0) + (unsyncedRevenue || 0);
        const avgProVerkauf = sales.length > 0 ? totalVerbrauchKosten / sales.length : 0;
        const pct = totalUmsatz > 0 ? (totalVerbrauchKosten / totalUmsatz * 100).toFixed(1) : '0';
        const restwert = bestand.reduce((s, m) => s + (parseFloat(m.kostenProEinheit) || 0) * (parseInt(m.bestand) || 0), 0);

        // Most used material
        const matUsage = {};
        verbrauch.forEach(v => { matUsage[v.materialName || v.materialId] = (matUsage[v.materialName || v.materialId] || 0) + (parseInt(v.menge) || 0); });
        const topMat = Object.entries(matUsage).sort((a, b) => b[1] - a[1])[0];

        section.innerHTML = `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">📦 Verpackungskosten-Analyse</div>
                    <a href="#" data-action="navigate" data-args=\'["materiallager"]\'
                        style="font-size:12px;color:var(--info);">Materiallager →</a>
                </div>
                <div class="stats-grid" style="margin:0 0 12px;">
                    <div class="card stat-card danger" style="margin:0;">
                        <div class="card-label">Verpackungskosten</div>
                        <div class="card-value">${Utils.formatCurrency(totalVerbrauchKosten)}</div>
                        <div class="card-subtitle">aus Materiallager</div>
                    </div>
                    <div class="card stat-card warning" style="margin:0;">
                        <div class="card-label">Ø je Verkauf</div>
                        <div class="card-value">${Utils.formatCurrency(avgProVerkauf)}</div>
                        <div class="card-subtitle">${sales.length} Verkäufe im Zeitraum</div>
                    </div>
                    <div class="card stat-card info" style="margin:0;">
                        <div class="card-label">% des Umsatzes</div>
                        <div class="card-value">${pct} %</div>
                        <div class="card-subtitle">Verpackungsanteil</div>
                    </div>
                    <div class="card stat-card success" style="margin:0;">
                        <div class="card-label">Restwert Lager</div>
                        <div class="card-value">${Utils.formatCurrency(restwert)}</div>
                        <div class="card-subtitle">Umlaufvermögen${topMat ? '<br>Top: ' + Utils.escapeHtml(topMat[0]) + ' (' + topMat[1] + ' Stk.)' : ''}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /** Chart.js (200 KB) wird nicht mehr eager geladen — dieses Modul ist der einzige
     *  Nutzer im ganzen Projekt. Nachladen genau hier, beim ersten Zeichnen. */
    _ensureChartJs() {
        if (typeof Chart !== 'undefined') return Promise.resolve();
        if (this._chartJsPromise) return this._chartJsPromise;
        this._chartJsPromise = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = 'js/vendor/chart.min.js';
            el.onload = () => resolve();
            el.onerror = () => { this._chartJsPromise = null; reject(new Error('Diagramm-Bibliothek konnte nicht geladen werden')); };
            document.head.appendChild(el);
        });
        return this._chartJsPromise;
    },

    _renderCharts() {
        this._ensureChartJs().then(() => this._renderChartsNow())
            .catch(err => Utils.showToast(err.message, 'error'));
    },

    _renderChartsNow() {
        this._destroyCharts();
        const { sales, purchases, allPurchases, unsyncedRevenue } = this._getFilteredData();
        const { textColor, gridColor } = this._getThemeColors();

        // ── G: Leerer Zustand ────────────────────────────────────────────────
        if (sales.length === 0 && purchases.length === 0) {
            const periodLabel = isNaN(parseInt(this._period))
                ? (this._period === 'all' ? 'Gesamte Zeit' : 'diesen Zeitraum')
                : `das Jahr ${this._period}`;
            ['platAnalyseSection','matStatSection','profitabilitaetSection',
             'chartBrand','chartPlatform','chartTypes','chartMonths','chartAvg','chartROI']
                .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
            const first = document.getElementById('platAnalyseSection');
            if (first) first.innerHTML = `
                <div class="card" style="text-align:center;padding:48px 24px;margin-bottom:20px;">
                    <div style="font-size:52px;margin-bottom:16px;">📊</div>
                    <h3 style="margin:0 0 8px;color:var(--text-primary);">Keine Daten für ${periodLabel}</h3>
                    <p style="color:var(--text-muted);max-width:380px;margin:0 auto 20px;">
                        Trage Einkäufe und Verkäufe ein – danach erscheinen hier Auswertungen nach Marke,
                        Plattform, Gewinn und mehr.
                    </p>
                    <button class="btn btn-primary" data-action="navigate" data-args=\'["buchungen"]\'>
                        → Erste Buchung erfassen
                    </button>
                </div>`;
            return;
        }

        this._renderPlatformAnalyse(sales, allPurchases);
        this._renderMaterialStats(sales, unsyncedRevenue);
        this._renderProfitabilitaet(sales, allPurchases);

        // 1. Gewinn pro Marke (horizontal bar)
        const brandProfit = {};
        sales.forEach(s => {
            const brand = s.marke || 'Unbekannt';
            const net = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                ek = p ? (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) : 0;
            }
            brandProfit[brand] = (brandProfit[brand] || 0) + net - ek;
        });
        const brandLabels = Object.keys(brandProfit).sort((a, b) => brandProfit[b] - brandProfit[a]);
        const brandData = brandLabels.map(b => brandProfit[b]);

        this._createChart('chartBrand', {
            type: 'bar',
            data: {
                labels: brandLabels.length ? brandLabels : ['Keine Daten'],
                datasets: [{
                    label: 'Gewinn',
                    data: brandLabels.length ? brandData : [0],
                    backgroundColor: brandData.map(v => v >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
                    borderWidth: 1
                }]
            },
            options: { ...this._defaultOptions(true), plugins: { legend: { display: false } } }
        });

        // 2. Gewinn pro Plattform
        const platProfit = {};
        sales.forEach(s => {
            const plat = s.verkaufsplattform || 'Unbekannt';
            const net = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                ek = p ? (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) : 0;
            }
            platProfit[plat] = (platProfit[plat] || 0) + net - ek;
        });
        const platLabels = Object.keys(platProfit).sort((a, b) => platProfit[b] - platProfit[a]);

        this._createChart('chartPlatform', {
            type: 'bar',
            data: {
                labels: platLabels.length ? platLabels : ['Keine Daten'],
                datasets: [{
                    label: 'Gewinn',
                    data: platLabels.length ? platLabels.map(p => platProfit[p]) : [0],
                    backgroundColor: 'rgba(16,185,129,0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }]
            },
            options: { ...this._defaultOptions(false), plugins: { legend: { display: false } } }
        });

        // 3. Meistverkaufte Artikeltypen (doughnut)
        const typeCounts = {};
        sales.forEach(s => {
            const t = s.artikeltyp || 'Sonstiges';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        const typeLabels = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]);
        const colors = ['#10b981', '#3b82f6', '#8b93f8', '#f5a623', '#ef5350', '#14b8a6', '#0891b2', '#f97316'];

        this._createChart('chartTypes', {
            type: 'doughnut',
            data: {
                labels: typeLabels.length ? typeLabels : ['Keine Daten'],
                datasets: [{
                    data: typeLabels.length ? typeLabels.map(t => typeCounts[t]) : [1],
                    backgroundColor: typeLabels.length ? typeLabels.map((_, i) => colors[i % colors.length]) : ['#2d2d44']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: textColor, padding: 12 } }
                }
            }
        });

        // 4. Beste Monate (profit per month)
        const monthProfit = {};
        sales.forEach(s => {
            if (!s.datum) return;
            const key = s.datum.substring(0, 7); // YYYY-MM
            const net = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                ek = p ? (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) : 0;
            }
            monthProfit[key] = (monthProfit[key] || 0) + net - ek;
        });
        const monthKeys = Object.keys(monthProfit).filter(k => k && k.includes('-')).sort();
        const monthLabels2 = monthKeys.map(k => {
            const parts = k.split('-');
            const y = parts[0] || '';
            const m = parseInt(parts[1]) || 1;
            return Utils.getMonthShort(m - 1) + ' ' + y;
        });

        this._createChart('chartMonths', {
            type: 'bar',
            data: {
                labels: monthLabels2.length ? monthLabels2 : ['Keine Daten'],
                datasets: [{
                    label: 'Gewinn',
                    data: monthLabels2.length ? monthKeys.map(k => monthProfit[k]) : [0],
                    backgroundColor: monthKeys.map(k => monthProfit[k] >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
                    borderWidth: 1
                }]
            },
            options: { ...this._defaultOptions(false), plugins: { legend: { display: false } } }
        });

        // 5. Durchschnittlicher EK vs VK per brand
        const brandEK = {};
        const brandVK = {};
        const brandCount = {};
        sales.forEach(s => {
            const brand = s.marke || 'Unbekannt';
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                ek = p ? (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) : 0;
            }
            const vk = parseFloat(s.verkaufspreis) || 0;
            brandEK[brand] = (brandEK[brand] || 0) + ek;
            brandVK[brand] = (brandVK[brand] || 0) + vk;
            brandCount[brand] = (brandCount[brand] || 0) + 1;
        });
        const avgBrands = Object.keys(brandCount).sort();

        this._createChart('chartAvg', {
            type: 'bar',
            data: {
                labels: avgBrands.length ? avgBrands : ['Keine Daten'],
                datasets: [
                    {
                        label: 'Durchschn. EK',
                        data: avgBrands.length ? avgBrands.map(b => brandEK[b] / brandCount[b]) : [0],
                        backgroundColor: 'rgba(239,68,68,0.7)',
                        borderWidth: 1
                    },
                    {
                        label: 'Durchschn. VK',
                        data: avgBrands.length ? avgBrands.map(b => brandVK[b] / brandCount[b]) : [0],
                        backgroundColor: 'rgba(16,185,129,0.7)',
                        borderWidth: 1
                    }
                ]
            },
            options: this._defaultOptions(false)
        });

        // 6. ROI pro Kategorie (Artikeltyp)
        const typeEK = {};
        const typeVK = {};
        const typeCount2 = {};
        sales.forEach(s => {
            const t = s.artikeltyp || 'Sonstiges';
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                ek = p ? (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) : 0;
            }
            const vk = parseFloat(s.verkaufspreis) || 0;
            typeEK[t] = (typeEK[t] || 0) + ek;
            typeVK[t] = (typeVK[t] || 0) + vk;
            typeCount2[t] = (typeCount2[t] || 0) + 1;
        });
        const roiTypes = Object.keys(typeCount2).sort();
        const roiData = roiTypes.map(t => {
            const avgEK = typeEK[t] / typeCount2[t];
            const avgVK = typeVK[t] / typeCount2[t];
            return avgEK > 0 ? ((avgVK - avgEK) / avgEK) * 100 : 0;
        });

        this._createChart('chartROI', {
            type: 'bar',
            data: {
                labels: roiTypes.length ? roiTypes : ['Keine Daten'],
                datasets: [{
                    label: 'ROI %',
                    data: roiTypes.length ? roiData : [0],
                    backgroundColor: roiData.map(v => v >= 0 ? 'rgba(59,130,246,0.7)' : 'rgba(239,68,68,0.7)'),
                    borderWidth: 1
                }]
            },
            options: {
                ...this._defaultOptions(false),
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: {
                        ticks: { color: textColor, callback: v => v + '%' },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    },

    _renderProfitabilitaet(sales, allPurchases) {
        const section = document.getElementById('profitabilitaetSection');
        if (!section) return;
        if (!sales.length) { section.innerHTML = ''; return; }

        const brandData = {};
        const typeData  = {};

        sales.forEach(s => {
            const brand = s.marke      || 'Unbekannt';
            const type  = s.artikeltyp || 'Sonstiges';

            let ek = 0;
            let purchaseDatum = null;

            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) {
                        ek += parseFloat(p.einkaufspreis) || 0;
                        if (!purchaseDatum || (p.datum && p.datum < purchaseDatum)) purchaseDatum = p.datum;
                    }
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                if (p) { ek = parseFloat(p.einkaufspreis) || 0; purchaseDatum = p.datum; }
            }

            const vk    = parseFloat(s.verkaufspreis) || 0;
            const net   = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            const profit = net - ek;

            let standzeit = null;
            if (purchaseDatum && s.datum) {
                const ms = new Date(s.datum) - new Date(purchaseDatum);
                standzeit = Math.max(0, Math.round(ms / 86400000));
            }

            [['brand', brand, brandData], ['type', type, typeData]].forEach(([, key, map]) => {
                if (!map[key]) map[key] = { count: 0, totalEK: 0, totalVK: 0, totalNet: 0, totalGewinn: 0, stSum: 0, stCount: 0 };
                const d = map[key];
                d.count++;
                d.totalEK    += ek;
                d.totalVK    += vk;
                d.totalNet   += net;
                d.totalGewinn += profit;
                if (standzeit !== null) { d.stSum += standzeit; d.stCount++; }
            });
        });

        const renderRows = (dataMap) => {
            const entries = Object.entries(dataMap).sort((a, b) => b[1].totalGewinn - a[1].totalGewinn);
            if (!entries.length) return `<tr><td colspan="7" class="table-empty">Keine Daten</td></tr>`;
            return entries.map(([name, v]) => {
                const avgEK     = v.count > 0 ? v.totalEK    / v.count : 0;
                const avgVK     = v.count > 0 ? v.totalVK    / v.count : 0;
                const avgProfit = v.count > 0 ? v.totalGewinn / v.count : 0;
                const marge     = v.totalNet > 0 ? v.totalGewinn / v.totalNet * 100 : 0;
                const avgSt     = v.stCount > 0 ? Math.round(v.stSum / v.stCount) : null;
                const mCol = marge >= 30 ? 'var(--success)' : marge >= 10 ? 'var(--warning)' : 'var(--danger)';
                const mBadge = marge >= 30 ? '🟢' : marge >= 10 ? '🟡' : '🔴';
                return `<tr>
                    <td><strong>${Utils.escapeHtml(name)}</strong></td>
                    <td style="text-align:right">${v.count}</td>
                    <td style="text-align:right">${Utils.formatCurrency(avgEK)}</td>
                    <td style="text-align:right">${Utils.formatCurrency(avgVK)}</td>
                    <td style="text-align:right;color:${avgProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(avgProfit)}</td>
                    <td style="text-align:right;color:${mCol};font-weight:600">${mBadge} ${marge.toFixed(1)}%</td>
                    <td style="text-align:right;color:var(--text-muted)">${avgSt !== null ? avgSt + ' T.' : '—'}</td>
                </tr>`;
            }).join('');
        };

        const thead = `<thead><tr>
            <th>Name</th>
            <th style="text-align:right">Stk.</th>
            <th style="text-align:right">Ø EK</th>
            <th style="text-align:right">Ø VK</th>
            <th style="text-align:right">Ø Gewinn</th>
            <th style="text-align:right">Marge</th>
            <th style="text-align:right">Ø Standzeit</th>
        </tr></thead>`;

        // Best brand / best type badges
        const topBrand = Object.entries(brandData).sort((a, b) => b[1].totalGewinn - a[1].totalGewinn)[0];
        const topType  = Object.entries(typeData).sort((a, b) => b[1].totalGewinn - a[1].totalGewinn)[0];
        const fastType = Object.entries(typeData)
            .filter(([, v]) => v.stCount > 0)
            .sort((a, b) => (a[1].stSum / a[1].stCount) - (b[1].stSum / b[1].stCount))[0];

        const highlights = [
            topBrand ? `🏆 <strong>Top Marke:</strong> ${Utils.escapeHtml(topBrand[0])} — ${Utils.formatCurrency(topBrand[1].totalGewinn)} Gewinn` : '',
            topType  ? `📦 <strong>Top Kategorie:</strong> ${Utils.escapeHtml(topType[0])} — ${topType[1].count} Stk. verkauft` : '',
            fastType ? `⚡ <strong>Schnellste Umschlagszeit:</strong> ${Utils.escapeHtml(fastType[0])} — Ø ${Math.round(fastType[1].stSum / fastType[1].stCount)} Tage` : ''
        ].filter(Boolean);

        section.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
            <div class="card-header">
                <div class="card-title">📊 Profitabilitäts-Übersicht</div>
                <div style="font-size:12px;color:var(--text-muted);">Marge = Nettogewinn ÷ Nettoumsatz · Standzeit = Ø Tage EK→VK</div>
            </div>
            ${highlights.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
                ${highlights.map(h => `<div style="flex:1;min-width:200px;padding:8px 12px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:8px;font-size:13px;">${h}</div>`).join('')}
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div>
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px;">Nach Marke</div>
                    <div class="table-container" style="border:none;margin:0;">
                        <table>${thead}<tbody>${renderRows(brandData)}</tbody></table>
                    </div>
                </div>
                <div>
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px;">Nach Artikeltyp</div>
                    <div class="table-container" style="border:none;margin:0;">
                        <table>${thead}<tbody>${renderRows(typeData)}</tbody></table>
                    </div>
                </div>
            </div>
        </div>`;
    }
};
