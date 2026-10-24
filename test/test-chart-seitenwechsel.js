// Diagramme beim Seitenwechsel aufräumen:  node test/test-chart-seitenwechsel.js
// =============================================================================
// Anlass: Alarm vom 2026-10-16, 1x "TypeError: Cannot read properties of null (reading
// 'getAttribute')" in js/vendor/apexcharts.min.js. Dashboard und EÜR zerstörten ihre
// ApexCharts-Diagramme nur beim eigenen Neuaufbau, nicht beim Wechsel auf eine andere Seite —
// die Diagramme hingen dann weiter an Resize-Ereignissen, obwohl ihr Element weg war.
// App.navigate ruft für Unter-Apps schon runLeaveHook auf; Dashboard und Euer hängen sich jetzt
// dort ein. Geprüft wird:
//   1. Dashboard.runLeaveHook zerstört alle drei Diagramme, auch wenn eines beim destroy() wirft
//   2. Euer.runLeaveHook zerstört Monatsbalken und Donut
//   3. App.navigate ruft runLeaveHook für Dashboard und Euer auf (Quelltext-Prüfung)
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');

const ROOT = path.join(__dirname, '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function lade(datei, name, extra) {
    const ctx = Object.assign({ console, document: { getElementById: () => null } }, extra || {});
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(lies(datei) + '\n;this.' + name + ' = ' + name + ';', ctx);
    return ctx[name];
}
function attrappe(wirft) {
    return { destroyed: false, destroy() { this.destroyed = true; if (wirft) throw new Error('Element schon weg'); } };
}

let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };

// 1. Dashboard
const Dashboard = lade('js/dashboard.js', 'Dashboard');
const a = attrappe(false), b = attrappe(true), c = attrappe(false);
Dashboard._chart = a; Dashboard._chartJahres = b; Dashboard._chartGewinn = c;
Dashboard.runLeaveHook();
assert.ok(a.destroyed && b.destroyed && c.destroyed, 'alle drei zerstört');
assert.strictEqual(Dashboard._chart, null);
assert.strictEqual(Dashboard._chartJahres, null, 'auch nach werfendem destroy() geleert');
assert.strictEqual(Dashboard._chartGewinn, null);
Dashboard.runLeaveHook();   // zweiter Aufruf ohne Diagramme ist folgenlos
ok('Dashboard.runLeaveHook zerstört alle Diagramme, werfendes destroy() stört nicht');

// 2. Euer
const Euer = lade('js/euer.js', 'Euer');
const m = attrappe(false), d = attrappe(false);
Euer._charts = [m, d];
Euer.runLeaveHook();
assert.ok(m.destroyed && d.destroyed);
assert.strictEqual(Euer._charts.length, 0);
ok('Euer.runLeaveHook zerstört Monatsbalken und Donut');

// 3. App.navigate hängt beide ein
const app = lies('js/app.js');
const nav = app.slice(app.indexOf('    navigate(page) {'));
const block = nav.slice(0, nav.indexOf('runLeaveHook()') + 200);
for (const name of ['RechApp', 'EBApp', 'Dashboard', 'Euer']) {
    assert.ok(new RegExp("typeof " + name + "\\s+!== 'undefined' \\? " + name).test(block), name + ' fehlt in der Aufräumliste');
}
ok('App.navigate ruft runLeaveHook für Dashboard und Euer auf');

console.log('\n' + pass + '/3 Seitenwechsel-Tests bestanden ✅');
