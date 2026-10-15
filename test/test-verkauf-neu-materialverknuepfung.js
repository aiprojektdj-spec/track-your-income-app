// Regression: Verkaufsformular (js/buchungen.js, Klick auf #saveVerkaufBtn) legt einen NEUEN
// Verkauf an — nicht eine Bearbeitung einer unbekannten id.
//
// Vorher erzeugte der Handler die id vorab (Store.generateId()) und reichte sie an saveSale /
// saveSaleMulti durch, um den Materialverbrauch zu verknüpfen. Folgen:
//   - saveSale nahm den id-Zweig (Bearbeitung): kein createdAt, kein USt-Stempel, kein
//     Audit-Eintrag 'erstellt', keine Limitprüfung, kein Webhook 'einnahme'.
//   - saveSaleMulti vergab eine neue id — der Materialverbrauch zeigte auf die alte, also ins Leere.
//   - Beim Free-Tier-Limit wurde trotzdem Material abgebucht und "gespeichert" gemeldet.
//
// Echter Code: js/store.js, js/buchungen.js (_bindVerkaufForm → Save-Handler).
// Simuliert: DOM (Formularfelder, Material-Mengenfelder), localStorage, Utils, Webhooks, UserPlan.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

function welt({ limitErreicht = false } = {}) {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };

    // Formularelemente: id → { value, handlers }
    const els = {};
    const el = id => els[id] || (els[id] = {
        id, value: '', dataset: {}, style: {},
        _h: {}, addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
        click() { (this._h.click || []).forEach(f => f({ preventDefault() {} })); },
        focus() {}, scrollIntoView() {}, setSelectionRange() {}
    });
    let matInputs = [];
    const document = {
        getElementById: id => el(id),
        querySelectorAll: sel => sel === '.vk_mat_menge' ? matInputs : [],
        querySelector: () => null
    };
    const toasts = [];
    const Utils = {
        formatCurrency: n => String(n), escapeHtml: s => String(s == null ? '' : s),
        showToast: (msg, typ) => toasts.push({ msg, typ }),
        getDateInputValue: id => el(id).value,
        readLandField: () => ({ land: 'DE', ausfuhrnachweis: false }),
        calculateNetRevenue: (vk, vkK, geb, vs) => vk + vkK - vk * geb / 100 - vs,
        todayISO: () => '2026-10-15'
    };
    const webhooks = [];
    const Webhooks = { fire: (typ, rec) => webhooks.push({ typ, id: rec.id }) };
    const proHinweise = [];
    const UserPlan = {
        isPro: () => !limitErreicht, isTrialActive: () => false,
        getLimit: () => 0, requirePro: f => proHinweise.push(f)
    };

    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js', 'js/buchungen.js'],
        { localStorage, Utils, document, Webhooks, UserPlan });
    ctx.Store.saveSettings({ ustMode: 'klein' });
    ctx.Buchungen._renderTab = () => {};

    const mat = ctx.Store.saveMaterialBestandItem({ name: 'Karton S', einheit: 'Stück', bestand: 10, kostenProEinheit: 0.5 });

    ctx.verkaufe = ({ purchaseIds = [], manuell = false, matMenge = 0 }) => {
        Object.keys(els).forEach(k => delete els[k]);
        el('vk_datum').value = '2026-10-15';
        el('vk_plattform').value = '';
        el('vk_preis').value = '40';
        el('vk_versandKaeufer').value = '0';
        el('vk_gebuehr').value = '0';
        el('vk_versandVk').value = '0';
        el('vk_notizen').value = '';
        el('vk_marke').value = 'Manuell';
        matInputs = matMenge ? [{ value: String(matMenge), dataset: { matId: mat.id, kosten: '0.5' }, addEventListener() {} }] : [];
        ctx.Buchungen._verkaufManual = manuell;
        ctx.Buchungen._selectedPurchaseIds = purchaseIds.slice();
        ctx.Buchungen._bindVerkaufForm();
        el('saveVerkaufBtn').click();
    };
    ctx.neuerEinkauf = marke => ctx.Store.savePurchase({ datum: '2026-10-01', marke, artikeltyp: 'Jacke', einkaufspreis: 10, status: 'verfuegbar' });
    ctx.audit = id => ctx.Store.getAuditLog().filter(a => a.entityType === 'verkauf' && a.entityId === id);
    ctx.verbrauch = () => ctx.Store.getMaterialVerbrauch();
    ctx.matId = mat.id;
    ctx.toasts = toasts; ctx.webhooks = webhooks; ctx.proHinweise = proHinweise;
    return ctx;
}

function pruefeNeuanlage(ctx, s) {
    assert.ok(s, 'Verkauf vorhanden');
    assert.ok(s.createdAt, 'createdAt gesetzt');
    assert.strictEqual(s.ustBehandlung, 'klein', 'USt-Stempel');
    const a = ctx.audit(s.id);
    assert.strictEqual(a.length, 1, 'genau ein Audit-Eintrag');
    assert.strictEqual(a[0].action, 'erstellt', 'Audit-Aktion');
    assert.deepStrictEqual(ctx.webhooks.map(w => w.typ), ['einnahme'], 'Webhook einnahme');
    const v = ctx.verbrauch();
    assert.strictEqual(v.length, 1, 'ein Materialverbrauch');
    assert.strictEqual(v[0].referenzId, s.id, 'Materialverbrauch zeigt auf den gespeicherten Verkauf');
    assert.strictEqual(v[0].menge, 2);
    assert.ok(ctx.toasts.some(t => t.typ === 'success'), 'Erfolgsmeldung');
}

check('Einzelverkauf: Audit erstellt, USt-Stempel, Webhook, Material verknüpft', () => {
    const ctx = welt();
    const p = ctx.neuerEinkauf('Levis');
    ctx.verkaufe({ purchaseIds: [p.id], matMenge: 2 });
    const sales = ctx.Store.getSales();
    assert.strictEqual(sales.length, 1);
    assert.strictEqual(sales[0].purchaseId, p.id);
    pruefeNeuanlage(ctx, sales[0]);
});

check('Manueller Verkauf ohne Lagerartikel: gleiche Neuanlage-Pflichten', () => {
    const ctx = welt();
    ctx.verkaufe({ manuell: true, matMenge: 2 });
    const sales = ctx.Store.getSales();
    assert.strictEqual(sales.length, 1);
    pruefeNeuanlage(ctx, sales[0]);
});

check('Paketverkauf: Material zeigt auf die von saveSaleMulti vergebene id', () => {
    const ctx = welt();
    const a = ctx.neuerEinkauf('Levis'), b = ctx.neuerEinkauf('Nike');
    ctx.verkaufe({ purchaseIds: [a.id, b.id], matMenge: 2 });
    const sales = ctx.Store.getSales();
    assert.strictEqual(sales.length, 1);
    assert.deepStrictEqual(sales[0].purchaseIds, [a.id, b.id]);
    pruefeNeuanlage(ctx, sales[0]);
});

check('Free-Tier-Limit: kein Verkauf, kein Materialverbrauch, keine Erfolgsmeldung', () => {
    const ctx = welt({ limitErreicht: true });
    ctx.verkaufe({ manuell: true, matMenge: 2 });
    assert.strictEqual(ctx.Store.getSales().length, 0, 'kein Verkauf');
    assert.strictEqual(ctx.verbrauch().length, 0, 'kein Materialverbrauch');
    assert.strictEqual(ctx.Store.getMaterialBestand()[0].bestand, 10, 'Bestand unverändert');
    assert.ok(!ctx.toasts.some(t => t.typ === 'success'), 'keine Erfolgsmeldung');
    assert.strictEqual(ctx.proHinweise.length, 1, 'Pro-Hinweis gezeigt');
});

check('Free-Tier-Limit beim Paketverkauf: ebenso nichts gebucht', () => {
    const ctx = welt({ limitErreicht: true });
    ctx.verkaufe({ purchaseIds: ['x1', 'x2'], matMenge: 2 });
    assert.strictEqual(ctx.Store.getSales().length, 0);
    assert.strictEqual(ctx.verbrauch().length, 0);
    assert.ok(!ctx.toasts.some(t => t.typ === 'success'));
});

console.log(`\n${pass}/${pass + fail} bestanden`);
if (fail) process.exit(1);
