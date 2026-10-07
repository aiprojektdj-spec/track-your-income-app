// Anzeigeadapter: Datenidentität, Vorzeichen, Status, Filter und Originale.
// Keine Browserdaten, keine Schreibmethoden und keine neuen Abhängigkeiten.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const data = {
    purchases: [{ id: 'same', datum: '2026-10-01', einkaufspreis: 12.5, anzahl: 2, beschreibung: '<img src=x onerror=alert(1)>', locked: true }],
    sales: [{ id: 'same', datum: '2026-10-03', verkaufspreis: 90, _invoiceId: 'invoice-1', beschreibung: 'Rechnungszahlung' }, { id: 'cancelled', datum: '2026-09-30', verkaufspreis: 44, storniert: true }],
    expenses: [{ id: 'expense-1', datum: '2026-10-02', betrag: 18.5, belegNr: 'RE-123', beschreibung: 'Porto', lieferant: 'Post' }],
    private: [{ id: 'p1', datum: '2026-10-04', betrag: 200, typ: 'einlage' }, { id: 'p2', datum: '2026-10-05', betrag: 50, typ: 'entnahme' }, { id: 'p3', datum: '2026-10-06', betrag: 8, typ: 'unbekannt' }]
};
const snapshot = JSON.stringify(data);
Object.values(data).forEach(list => { list.forEach(Object.freeze); Object.freeze(list); });
let readonly = false, modal = '', preview = '', subpage = '', createPrivate = 0;
const context = {
    console, confirm: () => true,
    document: { addEventListener() {}, querySelectorAll() { return []; }, getElementById() { return null; } },
    Store: {
        getPurchases(all) { assert.equal(all, true); return data.purchases; },
        getSales(all) { assert.equal(all, true); return data.sales; },
        getExpenses(all) { assert.equal(all, true); return data.expenses; },
        getPrivatbuchungen() { return data.private; },
        isLocked(record) { return !!record.locked; },
        _isReadonlyCompany() { return readonly; },
        getRechInvoices() { throw Error('Rechnungen dürfen nicht zusätzlich summiert werden'); },
        set() { throw Error('Der Anzeigeadapter darf nicht speichern'); }
    },
    Utils: { escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), formatDate: v => v, formatCurrency: v => `${v} EUR` },
    App: { pages: {}, currentPage: 'buchungen', _formDirty: false, showModal(title, body, footer) { modal = title + body + footer; }, closeModal() {}, navigate(page) { this.currentPage = page; } },
    Buchungen: { _activeTab: 'alle', _filters: {}, render() { return 'legacy'; }, init() {} },
    Rechtsform: { getConfig() { return { privatbuchungen: true }; } },
    Ausgaben: {}, Privatbuchungen: { _openForm() { createPrivate++; } },
    RechApp: { navigate(page) { subpage = page; } }, Dokumente: { showPreview(id) { preview = id; } }
};
context.window = context;
vm.createContext(context);
let source = fs.readFileSync(path.join(__dirname, '..', 'js/redesign-bookings.js'), 'utf8');
source = source.replace('window.RedesignBookings = {', 'window.BookingTest = { filtered, filters, create, start, detail, original, changeMode, load: function () { currentRecords=rows(); } }; window.RedesignBookings = {');
vm.runInContext(source, context);
const records = context.RedesignBookings.rows();
assert.equal(records.length, 7);
assert.equal(new Set(records.map(row => row.key)).size, 7);
assert.equal(records.filter(row => row.record._invoiceId).length, 1);
assert.equal(records.find(row => row.kind === 'purchase').amount, -25);
assert.equal(records.find(row => row.kind === 'expense').amount, -18.5);
assert.equal(records.find(row => row.key === 'private:p1').amount, 200);
assert.equal(records.find(row => row.key === 'private:p2').amount, -50);
assert.equal(records.find(row => row.key === 'private:p3').amount, null);
assert.equal(records.find(row => row.key === 'purchase:same').state, 'Festgeschrieben');
assert.equal(records.find(row => row.key === 'sale:cancelled').state, 'Storniert');
assert.equal(JSON.stringify(data), snapshot);
console.log('OK alle vier Quellen, keine Rechnungs-Doppelzählung, stabile IDs, Vorzeichen und unveränderte Originaldaten');
console.log('OK unbekannter Privat-Typ bleibt ungeklärt; Festschreibung und Storno sind sichtbar');

const test = context.BookingTest;
test.filters.kind = 'private';
assert.equal(test.filtered(records).length, 3);
test.filters.kind = '';
test.filters.search = 're-123';
assert.equal(test.filtered(records)[0].key, 'expense:expense-1');
test.filters.search = '';
test.filters.from = '2026-10-02'; test.filters.to = '2026-10-03';
assert.equal(test.filtered(records).length, 2);
test.filters.from = test.filters.to = ''; test.filters.status = 'Storniert';
assert.equal(test.filtered(records)[0].key, 'sale:cancelled');
console.log('OK Typ-, Zeitraum-, Status- und Belegnummernfilter');

test.load();
test.detail('purchase:same');
assert.ok(modal.includes('&lt;img'));
assert.ok(!modal.includes('<img src=x'));
test.original('sale:same');
assert.equal(context.App.currentPage, 'rechnungen');
context.RedesignBookings.afterRender('rechnungen');
assert.equal(subpage, 'dokumente');
assert.equal(preview, 'invoice-1');
console.log('OK Details escapen Nutzerdaten; Rechnungszahlung führt zum ursprünglichen Dokument');

context.App._formDirty = true;
context.confirm = () => false;
assert.equal(test.changeMode('legacy', 'einkauf'), false);
assert.equal(context.Buchungen._activeTab, 'alle');
assert.equal(context.App._formDirty, true);
context.App._formDirty = false;
context.confirm = () => true;
test.start('private');
context.RedesignBookings.afterRender('privatbuchungen');
assert.equal(createPrivate, 1);
readonly = true; modal = '';
test.create();
assert.equal(modal, '');
assert.ok(!context.App.pages.buchungen.render().includes('data-sr-booking="create"'));
test.start('private');
context.RedesignBookings.afterRender('privatbuchungen');
assert.equal(createPrivate, 1);
console.log('OK Dirty-Abbruch, Delegation an bestehende Erfassung und Nur-Lese-Sperre');
