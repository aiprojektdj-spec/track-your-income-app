// Umsatz nach Land (Kundenwunsch 2026-10-08): Verkäufe tragen optional `land` (ISO-Code),
// die Statistiken summieren Artikelpreis + Käufer-Versand je Land — derselbe Umsatzbegriff
// wie die Plattform-Analyse daneben. Verkäufe ohne Angabe landen in "Ohne Angabe", am Ende.
'use strict';
const fs = require('fs');
const vm = require('vm');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

const sections = {};
const ctx = {
    console, Intl,
    window: {}, localStorage: { getItem: () => null, setItem() {} },
    document: {
        getElementById: id => (sections[id] = sections[id] || { innerHTML: '' }),
        addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
        body: { appendChild() {} }
    },
    MutationObserver: function () { this.observe = () => {}; }
};
vm.createContext(ctx);
try {
    vm.runInContext(fs.readFileSync(__dirname + '/../js/utils.js', 'utf8') + '\nthis.Utils = Utils;', ctx);
    vm.runInContext(fs.readFileSync(__dirname + '/../js/statistiken.js', 'utf8') + '\nthis.Statistiken = Statistiken;', ctx);
} catch (e) {
    console.error('✗ FAIL Module laden: ' + e.message);
    process.exit(1);
}
const { Utils, Statistiken } = ctx;

check('Ländername deutsch', Utils.landName('AT') === 'Österreich');
check('leeres Land = Ohne Angabe', Utils.landName('') === 'Ohne Angabe');
const opts = Utils.landOptionsHtml('FR');
check('Optionsliste markiert Auswahl', /<option value="FR" selected>/.test(opts));
check('Optionsliste hat Leer-Option', opts.startsWith('<option value="">'));
check('27 EU-Länder + 4 Nicht-EU', (opts.match(/<option value="[A-Z]{2}"/g) || []).length === 31);

try {
    Statistiken._renderLandAnalyse([
        { land: 'DE', verkaufspreis: 20, versandkostenKaeufer: 5 },
        { land: 'FR', verkaufspreis: 50, versandkostenKaeufer: 0 },
        { land: 'DE', verkaufspreis: '10', versandkostenKaeufer: '' },
        { verkaufspreis: 100 }
    ]);
    const html = sections.landAnalyseSection.innerHTML;
    const zeilen = html.split('<tr>').slice(2);
    check('drei Zeilen (DE, FR, ohne Angabe)', zeilen.length === 3);
    check('FR vor DE (50 > 35)', zeilen[0].includes('Frankreich') && zeilen[1].includes('Deutschland'));
    check('DE inkl. Käufer-Versand = 35', zeilen[1].includes(Utils.formatCurrency(35)));
    check('Ohne Angabe am Ende trotz höchstem Umsatz', zeilen[2].includes('Ohne Angabe'));
    check('Anteil FR 50/185 = 27,0 %', zeilen[0].includes('27,0 %'));
} catch (e) {
    total++; console.error('✗ FAIL Auswertung: ' + e.message); process.exitCode = 1;
}

console.log(`\n${pass}/${total} bestanden`);
