// Demo-Modus (demo.html): Der Arbeitsspeicher-Ersatz darf den echten localStorage nie lesen
// oder schreiben — auf derselben Domain liegt dort die echte Buchhaltung angemeldeter Nutzer.
// Dazu: Musterdaten landen vollstaendig, die Grenze von 25 neuen Eintraegen greift, Bearbeiten
// bleibt erlaubt. Laedt die echten Module (store.js, companies.js, utils.js ...) in einen vm-Kontext.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n' + (e && e.stack || e)); process.exitCode = 1; }
}

// "Echter" Browser-Speicher: zaehlt jeden Zugriff.
function spionSpeicher() {
    const daten = {};
    const zugriffe = [];
    return {
        zugriffe,
        speicher: {
            getItem(k) { zugriffe.push('get:' + k); return k in daten ? daten[k] : null; },
            setItem(k, v) { zugriffe.push('set:' + k); daten[k] = String(v); },
            removeItem(k) { zugriffe.push('remove:' + k); delete daten[k]; },
            key() { zugriffe.push('key'); return null; },
            get length() { zugriffe.push('length'); return 0; }
        }
    };
}

function kontext(opts) {
    const spion = spionSpeicher();
    const body = { firstChild: null, insertBefore() {}, appendChild() {} };
    const ctx = {
        console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
        Math, Date, JSON, Intl, Set, Map, Promise, Proxy, Object, Array, String, Number, Error,
        URLSearchParams, setTimeout() {}, clearTimeout() {}, requestAnimationFrame() {},
        location: { search: (opts && opts.search) || '', pathname: '/demo.html', hash: '' },
        history: { state: null, replaceState(s, t, url) { ctx.__ersetzteUrl = url; } },
        navigator: {},
        HTMLAnchorElement: function () {},
        MutationObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
        document: {
            readyState: 'complete',
            body,
            documentElement: { classList: { add() {} }, set innerHTML(v) { ctx.__gestoppt = v; } },
            addEventListener() {},
            createElement() { return { style: {}, setAttribute() {}, appendChild() {}, set innerHTML(v) {}, className: '' }; },
            getElementById() { return null; },
            querySelectorAll() { return []; },
            querySelector() { return null; }
        },
        addEventListener() {}
    };
    ctx.HTMLAnchorElement.prototype.click = function () {};
    ctx.window = ctx;
    ctx.top = ctx;
    vm.createContext(ctx);
    // Im Browser ist localStorage eine ersetzbare Eigenschaft von window.
    Object.defineProperty(ctx, 'localStorage', { get() { return spion.speicher; }, configurable: !(opts && opts.gesperrt) });
    Object.defineProperty(ctx, 'sessionStorage', { get() { return spion.speicher; }, configurable: true });
    Object.defineProperty(ctx, 'indexedDB', { get() { return { open() { spion.zugriffe.push('idb'); } }; }, configurable: true });
    return { ctx, spion };
}

function lade(ctx, datei) {
    const src = fs.readFileSync(path.join(ROOT, datei), 'utf8')
        .replace(/^(?:const|let) ([A-Za-z_$][\w$]*)\s*=/gm, 'var $1 =');
    vm.runInContext(src, ctx, { filename: datei });
}

const KERN = ['js/companies.js', 'js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js',
    'js/user-plan.js', 'js/utils.js'];

test('Speicher-Ersatz: echter localStorage/IndexedDB bleiben unberuehrt', () => {
    const { ctx, spion } = kontext();
    lade(ctx, 'js/demo-speicher.js');
    assert.strictEqual(ctx.__demoSpeicherAktiv, true);
    assert.strictEqual(ctx.indexedDB, undefined);
    ctx.localStorage.setItem('reselling_sales', '[1]');
    assert.strictEqual(ctx.localStorage.getItem('reselling_sales'), '[1]');
    assert.deepStrictEqual(Object.keys(ctx.localStorage), ['reselling_sales']);
    assert.strictEqual(ctx.localStorage.length, 1);
    ctx.localStorage.removeItem('reselling_sales');
    assert.strictEqual(ctx.localStorage.getItem('reselling_sales'), null);
    assert.deepStrictEqual(spion.zugriffe, []);
});

test('Speicher-Ersatz scheitert laut, wenn localStorage nicht ersetzbar ist', () => {
    const { ctx } = kontext({ gesperrt: true });
    assert.throws(() => lade(ctx, 'js/demo-speicher.js'), /nicht isoliert/);
    assert.ok(ctx.__gestoppt, 'Seite muss geleert werden');
    assert.notStrictEqual(ctx.__demoSpeicherAktiv, true);
});

test('Demo-Modus ohne isolierten Speicher schreibt keine Musterdaten', () => {
    const { ctx, spion } = kontext();
    KERN.forEach(f => lade(ctx, f));
    lade(ctx, 'js/demo-modus.js');
    assert.strictEqual(ctx.DemoModus, undefined);
    assert.ok(!spion.zugriffe.some(z => z.startsWith('set:')), 'kein Schreibzugriff erlaubt: ' + spion.zugriffe.filter(z => z.startsWith('set:')));
});

test('Musterdaten, Grenze 25, Bearbeiten erlaubt, nichts im echten Speicher', () => {
    const { ctx, spion } = kontext({ search: '?page=euer' });
    lade(ctx, 'js/demo-speicher.js');
    KERN.forEach(f => lade(ctx, f));
    lade(ctx, 'js/demo-modus.js');
    const Store = ctx.Store;

    assert.strictEqual(ctx.CompanyManager.getAll().length, 1);
    assert.strictEqual(Store.getPurchases().length, 18);
    assert.strictEqual(Store.getSales().length, 13);
    assert.strictEqual(Store.getExpenses().length, 4);
    assert.strictEqual(Store.getSettings().onboardingDone, true);
    assert.strictEqual(Store.getRechUnternehmen().firmenname, 'Vintage Kiste (Muster)');
    assert.strictEqual(ctx.Utils.agbAccepted(), true);
    assert.strictEqual(ctx.DemoModus.frei(), 25);
    assert.strictEqual(ctx.__ersetzteUrl, '/demo.html', 'gesperrte Startseite muss aus der Adresse fliegen');

    for (let i = 0; i < 30; i++) Store.savePurchase({ datum: '2026-10-18', marke: 'T', artikeltyp: 'T', einkaufspreis: 1 });
    assert.strictEqual(Store.getPurchases().length, 18 + 25);
    assert.strictEqual(ctx.DemoModus.frei(), 0);
    Store.saveExpense({ datum: '2026-10-18', kategorie: 'X', beschreibung: 'X', betrag: 1 });
    assert.strictEqual(Store.getExpenses().length, 4);

    const p = Store.getPurchases()[0];
    p.beschreibung = 'bearbeitet';
    Store.savePurchase(p);
    assert.strictEqual(Store.getPurchases()[0].beschreibung, 'bearbeitet');

    assert.deepStrictEqual(spion.zugriffe, []);
});

console.log(pass + '/4 Demo-Modus-Faelle bestanden');
