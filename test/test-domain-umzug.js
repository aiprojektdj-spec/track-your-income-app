// Domain-Umzug (js/domain-umzug.js): Tab-zu-Tab-Protokoll alt -> neu.
// Sichert ab: Daten gehen nur an getstackr.de, werden nur von der alten Adresse und nur vom
// Opener-Fenster angenommen, und der Import laeuft ueber BackupCrypto.restore().
const path = require('path');
const MOD = path.join(__dirname, '..', 'js', 'domain-umzug.js');
const ALT = 'https://track-your-income-app.vercel.app';
const NEU = 'https://getstackr.de';

let fails = 0;
function check(name, ok) {
    console.log((ok ? 'OK   ' : 'FAIL ') + name);
    if (!ok) fails++;
}

function element() {
    return { innerHTML: '', style: {}, setAttribute() {}, addEventListener() {}, querySelector() { return element(); } };
}

function umgebung(host, search, opts) {
    opts = opts || {};
    const listeners = [];
    const store = {};
    const calls = { open: [], restore: [], toPopup: [], toOpener: [] };
    const popup = { postMessage: (msg, origin) => calls.toPopup.push({ msg, origin }) };
    const opener = opts.opener === false ? null : { postMessage: (msg, origin) => calls.toOpener.push({ msg, origin }) };
    const elements = {};
    global.window = {
        opener,
        addEventListener: (t, fn) => { if (t === 'message') listeners.push(fn); },
        removeEventListener: (t, fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
        open: (url) => { calls.open.push(url); return popup; },
    };
    global.location = { hostname: host, search: search || '', pathname: '/app.html' };
    global.history = { replaceState() {} };
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    global.document = {
        getElementById: (id) => (elements[id] = elements[id] || element()),
        createElement: () => element(),
        body: { firstChild: null, insertBefore: (el) => { elements.domainUmzugBanner = el; } },
    };
    global.BackupCrypto = {
        buildBundle: () => ({ __account: { oyi_companies: [{ id: 'co_a' }] }, co_a: { co_a__reselling_items: [] } }),
        restore: async (b) => { calls.restore.push(b); },
    };
    global.CompanyManager = { getAll: () => opts.firmen || [] };
    global.Utils = { escapeHtml: (s) => s, showToast() {} };
    global.URLSearchParams = URLSearchParams;
    delete require.cache[require.resolve(MOD)];
    const mod = require(MOD);
    const send = async (data, origin, source) => { for (const fn of listeners.slice()) await fn({ data, origin, source }); };
    return { mod, calls, store, popup, opener, send, elements, listeners };
}

(async () => {
    // ── Alte Domain ──
    let u = umgebung('track-your-income-app.vercel.app');
    let weiterAlt = false;
    check('A1 alte Domain: Start laeuft normal weiter', u.mod.vorDemStart(() => { weiterAlt = true; }) === false);
    check('A2 alte Domain: Banner steht da', /Jetzt umziehen/.test(u.elements.domainUmzugBanner.innerHTML));
    u.mod.starten();
    check('A3 oeffnet getstackr.de/app.html?umzug=1', u.calls.open[0] === NEU + '/app.html?umzug=1');
    await u.send({ type: 'stackr-umzug-bereit' }, 'https://evil.example', u.popup);
    check('A4 fremde Origin bekommt keine Daten', u.calls.toPopup.length === 0);
    await u.send({ type: 'stackr-umzug-bereit' }, NEU, {});
    check('A5 fremdes Fenster mit richtiger Origin bekommt keine Daten', u.calls.toPopup.length === 0);
    await u.send({ type: 'stackr-umzug-bereit' }, NEU, u.popup);
    check('A6 Daten gehen genau einmal und nur an getstackr.de',
          u.calls.toPopup.length === 1 && u.calls.toPopup[0].origin === NEU &&
          u.calls.toPopup[0].msg.type === 'stackr-umzug-daten' && !!u.calls.toPopup[0].msg.bundle.co_a);
    await u.send({ type: 'stackr-umzug-fertig' }, NEU, u.popup);
    check('A7 Erfolg wird vermerkt, Banner wechselt',
          !!u.store.oyi_umzug_am && /Umgezogen am/.test(u.elements.domainUmzugBanner.innerHTML));

    // ── Neue Domain mit Umzug ──
    u = umgebung('getstackr.de', '?umzug=1');
    check('B1 neue Domain mit ?umzug=1 uebernimmt den Start', u.mod.vorDemStart(() => {}) === true);
    check('B2 meldet "bereit" nur an die alte Adresse',
          u.calls.toOpener.length === 1 && u.calls.toOpener[0].origin === ALT && u.calls.toOpener[0].msg.type === 'stackr-umzug-bereit');
    const bundle = { co_x: { co_x__reselling_items: [{ id: 1 }] } };
    await u.send({ type: 'stackr-umzug-daten', v: 1, bundle }, 'https://evil.example', u.opener);
    check('B3 Daten von fremder Origin werden ignoriert', u.calls.restore.length === 0);
    await u.send({ type: 'stackr-umzug-daten', v: 1, bundle }, ALT, {});
    check('B4 Daten von fremdem Fenster werden ignoriert', u.calls.restore.length === 0);
    await u.send({ type: 'stackr-umzug-daten', v: 1, bundle: [1, 2] }, ALT, u.opener);
    check('B5 kaputtes Buendel (Array) wird ignoriert', u.calls.restore.length === 0);
    await u.send({ type: 'stackr-umzug-daten', v: 2, bundle }, ALT, u.opener);
    check('B6 unbekannte Protokollversion wird ignoriert', u.calls.restore.length === 0);
    await u.send({ type: 'stackr-umzug-daten', v: 1, bundle }, ALT, u.opener);
    check('B7 gueltige Daten laufen ueber BackupCrypto.restore', u.calls.restore.length === 1 && u.calls.restore[0] === bundle);
    check('B8 Erfolg geht nur an die alte Adresse zurueck',
          u.calls.toOpener.length === 2 && u.calls.toOpener[1].origin === ALT && u.calls.toOpener[1].msg.type === 'stackr-umzug-fertig');
    await u.send({ type: 'stackr-umzug-daten', v: 1, bundle }, ALT, u.opener);
    check('B9 zweite Sendung wird nicht noch einmal importiert', u.calls.restore.length === 1);

    // ── Neue Domain ohne Opener (Verbindung durch Login abgerissen) ──
    u = umgebung('getstackr.de', '?umzug=1', { opener: false });
    check('C1 ohne Opener: Hinweis statt Import', u.mod.vorDemStart(() => {}) === true && u.calls.restore.length === 0);

    // ── Neue Domain ohne Umzug ──
    u = umgebung('getstackr.de', '', { firmen: [] });
    check('D1 neue Domain ohne Firma fragt "neu oder schon Kunde"', u.mod.vorDemStart(() => {}) === true);
    u = umgebung('getstackr.de', '', { firmen: [{ id: 'co_a' }] });
    check('D2 neue Domain mit Daten startet normal', u.mod.vorDemStart(() => {}) === false);

    // ── Andere Hosts ──
    u = umgebung('localhost');
    check('E1 andere Hosts: keine Wirkung', u.mod.vorDemStart(() => {}) === false && u.listeners.length === 0);

    if (fails) { console.log(`\n${fails} Fehler`); process.exit(1); }
    console.log('\nAlle Checks gruen');
})();
