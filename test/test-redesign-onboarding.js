// Zwei-Etappen-Adapter mit den echten Firmen-/Abschlussmethoden aus js/app.js.
// Der DOM-Ersatz hält Formularwerte und Ereignisse; keine Browser-/npm-Abhängigkeit.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const start = appSource.indexOf('    _saveOnboardingStep() {');
const end = appSource.indexOf('    // ---- Settings Modal ----', start);
assert(start >= 0 && end > start, 'Originale Onboarding-Methoden müssen auffindbar bleiben');
const originalMethods = appSource.slice(start, end);
const adapter = fs.readFileSync(path.join(root, 'js/redesign-onboarding.js'), 'utf8');

function harness(config = {}) {
    const state = { writes: 0, created: 0, company: null, saved: null, sync: 0, navigation: [], toasts: [], failCreate: false, failRename: false, failSave: false };
    const nodes = new Map();
    let context;

    class Element {
        constructor(id = '') {
            this.id = id;
            this.value = '';
            this.checked = false;
            this.hidden = false;
            this.disabled = false;
            this.isConnected = true;
            this.validity = { valid: true };
            this.className = '';
            this.attributes = {};
            this.listeners = {};
            this.textContent = '';
            this._html = '';
        }
        set innerHTML(html) {
            this._html = html;
            if (this.id !== 'onboarding') return;
            for (const [id, node] of nodes) if (id !== 'onboarding') { node.isConnected = false; nodes.delete(id); }
            for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
                const node = new Element(match[3]);
                const attributes = match[2];
                node.value = ((attributes.match(/\bvalue="([^"]*)"/) || [])[1] || '').replaceAll('&amp;', '&').replaceAll('&quot;', '"');
                node.checked = /\schecked(?:\s|$)/.test(attributes);
                node.hidden = /\shidden(?:\s|$)/.test(attributes);
                node.className = (attributes.match(/\bclass="([^"]*)"/) || [])[1] || '';
                nodes.set(node.id, node);
            }
            for (const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
                const selected = match[2].match(/<option\b[^>]*value="([^"]*)"[^>]* selected/);
                nodes.get(match[1]).value = selected ? selected[1] : '';
            }
        }
        get innerHTML() { return this._html; }
        addEventListener(type, handler) { (this.listeners[type] || (this.listeners[type] = [])).push(handler); }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this.attributes[name]; }
        focus() { context.document.activeElement = this; }
        querySelector() { return new Element(); }
        querySelectorAll(selector) {
            if (selector === '[aria-invalid]') return [...nodes.values()].filter(node => node.attributes['aria-invalid']);
            if (selector === '.redesign-field-error') return [...nodes.values()].filter(node => node.className.includes('redesign-field-error'));
            return [];
        }
    }

    nodes.set('onboarding', new Element('onboarding'));
    context = {
        console, Date, Math,
        document: { getElementById: id => nodes.get(id) || null, activeElement: { id: '' } },
        localStorage: { setItem() {} },
        Utils: {
            escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
            showToast: (message, type) => state.toasts.push({ message, type })
        },
        Store: {
            getSettings: () => ({ retainedSetting: 'bleibt', ...(state.saved || {}) }),
            saveSettings(value) {
                if (state.failSave) throw new Error('Speicher voll');
                state.writes++;
                state.saved = JSON.parse(JSON.stringify(value));
            }
        },
        CompanyManager: {
            BRANCHEN: ['Dienstleistung', 'Sonstiges'], FARBEN: [{ hex: 'test' }], ACTIVE_KEY: 'test-company',
            getActiveId: () => state.company && state.company.id,
            getActive: () => state.company,
            create(name) {
                if (state.failCreate) throw new Error('Firma nicht speicherbar');
                state.created++;
                return (state.company = { id: 'test', name });
            },
            rename(id, name) {
                if (state.failRename) throw new Error('Umbenennen fehlgeschlagen');
                state.company.name = name;
            },
            migrateExistingData() {}, renderSwitcherBtn: () => ''
        },
        Rechtsform: { set() {}, getAllOptions: () => [{ value: 'Einzelunternehmen', label: 'Einzelunternehmen' }, { value: 'GbR', label: 'GbR' }] }
    };
    vm.createContext(context);
    vm.runInContext('this.App = { _onboardingStep: 1, _onboardingData: {}, ' + originalMethods + ' };', context);
    context.App.navigate = page => state.navigation.push(page);
    context.App._openSyncConnect = () => { state.sync++; };
    vm.runInContext(adapter, context);
    Object.assign(state, config);
    context.App._renderOnboarding();
    return {
        state, app: context.App, node: id => nodes.get(id),
        fire(id, type = 'click') { for (const handler of nodes.get(id).listeners[type] || []) handler({ preventDefault() {} }); },
        submit() { this.fire('redesignOnboardingForm', 'submit'); },
        company() {
            for (const [name, value] of Object.entries({ firmenname: 'Prüffirma & Co', name: 'Testperson', branche: 'Dienstleistung', rechtsform: 'GbR' })) nodes.get('ob_' + name).value = value;
        }
    };
}

let count = 0;
function check(name, run) { run(); count++; console.log('✓ ' + name); }

check('Etappe 1: keine stillen Auswahlen; Pflichtfehler erzeugen keine Firma', () => {
    const h = harness();
    assert.equal(h.node('ob_branche').value, '');
    assert.equal(h.node('ob_rechtsform').value, '');
    h.submit();
    assert.equal(h.state.created, 0);
    assert(h.node('obErrorSummary').innerHTML.includes('Wähle deine Rechtsform'));
    assert.equal(h.node('obNext').disabled, false);
});

check('Zwei Etappen und alle zehn bisherigen Zusatzfelder bleiben erhalten', () => {
    const h = harness(); h.company(); h.submit();
    assert.equal(h.app._onboardingStep, 2);
    assert.equal(h.state.created, 1);
    assert(h.node('onboarding').innerHTML.includes('Schritt 2 von 2'));
    assert.equal(h.node('ob_ustMode').value, '');
    for (const name of ['adresse', 'plz', 'ort', 'telefon', 'email', 'steuernummer', 'ustId', 'bankname', 'iban', 'bic']) assert(h.node('ob_' + name), name);
});

check('Unbekannter Status speichert kein fertiges Profil; Zurück/Weiter und Sync bewahren Eingaben', () => {
    const h = harness(); h.company(); h.submit();
    h.node('ob_adresse').value = 'Prüfstraße 12'; h.node('ob_iban').value = 'Test-IBAN'; h.node('ob_ustMode').value = 'unknown';
    h.submit();
    assert.equal(h.state.writes, 0);
    assert.equal(h.app._onboardingData.ustMode, undefined);
    assert.equal(h.state.navigation.length, 0);
    assert(h.node('obErrorSummary').innerHTML.includes('Klär deinen Umsatzsteuerstatus'));
    h.fire('obConnect'); assert.equal(h.state.sync, 1);
    h.fire('obPrev'); assert.equal(h.node('ob_firmenname').value, 'Prüffirma & Co');
    h.submit(); assert.equal(h.state.created, 1);
    assert.equal(h.node('ob_ustMode').value, 'unknown');
    assert.equal(h.node('ob_adresse').value, 'Prüfstraße 12');
    assert.equal(h.node('ob_iban').value, 'Test-IBAN');
});

check('Sync ist vor der ersten Firmenerstellung erreichbar und legt keine leere Firma an', () => {
    const h = harness(); h.node('ob_firmenname').value = 'Entwurf'; h.fire('obConnect');
    assert.equal(h.state.sync, 1); assert.equal(h.state.created, 0); assert.equal(h.state.writes, 0);
    assert.equal(h.app._onboardingData.firmenname, 'Entwurf');
});

for (const mode of ['klein', 'regel']) check('Abschluss braucht Bestätigung und speichert ' + mode + ' unverändert mit Zusatzfeldern', () => {
    const h = harness(); h.company(); h.submit();
    h.node('ob_ustMode').value = mode; h.submit();
    assert.equal(h.state.writes, 0);
    assert.equal(h.node('ob_ustConfirm').attributes['aria-invalid'], 'true');
    h.node('ob_ustConfirm').checked = true; h.node('ob_adresse').value = 'Straße 9'; h.node('ob_bankname').value = 'Bank'; h.submit();
    assert.equal(h.state.writes, 1);
    assert.equal(h.state.saved.ustMode, mode);
    assert.equal(h.state.saved.adresse, 'Straße 9'); assert.equal(h.state.saved.bankname, 'Bank');
    assert.equal(h.state.saved.retainedSetting, 'bleibt'); assert.equal(h.state.saved.onboardingDone, true);
    assert.deepEqual(h.state.navigation, ['dashboard']);
});

check('Statuswechsel hebt die bisherige Bestätigung auf', () => {
    const h = harness(); h.company(); h.submit(); h.node('ob_ustConfirm').checked = true;
    h.node('ob_ustMode').value = 'regel'; h.fire('ob_ustMode', 'change');
    assert.equal(h.node('ob_ustConfirm').checked, false);
});

check('Bestehender Fehlerpfad bei Firmenerstellung bewahrt Eingaben und Etappe', () => {
    const h = harness({ failCreate: true }); h.company(); h.submit();
    assert.equal(h.app._onboardingStep, 1); assert.equal(h.state.writes, 0); assert.equal(h.state.created, 0);
    assert.equal(h.node('ob_firmenname').value, 'Prüffirma & Co');
    assert(h.state.toasts.some(toast => toast.type === 'error' && toast.message.includes('Firma nicht speicherbar')));
    h.state.failCreate = false; h.submit(); assert.equal(h.app._onboardingStep, 2);
});

check('Umbenennungsfehler bleibt sichtbar, Eingaben bleiben bestehen', () => {
    const h = harness({ company: { id: 'vorhanden', name: 'Alter Name' }, failRename: true }); h.company(); h.submit();
    assert.equal(h.app._onboardingStep, 1); assert.equal(h.state.writes, 0);
    assert(h.node('obErrorSummary').innerHTML.includes('Umbenennen fehlgeschlagen'));
    assert.equal(h.node('obNext').disabled, false);
});

check('Speicherfehler beim Abschluss erlaubt Wiederholen ohne Datenverlust', () => {
    const h = harness({ failSave: true }); h.company(); h.submit();
    h.node('ob_ustMode').value = 'regel'; h.node('ob_ustConfirm').checked = true; h.node('ob_iban').value = 'Erhalten'; h.submit();
    assert.equal(h.state.writes, 0); assert.equal(h.app._onboardingData.onboardingDone, undefined);
    assert.equal(h.node('ob_iban').value, 'Erhalten'); assert.equal(h.node('obFinish').disabled, false);
    assert(h.node('obErrorSummary').innerHTML.includes('Speicher voll'));
    h.state.failSave = false; h.submit(); assert.equal(h.state.writes, 1); assert.equal(h.state.saved.iban, 'Erhalten');
});

console.log('\n' + count + '/' + count + ' Prüfungen bestanden');
