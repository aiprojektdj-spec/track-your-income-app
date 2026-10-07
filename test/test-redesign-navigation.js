// Navigation mit echten App-Guards, ohne Authentifizierung oder Kundenspeicher.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
let url = new URL('http://localhost/app.html?page=dashboard');
const writes = [], goes = [];
let renders = 0;
const document = {
    readyState: 'loading', addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, getElementById(id) { return id === 'content' ? { innerHTML: '' } : null; }
};
const context = {
    console, URL, URLSearchParams, Number, document, confirm: () => true,
    setTimeout: () => 0, requestAnimationFrame() { renders++; }, queueMicrotask,
    location: { get href() { return url.href; }, get search() { return url.search; }, get pathname() { return url.pathname; }, get hash() { return url.hash; } },
    history: {
        state: null,
        replaceState(state, _, target) { this.state = state; url = new URL(target, url); writes.push('replace'); },
        pushState(state, _, target) { this.state = state; url = new URL(target, url); writes.push('push'); },
        go(delta) { goes.push(delta); }
    },
    matchMedia: () => ({ matches: false }), addEventListener() {}
};
context.window = context;
for (const name of ['Dashboard', 'Buchungen', 'Lager', 'Euer', 'Ausgaben', 'Statistiken', 'Protokoll', 'Retouren', 'Fahrtenbuch', 'Kassenbuch', 'Steuertermine', 'Materiallager', 'Akademie', 'GbrModul', 'Afa', 'Privatbuchungen', 'UstVoranmeldung', 'Ksk', 'BankImport', 'Steuerberater', 'Vorsteuer', 'OSS', 'Koerperschaftsteuer', 'Bilanz', 'Rechtsform', 'Lohnsteuer', 'Gewerbesteuer']) {
    context[name] = { render() { return ''; }, init() {} };
}
context.Rechtsform.getConfig = () => ({ bilanzOptional: true, privatbuchungen: true, ksk: true, gewerbesteuer: true });
vm.createContext(context);
// Testzugang existiert nur im isolierten VM-Quelltext, nicht in der Browser-App.
const shellSource = fs.readFileSync(path.join(root, 'js/redesign-shell.js'), 'utf8');
vm.runInContext(shellSource.replace('window.RedesignShell = {', 'window.ShellTest = { onPopstate, ready: function () { ready=true; }, routes: ROUTES, groups: GROUPS, href, SUBPAGES };\nwindow.RedesignShell = {'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8') + '\nglobalThis.TestApp=App;', context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/redesign-settings.js'), 'utf8'), context);
const app = context.TestApp;
app._checkUstThreshold = () => {};
app._skeletonFor = () => '';

assert.deepStrictEqual(Object.keys(app.pages).sort(), Object.keys(context.ShellTest.routes).sort());
assert.equal(context.ShellTest.groups.length, 6);
console.log(`OK ${Object.keys(app.pages).length} bestehende Routen vollständig zugeordnet, sechs Hauptbereiche`);
app.navigate('dashboard');
assert.deepStrictEqual(writes, ['replace']);
app.navigate('buchungen');
assert.equal(writes.at(-1), 'push');
assert.equal(url.searchParams.get('page'), 'buchungen');
app.navigate('buchungen');
assert.equal(writes.at(-1), 'replace');
console.log('OK History: Eintritt replace, Seitenwechsel push, Aktualisierung ohne Duplikat');

app._formDirty = true;
context.confirm = () => false;
const before = writes.length;
app.navigate('euer');
assert.equal(app.currentPage, 'buchungen');
assert.equal(writes.length, before);
assert.equal(app._formDirty, true);
console.log('OK Dirty-Abbruch bewahrt Route, URL und Eingaben');

context.ShellTest.ready();
const renderedBefore = renders;
url = new URL('http://localhost/app.html?page=dashboard');
context.ShellTest.onPopstate({ state: { stackrIndex: 0 } });
assert.deepStrictEqual(goes, [1]);
assert.equal(app.currentPage, 'buchungen');
assert.equal(renders, renderedBefore);
url = new URL('http://localhost/app.html?page=buchungen');
context.ShellTest.onPopstate({ state: { stackrIndex: 1 } });
assert.equal(renders, renderedBefore);
assert.equal(app._formDirty, true);
console.log('OK abgebrochenes Zurück stellt History ohne Formular-Neurender wieder her');

context.confirm = () => true;
url = new URL('http://localhost/app.html?page=dashboard');
context.ShellTest.onPopstate({ state: { stackrIndex: 0 } });
assert.equal(app.currentPage, 'dashboard');
assert.equal(app._formDirty, false);
assert.equal(url.searchParams.get('page'), 'dashboard');
console.log('OK bestätigtes Zurück durchläuft die bestehenden Guards');

for (const pathname of ['/app.html', '/rechnungen/', '/rechnungen/index.html', '/lager', '/lager/index.html', '/eigenbelege/']) {
    const isolated = { window: null, URLSearchParams, URL, location: { pathname, search: '', href: 'http://localhost' + pathname }, document: { readyState: 'loading', addEventListener() {} }, matchMedia: () => ({ matches: false }) };
    isolated.window = isolated;
    vm.createContext(isolated);
    vm.runInContext(shellSource.replace('window.RedesignShell = {', 'window.Check={href,SUBPAGES}; window.RedesignShell = {'), isolated);
    // Clean-URL /lager besitzt im Dokument ausdrücklich base href=/lager/.
    const target = new URL(isolated.Check.href('rechnungen', 'dokumente'), 'http://localhost' + (pathname === '/lager' ? '/lager/' : pathname));
    assert.equal(target.pathname, '/app.html');
    assert.equal(target.searchParams.get('view'), 'dokumente');
    assert.equal(isolated.Check.SUBPAGES.rechnungen.length, 12);
    assert.equal(isolated.Check.SUBPAGES.eigenbelege.length, 6);
    assert.equal(isolated.Check.SUBPAGES.gbr.length, 5);
}
console.log('OK Standalone-/Clean-URL-Links und alle Rechnungs-, Eigenbeleg- und GbR-Unteraufgaben');
