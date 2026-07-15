// ============================================
// Schweiz-Modul — EAR, MWST, AHV, Steuerrechner
// Einzelfirma / selbstständige Erwerbstätigkeit (CH)
// ============================================
const Schweiz = {
    _tab: 'ear',
    _period: 'jahr',
    _year: new Date().getFullYear(),
    _month: new Date().getMonth(),
    _kanton: 'ZH',
    _gemeinde: '',
    _zivilstand: 'ledig',
    _gjStart: 1,
    _mwstMethode: 'effektiv',
    _saldoBranche: 'it',
    _saldoSatzManuell: 5.9,

    // ── Kantone mit geschätzter Gesamtsteuerbelastung (Kanton+Gemeinde+DBst)
    // bei CHF 100'000 steuerbarem Einkommen, Einzelperson 2024 — Richtwerte!
    KANTONE: {
        'AG': { name: 'Aargau',                    rate: 0.240 },
        'AI': { name: 'Appenzell Innerrhoden',      rate: 0.210 },
        'AR': { name: 'Appenzell Ausserrhoden',     rate: 0.230 },
        'BE': { name: 'Bern',                       rate: 0.280 },
        'BL': { name: 'Basel-Landschaft',           rate: 0.250 },
        'BS': { name: 'Basel-Stadt',                rate: 0.250 },
        'FR': { name: 'Freiburg',                   rate: 0.260 },
        'GE': { name: 'Genf',                       rate: 0.360 },
        'GL': { name: 'Glarus',                     rate: 0.220 },
        'GR': { name: 'Graubünden',                 rate: 0.240 },
        'JU': { name: 'Jura',                       rate: 0.300 },
        'LU': { name: 'Luzern',                     rate: 0.250 },
        'NE': { name: 'Neuenburg',                  rate: 0.300 },
        'NW': { name: 'Nidwalden',                  rate: 0.190 },
        'OW': { name: 'Obwalden',                   rate: 0.180 },
        'SG': { name: 'St. Gallen',                 rate: 0.250 },
        'SH': { name: 'Schaffhausen',               rate: 0.220 },
        'SO': { name: 'Solothurn',                  rate: 0.260 },
        'SZ': { name: 'Schwyz',                     rate: 0.180 },
        'TG': { name: 'Thurgau',                    rate: 0.240 },
        'TI': { name: 'Tessin',                     rate: 0.280 },
        'UR': { name: 'Uri',                        rate: 0.200 },
        'VD': { name: 'Waadt',                      rate: 0.330 },
        'VS': { name: 'Wallis',                     rate: 0.260 },
        'ZG': { name: 'Zug',                        rate: 0.150 },
        'ZH': { name: 'Zürich',                     rate: 0.240 },
    },

    // Effektive Gesamtsteuerbelastung (DBst+Kanton+Gemeinde) bei CHF 100k, ledig, 2024 — Richtwerte!
    GEMEINDEN: {
        'AG': [
            { id: 'aarau',       name: 'Aarau',           rate: 0.245 },
            { id: 'baden',       name: 'Baden',           rate: 0.230 },
            { id: 'wettingen',   name: 'Wettingen',       rate: 0.250 },
            { id: 'rheinfelden', name: 'Rheinfelden',     rate: 0.240 },
            { id: 'spreitenbach',name: 'Spreitenbach',    rate: 0.228 },
        ],
        'AI': [
            { id: 'appenzell',   name: 'Appenzell',       rate: 0.210 },
        ],
        'AR': [
            { id: 'herisau',     name: 'Herisau',         rate: 0.240 },
            { id: 'teufen',      name: 'Teufen',          rate: 0.225 },
            { id: 'gossau',      name: 'Gossau',          rate: 0.235 },
        ],
        'BE': [
            { id: 'bern',        name: 'Bern',            rate: 0.285 },
            { id: 'biel',        name: 'Biel/Bienne',     rate: 0.300 },
            { id: 'thun',        name: 'Thun',            rate: 0.275 },
            { id: 'koeniz',      name: 'Köniz',           rate: 0.290 },
            { id: 'belp',        name: 'Belp',            rate: 0.280 },
        ],
        'BL': [
            { id: 'liestal',     name: 'Liestal',         rate: 0.255 },
            { id: 'allschwil',   name: 'Allschwil',       rate: 0.240 },
            { id: 'binningen',   name: 'Binningen',       rate: 0.225 },
            { id: 'muttenz',     name: 'Muttenz',         rate: 0.245 },
            { id: 'reinach',     name: 'Reinach BL',      rate: 0.250 },
        ],
        'BS': [
            { id: 'basel',       name: 'Basel',           rate: 0.250 },
            { id: 'riehen',      name: 'Riehen',          rate: 0.235 },
            { id: 'bettingen',   name: 'Bettingen',       rate: 0.210 },
        ],
        'FR': [
            { id: 'fribourg',    name: 'Fribourg',        rate: 0.265 },
            { id: 'bulle',       name: 'Bulle',           rate: 0.255 },
            { id: 'villars',     name: 'Villars-sur-Glâne',rate: 0.250 },
        ],
        'GE': [
            { id: 'geneve',      name: 'Genève',          rate: 0.365 },
            { id: 'carouge',     name: 'Carouge',         rate: 0.355 },
            { id: 'onex',        name: 'Onex',            rate: 0.360 },
            { id: 'lancy',       name: 'Lancy',           rate: 0.360 },
        ],
        'GL': [
            { id: 'glarus',      name: 'Glarus',          rate: 0.220 },
            { id: 'glarusnord',  name: 'Glarus Nord',     rate: 0.225 },
        ],
        'GR': [
            { id: 'chur',        name: 'Chur',            rate: 0.245 },
            { id: 'davos',       name: 'Davos',           rate: 0.220 },
            { id: 'arosa',       name: 'Arosa',           rate: 0.210 },
            { id: 'landquart',   name: 'Landquart',       rate: 0.250 },
        ],
        'JU': [
            { id: 'delemont',    name: 'Delémont',        rate: 0.305 },
            { id: 'porrentruy',  name: 'Porrentruy',      rate: 0.310 },
        ],
        'LU': [
            { id: 'luzern',      name: 'Luzern',          rate: 0.245 },
            { id: 'emmen',       name: 'Emmen',           rate: 0.270 },
            { id: 'kriens',      name: 'Kriens',          rate: 0.255 },
            { id: 'horw',        name: 'Horw',            rate: 0.235 },
            { id: 'sursee',      name: 'Sursee',          rate: 0.255 },
        ],
        'NE': [
            { id: 'neuchatel',   name: 'Neuchâtel',       rate: 0.305 },
            { id: 'chdf',        name: 'La Chaux-de-Fonds',rate: 0.320 },
            { id: 'lelocle',     name: 'Le Locle',        rate: 0.315 },
        ],
        'NW': [
            { id: 'stans',       name: 'Stans',           rate: 0.190 },
            { id: 'hergiswil',   name: 'Hergiswil',       rate: 0.170 },
            { id: 'buochs',      name: 'Buochs',          rate: 0.195 },
        ],
        'OW': [
            { id: 'sarnen',      name: 'Sarnen',          rate: 0.185 },
            { id: 'engelberg',   name: 'Engelberg',       rate: 0.195 },
            { id: 'kerns',       name: 'Kerns',           rate: 0.190 },
        ],
        'SG': [
            { id: 'stgallen',    name: 'St. Gallen',      rate: 0.250 },
            { id: 'rapperswil',  name: 'Rapperswil-Jona', rate: 0.240 },
            { id: 'wil',         name: 'Wil',             rate: 0.260 },
            { id: 'arbon',       name: 'Arbon',           rate: 0.255 },
        ],
        'SH': [
            { id: 'schaffhausen',name: 'Schaffhausen',    rate: 0.220 },
            { id: 'neuhausen',   name: 'Neuhausen a. Rhf.',rate: 0.215 },
        ],
        'SO': [
            { id: 'solothurn',   name: 'Solothurn',       rate: 0.260 },
            { id: 'olten',       name: 'Olten',           rate: 0.270 },
            { id: 'grenchen',    name: 'Grenchen',        rate: 0.290 },
            { id: 'biberist',    name: 'Biberist',        rate: 0.265 },
        ],
        'SZ': [
            { id: 'schwyz',      name: 'Schwyz',          rate: 0.170 },
            { id: 'freienbach',  name: 'Freienbach (Pfäffikon SZ)',rate: 0.165 },
            { id: 'kuessnacht',  name: 'Küssnacht',       rate: 0.195 },
            { id: 'arth',        name: 'Arth',            rate: 0.185 },
        ],
        'TG': [
            { id: 'kreuzlingen', name: 'Kreuzlingen',     rate: 0.240 },
            { id: 'frauenfeld',  name: 'Frauenfeld',      rate: 0.235 },
            { id: 'amriswil',    name: 'Amriswil',        rate: 0.245 },
        ],
        'TI': [
            { id: 'lugano',      name: 'Lugano',          rate: 0.285 },
            { id: 'bellinzona',  name: 'Bellinzona',      rate: 0.275 },
            { id: 'locarno',     name: 'Locarno',         rate: 0.270 },
            { id: 'mendrisio',   name: 'Mendrisio',       rate: 0.260 },
        ],
        'UR': [
            { id: 'altdorf',     name: 'Altdorf',         rate: 0.200 },
            { id: 'erstfeld',    name: 'Erstfeld',        rate: 0.205 },
        ],
        'VD': [
            { id: 'lausanne',    name: 'Lausanne',        rate: 0.340 },
            { id: 'morges',      name: 'Morges',          rate: 0.320 },
            { id: 'nyon',        name: 'Nyon',            rate: 0.315 },
            { id: 'yverdon',     name: 'Yverdon-les-Bains',rate: 0.335 },
            { id: 'renens',      name: 'Renens',          rate: 0.345 },
        ],
        'VS': [
            { id: 'sion',        name: 'Sion',            rate: 0.260 },
            { id: 'brigglis',    name: 'Brig-Glis',       rate: 0.240 },
            { id: 'monthey',     name: 'Monthey',         rate: 0.255 },
            { id: 'visp',        name: 'Visp',            rate: 0.225 },
        ],
        'ZG': [
            { id: 'zug',         name: 'Zug',             rate: 0.145 },
            { id: 'baar',        name: 'Baar',            rate: 0.130 },
            { id: 'steinhausen', name: 'Steinhausen',     rate: 0.140 },
            { id: 'cham',        name: 'Cham',            rate: 0.145 },
        ],
        'ZH': [
            { id: 'zuerich',     name: 'Zürich',          rate: 0.255 },
            { id: 'winterthur',  name: 'Winterthur',      rate: 0.265 },
            { id: 'kueSnacht',   name: 'Küsnacht',        rate: 0.220 },
            { id: 'zollikon',    name: 'Zollikon',        rate: 0.230 },
            { id: 'uster',       name: 'Uster',           rate: 0.245 },
            { id: 'regensdorf',  name: 'Regensdorf',      rate: 0.245 },
        ],
    },

    init() {
        const s = Store.getSettings();
        if (s.chKanton) this._kanton = s.chKanton;
        if (s.chGemeinde) this._gemeinde = s.chGemeinde;
        if (s.chGjStart) this._gjStart = parseInt(s.chGjStart) || 1;
    },

    render() {
        const tabs = [
            { id: 'ear',    label: 'EAR',       icon: 'ti-file-analytics' },
            { id: 'mwst',   label: 'MWST',      icon: 'ti-receipt-tax' },
            { id: 'ahv',    label: 'AHV/IV/EO', icon: 'ti-shield-check' },
            { id: 'steuer', label: 'Steuer',    icon: 'ti-calculator' },
        ];

        const tabBar = tabs.map(t => `
            <button class="btn${this._tab === t.id ? ' btn-primary' : ''}"
                    data-action="ch-set-tab" data-args='["${t.id}"]' 
                    style="display:flex;align-items:center;gap:6px;font-size:13px;">
                <i class="ti ${t.icon}"></i>${t.label}
            </button>
        `).join('');

        let body = '';
        if (this._tab === 'ear')    body = this._renderEAR();
        if (this._tab === 'mwst')   body = this._renderMWST();
        if (this._tab === 'ahv')    body = this._renderAHV();
        if (this._tab === 'steuer') body = this._renderSteuer();

        return `
            <div class="page-header">
                <h2 style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:22px;">🇨🇭</span>
                    Schweiz-Modul
                </h2>
                <div style="color:var(--text-muted);font-size:13px;">Einzelfirma / Selbstständige Erwerbstätigkeit</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
                ${tabBar}
            </div>
            ${body}
        `;
    },

    _setTab(tab) {
        this._tab = tab;
        App.navigate('schweiz');
    },

    // ── Zeitraum-Datumsberechnung (gleiche Logik wie EÜR) ──────────────────
    _getPeriodDates() {
        const y = this._year;
        const m = this._month;
        if (this._period === 'monat') {
            const s = `${y}-${String(m+1).padStart(2,'0')}-01`;
            const e = new Date(y, m+1, 0);
            const eStr = `${y}-${String(m+1).padStart(2,'0')}-${String(e.getDate()).padStart(2,'0')}`;
            return { start: s, end: eStr, label: Utils.getMonthName(m) + ' ' + y };
        }
        if (this._period === 'quartal') {
            const qs = Math.floor(m/3)*3;
            const s = `${y}-${String(qs+1).padStart(2,'0')}-01`;
            const qe = new Date(y, qs+3, 0);
            const eStr = `${qe.getFullYear()}-${String(qe.getMonth()+1).padStart(2,'0')}-${String(qe.getDate()).padStart(2,'0')}`;
            return { start: s, end: eStr, label: `Q${Math.floor(m/3)+1} ${y}` };
        }
        const gjs = (this._gjStart || 1) - 1; // 0-based month index
        if (gjs === 0) {
            return { start: `${y}-01-01`, end: `${y}-12-31`, label: 'Jahr ' + y };
        }
        const gjEndDate = new Date(y + 1, gjs, 0);
        return {
            start: `${y}-${String(gjs + 1).padStart(2,'0')}-01`,
            end:   `${y + 1}-${String(gjs).padStart(2,'0')}-${String(gjEndDate.getDate()).padStart(2,'0')}`,
            label: `GJ ${y}/${String(y + 1).slice(-2)}`,
        };
    },

    _periodSelector() {
        const y = this._year;
        const m = this._month;
        return `
            <div class="card" style="margin-bottom:20px;padding:16px;">
                <div class="form-row" style="align-items:flex-end;">
                    <div class="form-group">
                        <label class="form-label">Zeitraum</label>
                        <select class="form-select" id="chPeriod" data-action-change="ch-period">
                            <option value="monat"   ${this._period==='monat'   ? 'selected' : ''}>Monat</option>
                            <option value="quartal" ${this._period==='quartal' ? 'selected' : ''}>Quartal</option>
                            <option value="jahr"    ${this._period==='jahr'    ? 'selected' : ''}>Jahr</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Jahr</label>
                        <select class="form-select" id="chYear" data-action-change="ch-year">
                            ${Array.from({length:8},(_,i)=>2020+i).map(yr =>
                                `<option value="${yr}" ${yr===y ? 'selected' : ''}>${yr}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="chMonthGroup" style="${this._period==='monat' ? '' : 'display:none'}">
                        <label class="form-label">Monat</label>
                        <select class="form-select" id="chMonth" data-action-change="ch-month">
                            ${Array.from({length:12},(_,i)=>i).map(mo =>
                                `<option value="${mo}" ${mo===m ? 'selected' : ''}>${Utils.getMonthName(mo)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="chQuarterGroup" style="${this._period==='quartal' ? '' : 'display:none'}">
                        <label class="form-label">Quartal</label>
                        <select class="form-select" id="chQuarter" data-action-change="ch-quarter">
                            ${[0,1,2,3].map(q =>
                                `<option value="${q}" ${Math.floor(m/3)===q ? 'selected' : ''}>Q${q+1}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    _onPeriodChange(val) {
        this._period = val;
        this._rerender();
    },

    _rerender() {
        App.navigate('schweiz');
    },

    // ── EAR: Einnahmen-Ausgaben-Rechnung ────────────────────────────────────
    _calcEAR(start, end) {
        const sales     = (Store.getSales() || []).filter(s => Utils.isInPeriod(s.datum, start, end));
        const purchases = (Store.getPurchases() || []).filter(p => Utils.isInPeriod(p.datum, start, end));
        const expenses  = (Store.getExpenses() || []).filter(e => Utils.isInPeriod(e.datum, start, end));
        const fahrten   = (typeof Store.getFahrten === 'function')
            ? Store.getFahrten().filter(f => Utils.isInPeriod(f.datum, start, end)) : [];

        // Bezahlte Rechnungen die noch nicht als Verkauf gesynct sind
        const syncedIds = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedInv = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (syncedIds.has(inv.id)) return false;
            return Utils.isInPeriod(inv.bezahltAm || inv.datum, start, end);
        });
        const rechEin = unsyncedInv.reduce((s, inv) =>
            s + (inv.positionen || []).reduce((s2, p) => s2 + (p.menge||0)*(p.einzelpreis||0), 0), 0);

        const bruttoEin = sales.reduce((s, v) =>
            s + (parseFloat(v.verkaufspreis)||0) + (parseFloat(v.versandkostenKaeufer)||0), 0) + rechEin;

        // Retouren
        const stornierteSaleIds = new Set(Store.getSales(true).filter(s=>s.storniert).map(s=>s.id));
        const retouren = (typeof Store.getRetouren === 'function')
            ? Store.getRetouren().filter(r =>
                Utils.isInPeriod(r.datum, start, end) && !(r.saleId && stornierteSaleIds.has(r.saleId)))
            : [];
        const retourenEin = retouren.reduce((s,r) => s+(parseFloat(r.erstattungBetrag)||0), 0);

        const einnahmen = bruttoEin - retourenEin;

        const wareneinkauf       = purchases.reduce((s,p) => s+(parseFloat(p.einkaufspreis)||0)*(parseInt(p.anzahl)||1), 0);
        const versandkosten      = sales.reduce((s,v) => s+(parseFloat(v.versandkostenVerkaufer)||0), 0);
        const plattformgebuehren = sales.reduce((s,v) => {
            const vk = (parseFloat(v.verkaufspreis)||0)+(parseFloat(v.versandkostenKaeufer)||0);
            return s + vk*(parseFloat(v.plattformgebuehrProzent)||0)/100;
        }, 0);
        const fahrtkosten = fahrten.reduce((s,f) => s+(parseFloat(f.kosten)||0), 0);
        const sonstigeAusgaben = expenses.reduce((s,e) => s+(parseFloat(e.betrag)||0), 0);

        // AfA
        const afaAnlagen = (typeof Store.getAfaAnlagen === 'function') ? Store.getAfaAnlagen().filter(a=>!a.storniert) : [];
        const daysInPeriod = Math.max(1, Math.round((new Date(end)-new Date(start))/(864e5))+1);
        const afaRatio = this._period==='jahr' ? 1 : daysInPeriod/365;
        const afaKosten = afaAnlagen.reduce((s,a) => {
            if (typeof Afa !== 'undefined' && Afa._calcJahresAfa) return s+Afa._calcJahresAfa(a, this._year)*afaRatio;
            return s;
        }, 0);

        const eigenbelegeRaw = (() => { try { const _ebCo = localStorage.getItem('oyi_active_company')||''; const _k = (_ebCo?_ebCo+'__':'')+'eigenbelege_belege'; return (typeof Store !== 'undefined' ? Store._syncReadRaw(_k) : JSON.parse(localStorage.getItem(_k)||'[]')) || []; } catch{return[];} })();
        const eigenbelegeAusgaben = eigenbelegeRaw
            .filter(b=>!b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, start, end))
            .reduce((s,b)=>s+(parseFloat(b.betragNetto)||parseFloat(b.betragBrutto)||0), 0);

        const ausgaben = wareneinkauf+versandkosten+plattformgebuehren+fahrtkosten+sonstigeAusgaben+eigenbelegeAusgaben+afaKosten;
        const reingewinn = einnahmen - ausgaben;

        // Kategorie-Breakdown für Ausgaben
        const catBreak = {};
        expenses.forEach(e => {
            const cat = e.kategorie || 'Sonstiges';
            catBreak[cat] = (catBreak[cat]||0)+(parseFloat(e.betrag)||0);
        });

        return {
            einnahmen, ausgaben, reingewinn,
            wareneinkauf, versandkosten, plattformgebuehren,
            fahrtkosten, sonstigeAusgaben, eigenbelegeAusgaben, afaKosten,
            sales, purchases, expenses, catBreak,
        };
    },

    _renderEAR() {
        const { start, end, label } = this._getPeriodDates();
        const d = this._calcEAR(start, end);
        const { einnahmen, ausgaben, reingewinn } = d;
        const settings = Store.getSettings();

        // MWST-Pflicht prüfen (Jahresumsatz > CHF 100'000)
        const jahresStart = `${this._year}-01-01`;
        const jahresEnd   = `${this._year}-12-31`;
        const jahresEin   = this._calcEAR(jahresStart, jahresEnd).einnahmen;
        const mwstPflichtig = jahresEin >= 100000;

        const fmt = v => Utils.formatCurrency(v);

        const catRows = Object.entries(d.catBreak)
            .sort((a,b)=>b[1]-a[1])
            .map(([cat,val]) => `<tr><td style="padding:4px 8px;color:var(--text-secondary);">${Utils.escapeHtml(cat)}</td><td style="padding:4px 8px;text-align:right;">${fmt(val)}</td></tr>`)
            .join('');

        return `
            ${this._periodSelector()}

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;">
                <div class="card stat-card success" style="padding:14px 16px;border-left:3px solid var(--success);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:5px;"><i class="ti ti-trending-up"></i> Einnahmen</div>
                    <div style="font-size:28px;font-weight:700;">${fmt(einnahmen)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${label} · ${d.sales.length} Verkäufe</div>
                </div>
                <div class="card stat-card danger" style="padding:14px 16px;border-left:3px solid var(--danger);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:5px;"><i class="ti ti-trending-down"></i> Ausgaben</div>
                    <div style="font-size:28px;font-weight:700;">${fmt(ausgaben)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${d.purchases.length} Einkäufe · ${d.expenses.length} BA</div>
                </div>
                <div class="card stat-card ${reingewinn>=0?'success':'danger'}" style="padding:14px 16px;border-left:3px solid ${reingewinn>=0?'var(--success)':'var(--danger)'};">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:5px;"><i class="ti ti-scale"></i> Reingewinn</div>
                    <div style="font-size:28px;font-weight:700;color:${reingewinn>=0?'var(--success)':'var(--danger)'};">${fmt(reingewinn)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Einnahmen minus Ausgaben</div>
                </div>
            </div>

            ${mwstPflichtig
                ? `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--warning);display:flex;align-items:center;gap:8px;"><i class="ti ti-alert-triangle"></i> Jahresumsatz überschreitet CHF 100'000 — Sie sind voraussichtlich MWST-pflichtig. <button class="btn" data-action="ch-set-tab" data-args='["mwst"]'  style="margin-left:auto;font-size:12px;padding:4px 10px;">→ MWST prüfen</button></div>`
                : `<div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:var(--success);display:flex;align-items:center;gap:8px;"><i class="ti ti-shield-check"></i> Jahresumsatz unter CHF 100'000 — Sie können von der MWST-Pflicht befreit sein (Art. 10 Abs. 2 MWSTG).</div>`
            }

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="card" style="padding:16px;">
                    <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-trending-up" style="color:var(--success);margin-right:6px;"></i>Einnahmen-Detail</div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <tr><td style="padding:4px 8px;color:var(--text-secondary);">Verkaufserlöse</td><td style="padding:4px 8px;text-align:right;">${fmt(d.einnahmen + d.ausgaben > 0 ? d.sales.reduce((s,v)=>s+(parseFloat(v.verkaufspreis)||0),0) : 0)}</td></tr>
                        <tr><td style="padding:4px 8px;color:var(--text-secondary);">Versandkosten Käufer</td><td style="padding:4px 8px;text-align:right;">${fmt(d.sales.reduce((s,v)=>s+(parseFloat(v.versandkostenKaeufer)||0),0))}</td></tr>
                        <tr style="border-top:1px solid var(--border);font-weight:600;"><td style="padding:6px 8px;">Total Einnahmen</td><td style="padding:6px 8px;text-align:right;color:var(--success);">${fmt(einnahmen)}</td></tr>
                    </table>
                </div>
                <div class="card" style="padding:16px;">
                    <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-trending-down" style="color:var(--danger);margin-right:6px;"></i>Ausgaben-Detail</div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        ${d.wareneinkauf>0 ? `<tr><td style="padding:4px 8px;color:var(--text-secondary);">Wareneinkauf</td><td style="padding:4px 8px;text-align:right;">${fmt(d.wareneinkauf)}</td></tr>` : ''}
                        ${d.versandkosten>0 ? `<tr><td style="padding:4px 8px;color:var(--text-secondary);">Versandkosten (Verkäufer)</td><td style="padding:4px 8px;text-align:right;">${fmt(d.versandkosten)}</td></tr>` : ''}
                        ${d.plattformgebuehren>0 ? `<tr><td style="padding:4px 8px;color:var(--text-secondary);">Plattformgebühren</td><td style="padding:4px 8px;text-align:right;">${fmt(d.plattformgebuehren)}</td></tr>` : ''}
                        ${d.fahrtkosten>0 ? `<tr><td style="padding:4px 8px;color:var(--text-secondary);">Fahrtkosten</td><td style="padding:4px 8px;text-align:right;">${fmt(d.fahrtkosten)}</td></tr>` : ''}
                        ${d.afaKosten>0 ? `<tr><td style="padding:4px 8px;color:var(--text-secondary);">Abschreibungen (AfA)</td><td style="padding:4px 8px;text-align:right;">${fmt(d.afaKosten)}</td></tr>` : ''}
                        ${d.eigenbelegeAusgaben>0 ? `<tr><td style="padding:4px 8px;color:var(--text-secondary);">Eigenbelege</td><td style="padding:4px 8px;text-align:right;">${fmt(d.eigenbelegeAusgaben)}</td></tr>` : ''}
                        ${catRows}
                        <tr style="border-top:1px solid var(--border);font-weight:600;"><td style="padding:6px 8px;">Total Ausgaben</td><td style="padding:6px 8px;text-align:right;color:var(--danger);">${fmt(ausgaben)}</td></tr>
                    </table>
                </div>
            </div>

            <div class="card" style="margin-top:16px;padding:16px;">
                <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-receipt" style="margin-right:6px;"></i>EAR-Zusammenfassung ${label}</div>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr style="background:rgba(16,185,129,.06);"><td style="padding:8px 12px;font-weight:600;">Einnahmen</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--success);">${fmt(einnahmen)}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:600;">Ausgaben</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--danger);">- ${fmt(ausgaben)}</td></tr>
                    <tr style="border-top:2px solid var(--border);background:rgba(16,185,129,.04);"><td style="padding:10px 12px;font-weight:700;font-size:15px;">Reingewinn</td><td style="padding:10px 12px;text-align:right;font-weight:700;font-size:15px;color:${reingewinn>=0?'var(--success)':'var(--danger)'};">${fmt(reingewinn)}</td></tr>
                </table>
                <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn" data-action="ch-set-tab" data-args='["ahv"]'  style="font-size:12px;"><i class="ti ti-shield-check"></i> AHV berechnen</button>
                    <button class="btn" data-action="ch-set-tab" data-args='["steuer"]'  style="font-size:12px;"><i class="ti ti-calculator"></i> Steuer schätzen</button>
                    <button class="btn" data-action="ch-export-pdf" style="font-size:12px;"><i class="ti ti-printer"></i> PDF drucken</button>
                    <button class="btn" data-action="ch-export-csv" style="font-size:12px;"><i class="ti ti-table-export"></i> Excel / CSV</button>
                </div>
            </div>

            <div style="margin-top:12px;padding:10px 14px;background:rgba(100,116,139,.08);border-radius:8px;font-size:11px;color:var(--text-muted);">
                <i class="ti ti-info-circle"></i> <strong>Hinweis:</strong> Die EAR dient als Grundlage für die Einkommenssteuererklärung (Formular E). Sie ersetzt keine Steuerberatung. Massgebend ist die von der kantonalen Steuerverwaltung anerkannte Abrechnung.
            </div>
        `;
    },

    // ── EAR Export ──────────────────────────────────────────────────────────
    _exportEAR_PDF() {
        const { start, end, label } = this._getPeriodDates();
        const d = this._calcEAR(start, end);
        const settings = Store.getSettings();
        const firma = settings.firma || settings.firmenname || 'Meine Firma';
        const fmt = v => Utils.formatCurrency(v);   // CH-Format: CHF 1'234.55 (Punkt-Dezimal, Apostroph-Tausender)

        const detailRows = [
            ['Verkaufserlöse', d.sales.reduce((s,v)=>s+(parseFloat(v.verkaufspreis)||0),0)],
            ['Versandkosten (Käufer)', d.sales.reduce((s,v)=>s+(parseFloat(v.versandkostenKaeufer)||0),0)],
            ...(d.wareneinkauf>0      ? [['Wareneinkauf',           -d.wareneinkauf]]      : []),
            ...(d.versandkosten>0     ? [['Versandkosten (Verk.)',  -d.versandkosten]]     : []),
            ...(d.plattformgebuehren>0? [['Plattformgebühren',      -d.plattformgebuehren]]: []),
            ...(d.fahrtkosten>0       ? [['Fahrtkosten',            -d.fahrtkosten]]       : []),
            ...(d.afaKosten>0         ? [['Abschreibungen (AfA)',   -d.afaKosten]]         : []),
            ...(d.eigenbelegeAusgaben>0?[['Eigenbelege',            -d.eigenbelegeAusgaben]]: []),
            ...(d.sonstigeAusgaben>0  ? [['Sonstige Ausgaben',      -d.sonstigeAusgaben]]  : []),
        ];

        const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>EAR ${label}</title><style>
body{font-family:Arial,sans-serif;font-size:11pt;margin:20mm;color:#111}
h1{font-size:16pt;margin:0 0 2px}
.sub{color:#666;font-size:10pt;margin-bottom:18px}
table{width:100%;border-collapse:collapse;margin-top:10px}
td{padding:5px 8px;border-bottom:1px solid #eee}
td:last-child{text-align:right;white-space:nowrap}
.bold{font-weight:700}
.sep{border-top:2px solid #333;border-bottom:none}
.green{color:#15803d;background:#f0fdf4}
.red{color:#b91c1c;background:#fef2f2}
.footer{margin-top:24px;font-size:8pt;color:#aaa;border-top:1px solid #ddd;padding-top:6px}
@media print{body{margin:10mm}}
</style></head><body>
<h1>Einnahmen-Ausgaben-Rechnung (EAR)</h1>
<div class="sub">${Utils.escapeHtml(firma)} &nbsp;·&nbsp; ${label}</div>
<table>
<tr class="green bold"><td>Total Einnahmen</td><td>${fmt(d.einnahmen)}</td></tr>
${detailRows.filter(r=>r[1]>0).map(r=>`<tr><td style="padding-left:20px;color:#555">${Utils.escapeHtml(r[0])}</td><td>${fmt(r[1])}</td></tr>`).join('')}
<tr class="red bold sep"><td>Total Ausgaben</td><td>${fmt(d.ausgaben)}</td></tr>
${detailRows.filter(r=>r[1]<0).map(r=>`<tr><td style="padding-left:20px;color:#555">${Utils.escapeHtml(r[0])}</td><td>${fmt(Math.abs(r[1]))}</td></tr>`).join('')}
<tr class="bold sep" style="font-size:12pt;background:#f8fafc"><td>Reingewinn</td><td style="color:${d.reingewinn>=0?'#15803d':'#b91c1c'}">${fmt(d.reingewinn)}</td></tr>
</table>
<div class="footer">Erstellt mit Stackr v1.7 &nbsp;·&nbsp; ${new Date().toLocaleDateString('de-CH')} &nbsp;·&nbsp; Keine Steuerberatung — nur zur internen Planung.</div>
</body></html>`;

        const w = window.open('', '_blank', 'width=820,height=640');
        if (!w) { Utils.showToast('Popup blockiert – bitte Popups erlauben.', 'error'); return; }
        w.document.write(html);
        w.document.close();
        w.onload = () => w.print();
    },

    _exportEAR_CSV() {
        const { start, end, label } = this._getPeriodDates();
        const d = this._calcEAR(start, end);
        const settings = Store.getSettings();
        const firma = settings.firma || settings.firmenname || 'Meine Firma';

        const rows = [
            ['EAR', label, firma],
            [],
            ['Bezeichnung', 'Betrag (CHF)'],
            ['Total Einnahmen', d.einnahmen.toFixed(2)],
            ['  Verkaufserlöse', d.sales.reduce((s,v)=>s+(parseFloat(v.verkaufspreis)||0),0).toFixed(2)],
            ['  Versandkosten (Käufer)', d.sales.reduce((s,v)=>s+(parseFloat(v.versandkostenKaeufer)||0),0).toFixed(2)],
            [],
            ['Total Ausgaben', d.ausgaben.toFixed(2)],
            ...(d.wareneinkauf>0      ? [['  Wareneinkauf',          d.wareneinkauf.toFixed(2)]]      : []),
            ...(d.versandkosten>0     ? [['  Versandkosten (Verk.)', d.versandkosten.toFixed(2)]]     : []),
            ...(d.plattformgebuehren>0? [['  Plattformgebühren',     d.plattformgebuehren.toFixed(2)]]: []),
            ...(d.fahrtkosten>0       ? [['  Fahrtkosten',           d.fahrtkosten.toFixed(2)]]       : []),
            ...(d.afaKosten>0         ? [['  AfA-Abschreibungen',    d.afaKosten.toFixed(2)]]         : []),
            ...(d.eigenbelegeAusgaben>0?[['  Eigenbelege',           d.eigenbelegeAusgaben.toFixed(2)]]: []),
            ...(d.sonstigeAusgaben>0  ? [['  Sonstige Ausgaben',     d.sonstigeAusgaben.toFixed(2)]]  : []),
            ...Object.entries(d.catBreak).map(([cat,val])=>[`    ${cat}`, val.toFixed(2)]),
            [],
            ['Reingewinn', d.reingewinn.toFixed(2)],
        ];

        const csv = rows.map(r => (r.length ? r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';') : '')).join('\r\n');
        const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EAR_${label.replace(/ /g,'_')}_${firma.replace(/[^a-zA-Z0-9]/g,'_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast('CSV exportiert — in Excel öffnen.', 'success');
    },

    // ── MWST: Mehrwertsteuer-Abrechnung (Effektive Methode) ────────────────
    _calcMWST(start, end) {
        const sales    = (Store.getSales() || []).filter(s => Utils.isInPeriod(s.datum, start, end));
        const expenses = (Store.getExpenses() || []).filter(e => Utils.isInPeriod(e.datum, start, end));
        const purchases= (Store.getPurchases() || []).filter(p => Utils.isInPeriod(p.datum, start, end));

        // Umsätze nach Steuersatz aufteilen
        // Wir mappen Deutsche Steuersätze auf CH-Sätze:
        //   ≤ 0 → steuerfrei
        //   2-3 → 2.6% (Sondersatz)
        //   3-5 → 3.8% (Beherbergung) — falls Nutzer manuell 3.8 eingibt
        //   sonst → 8.1% (Normalsatz)
        const _chRate = (satz) => {
            const r = parseFloat(satz);
            if (!r || r <= 0) return 0;
            if (r <= 3) return 2.6;
            if (r <= 5) return 3.8;
            return 8.1;
        };

        let umsatz81=0, umsatz26=0, umsatz38=0, umsatzFrei=0;
        let mwst81=0, mwst26=0, mwst38=0;

        sales.forEach(v => {
            const brutto = (parseFloat(v.verkaufspreis)||0)+(parseFloat(v.versandkostenKaeufer)||0);
            const rate = _chRate(v.steuersatz);
            const netto = brutto / (1 + rate/100);
            const mwst  = brutto - netto;
            if (rate === 8.1) { umsatz81+=netto; mwst81+=mwst; }
            else if (rate === 2.6) { umsatz26+=netto; mwst26+=mwst; }
            else if (rate === 3.8) { umsatz38+=netto; mwst38+=mwst; }
            else { umsatzFrei+=brutto; }
        });

        const schuld = mwst81+mwst26+mwst38;

        // Vorsteuer aus Einkäufen und Ausgaben
        let vorsteuer = 0;
        purchases.forEach(p => {
            const brutto = (parseFloat(p.einkaufspreis)||0)*(parseInt(p.anzahl)||1);
            // Explizite 0 (steuerfrei) NICHT auf 8,1% defaulten — nur leer/null nutzt Default
            const rate = _chRate(p.steuersatz != null && p.steuersatz !== '' ? p.steuersatz : 8.1) / 100;
            vorsteuer += brutto - brutto/(1+rate);
        });
        expenses.forEach(e => {
            const brutto = parseFloat(e.betrag)||0;
            const _eSatz = (e.ustSatz != null && e.ustSatz !== '') ? e.ustSatz
                         : (e.steuersatz != null && e.steuersatz !== '') ? e.steuersatz : 8.1;
            const rate = _chRate(_eSatz) / 100;
            if (rate > 0) vorsteuer += brutto - brutto/(1+rate);
        });

        const zahllast = schuld - vorsteuer;

        return { umsatz81, umsatz26, umsatz38, umsatzFrei, mwst81, mwst26, mwst38, schuld, vorsteuer, zahllast };
    },

    _renderMWST() {
        const { start, end, label } = this._getPeriodDates();
        const fmt = v => Utils.formatCurrency(v);

        // Jahresumsatz für Pflicht-Check
        const jahresEin = this._calcEAR(`${this._year}-01-01`, `${this._year}-12-31`).einnahmen;
        const mwstPflichtig = jahresEin >= 100000;

        // Methoden-Toggle
        const methodeToggle = `
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
                <button class="btn${this._mwstMethode==='effektiv'?' btn-primary':''}" data-action="ch-mwst-methode" data-args='["effektiv"]' >
                    <i class="ti ti-file-check"></i> Effektive Methode
                </button>
                <button class="btn${this._mwstMethode==='saldo'?' btn-primary':''}" data-action="ch-mwst-methode" data-args='["saldo"]' >
                    <i class="ti ti-receipt"></i> Saldosteuersatz
                </button>
            </div>`;

        if (this._mwstMethode === 'saldo') return this._renderMWST_Saldo(label, jahresEin, mwstPflichtig, fmt, methodeToggle);

        const d = this._calcMWST(start, end);

        return `
            ${this._periodSelector()}
            ${methodeToggle}

            ${!mwstPflichtig
                ? `<div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:14px 18px;margin-bottom:16px;font-size:13px;">
                    <div style="font-weight:700;color:var(--success);margin-bottom:6px;"><i class="ti ti-shield-check"></i> MWST-Befreiung möglich</div>
                    <div>Ihr Jahresumsatz beträgt <strong>${fmt(jahresEin)}</strong> — unter der Freigrenze von <strong>CHF 100'000</strong>.</div>
                    <div style="margin-top:4px;font-size:12px;color:var(--text-muted);">Art. 10 Abs. 2 lit. a MWSTG: Freiwillige Unterstellung bei der ESTV möglich.</div>
                   </div>`
                : `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:14px 18px;margin-bottom:16px;font-size:13px;">
                    <div style="font-weight:700;color:var(--warning);margin-bottom:6px;"><i class="ti ti-alert-triangle"></i> MWST-pflichtig</div>
                    <div>Jahresumsatz <strong>${fmt(jahresEin)}</strong> überschreitet CHF 100'000.</div>
                    <div style="margin-top:4px;font-size:12px;color:var(--text-muted);">Abrechnung quartalsweise oder halbjährlich bei der ESTV (www.estv.admin.ch)</div>
                   </div>`
            }

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--accent);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">MWST-Schuld</div>
                    <div style="font-size:24px;font-weight:700;">${fmt(d.schuld)}</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--info);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Vorsteuer</div>
                    <div style="font-size:24px;font-weight:700;">- ${fmt(d.vorsteuer)}</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid ${d.zahllast>=0?'var(--danger)':'var(--success)'};">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">${d.zahllast>=0?'Zahllast':'Guthaben'}</div>
                    <div style="font-size:24px;font-weight:700;color:${d.zahllast>=0?'var(--danger)':'var(--success)'};">${fmt(Math.abs(d.zahllast))}</div>
                </div>
            </div>

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-receipt-tax" style="margin-right:6px;"></i>MWST-Abrechnung ${label}</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border);">
                            <th style="padding:6px 8px;text-align:left;font-weight:600;color:var(--text-secondary);">Steuersatz</th>
                            <th style="padding:6px 8px;text-align:right;font-weight:600;color:var(--text-secondary);">Nettoumsatz</th>
                            <th style="padding:6px 8px;text-align:right;font-weight:600;color:var(--text-secondary);">MWST</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${d.umsatz81>0 ? `<tr><td style="padding:5px 8px;color:var(--text-secondary);">Normalsatz 8.1% (Ziff. 200)</td><td style="padding:5px 8px;text-align:right;">${fmt(d.umsatz81)}</td><td style="padding:5px 8px;text-align:right;">${fmt(d.mwst81)}</td></tr>` : ''}
                        ${d.umsatz26>0 ? `<tr><td style="padding:5px 8px;color:var(--text-secondary);">Sondersatz 2.6% (Ziff. 220)</td><td style="padding:5px 8px;text-align:right;">${fmt(d.umsatz26)}</td><td style="padding:5px 8px;text-align:right;">${fmt(d.mwst26)}</td></tr>` : ''}
                        ${d.umsatz38>0 ? `<tr><td style="padding:5px 8px;color:var(--text-secondary);">Beherbergung 3.8% (Ziff. 225)</td><td style="padding:5px 8px;text-align:right;">${fmt(d.umsatz38)}</td><td style="padding:5px 8px;text-align:right;">${fmt(d.mwst38)}</td></tr>` : ''}
                        ${d.umsatzFrei>0 ? `<tr><td style="padding:5px 8px;color:var(--text-secondary);">Steuerbefreit / 0%</td><td style="padding:5px 8px;text-align:right;">${fmt(d.umsatzFrei)}</td><td style="padding:5px 8px;text-align:right;">${fmt(0)}</td></tr>` : ''}
                        <tr style="border-top:1px solid var(--border);font-weight:600;">
                            <td style="padding:7px 8px;">Total MWST-Schuld (Ziff. 302)</td>
                            <td style="padding:7px 8px;text-align:right;"></td>
                            <td style="padding:7px 8px;text-align:right;color:var(--accent);">${fmt(d.schuld)}</td>
                        </tr>
                        <tr>
                            <td style="padding:5px 8px;color:var(--text-secondary);">Vorsteuer (Ziff. 400)</td>
                            <td style="padding:5px 8px;text-align:right;"></td>
                            <td style="padding:5px 8px;text-align:right;">- ${fmt(d.vorsteuer)}</td>
                        </tr>
                        <tr style="border-top:2px solid var(--border);background:rgba(16,185,129,.04);">
                            <td style="padding:8px;font-weight:700;">Zahllast / Guthaben (Ziff. 500)</td>
                            <td style="padding:8px;text-align:right;"></td>
                            <td style="padding:8px;text-align:right;font-weight:700;color:${d.zahllast>=0?'var(--danger)':'var(--success)'};">${d.zahllast>=0?''+fmt(d.zahllast):'- '+fmt(Math.abs(d.zahllast))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="padding:10px 14px;background:rgba(100,116,139,.08);border-radius:8px;font-size:11px;color:var(--text-muted);">
                <i class="ti ti-info-circle"></i> <strong>Hinweis:</strong> Die Ziffer-Nummern entsprechen dem amtlichen MWST-Abrechnungsformular der ESTV (effektive Methode). Massgebend ist Ihre eigene Buchhaltung. Steuersätze gelten ab 01.01.2024.
            </div>
        `;
    },

    // ── MWST Saldosteuersatz-Methode (Art. 37 MWSTG) ──────────────────────
    _renderMWST_Saldo(label, jahresEin, mwstPflichtig, fmt, methodeToggle) {
        const BRANCHEN = [
            { id: 'it',       label: 'IT / Software / Beratung / Consulting',  satz: 5.9 },
            { id: 'grafik',   label: 'Grafik / Design / Fotografie',            satz: 5.9 },
            { id: 'freie',    label: 'Freie Berufe (Arzt, Anwalt, Treuhänder)',satz: 5.9 },
            { id: 'handwerk', label: 'Handwerk (allgemein)',                    satz: 5.2 },
            { id: 'gastro',   label: 'Gastronomie / Catering',                 satz: 5.2 },
            { id: 'transport',label: 'Transport / Logistik',                   satz: 4.0 },
            { id: 'detail_nf',label: 'Detailhandel (ohne Lebensmittel)',       satz: 2.0 },
            { id: 'detail_lm',label: 'Detailhandel (Lebensmittel)',            satz: 0.6 },
            { id: 'gross',    label: 'Grosshandel',                            satz: 0.6 },
            { id: 'manuell',  label: 'Manuell eingeben …',                     satz: null },
        ];
        const selectedBranche = BRANCHEN.find(b => b.id === this._saldoBranche) || BRANCHEN[0];
        const saldoSatz = selectedBranche.satz !== null ? selectedBranche.satz : this._saldoSatzManuell;
        const saldoMWST = jahresEin * (saldoSatz / 100);

        const brancheOpts = BRANCHEN.map(b =>
            `<option value="${b.id}" ${b.id===this._saldoBranche?'selected':''}>${b.label}${b.satz!==null?' ('+b.satz+'%)':''}</option>`
        ).join('');

        return `
            ${this._periodSelector()}
            ${methodeToggle}

            <div class="card" style="padding:14px 18px;margin-bottom:16px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:8px;font-size:13px;">
                <div style="font-weight:700;margin-bottom:4px;"><i class="ti ti-info-circle"></i> Saldosteuersatz-Methode (Art. 37 MWSTG)</div>
                <div style="color:var(--text-secondary);">Pauschalabgabe auf dem Bruttoumsatz — kein Vorsteuerabzug. Nur für Umsätze bis <strong>CHF 5.005 Mio.</strong> möglich. Bestätigung durch die ESTV erforderlich.</div>
            </div>

            ${!mwstPflichtig
                ? `<div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--success);"><i class="ti ti-shield-check"></i> Jahresumsatz unter CHF 100'000 — MWST-Befreiung möglich (Art. 10 Abs. 2 MWSTG).</div>`
                : ''
            }

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:14px;font-size:14px;"><i class="ti ti-sliders" style="margin-right:6px;"></i>Parameter</div>
                <div class="form-group">
                    <label class="form-label">Branche</label>
                    <select class="form-select" data-action-change="ch-saldo-branche">
                        ${brancheOpts}
                    </select>
                </div>
                ${selectedBranche.satz === null ? `
                <div class="form-group">
                    <label class="form-label">Saldosteuersatz (%)</label>
                    <input type="number" class="form-input" value="${this._saldoSatzManuell}" min="0" max="10" step="0.1"
                        data-action-change="ch-saldo-satz">
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Den genauen Satz findest du in der ESTV-Liste (www.estv.admin.ch → MWST → Saldosteuersatzmethode).</div>
                </div>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--info);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Jahresumsatz (brutto)</div>
                    <div style="font-size:24px;font-weight:700;">${fmt(jahresEin)}</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--accent);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Saldosteuersatz</div>
                    <div style="font-size:24px;font-weight:700;">${saldoSatz.toFixed(1)} %</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--danger);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">MWST-Schuld</div>
                    <div style="font-size:24px;font-weight:700;color:var(--danger);">${fmt(saldoMWST)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${jahresEin>0?(saldoSatz).toFixed(1):'0.0'} % von Umsatz</div>
                </div>
            </div>

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-receipt-tax" style="margin-right:6px;"></i>Abrechnung Saldosteuersatz — ${new Date().getFullYear()}</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">Bruttoumsatz (inkl. MWST)</td><td style="padding:6px 8px;text-align:right;">${fmt(jahresEin)}</td></tr>
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">× Saldosteuersatz (${saldoSatz.toFixed(1)}%)</td><td style="padding:6px 8px;text-align:right;"></td></tr>
                    <tr style="border-top:2px solid var(--border);background:rgba(239,68,68,.04);">
                        <td style="padding:8px;font-weight:700;">MWST-Schuld (zahlen an ESTV)</td>
                        <td style="padding:8px;text-align:right;font-weight:700;color:var(--danger);">${fmt(saldoMWST)}</td>
                    </tr>
                    <tr><td style="padding:6px 8px;color:var(--text-muted);font-size:11px;" colspan="2">Abrechnung: halbjährlich oder jährlich (auf Antrag). Kein Vorsteuerabzug möglich.</td></tr>
                </table>
            </div>

            <div style="padding:10px 14px;background:rgba(100,116,139,.08);border-radius:8px;font-size:11px;color:var(--text-muted);">
                <i class="ti ti-info-circle"></i> <strong>Hinweis:</strong> Die Saldosteuersätze sind branchenspezifisch und werden von der ESTV festgelegt. Der hier gezeigte Satz ist ein Richtwert — massgebend ist Ihr genehmigter Saldosteuersatz. Quelle: ESTV Merkblatt zur Saldosteuersatzmethode (www.estv.admin.ch).
            </div>
        `;
    },

    // ── AHV/IV/EO: Sozialversicherungsbeiträge ──────────────────────────────
    _calcAHV(reingewinn) {
        const einkommen = Math.max(0, parseFloat(reingewinn) || 0);
        // AHV/IV/EO-Beitragssatz 2026 (BSV Merkblatt 2.02): 10.0% für Selbstständige (AHV 8.1% + IV 1.4% + EO 0.5%)
        // Achtung: 10.6% gilt für Arbeitnehmer+Arbeitgeber zusammen — nicht für Selbstständige!
        const MINDESTBEITRAG = 530;    // CHF/Jahr (Mindestbeitrag 2026, Untergrenze Gleitzone)
        const GRENZE_UNTEN   = 10100;  // kein Beitrag darunter (Skala-Untergrenze 2026)
        const GRENZE_OBEN    = 60500;  // voller Satz ab hier (2026: CHF 60'500, Art. 21 AHVV)
        const VOLLSATZ       = 0.100; // 10.0% (AHV 8.1% + IV 1.4% + EO 0.5%)

        // Selbstständige zahlen auch unter der Skala-Untergrenze den Mindestbeitrag (CHF 530/Jahr).
        if (einkommen < GRENZE_UNTEN) return { beitrag: MINDESTBEITRAG, rate: einkommen>0 ? MINDESTBEITRAG/einkommen : 0, monatlich: Math.round(MINDESTBEITRAG/12*100)/100, stufe: 'mindest' };

        let beitrag, rate;
        if (einkommen >= GRENZE_OBEN) {
            beitrag = einkommen * VOLLSATZ;
            rate = VOLLSATZ;
        } else {
            // Gleitende Skala: linear von Mindestbeitrag@10100 bis Vollsatz@60500 (Art. 21 AHVV)
            const prop = (einkommen - GRENZE_UNTEN) / (GRENZE_OBEN - GRENZE_UNTEN);
            beitrag = Math.max(MINDESTBEITRAG, MINDESTBEITRAG + (GRENZE_OBEN * VOLLSATZ - MINDESTBEITRAG) * prop);
            rate = beitrag / einkommen;
        }

        return { beitrag: Math.round(beitrag * 100) / 100, rate, monatlich: Math.round(beitrag/12*100)/100, stufe: einkommen>=GRENZE_OBEN?'voll':'gleitend' };
    },

    _renderAHV() {
        const { start, end, label } = this._getPeriodDates();
        const earData = this._calcEAR(start, end);
        const reingewinn = Math.max(0, earData.reingewinn);
        const ahv = this._calcAHV(reingewinn);
        const fmt = v => Utils.formatCurrency(v);

        const stufeText = {
            mindest: 'Mindestbeitrag CHF 530 (Einkommen unter CHF 10\'100)',
            gleitend: 'Gleitende Skala (CHF 10\'100 – 60\'500)',
            voll: 'Voller Beitragssatz (Einkommen ab CHF 60\'500)',
        };

        return `
            ${this._periodSelector()}

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--accent);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;"><i class="ti ti-shield-check"></i> AHV/IV/EO gesamt</div>
                    <div style="font-size:26px;font-weight:700;">${fmt(ahv.beitrag)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${label}</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--info);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Monatliche Rate</div>
                    <div style="font-size:26px;font-weight:700;">${fmt(ahv.monatlich)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Durchschnitt/Monat</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--success);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Reingewinn (EAR)</div>
                    <div style="font-size:26px;font-weight:700;">${fmt(reingewinn)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${label}</div>
                </div>
            </div>

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:14px;font-size:14px;"><i class="ti ti-shield-check" style="margin-right:6px;color:var(--accent);"></i>Beitragsberechnung AHV/IV/EO 2026</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">Reingewinn aus EAR</td><td style="padding:6px 8px;text-align:right;font-weight:600;">${fmt(reingewinn)}</td></tr>
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">Beitragstufe</td><td style="padding:6px 8px;text-align:right;">${stufeText[ahv.stufe] || ahv.stufe}</td></tr>
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">Effektiver Beitragssatz</td><td style="padding:6px 8px;text-align:right;">${(ahv.rate*100).toFixed(2)} %</td></tr>
                    <tr style="border-top:1px solid var(--border);">
                        <td style="padding:6px 8px;color:var(--text-secondary);">davon AHV (8.1%)</td>
                        <td style="padding:6px 8px;text-align:right;">${fmt(ahv.beitrag * (8.1 / 10.0))}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 8px;color:var(--text-secondary);">davon IV (1.4%)</td>
                        <td style="padding:6px 8px;text-align:right;">${fmt(ahv.beitrag * (1.4 / 10.0))}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 8px;color:var(--text-secondary);">davon EO (0.5%)</td>
                        <td style="padding:6px 8px;text-align:right;">${fmt(ahv.beitrag * (0.5 / 10.0))}</td>
                    </tr>
                    <tr style="border-top:2px solid var(--border);background:rgba(16,185,129,.04);">
                        <td style="padding:8px;font-weight:700;">Total AHV/IV/EO</td>
                        <td style="padding:8px;text-align:right;font-weight:700;color:var(--accent);">${fmt(ahv.beitrag)}</td>
                    </tr>
                </table>
            </div>

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-building-bank" style="margin-right:6px;"></i>Liquiditätsplanung</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:13px;">
                    <div style="background:var(--surface);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">Reingewinn</div>
                        <div style="font-weight:700;">${fmt(reingewinn)}</div>
                    </div>
                    <div style="background:var(--surface);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">- AHV/IV/EO</div>
                        <div style="font-weight:700;color:var(--danger);">- ${fmt(ahv.beitrag)}</div>
                    </div>
                    <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">Nach AHV (vor Steuer)</div>
                        <div style="font-weight:700;color:var(--success);">${fmt(Math.max(0, reingewinn - ahv.beitrag))}</div>
                    </div>
                </div>
                <div style="margin-top:10px;font-size:12px;color:var(--text-muted);">
                    Tipp: Legen Sie monatlich ca. ${fmt(ahv.monatlich)} für die AHV-Beiträge zurück. Die Ausgleichskasse stellt die Akonto-Rechnungen quartalsweise.
                </div>
            </div>

            <div style="padding:10px 14px;background:rgba(100,116,139,.08);border-radius:8px;font-size:11px;color:var(--text-muted);">
                <i class="ti ti-info-circle"></i> <strong>Beitragssätze 2026 (Selbstständige):</strong> AHV 8.1% + IV 1.4% + EO 0.5% = 10.0%. Mindestbeitrag CHF 530/Jahr. Gleitende Skala CHF 10'100 – 60'500. Quelle: BSV Merkblatt 2.02. Die Berechnung ist eine Schätzung — massgebend ist Ihre zuständige AHV-Ausgleichskasse.
            </div>
        `;
    },

    // ── Steuerrechner: Einkommenssteuer-Schätzung ──────────────────────────
    _calcDBst(einkommen, verheiratet) {
        // Direkte Bundessteuer 2026 (ESTV Form. 58c, gültig ab 2026) — Stufentarif Art. 36 DBG
        // Tarif für ledige natürliche Personen (Grundtarif / Tarif A)
        // Stufen: (untere Grenze CHF, Grenzsteuersatz % auf den Überschuss)
        const tariA = [
            [      0,   0    ],
            [  15200,   0.77 ],
            [  33200,   0.88 ],
            [  43500,   2.64 ],
            [  58000,   2.97 ],
            [  76200,   5.94 ],
            [  82100,   6.60 ],
            [ 108900,   8.80 ],
            [ 141500,  11.00 ],
            [ 185100,  13.20 ],
            [ 793900,  11.50 ],
        ];
        // Tarif B (Verheiratete/Einelternfamilien) — Verheiratetentarif Art. 36 Abs. 2 DBG
        const tariB = [
            [      0,   0    ],
            [  29700,   1.00 ],
            [  53400,   2.00 ],
            [  61300,   3.00 ],
            [  79100,   4.00 ],
            [  94900,   5.00 ],
            [ 108700,   6.00 ],
            [ 120600,   7.00 ],
            [ 130500,   8.00 ],
            [ 138400,   9.00 ],
            [ 144300,  10.00 ],
            [ 148300,  11.00 ],
            [ 150400,  12.00 ],
            [ 152400,  13.00 ],
            [ 941300,  11.50 ],
        ];

        const stufen = verheiratet ? tariB : tariA;
        let dbst = 0;
        for (let i=0; i<stufen.length; i++) {
            const lower = stufen[i][0];
            const upper = (i+1 < stufen.length) ? stufen[i+1][0] : Infinity;
            if (einkommen <= lower) break;
            const taxableInBracket = Math.min(einkommen, upper) - lower;
            dbst += taxableInBracket * stufen[i][1] / 100;
        }
        return Math.max(0, dbst);
    },

    _renderSteuer() {
        const { start, end, label } = this._getPeriodDates();
        const earData  = this._calcEAR(start, end);
        const reingewinn = Math.max(0, earData.reingewinn);
        const ahv = this._calcAHV(reingewinn);

        // Steuerbares Einkommen vereinfacht: Reingewinn - AHV/IV/EO - Berufskosten-Pauschale
        const ahvAbzug    = ahv.beitrag;
        const berufskosten = 0; // Nutzer kann manuell justieren
        const steuerbaresEink = Math.max(0, reingewinn - ahvAbzug - berufskosten);

        const verheiratet = this._zivilstand === 'verheiratet';
        const dbst = this._calcDBst(steuerbaresEink, verheiratet);

        const kantonInfo = this.KANTONE[this._kanton] || this.KANTONE['ZH'];
        const gemeindenListe = this.GEMEINDEN[this._kanton] || [];
        const selectedGemeinde = gemeindenListe.find(g => g.id === this._gemeinde);
        // Gemeinde-Rate überschreibt Kantons-Schnitt, falls ausgewählt
        const gesamtRate = selectedGemeinde ? selectedGemeinde.rate : kantonInfo.rate;
        const dbstRate = steuerbaresEink > 0 ? dbst / steuerbaresEink : 0;
        const kantonsRate = Math.max(0, gesamtRate - dbstRate);
        const kantonssteuer = steuerbaresEink * kantonsRate;
        const gesamtSteuer = dbst + kantonssteuer;

        const fmt = v => Utils.formatCurrency(v);

        const kantonOptionen = Object.entries(this.KANTONE)
            .sort((a,b)=>a[1].name.localeCompare(b[1].name))
            .map(([k, v]) => `<option value="${k}" ${k===this._kanton?'selected':''}>${k} — ${v.name}</option>`)
            .join('');

        const gemeindeOptionen = gemeindenListe.length
            ? `<option value="">— Kantonsschnitt —</option>` +
              gemeindenListe.map(g =>
                `<option value="${g.id}" ${g.id===this._gemeinde?'selected':''}>${Utils.escapeHtml(g.name)} (~${(g.rate*100).toFixed(1)}%)</option>`
              ).join('')
            : `<option value="">— keine Gemeindedaten —</option>`;

        const ortLabel = selectedGemeinde
            ? `${kantonInfo.name} · ${selectedGemeinde.name}`
            : `${kantonInfo.name} (Kantonsschnitt)`;

        return `
            ${this._periodSelector()}

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:14px;font-size:14px;"><i class="ti ti-sliders" style="margin-right:6px;"></i>Parameter</div>
                <div class="form-row" style="align-items:flex-end;flex-wrap:wrap;">
                    <div class="form-group">
                        <label class="form-label">Kanton</label>
                        <select class="form-select" id="chKanton" data-action-change="ch-kanton">
                            ${kantonOptionen}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gemeinde</label>
                        <select class="form-select" id="chGemeinde" data-action-change="ch-gemeinde">
                            ${gemeindeOptionen}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Zivilstand</label>
                        <select class="form-select" id="chZivilstand" data-action-change="ch-zivilstand">
                            <option value="ledig" ${this._zivilstand==='ledig'?'selected':''}>Ledig / Alleinstehend</option>
                            <option value="verheiratet" ${this._zivilstand==='verheiratet'?'selected':''}>Verheiratet / Eingetragene Partnerschaft</option>
                        </select>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--accent);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Direkte Bundessteuer</div>
                    <div style="font-size:24px;font-weight:700;">${fmt(dbst)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${steuerbaresEink>0?(dbst/steuerbaresEink*100).toFixed(1):'0.0'} % eff.</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--info);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Kantons- + Gemeindesteuer</div>
                    <div style="font-size:24px;font-weight:700;">${fmt(kantonssteuer)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${kantonInfo.name}</div>
                </div>
                <div class="card" style="padding:14px 16px;border-left:3px solid var(--danger);">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">Total Einkommenssteuer</div>
                    <div style="font-size:24px;font-weight:700;color:var(--danger);">${fmt(gesamtSteuer)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${steuerbaresEink>0?(gesamtSteuer/steuerbaresEink*100).toFixed(1):'0.0'} % eff.</div>
                </div>
            </div>

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:14px;font-size:14px;"><i class="ti ti-calculator" style="margin-right:6px;"></i>Steuerberechnung ${label} — ${kantonInfo.name}</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">Reingewinn (EAR)</td><td style="padding:6px 8px;text-align:right;">${fmt(reingewinn)}</td></tr>
                    <tr><td style="padding:6px 8px;color:var(--text-secondary);">- AHV/IV/EO Beiträge</td><td style="padding:6px 8px;text-align:right;">- ${fmt(ahvAbzug)}</td></tr>
                    <tr style="border-top:1px solid var(--border);font-weight:600;background:rgba(16,185,129,.04);">
                        <td style="padding:7px 8px;">= Steuerbares Einkommen (geschätzt)</td>
                        <td style="padding:7px 8px;text-align:right;">${fmt(steuerbaresEink)}</td>
                    </tr>
                    <tr style="border-top:1px solid var(--border);">
                        <td style="padding:6px 8px;color:var(--text-secondary);">Direkte Bundessteuer (Tarif ${verheiratet?'B':'A'})</td>
                        <td style="padding:6px 8px;text-align:right;">${fmt(dbst)}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px 8px;color:var(--text-secondary);">Kantons- + Gemeindesteuer (${(kantonsRate*100).toFixed(1)}%)</td>
                        <td style="padding:6px 8px;text-align:right;">${fmt(kantonssteuer)}</td>
                    </tr>
                    <tr style="border-top:2px solid var(--border);background:rgba(239,68,68,.04);">
                        <td style="padding:8px;font-weight:700;">Total Einkommenssteuer</td>
                        <td style="padding:8px;text-align:right;font-weight:700;color:var(--danger);">${fmt(gesamtSteuer)}</td>
                    </tr>
                </table>
            </div>

            <div class="card" style="padding:16px;margin-bottom:16px;">
                <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-building-bank" style="margin-right:6px;"></i>Gesamtbelastung im Überblick</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:13px;">
                    <div style="background:var(--surface);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">Reingewinn</div>
                        <div style="font-weight:700;">${fmt(reingewinn)}</div>
                    </div>
                    <div style="background:var(--surface);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">- AHV/IV/EO</div>
                        <div style="font-weight:700;color:var(--danger);">- ${fmt(ahvAbzug)}</div>
                    </div>
                    <div style="background:var(--surface);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">- Steuern (geschätzt)</div>
                        <div style="font-weight:700;color:var(--danger);">- ${fmt(gesamtSteuer)}</div>
                    </div>
                    <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:10px 14px;">
                        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">Netto nach Abzügen</div>
                        <div style="font-weight:700;color:var(--success);">${fmt(Math.max(0, reingewinn - ahvAbzug - gesamtSteuer))}</div>
                    </div>
                </div>
            </div>

            <div style="padding:10px 14px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;font-size:11px;color:var(--text-muted);">
                <i class="ti ti-alert-triangle" style="color:var(--danger);"></i> <strong>Wichtig:</strong> Diese Berechnung ist eine grobe Schätzung und dient nur zur Orientierung. Die Kantons- und Gemeindesteuer variiert stark je nach Wohngemeinde. Abzüge für Krankenkasse, Säule 3a, BVG-Einkauf etc. sind nicht berücksichtigt. Bitte konsultieren Sie einen Steuerberater oder nutzen Sie die offizielle Steuerberechnung Ihres Kantons.
            </div>
        `;
    },

    // ── Währungsumrechner (Hilfstool) ───────────────────────────────────────
    renderConverter() {
        const settings = Store.getSettings();
        const rate = parseFloat(settings.chfRate) || 1.05;
        return `
            <div class="card" style="padding:16px;margin-top:16px;">
                <div style="font-weight:600;margin-bottom:12px;font-size:14px;"><i class="ti ti-arrows-exchange" style="margin-right:6px;"></i>Währungsumrechner</div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">EUR-Betrag</label>
                        <input type="number" class="form-input" id="convEur" placeholder="0.00" data-action-input="ch-conv-eur" data-args='[${rate}]' >
                    </div>
                    <div class="form-group">
                        <label class="form-label">CHF-Betrag</label>
                        <input type="number" class="form-input" id="convChf" placeholder="0.00" data-action-input="ch-conv-chf" data-args='[${rate}]' >
                    </div>
                    <div class="form-group">
                        <label class="form-label">Kurs (CHF/EUR)</label>
                        <input type="number" class="form-input" id="convRate" value="${rate}" step="0.001" data-action-input="ch-conv-rate">
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">Kurs in Einstellungen ändern um Standard zu setzen.</div>
            </div>
        `;
    },

    _onConvEur(eur, rate) {
        const el = document.getElementById('convChf');
        if (el) el.value = ((parseFloat(eur)||0) * rate).toFixed(2);
    },
    _onConvChf(chf, rate) {
        const el = document.getElementById('convEur');
        if (el) el.value = ((parseFloat(chf)||0) / rate).toFixed(2);
    },
    _onConvRate(rate) {
        const eur = parseFloat(document.getElementById('convEur')?.value) || 0;
        const el = document.getElementById('convChf');
        if (el) el.value = (eur * (parseFloat(rate)||1)).toFixed(2);
    },
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'ch-set-tab':       function (tab) { Schweiz._setTab(tab); },
    'ch-period':        function (e, el) { Schweiz._onPeriodChange(el.value); },
    'ch-year':          function (e, el) { Schweiz._year = +el.value; Schweiz._rerender(); },
    'ch-month':         function (e, el) { Schweiz._month = +el.value; Schweiz._rerender(); },
    'ch-quarter':       function (e, el) { Schweiz._month = +el.value * 3; Schweiz._rerender(); },
    'ch-export-pdf':    function () { Schweiz._exportEAR_PDF(); },
    'ch-export-csv':    function () { Schweiz._exportEAR_CSV(); },
    'ch-mwst-methode':  function (m) { Schweiz._mwstMethode = m; Schweiz._rerender(); },
    'ch-saldo-branche': function (e, el) { Schweiz._saldoBranche = el.value; Schweiz._rerender(); },
    'ch-saldo-satz':    function (e, el) { Schweiz._saldoSatzManuell = parseFloat(el.value) || 0; Schweiz._rerender(); },
    'ch-kanton':        function (e, el) { Schweiz._kanton = el.value; Schweiz._gemeinde = ''; Schweiz._rerender(); },
    'ch-gemeinde':      function (e, el) { Schweiz._gemeinde = el.value; Schweiz._rerender(); },
    'ch-zivilstand':    function (e, el) { Schweiz._zivilstand = el.value; Schweiz._rerender(); },
    'ch-conv-eur':      function (rate, e, el) { Schweiz._onConvEur(el.value, rate); },
    'ch-conv-chf':      function (rate, e, el) { Schweiz._onConvChf(el.value, rate); },
    'ch-conv-rate':     function (e, el) { Schweiz._onConvRate(el.value); }
});
