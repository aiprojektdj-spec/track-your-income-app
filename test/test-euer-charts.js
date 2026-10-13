// EÜR-Diagramme werden vor dem Neuanlegen zerstört:  node test/test-euer-charts.js
// =============================================================================
// Anlass: Alarm vom 2026-10-09, 1x "TypeError: Cannot read properties of undefined (reading
// 'toString')" in js/vendor/apexcharts.min.js. Ursache nicht sicher belegbar (minifiziert,
// kein Stack), aber js/euer.js legte Monatsbalken und Ausgaben-Donut bei jedem init() neu an,
// ohne die alten zu zerstören — die hingen weiter an Resize-Ereignissen. js/dashboard.js
// räumte schon immer auf. Geprüft wird mit einer ApexCharts-Attrappe:
//   1. erster Aufbau: zwei Diagramme, nichts zerstört
//   2. zweiter Aufbau: die beiden alten sind zerstört, zwei neue laufen
//   3. Wechsel auf die USt-Voranmeldung: alles zerstört, nichts Neues
//   4. ein destroy(), das wirft, hält den Aufbau nicht auf
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'euer.js'), 'utf8');

const alle = [];
let destroyWirft = false;
class ApexCharts {
    constructor(el, opts) { this.el = el; this.opts = opts; this.destroyed = false; this.rendered = false; alle.push(this); }
    render() { this.rendered = true; }
    destroy() { this.destroyed = true; if (destroyWirft) throw new Error('Element schon weg'); }
}
const els = { euerMonthChart: { id: 'euerMonthChart' }, euerDonutChart: { id: 'euerDonutChart', innerHTML: '' } };
const ctx = {
    window: {},
    ApexCharts,
    UstVoranmeldung: { init() {} },
    Store: { autoSyncInvoices() {} },
    document: {
        documentElement: { getAttribute: () => 'dark' },
        getElementById: (id) => els[id] || null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    },
    addEventListener: () => {},
    console
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(SRC + '\n;this.Euer = Euer;', ctx);
const Euer = ctx.Euer;

Euer._lastRenderData = {
    monthlyData: Array.from({ length: 12 }, (_, i) => ({ ein: i * 10, aus: i })),
    donutLabels: ['Ware', 'Versand'], donutValues: [100, 20]
};
function initOhneRest() { Euer.init(); }

let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };

initOhneRest();
assert.strictEqual(alle.length, 2, 'Monatsbalken und Donut angelegt');
assert.ok(alle.every(c => c.rendered && !c.destroyed));
ok('erster Aufbau: zwei Diagramme, nichts zerstört');

initOhneRest();
assert.strictEqual(alle.length, 4);
assert.ok(alle[0].destroyed && alle[1].destroyed, 'alte Diagramme zerstört');
assert.ok(!alle[2].destroyed && !alle[3].destroyed, 'neue laufen');
assert.strictEqual(Euer._charts.length, 2);
ok('zweiter Aufbau: alte zerstört, zwei neue');

Euer._view = 'uva';
initOhneRest();
assert.ok(alle[2].destroyed && alle[3].destroyed, 'beim Wechsel zur UVA zerstört');
assert.strictEqual(alle.length, 4, 'keine neuen Diagramme in der UVA');
assert.strictEqual(Euer._charts.length, 0);
ok('Wechsel auf die USt-Voranmeldung räumt auf');

Euer._view = 'report';
initOhneRest();
destroyWirft = true;
initOhneRest();
assert.strictEqual(alle.length, 8, 'Aufbau läuft trotz werfendem destroy()');
assert.strictEqual(Euer._charts.length, 2);
ok('werfendes destroy() hält den Aufbau nicht auf');

console.log('\n' + pass + '/4 EÜR-Diagramm-Tests bestanden ✅');
