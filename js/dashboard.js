// ============================================
// Dashboard Module
// ============================================
const Dashboard = {
    _chart: null,
    _chartJahres: null,
    _chartGewinn: null,
    _selectedYear: new Date().getFullYear(),

    render() {
        const year = this._selectedYear;
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;

        const allPurchases = Store.getPurchases(true);
        const allSales     = Store.getSales(true);
        const allExpenses  = Store.getExpenses(true);

        const purchases = allPurchases.filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const sales     = allSales.filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const expenses  = allExpenses.filter(e => Utils.isInPeriod(e.datum, startDate, endDate));

        // Rechnungen (aus Rechnungsbuch)
        const allRechnungen   = Store.getRechInvoices ? Store.getRechInvoices() : [];
        const settings        = Store.getSettings();
        const isKlein         = (settings.ustMode || 'klein') === 'klein';

        // Bezahlte Rechnungen die noch nicht via autoSync in Sales gelandet sind
        const syncedIds = new Set(allSales.filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedRechnungen = allRechnungen.filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (syncedIds.has(inv.id)) return false;
            return Utils.isInPeriod(inv.bezahltAm || inv.datum, startDate, endDate);
        });
        const unsyncedRevenue = unsyncedRechnungen.reduce((sum, inv) =>
            sum + (inv.positionen || []).reduce((s2, p) => {
                const n = (p.menge || 0) * (p.einzelpreis || 0);
                return s2 + n + (isKlein ? 0 : n * (p.mwstSatz || 0) / 100);
            }, 0), 0
        );

        // Offene Rechnungen (offen / versendet / überfällig) — alle Jahre
        const offeneRechnungen = allRechnungen.filter(inv =>
            inv.typ === 'rechnung' && !inv._storniert &&
            ['offen', 'versendet', 'ueberfaellig'].includes(inv.status)
        );
        const offeneSumme = offeneRechnungen.reduce((sum, inv) =>
            sum + (inv.positionen || []).reduce((s2, p) => {
                const n = (p.menge || 0) * (p.einzelpreis || 0);
                return s2 + n + (isKlein ? 0 : n * (p.mwstSatz || 0) / 100);
            }, 0), 0
        );
        const ueberfaelligCount = offeneRechnungen.filter(inv => inv.status === 'ueberfaellig').length;

        // Year totals
        const yearRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0) + unsyncedRevenue;
        const yearPurchaseCost = purchases.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
        const yearExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const yearShipping = sales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
        const yearPlatformFees = sales.reduce((sum, s) => {
            const vk = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            const pct = parseFloat(s.plattformgebuehrProzent) || 0;
            return sum + (vk + vkK) * pct / 100;
        }, 0);
        const yearAllExpenses = yearPurchaseCost + yearExpenses + yearShipping + yearPlatformFees;
        const yearProfit = yearRevenue - yearAllExpenses;

        // Current month (within selected year)
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear  = now.getFullYear();
        const isCurrentYear = year === curYear;
        const monthStart = `${year}-${String(curMonth + 1).padStart(2, '0')}-01`;
        const nextM = new Date(year, curMonth + 1, 0);
        const monthEnd = `${year}-${String(curMonth + 1).padStart(2, '0')}-${String(nextM.getDate()).padStart(2, '0')}`;

        const monthSales     = sales.filter(s => Utils.isInPeriod(s.datum, monthStart, monthEnd));
        const monthPurchases = purchases.filter(p => Utils.isInPeriod(p.datum, monthStart, monthEnd));
        const monthExpenses2 = expenses.filter(e => Utils.isInPeriod(e.datum, monthStart, monthEnd));

        const monthRevenue  = monthSales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
        const monthCost     = monthPurchases.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0)
                            + monthExpenses2.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0)
                            + monthSales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0)
                            + monthSales.reduce((sum, s) => {
                                const vk = parseFloat(s.verkaufspreis) || 0;
                                const vkK = parseFloat(s.versandkostenKaeufer) || 0;
                                const pct = parseFloat(s.plattformgebuehrProzent) || 0;
                                return sum + (vk + vkK) * pct / 100;
                              }, 0);
        const monthProfit = monthRevenue - monthCost;

        // Inventory (all-time, not filtered by year)
        const available = allPurchases.filter(p => p.status === 'verfuegbar');
        const inventoryCount = available.reduce((sum, p) => sum + (parseInt(p.anzahl) || 1), 0);
        const inventoryValue = available.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);

        // Last 5 bookings in selected year
        const allBookings = [
            ...purchases.map(p => ({ ...p, _type: 'Einkauf',  _amount: -(parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) })),
            ...sales.map(s    => ({ ...s,  _type: s._typ === 'rechnung' ? 'Rechnung' : 'Verkauf', _amount: parseFloat(s.verkaufspreis) || 0 })),
            ...unsyncedRechnungen.map(inv => ({
                datum: inv.bezahltAm || inv.datum, marke: 'Rechnung', artikeltyp: inv.nummer || '', beschreibung: '',
                _type: 'Rechnung',
                _amount: (inv.positionen || []).reduce((s2, p) => s2 + (p.menge || 0) * (p.einzelpreis || 0), 0)
            }))
        ].sort((a, b) => (b.datum || '').localeCompare(a.datum || '')).slice(0, 5);

        let bookingsRows = '';
        if (allBookings.length === 0) {
            bookingsRows = `<tr><td colspan="5" class="table-empty">Keine Buchungen in ${year}</td></tr>`;
        } else {
            bookingsRows = allBookings.map(b => `
                <tr>
                    <td>${Utils.formatDate(b.datum)}</td>
                    <td><span class="badge ${b._type === 'Verkauf' ? 'badge-success' : b._type === 'Rechnung' ? 'badge-warning' : 'badge-info'}">${b._type}</span></td>
                    <td>${Utils.escapeHtml(b.marke || '')} ${Utils.escapeHtml(b.artikeltyp || '')}</td>
                    <td>${Utils.escapeHtml(b.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(b._amount)}</td>
                </tr>
            `).join('');
        }

        // Year switcher dropdown
        const minYear = 2020;
        const maxYear = new Date().getFullYear() + 2;
        const yearOptions = Array.from({length: maxYear - minYear + 1}, (_, i) => minYear + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');
        const yearBtns = `<select class="year-select" id="yearSelect">${yearOptions}</select>`;

        // Backup-Reminder: prüfen wie alt das letzte Datei-Backup ist
        let backupReminder = '';
        try {
            const lastBackup = localStorage.getItem('_fs_backup_last');
            const dismissed  = parseInt(localStorage.getItem('_backup_reminder_dismissed_until') || '0');
            const now = Date.now();
            if (now > dismissed) {
                let daysSince = null;
                if (lastBackup) {
                    daysSince = Math.floor((now - new Date(lastBackup).getTime()) / 86400000);
                }
                if (!lastBackup || daysSince >= 7) {
                    const msg = !lastBackup
                        ? 'Du hast noch <strong>kein Datei-Backup</strong> eingerichtet — bei einem Festplatten-Crash wäre alles weg.'
                        : `Letztes Backup ist <strong>${daysSince} Tage</strong> alt.`;
                    backupReminder = `
                        <div id="backupReminder" style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.5);border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                            <span style="font-size:22px;flex-shrink:0;">💾</span>
                            <div style="flex:1;min-width:200px;font-size:13px;">
                                <strong style="color:var(--warning);">Backup-Erinnerung</strong>
                                <div style="margin-top:2px;color:var(--text-secondary);">${msg}</div>
                            </div>
                            <button class="btn btn-warning" id="backupReminderNow" style="font-size:13px;">💾 Jetzt sichern</button>
                            <button class="btn btn-small" id="backupReminderLater" style="opacity:.7;font-size:12px;">7 Tage später erinnern</button>
                        </div>`;
                }
            }
        } catch(e) { /* ignore */ }

        return `
            <div class="page-header">
                <h2>Dashboard</h2>
            </div>

            ${backupReminder}

            <div class="year-switcher">
                ${yearBtns}
            </div>

            ${(() => {
                const land = (typeof CompanyManager !== 'undefined') ? CompanyManager.getActiveLand() : 'DE';
                return (land === 'AT' && typeof SVS !== 'undefined') ? SVS.renderDashboardKachel() : '';
            })()}

            <div class="stats-grid">
                <div class="card stat-card success">
                    <div class="card-label">Einnahmen ${year}</div>
                    <div class="card-value">${Utils.formatCurrency(yearRevenue)}</div>
                    <div class="card-subtitle">${sales.length} Verkäufe</div>
                </div>
                <div class="card stat-card danger">
                    <div class="card-label">Ausgaben ${year}</div>
                    <div class="card-value">${Utils.formatCurrency(yearAllExpenses)}</div>
                    <div class="card-subtitle">Einkauf + Kosten</div>
                </div>
                <div class="card stat-card ${monthProfit >= 0 ? 'success' : 'danger'}">
                    <div class="card-label">${isCurrentYear ? 'Gewinn (akt. Monat)' : 'Gewinn ' + Utils.getMonthShort(curMonth)}</div>
                    <div class="card-value">${Utils.formatCurrency(monthProfit)}</div>
                    <div class="card-subtitle">${Utils.getMonthName(curMonth)} ${year}</div>
                </div>
                <div class="card stat-card ${yearProfit >= 0 ? 'success' : 'warning'}">
                    <div class="card-label">Gewinn ${year}</div>
                    <div class="card-value">${Utils.formatCurrency(yearProfit)}</div>
                    <div class="card-subtitle">Jahresgewinn</div>
                </div>
                <div class="card stat-card info">
                    <div class="card-label">Lagerbestand</div>
                    <div class="card-value">${inventoryCount}</div>
                    <div class="card-subtitle">Wert: ${Utils.formatCurrency(inventoryValue)}</div>
                </div>
                ${(() => {
                    if (typeof Akademie === 'undefined') return '';
                    try {
                        const prog = Akademie._getProgress();
                        const totalLessons = Akademie.MODULES.reduce((s, m) => s + m.lessons.length, 0);
                        const totalAch = Akademie.ACHIEVEMENTS.length;
                        const lessonPct = totalLessons > 0 ? Math.round(prog.completedLessons.length / totalLessons * 100) : 0;
                        return `
                        <div class="card stat-card" id="dashAkademieWidget" style="cursor:pointer;border-left:4px solid var(--accent);">
                            <div class="card-label">🎓 Akademie</div>
                            <div class="card-value" style="font-size:22px;">${prog.unlockedAchievements.length} / ${totalAch}</div>
                            <div class="card-subtitle">Achievements · ${lessonPct}% gelernt</div>
                        </div>
                        `;
                    } catch(e) { return ''; }
                })()}
            </div>

            ${(typeof GbR !== 'undefined') ? GbR.renderDashboardKacheln(yearProfit) : ''}

            ${this._renderTopMarkenWidget(allSales, allPurchases, year)}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Letzte Buchungen ${year}</div>
                    </div>
                    <div class="table-container" style="border:none;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Typ</th>
                                    <th>Artikel</th>
                                    <th>Beschreibung</th>
                                    <th style="text-align:right">Betrag</th>
                                </tr>
                            </thead>
                            <tbody>${bookingsRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Einnahmen vs. Ausgaben ${year}</div>
                    </div>
                    <div class="chart-container">
                        <canvas id="dashChart"></canvas>
                    </div>
                </div>
            </div>

            ${this._renderJahresvergleich(year)}

            <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-top:16px;">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Monatsverlauf Gewinn (letzte 12 Monate)</div>
                    </div>
                    <div class="chart-container">
                        <canvas id="dashChartGewinn"></canvas>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        // Bezahlte Rechnungen immer synchronisieren wenn Dashboard geöffnet wird
        Store.autoSyncInvoices();

        // Akademie-Achievements bei jedem Dashboard-Aufruf prüfen
        if (typeof Akademie !== 'undefined' && Akademie.checkNewAchievements) {
            Akademie.checkNewAchievements();
        }

        // Akademie-Widget Klick → Akademie öffnen
        const akadWidget = document.getElementById('dashAkademieWidget');
        if (akadWidget) akadWidget.addEventListener('click', () => App.navigate('akademie'));

        // Backup-Reminder Buttons
        const remNow = document.getElementById('backupReminderNow');
        if (remNow) remNow.addEventListener('click', () => {
            if (typeof App !== 'undefined' && App.showBackupModal) App.showBackupModal();
        });
        const remLater = document.getElementById('backupReminderLater');
        if (remLater) remLater.addEventListener('click', () => {
            const sevenDays = 7 * 86400000;
            localStorage.setItem('_backup_reminder_dismissed_until', String(Date.now() + sevenDays));
            const banner = document.getElementById('backupReminder');
            if (banner) banner.style.display = 'none';
            Utils.showToast('Erinnerung pausiert für 7 Tage', 'info');
        });

        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) yearSelect.addEventListener('change', () => {
            this._selectedYear = parseInt(yearSelect.value);
            this._refresh();
        });

        this._renderChart();
        this._renderGewinnChart();
    },

    _refresh() {
        if (this._chart) { this._chart.destroy(); this._chart = null; }
        if (this._chartJahres) { this._chartJahres.destroy(); this._chartJahres = null; }
        if (this._chartGewinn) { this._chartGewinn.destroy(); this._chartGewinn = null; }
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    },

    _getYearStats(year) {
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        const allPurchases = Store.getPurchases(true);
        const allSales     = Store.getSales(true);
        const allExpenses  = Store.getExpenses(true);
        const sales     = allSales.filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const purchases = allPurchases.filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const expenses  = allExpenses.filter(e => Utils.isInPeriod(e.datum, startDate, endDate));
        const einnahmen = sales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
        const purchaseCost = purchases.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
        const expCost = expenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const shipping = sales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
        const fees = sales.reduce((sum, s) => {
            const vk = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            const pct = parseFloat(s.plattformgebuehrProzent) || 0;
            return sum + (vk + vkK) * pct / 100;
        }, 0);
        const ausgaben = purchaseCost + expCost + shipping + fees;
        const gewinn = einnahmen - ausgaben;
        const marge = einnahmen > 0 ? (gewinn / einnahmen * 100) : 0;
        const avgVK = sales.length > 0 ? einnahmen / sales.length : 0;
        return { einnahmen, ausgaben, gewinn, marge, anzahl: sales.length, avgVK };
    },

    _renderJahresvergleich(currentYear) {
        const years = [currentYear - 2, currentYear - 1, currentYear].filter(y => y >= 2020);
        if (years.length < 2) return '';
        const stats = years.map(y => ({ year: y, ...this._getYearStats(y) }));
        const rows = [
            { label: 'Einnahmen', key: 'einnahmen', fmt: v => Utils.formatCurrency(v) },
            { label: 'Ausgaben', key: 'ausgaben', fmt: v => Utils.formatCurrency(v) },
            { label: 'Gewinn', key: 'gewinn', fmt: v => Utils.formatCurrency(v) },
            { label: 'Marge', key: 'marge', fmt: v => v.toFixed(1) + '%' },
            { label: 'Verkäufe', key: 'anzahl', fmt: v => v },
            { label: 'Ø VK-Preis', key: 'avgVK', fmt: v => Utils.formatCurrency(v) }
        ];
        const headerCells = stats.map(s => `<th style="text-align:right">${s.year}</th>`).join('');
        const tableRows = rows.map(r => {
            const cells = stats.map(s => {
                const val = s[r.key];
                const color = r.key === 'gewinn' ? (val >= 0 ? 'color:var(--success)' : 'color:var(--danger)') : '';
                return `<td style="text-align:right;${color}">${r.fmt(val)}</td>`;
            }).join('');
            return `<tr><td>${r.label}</td>${cells}</tr>`;
        }).join('');

        return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
            <div class="card">
                <div class="card-header"><div class="card-title">Jahresvergleich</div></div>
                <div class="table-container" style="border:none;">
                    <table>
                        <thead><tr><th>Kennzahl</th>${headerCells}</tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><div class="card-title">Jahresvergleich Chart</div></div>
                <div class="chart-container"><canvas id="dashChartJahres"></canvas></div>
            </div>
        </div>`;
    },

    _renderGewinnChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('dashChartGewinn');
        if (!canvas) return;
        if (this._chartGewinn) { this._chartGewinn.destroy(); this._chartGewinn = null; }

        const textColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#64748b' : '#94a3b8';
        const gridColor = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(45,45,68,0.5)';
        const allSales = Store.getSales(true);
        const allPurchases = Store.getPurchases(true);
        const allExpenses = Store.getExpenses(true);

        const labels = [];
        const gewinne = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            const mEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
            labels.push(Utils.getMonthShort(d.getMonth()) + ' ' + d.getFullYear().toString().substr(2));
            const mSales = allSales.filter(s => Utils.isInPeriod(s.datum, mStart, mEnd));
            const mPurch = allPurchases.filter(p => Utils.isInPeriod(p.datum, mStart, mEnd));
            const mExp = allExpenses.filter(e => Utils.isInPeriod(e.datum, mStart, mEnd));
            const ein = mSales.reduce((s, x) => s + (parseFloat(x.verkaufspreis) || 0), 0);
            const aus = mPurch.reduce((s, x) => s + (parseFloat(x.einkaufspreis) || 0) * (parseInt(x.anzahl) || 1), 0)
                      + mExp.reduce((s, x) => s + (parseFloat(x.betrag) || 0), 0)
                      + mSales.reduce((s, x) => s + (parseFloat(x.versandkostenVerkaufer) || 0), 0)
                      + mSales.reduce((s, x) => {
                          const vk = parseFloat(x.verkaufspreis) || 0;
                          const vkK = parseFloat(x.versandkostenKaeufer) || 0;
                          const pct = parseFloat(x.plattformgebuehrProzent) || 0;
                          return s + (vk + vkK) * pct / 100;
                        }, 0);
            gewinne.push(ein - aus);
        }

        this._chartGewinn = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Gewinn',
                    data: gewinne,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124,58,237,0.1)',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: gewinne.map(v => v >= 0 ? '#10b981' : '#ef4444'),
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: v => Utils.formatCurrency(v) }, grid: { color: gridColor } }
                }
            }
        });

        // Jahresvergleich chart
        const canvasJ = document.getElementById('dashChartJahres');
        if (canvasJ && !this._chartJahres) {
            const cy = this._selectedYear;
            const years = [cy - 2, cy - 1, cy].filter(y => y >= 2020);
            const stats = years.map(y => this._getYearStats(y));
            this._chartJahres = new Chart(canvasJ, {
                type: 'bar',
                data: {
                    labels: years.map(String),
                    datasets: [
                        { label: 'Einnahmen', data: stats.map(s => s.einnahmen), backgroundColor: 'rgba(16,185,129,0.7)', borderWidth: 1 },
                        { label: 'Ausgaben',  data: stats.map(s => s.ausgaben),  backgroundColor: 'rgba(239,68,68,0.7)',  borderWidth: 1 },
                        { label: 'Gewinn',    data: stats.map(s => s.gewinn),    backgroundColor: 'rgba(124,58,237,0.7)', borderWidth: 1 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: textColor } } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { color: gridColor } },
                        y: { ticks: { color: textColor, callback: v => Utils.formatCurrency(v) }, grid: { color: gridColor } }
                    }
                }
            });
        }
    },

    _renderTopMarkenWidget(allSales, allPurchases, year) {
        // Only use sales from the selected year
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        const sales = allSales.filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        if (!sales.length) return '';

        const brandMap = {};
        sales.forEach(s => {
            const brand = s.marke || 'Unbekannt';
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += parseFloat(p.einkaufspreis) || 0;
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                if (p) ek = parseFloat(p.einkaufspreis) || 0;
            }
            const net = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            if (!brandMap[brand]) brandMap[brand] = { count: 0, totalNet: 0, totalGewinn: 0 };
            brandMap[brand].count++;
            brandMap[brand].totalNet    += net;
            brandMap[brand].totalGewinn += net - ek;
        });

        const top = Object.entries(brandMap)
            .sort((a, b) => b[1].totalGewinn - a[1].totalGewinn)
            .slice(0, 5);

        if (!top.length) return '';

        const maxGewinn = Math.max(...top.map(([, v]) => Math.abs(v.totalGewinn)), 1);

        const rows = top.map(([brand, v], i) => {
            const marge = v.totalNet > 0 ? v.totalGewinn / v.totalNet * 100 : 0;
            const barW  = Math.round(Math.abs(v.totalGewinn) / maxGewinn * 100);
            const barCol = v.totalGewinn >= 0 ? 'var(--success)' : 'var(--danger)';
            const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
            return `<div style="display:grid;grid-template-columns:28px 1fr auto auto;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);">
                <div style="font-size:15px;text-align:center;">${medals[i]}</div>
                <div>
                    <div style="font-size:13px;font-weight:600;">${Utils.escapeHtml(brand)}</div>
                    <div style="margin-top:3px;height:4px;border-radius:2px;background:var(--border);overflow:hidden;">
                        <div style="width:${barW}%;height:100%;background:${barCol};border-radius:2px;"></div>
                    </div>
                </div>
                <div style="text-align:right;font-size:12px;color:var(--text-muted);">${v.count} Stk.<br><span style="color:${marge >= 20 ? 'var(--success)' : marge >= 0 ? 'var(--warning)' : 'var(--danger)'};font-weight:600;">${marge.toFixed(0)}%</span></div>
                <div style="text-align:right;font-size:13px;font-weight:700;color:${v.totalGewinn >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(v.totalGewinn)}</div>
            </div>`;
        }).join('');

        return `
        <div class="card" style="margin-bottom:16px;">
            <div class="card-header">
                <div class="card-title">🏆 Top Marken ${year}</div>
                <a href="#" onclick="App.navigate('statistiken');return false;" style="font-size:12px;color:var(--info);">Volle Analyse →</a>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0;">
                ${rows}
            </div>
        </div>`;
    },

    _renderChart() {
        const canvas = document.getElementById('dashChart');
        if (!canvas) return;
        if (this._chart) { this._chart.destroy(); this._chart = null; }

        const year = this._selectedYear;
        const sales     = Store.getSales(true);
        const purchases = Store.getPurchases(true);
        const expenses  = Store.getExpenses(true);

        const textColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#64748b' : '#94a3b8';
        const gridColor = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(45,45,68,0.5)';

        const labels    = [];
        const einnahmen = [];
        const ausgaben  = [];

        for (let m = 0; m < 12; m++) {
            labels.push(Utils.getMonthShort(m));
            const monthStart = `${year}-${String(m + 1).padStart(2, '0')}-01`;
            const nextM = new Date(year, m + 1, 1);
            const monthEnd = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`;
            const inPeriod = d => d >= monthStart && d < monthEnd;

            const rev = sales.filter(s => inPeriod(s.datum)).reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
            einnahmen.push(rev);

            const pc = purchases.filter(p => inPeriod(p.datum)).reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
            const ec = expenses.filter(e => inPeriod(e.datum)).reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
            const sc = sales.filter(s => inPeriod(s.datum)).reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
            const fc = sales.filter(s => inPeriod(s.datum)).reduce((sum, s) => {
                const vk = parseFloat(s.verkaufspreis) || 0;
                const vkK = parseFloat(s.versandkostenKaeufer) || 0;
                const pct = parseFloat(s.plattformgebuehrProzent) || 0;
                return sum + (vk + vkK) * pct / 100;
            }, 0);
            ausgaben.push(pc + ec + sc + fc);
        }

        if (typeof Chart === 'undefined') return;
        this._chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Einnahmen', data: einnahmen, backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 1 },
                    { label: 'Ausgaben',  data: ausgaben,  backgroundColor: 'rgba(239,68,68,0.7)',  borderColor: '#ef4444', borderWidth: 1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor } } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: v => Utils.formatCurrency(v) }, grid: { color: gridColor } }
                }
            }
        });
    }
};
