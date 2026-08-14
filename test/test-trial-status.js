// Trial-Status im Client:  node test/test-trial-status.js
//
// Fund N2 (Monetarisierungs-Audit 2026-08-12, teuerster Fund der Runde): Whop führt den Trial mit
// hinterlegter Karte — 7 Tage, Abbuchung am Tag 8. api/whop-access.js prüfte 'trialing' längst,
// warf den Status aber weg, bevor er den Client erreichte. js/user-plan.js hatte passende
// Funktionen nur als Stummel (`isTrialActive() { return false; }`).
//
// Folge: Die App konnte während der sieben Tage nicht sagen, dass ein Trial läuft, wie viele Tage
// bleiben und wann die erste Abbuchung kommt — das Kontomenü zeigte "Pro aktiv". Genau daraus
// entstehen Rückbuchungen: testen, vergessen, am Tag 8 überrascht werden.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const src = read('js/user-plan.js');

// UserPlan im Node laden: das Modul greift auf localStorage und document zu.
function load(initial) {
    const store = new Map();
    if (initial !== undefined) store.set('whop_access_info', initial);
    const localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
    };
    const document = { getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {} }) };
    const fn = new Function('localStorage', 'document', 'location', src + '; return UserPlan;');
    return { UserPlan: fn(localStorage, document, { href: '' }), store };
}

let pass = 0;
const TAG = 86400000;

// 1) Ohne Serverangabe verhält sich alles wie vorher — kein erfundener Trial
let { UserPlan } = load(undefined);
assert.strictEqual(UserPlan.isTrialActive(), false, 'ohne Status kein Trial');
assert.strictEqual(UserPlan.getTrialDaysLeft(), null, 'ohne Status keine Tageszahl');
assert.strictEqual(UserPlan.getStatus(), null, 'Status unbekannt');
assert.strictEqual(UserPlan.isPro(), true, 'Zugang bleibt unberührt');
pass++; console.log('✓ ohne Serverangabe kein Trial-Hinweis, Zugang unberührt');

// 2) 'trialing' + Zeitpunkt → Trial mit Tageszahl
({ UserPlan } = load(undefined));
const in5 = Date.now() + 5 * TAG + 60000;   // etwas Puffer, damit ceil nicht kippt
UserPlan.setAccessInfo('trialing', in5);
assert.strictEqual(UserPlan.isTrialActive(), true, 'Trial erkannt');
assert.strictEqual(UserPlan.getTrialDaysLeft(), 6, 'aufgerundet auf volle Tage');
assert.strictEqual(UserPlan.getRenewsAt(), in5, 'Zeitpunkt durchgereicht');
pass++; console.log('✓ trialing + Zeitpunkt → Trial mit Tageszahl');

// 3) 'active' ist KEIN Trial — ein falscher Hinweis bei einem zahlenden Kunden wäre schlimmer
//    als kein Hinweis
({ UserPlan } = load(undefined));
UserPlan.setAccessInfo('active', Date.now() + 20 * TAG);
assert.strictEqual(UserPlan.isTrialActive(), false, 'active ist kein Trial');
assert.strictEqual(UserPlan.getTrialDaysLeft(), null, 'keine Trial-Tage bei active');
assert.strictEqual(UserPlan.getStatus(), 'active');
pass++; console.log('✓ aktives Abo wird nicht als Trial angezeigt');

// 4) Trial ohne bekannten Zeitpunkt: Tatsache ja, Zahl nein
({ UserPlan } = load(undefined));
UserPlan.setAccessInfo('trialing', null);
assert.strictEqual(UserPlan.isTrialActive(), true, 'Trial auch ohne Datum erkannt');
assert.strictEqual(UserPlan.getTrialDaysLeft(), null, 'keine erfundene Tageszahl');
pass++; console.log('✓ Trial ohne Zeitpunkt: keine erfundene Tageszahl');

// 5) Letzter Tag und Überschreitung
({ UserPlan } = load(undefined));
UserPlan.setAccessInfo('trialing', Date.now() + 60000);
assert.strictEqual(UserPlan.getTrialDaysLeft(), 1, 'wenige Minuten → 1 Tag');
UserPlan.setAccessInfo('trialing', Date.now() - 5 * TAG);
assert.strictEqual(UserPlan.getTrialDaysLeft(), 0, 'abgelaufen → 0, nie negativ');
pass++; console.log('✓ Grenzfälle: 1 Tag bzw. 0, nie negativ');

// 6) Persistenz — der Server-Check läuft nicht bei jedem Seitenaufruf (Offline-Grace).
//    Ohne Persistenz wäre der Hinweis nach einem Reload weg.
let store;
({ UserPlan, store } = load(undefined));
const in3 = Date.now() + 3 * TAG + 60000;
UserPlan.setAccessInfo('trialing', in3);
const persisted = store.get('whop_access_info');
assert.ok(persisted, 'in localStorage geschrieben');
const neu = load(persisted);
assert.strictEqual(neu.UserPlan.isTrialActive(), true, 'nach Reload noch Trial');
assert.strictEqual(neu.UserPlan.getTrialDaysLeft(), 4, 'Tageszahl überlebt den Reload');
pass++; console.log('✓ Status überlebt den Reload');

// 7) Kaputte oder leere Persistenz darf nicht crashen und nichts behaupten
for (const bad of ['{kaputt', '{}', 'null', '[]', '']) {
    const l = load(bad);
    assert.strictEqual(l.UserPlan.isTrialActive(), false, 'kaputt (' + JSON.stringify(bad) + ') → kein Trial');
    assert.strictEqual(l.UserPlan.isPro(), true, 'Zugang bleibt auch bei kaputtem Wert');
}
pass++; console.log('✓ kaputte Persistenz: kein Trial, kein Crash, Zugang unberührt');

// 8) clearAccessInfo räumt auf (Logout-Pfad)
({ UserPlan, store } = load(undefined));
UserPlan.setAccessInfo('trialing', Date.now() + TAG);
UserPlan.clearAccessInfo();
assert.strictEqual(store.get('whop_access_info'), undefined, 'Eintrag entfernt');
assert.strictEqual(UserPlan.isTrialActive(), false, 'danach kein Trial');
pass++; console.log('✓ clearAccessInfo räumt Status und Speicher');

// ── Serverseite: der Status muss überhaupt ausgeliefert werden ────────────────────────────────
const acc = read('api/whop-access.js');
assert.ok(/status:\s+hasAccess \? \(det\.status \|\| null\) : null/.test(acc),
    'api/whop-access.js liefert status aus');
assert.ok(/renews_at:\s+hasAccess \? \(det\.renewsAt \|\| null\) : null/.test(acc),
    'api/whop-access.js liefert renews_at aus');
// Nur bei bestehendem Zugang — bei einem abgelehnten Zugriff hat der Client damit nichts zu tun
assert.ok(!/status:\s+det\.status/.test(acc), 'kein bedingungsloses Ausliefern');
pass++; console.log('✓ Server liefert status und renews_at (nur bei Zugang)');

// ── Dashboard: der Hinweis muss verdrahtet sein, sonst bleibt der Trial unsichtbar ────────────
const dash = read('js/dashboard.js');
assert.ok(/_renderTrialHinweis\(\)\s*\{/.test(dash), 'Hinweis-Funktion existiert');
assert.ok(/\$\{this\._renderTrialHinweis\(\)\}/.test(dash), 'und wird im Template aufgerufen');
assert.ok(/UserPlan\.isTrialActive\(\)/.test(dash), 'prüft den Trial-Status');
assert.ok(/typeof UserPlan === 'undefined'/.test(dash), 'defensiv gegen fehlendes UserPlan');
// Der Hinweis darf keine Zahl erfinden, wenn der Zeitpunkt fehlt
assert.ok(/tage === null/.test(dash), 'behandelt unbekannte Tageszahl eigens');
// Der Hinweis muss in BEIDEN Zweigen stehen. render() steigt bei leerer Datenlage in
// _renderFirstRun() aus — und ein Trial-Nutzer in den ersten Tagen hat noch keine Daten, ist
// also genau dieser Fall. Nur im Haupt-Template wäre der Hinweis für die Zielgruppe unsichtbar.
// Das ist beim Bauen passiert und erst in der Browser-Prüfung aufgefallen.
assert.strictEqual((dash.match(/\$\{this\._renderTrialHinweis\(\)\}/g) || []).length, 2,
    'Hinweis im Haupt-Template UND im First-Run-Zweig');
pass++; console.log('✓ Dashboard rendert den Hinweis in beiden Zweigen, ohne Zahl zu erfinden');

// ── Die eine noch fehlende Zeile ist dokumentiert ─────────────────────────────────────────────
// js/whop-auth.js hält eine andere Session; ohne diesen Aufruf bleibt der Trial unsichtbar.
assert.ok(/UserPlan\.setAccessInfo\(accJson\.status, accJson\.renews_at\)/.test(src),
    'die nötige Verdrahtungszeile steht als Hinweis im Code');
pass++; console.log('✓ fehlende Verdrahtung in whop-auth.js ist im Code benannt');

console.log('\n' + pass + '/11 Tests bestanden ✅');
