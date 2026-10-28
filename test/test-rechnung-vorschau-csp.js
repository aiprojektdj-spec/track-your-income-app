// Regression 2026-10-20: Rechnungsvorschau und gedruckte Rechnung waren ungestylt.
//
// Rechnung.generatePreviewHtml lieferte einen <style>-Block, printInvoiceWindow einen zweiten im
// Druck-iframe. Die CSP der App (style-src-elem 'self') blockiert beides — auch im about:blank-iframe,
// das die Policy erbt. Zusaetzlich bog css/redesign.css in Modals jedes style="color:#..." und
// "background:#..." per !important auf App-Farben um (Akzentfarbe weg).
//
// Soll: kein <style> im erzeugten HTML, keine Inline-Farben ausser der CSS-Variable --inv-akzent,
// die Styles liegen in css/rechnung-dokument.css und alle Seiten mit Rechnungsmodul binden sie ein.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');

const ROOT = path.join(__dirname, '..');
let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

function vorschau(inv) {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const Utils = {
        todayISO: () => '2026-10-20', formatDate: x => x, escapeHtml: s => String(s == null ? '' : s),
        formatNumber: n => String(n), formatCurrency: n => (parseFloat(n) || 0).toFixed(2) + ' €',
        showToast() {}, isInPeriod: () => true
    };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js',
        'rechnungen/js/xrechnung.js', 'rechnungen/js/rechnung.js'], { localStorage, Utils, document: { getElementById: () => null } });
    ctx.Store.saveSettings({ firmenname: 'Test', adresse: 'Weg 1', plz: '10115', ort: 'Berlin', ustMode: 'klein',
        invoicePrimaryColor: '#123456', zahlungslink: 'https://example.com/zahlen' });
    ctx.Store.saveRechCustomer({ id: 'k1', firma: 'Kunde', strasse: 'Str 2', plz: '20095', ort: 'Hamburg' });
    return ctx.Rechnung.generatePreviewHtml(Object.assign({ id: 'r1', typ: 'rechnung', nummer: 'RE-1', datum: '2026-10-20',
        kundeId: 'k1', positionen: [{ beschreibung: 'Jacke', menge: 1, einzelpreis: 10 }] }, inv), inv.wasserzeichen);
}

check('Vorschau-HTML ohne <style>, Akzentfarbe nur als CSS-Variable', () => {
    const html = vorschau({ status: 'storniert' });
    assert.ok(!/<style/i.test(html), '<style> im Vorschau-HTML');
    assert.ok(html.includes('--inv-akzent:#123456'), 'Akzentfarbe fehlt');
    const inline = (html.match(/style="[^"]*"/g) || []).filter(s => !/^style="--inv-akzent:[^;"]*"$/.test(s));
    assert.deepStrictEqual(inline, [], 'weitere Inline-Stile (redesign.css ueberschreibt Farben in Modals)');
    assert.ok(html.includes('inv-wasserzeichen'), 'Wasserzeichen fehlt');
});

check('Druckfenster verlinkt die Styles statt <style> einzubetten', () => {
    const src = fs.readFileSync(path.join(ROOT, 'rechnungen/js/rechnung.js'), 'utf8');
    const druck = src.slice(src.indexOf('function printInvoiceWindow'), src.indexOf('function showInvoicePreview'));
    assert.ok(druck.length > 100, 'printInvoiceWindow nicht gefunden');
    assert.ok(!/<style/i.test(druck), '<style> im Druckfenster');
    assert.ok(druck.includes('/css/rechnung-dokument.css') && druck.includes('/css/rechnung-druck.css'));
});

check('Stylesheet existiert und deckt die Klassen ab', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css/rechnung-dokument.css'), 'utf8');
    for (const k of ['.inv-wrap', '.inv-accent', '.inv-doc-type', '.inv-tbl th', '.inv-tr.grand', '.inv-wasserzeichen', '.inv-link'])
        assert.ok(css.includes(k + '{'), k + ' fehlt');
    assert.ok(/\.inv-tbl th\{[^}]*background:#f8fafc !important/.test(css), 'Tabellenkopf ohne !important (redesign.css: th transparent !important)');
    assert.ok(fs.existsSync(path.join(ROOT, 'css/rechnung-druck.css')));
});

check('Alle Seiten mit Rechnungsmodul binden css/rechnung-dokument.css ein', () => {
    const seiten = ['app.html', 'demo.html', 'rechnungen/index.html'].filter(f => fs.existsSync(path.join(ROOT, f)));
    assert.ok(seiten.length >= 2);
    for (const f of seiten) {
        const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
        assert.ok(/<link rel="stylesheet" href="(\.\.\/)?css\/rechnung-dokument\.css">/.test(html), f + ' bindet rechnung-dokument.css nicht ein');
    }
});

check('Mahnung: keine Inline-Stile, Druck nur ueber das Druck-iframe (2026-10-28)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'rechnungen/js/mahnungen.js'), 'utf8');
    const vorschau = src.slice(src.indexOf('function showMahnungPreview'), src.indexOf('function init('));
    assert.ok(vorschau.length > 100, 'showMahnungPreview nicht gefunden');
    const dokument = vorschau.slice(0, vorschau.indexOf("var overlay = document.getElementById('modalOverlay')"));
    assert.ok(!/style="/.test(dokument), 'Inline-Stil im Mahnungsdokument (redesign.css biegt Farben im Modal um)');
    assert.ok(!/window\.print\(/.test(vorschau), 'window.print() druckt die ganze App-Seite mit');
    assert.ok(/printInvoiceWindow\([^)]*mahnung-dokument\.css/.test(vorschau), 'Druck ohne mahnung-dokument.css');
    const css = fs.readFileSync(path.join(ROOT, 'css/mahnung-dokument.css'), 'utf8');
    for (const k of ['.invoice-preview-new', '.invoice-header-bar', '.mahn-meta', '.mahn-text', '.mahn-betrag', '.mahn-gesamt'])
        assert.ok(css.includes(k + ' {'), k + ' fehlt');
    for (const f of ['app.html', 'rechnungen/index.html']) {
        const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
        assert.ok(/<link rel="stylesheet" href="(\.\.\/)?css\/mahnung-dokument\.css">/.test(html), f + ' bindet mahnung-dokument.css nicht ein');
    }
});

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
if (fail) process.exit(1);
