// UI-Lab — Terminologie-Profile und Design-Packs des Prototyps.
//
// Lag bis zum 2026-09-09 als Inline-Block in ui-lab.html. Ausgelagert, damit die Seite
// dieselbe CSP bekommen kann wie der Rest der App (script-src 'self', ohne 'unsafe-inline')
// — sie war die einzige ausgelieferte Seite ganz ohne CSP (Fund B1,
// plan/funde-vollaudit-2026-09-09.md). Inhalt unveraendert uebernommen.
//
// Bleibt bewusst ohne defer und laeuft am Ende des Body: der Code greift direkt aufs DOM zu,
// ohne auf DOMContentLoaded zu warten.

/* ════════════════════════════════════════════════════════════
   (1) TERMINOLOGIE-PROFILE
   Jeder Schlüssel mappt auf data-term="…" Elemente im DOM.
   Live-Integration analog zu I18n.applyAll(): Terminology.apply().
   ════════════════════════════════════════════════════════════ */
var TERM_PROFILES = {
    klein: {
        'report.tab':      'Einnahmen',
        'report.heading':  'Einnahmen & Ausgaben',
        'report.sub':      '§ 4 Abs. 3 EStG · Kleinunternehmer (§ 19 UStG)',
        'report.export':   'Übersicht exportieren',
        'kpi.revenue':     'Einnahmen',
        'kpi.expenses':    'Ausgaben',
        'kpi.profit':      'Gewinn',
        'bookings.heading':'Buchungen',
        'col.desc':        'Beschreibung',
        'col.amount':      'Betrag',
        '_showUst':        false,
        'tax.note':        '<b>Hinweis:</b> Als Kleinunternehmer nach § 19 UStG wird keine Umsatzsteuer ausgewiesen — Beträge sind brutto = netto.'
    },
    euer: {
        'report.tab':      'EÜR',
        'report.heading':  'Einnahmen-Überschuss-Rechnung',
        'report.sub':      '§ 4 Abs. 3 EStG · Gewinnermittlung',
        'report.export':   'EÜR exportieren',
        'kpi.revenue':     'Betriebseinnahmen',
        'kpi.expenses':    'Betriebsausgaben',
        'kpi.profit':      'Überschuss / Gewinn',
        'bookings.heading':'Buchungen',
        'col.desc':        'Beschreibung',
        'col.ust':         'USt 19%',
        'col.amount':      'Betrag',
        '_showUst':        true,
        'tax.note':        '<b>Hinweis:</b> Umsatzsteuer wird ausgewiesen (Regelbesteuerung). Vorsteuerabzug möglich.'
    },
    bilanz: {
        'report.tab':      'GuV',
        'report.heading':  'Gewinn- und Verlustrechnung',
        'report.sub':      '§ 242 HGB · doppelte Buchführung · GuV + Bilanz',
        'report.export':   'GuV + Bilanz exportieren',
        'kpi.revenue':     'Umsatzerlöse',
        'kpi.expenses':    'Aufwendungen',
        'kpi.profit':      'Jahresüberschuss',
        'bookings.heading':'Buchungssätze (Soll / Haben)',
        'col.desc':        'Buchungstext / Konto',
        'col.ust':         'USt 19%',
        'col.amount':      'Betrag',
        '_showUst':        true,
        'tax.note':        '<b>Hinweis:</b> Doppelte Buchführung nach HGB — Erträge und Aufwendungen periodengerecht. Umsatzsteuer wird ausgewiesen.'
    }
};

/* ════════════════════════════════════════════════════════════
   (2) DESIGN-PACKS
   Setzen exakt die CSS-Variablen aus css/style.css.
   ════════════════════════════════════════════════════════════ */
var DESIGN_PACKS = {
    emerald: {
        label:'Emerald', dark:true, chips:['#10b981','#161a18','#eef2f0'],
        vars:{
            '--bg-primary':'#0a0c0b','--bg-secondary':'#101312','--bg-card':'#161a18','--bg-elevated':'#1c211f',
            '--accent':'#10b981','--accent-hover':'#0da271','--accent-light':'#34d399','--accent-glow':'rgba(16,185,129,.10)','--accent-text':'#ffffff',
            '--text-primary':'#eef2f0','--text-secondary':'#9ba8a1','--text-muted':'#71807a',
            '--border':'#1d2421','--border-light':'#2a332e','--border-strong':'#3a453f'
        }
    },
    indigo: {
        label:'Indigo', dark:true, chips:['#6366f1','#17161f','#eceaf5'],
        vars:{
            '--bg-primary':'#0a0a0f','--bg-secondary':'#111016','--bg-card':'#17161f','--bg-elevated':'#1f1d2b',
            '--accent':'#6366f1','--accent-hover':'#4f46e5','--accent-light':'#818cf8','--accent-glow':'rgba(99,102,241,.12)','--accent-text':'#ffffff',
            '--text-primary':'#eceaf5','--text-secondary':'#a3a0b5','--text-muted':'#6f6c82',
            '--border':'#221f2e','--border-light':'#2e2a3d','--border-strong':'#3c3750'
        }
    },
    slate: {
        label:'Slate', dark:true, chips:['#64748b','#181c20','#e5e9ec'],
        vars:{
            '--bg-primary':'#0b0d0f','--bg-secondary':'#121518','--bg-card':'#181c20','--bg-elevated':'#21262b',
            '--accent':'#64748b','--accent-hover':'#475569','--accent-light':'#94a3b8','--accent-glow':'rgba(148,163,184,.12)','--accent-text':'#ffffff',
            '--text-primary':'#e5e9ec','--text-secondary':'#9aa4ad','--text-muted':'#6b757d',
            '--border':'#1f242a','--border-light':'#2b323a','--border-strong':'#3a434c'
        }
    },
    sand: {
        label:'Sand', dark:false, chips:['#c2683b','#ffffff','#2b2620'],
        vars:{
            '--bg-primary':'#f6f5f1','--bg-secondary':'#fdfcfa','--bg-card':'#ffffff','--bg-elevated':'#efece4',
            '--accent':'#c2683b','--accent-hover':'#a8542c','--accent-light':'#d98a5e','--accent-glow':'rgba(194,104,59,.12)','--accent-text':'#ffffff',
            '--text-primary':'#2b2620','--text-secondary':'#6b6354','--text-muted':'#968c79',
            '--border':'#e6e1d6','--border-light':'#d8d2c4','--border-strong':'#c4bba8',
            '--shadow':'0 1px 2px rgba(80,60,30,.06),0 4px 16px -8px rgba(80,60,30,.12)',
            '--shadow-lg':'0 4px 12px rgba(80,60,30,.08),0 24px 64px -16px rgba(80,60,30,.18)'
        }
    },
    contrast: {
        label:'Kontrast', dark:true, chips:['#00e676','#000000','#ffffff'],
        vars:{
            '--bg-primary':'#000000','--bg-secondary':'#0a0a0a','--bg-card':'#111111','--bg-elevated':'#1a1a1a',
            '--accent':'#00e676','--accent-hover':'#00c853','--accent-light':'#69f0ae','--accent-glow':'rgba(0,230,118,.18)','--accent-text':'#000000',
            '--text-primary':'#ffffff','--text-secondary':'#e0e0e0','--text-muted':'#b0b0b0',
            '--border':'#3a3a3a','--border-light':'#4d4d4d','--border-strong':'#ffffff'
        }
    }
};

/* ── Persistenz (gleiche Namens-Konvention wie Live-App) ── */
var LS_PROFILE = 'stackr_term_profile';
var LS_PACK    = 'stackr_design_pack';
function lsGet(k,d){try{return localStorage.getItem(k)||d;}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}

/* ── Terminologie anwenden ── */
function applyProfile(key){
    var p = TERM_PROFILES[key] || TERM_PROFILES.euer;
    document.documentElement.setAttribute('data-profile', key);

    document.querySelectorAll('[data-term]').forEach(function(el){
        var t = p[el.getAttribute('data-term')];
        if (t !== undefined) el.textContent = t;
    });
    document.querySelectorAll('[data-term-html]').forEach(function(el){
        var t = p[el.getAttribute('data-term-html')];
        if (t !== undefined) el.innerHTML = t;
    });

    // Konditionale Spalten (USt) je Profil
    var showUst = p['_showUst'] !== false;
    document.querySelectorAll('.col-ust').forEach(function(el){
        el.classList.toggle('hide', !showUst);
    });

    // Aktiven Button markieren
    document.querySelectorAll('#profileSeg .seg-btn').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-profile') === key);
    });
    lsSet(LS_PROFILE, key);
}

/* ── Design-Pack anwenden ── */
function applyPack(key){
    var pack = DESIGN_PACKS[key] || DESIGN_PACKS.emerald;
    var root = document.documentElement;
    Object.keys(pack.vars).forEach(function(v){ root.style.setProperty(v, pack.vars[v]); });
    root.setAttribute('data-pack', key);
    document.querySelectorAll('#packSwatches .swatch').forEach(function(s){
        s.classList.toggle('active', s.getAttribute('data-pack') === key);
    });
    lsSet(LS_PACK, key);
}

/* ── Swatches rendern ── */
(function renderSwatches(){
    var box = document.getElementById('packSwatches');
    Object.keys(DESIGN_PACKS).forEach(function(key){
        var p = DESIGN_PACKS[key];
        var el = document.createElement('button');
        el.className = 'swatch'; el.type = 'button';
        el.setAttribute('data-pack', key);
        el.innerHTML =
            '<div class="chip-row">' +
                '<span class="chip" style="background:'+p.chips[0]+'"></span>' +
                '<span class="chip" style="background:'+p.chips[1]+'"></span>' +
                '<span class="chip" style="background:'+p.chips[2]+'"></span>' +
            '</div><div class="sw-name">'+p.label+'</div>';
        el.addEventListener('click', function(){ applyPack(key); });
        box.appendChild(el);
    });
})();

/* ── Profil-Buttons verdrahten ── */
document.querySelectorAll('#profileSeg .seg-btn').forEach(function(b){
    b.addEventListener('click', function(){ applyProfile(b.getAttribute('data-profile')); });
});

/* ── Init aus localStorage ── */
applyPack(lsGet(LS_PACK, 'emerald'));
applyProfile(lsGet(LS_PROFILE, 'euer'));
