// Pflichtwechsel KU → Regel ab dem Grenzumsatz stempelt die betroffenen Vorgänge um
// (Steuerreview 2026-10-14 / Audit 2026-10-18, R-TAX-01).
//   node test/test-ku-wechsel-stempel.js
// Soll: §19 Abs. 1 UStG n. F. — die Befreiung entfällt ab dem Umsatz, mit dem die Grenze
// überschritten wird; dieser Umsatz ist bereits steuerpflichtig (Gründer 2026: 25.000 €).
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

const mem = {};
const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const c = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js', 'js/kleinunternehmer.js'], { localStorage, Utils: { showToast() {} } });
const S = c.Store;
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

S.saveSettings({ ustMode: 'klein', taetigkeitsbeginn: '2026-01-01' });
S.saveSale({ datum: '2026-02-01', verkaufspreis: 24900, steuersatz: 19 });
const grenz = S.saveSale({ datum: '2026-03-01', verkaufspreis: 119, steuersatz: 19 });
S.saveSale({ datum: '2026-03-01', verkaufspreis: 50, steuersatz: 19, _invoiceId: 'rech1', ustBehandlung: 'klein' });
assert.strictEqual(S.getSales().find(s => s.id === grenz.id).ustBehandlung, 'klein');

const r = c.Kleinunternehmer.pruefe({ year: 2026, grenzen: { vj: 25000, lfd: 100000 }, taetigkeitsbeginn: '2026-01-01',
    vorjahresUmsatz: 0, umsaetze: c.Kleinunternehmer.entgelte(2026) });
assert.strictEqual(r.status, 'sofort'); assert.strictEqual(r.ab, '2026-03-01');
const st = S.getSettings(); st.ustMode = 'regel'; st._ustModeAb = r.ab; S.saveSettings(st);

const nach = S.getSales();
assert.strictEqual(nach.find(s => s.id === grenz.id).ustBehandlung, 'regel', 'Grenzumsatz blieb Kleinunternehmer');
assert.strictEqual(nach.find(s => s.datum === '2026-02-01').ustBehandlung, 'klein', 'Umsatz vor dem Wechsel geändert');
assert.strictEqual(nach.find(s => s._invoiceId === 'rech1').ustBehandlung, 'klein', 'Rechnungszahlung darf nur über die Rechnung geändert werden');
assert.ok(S.getAuditLog().some(e => /Moduswechsel ab 2026-03-01/.test(e.details || '')), 'Umstempeln nicht protokolliert');
ok('R-TAX-01: Grenzumsatz vom 01.03. wird regelbesteuert, früherer KU-Umsatz und Rechnungszahlung bleiben');
console.log('\n' + n + '/1 KU-Wechsel-Tests bestanden');
