// Die Einstellungsübersicht delegiert ausschließlich an vorhandene Funktionen.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
let gate = true, handler, change, calls = [];
const selector = { value: '', addEventListener(type, fn) { change = fn; } };
const content = { addEventListener(type, fn) { handler = fn; } };
const ctx = {
    App: { pages: {}, showSettingsModal() { calls.push('settings'); }, showBackupModal() { calls.push('backup'); }, showDsgvoModal() { calls.push('privacy'); } },
    CloudSync: { openPanel() { calls.push('sync'); } },
    CompanyManager: { openSwitcher() { calls.push('companies'); } },
    AuthUI: { openUserMenu() { calls.push('account'); } },
    Theme: { get() { return 'dark'; }, set(value) { calls.push('theme:' + value); } },
    document: {
        getElementById(id) { return id === 'content' ? content : id === 'stackrSettingsTheme' ? selector : null; },
        querySelector(query) { return query.includes('#whopLoginOverlay') && gate ? {} : null; }
    }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/redesign-settings.js'), 'utf8'), ctx);
const settings = ctx.App.pages.einstellungen;
settings.init();
assert.equal(selector.value, 'dark');
const actions = ['settings', 'backup', 'sync', 'companies', 'account', 'privacy'];
function click(action, modified = false) {
    const el = { dataset: { settingsAction: action, settingsField: 'set_firmenname' } };
    handler({ target: { closest() { return el; } }, ctrlKey: modified, preventDefault() {} });
}
actions.forEach(action => click(action));
change();
assert.deepStrictEqual(calls, [], 'Gate muss sämtliche delegierten Einstellungsaktionen sperren');
gate = false;
actions.forEach(action => click(action));
assert.deepStrictEqual(calls, actions, 'Jeder Einstieg muss genau den vorhandenen Dialog öffnen');
click('backup', true);
assert.equal(calls.length, actions.length, 'Modifizierter Klick löst keine Aktion aus');
selector.value = 'light';
change();
assert.equal(calls.at(-1), 'theme:light', 'Vorhandene Theme-Quelle verwenden');
const html = settings.render();
for (const [page, view] of [['rechnungen', 'unternehmensdaten'], ['eigenbelege', 'einstellungen'], ['eigenbelege', 'kategorien'], ['gbr', 'stammdaten']]) {
    assert(html.includes('data-sr-page="' + page + '" data-sr-view="' + view + '"'), page + '/' + view + ' muss erreichbar bleiben');
}
for (const view of ['kategorien', 'status']) assert(html.includes('lager/index.html?verwaltung=' + view));
assert(!/Store\.|localStorage|fetch\(/.test(fs.readFileSync(path.join(__dirname, '../js/redesign-settings.js'), 'utf8')), 'Keine neue Speicher- oder Netzlogik');
console.log('OK Einstellungen: Gate, bestehende Dialoge, Theme-Quelle und sämtliche verschobenen Unteransichten');
