// js/rechtsform.js — die Weiche, an der Gewerbesteuerpflicht, Freibetrag, Bilanzpflicht
// und Feststellungserklaerung haengen.
//
// Das Modul hatte bis zum 2026-09-12 keinen Test (Kategorie C,
// plan/funde-vollaudit-2026-09-09.md), obwohl js/gewerbesteuer.js seine Antworten
// ungeprueft in Steuerbetraege umsetzt. Beim Schreiben dieses Tests fiel Fund A6 auf:
// ueberschreitetAO141Schwelle() zog den Gewinn aus einer fuenften eigenen Formel.
//
// Die Datei laesst sich als Ganzes laden (ein const-Objekt, kein Top-Level-Code), deshalb
// hier kein Extrahieren einzelner Methoden wie in den uebrigen Harnessen.
'use strict';
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/rechtsform.js', 'utf8');
const ladeRechtsform = () => new Function(src + '\nreturn Rechtsform;')();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

// Store-Mock: firmenform + taetigkeitsart sind die beiden Stellschrauben.
function setze(firmenform, taetigkeitsart) {
    const einst = {};
    if (firmenform)     einst.firmenform = firmenform;
    if (taetigkeitsart) einst.taetigkeitsart = taetigkeitsart;
    global.Store = { get: () => einst, set: () => {} };
}

const R = ladeRechtsform();

// ── Gewerbesteuerpflicht ─────────────────────────────────────────────────────
{
    setze('Einzelunternehmen');
    check('GewSt: Einzelunternehmen ist gewerbesteuerpflichtig', R.brauchtGewSt('Einzelunternehmen') === true);
    // §18 EStG: freiberufliche Taetigkeit ist kein Gewerbebetrieb -> keine Gewerbesteuer.
    check('GewSt: Freiberufler zahlt keine Gewerbesteuer', R.brauchtGewSt('Freiberufler') === false);
    check('GewSt: GmbH ist gewerbesteuerpflichtig', R.brauchtGewSt('GmbH') === true);
}
{
    // Die Taetigkeitsart schlaegt die Rechtsform: eine freiberufliche GbR (z.B. Aerzte)
    // ist kein Gewerbebetrieb, obwohl GbR in FORMEN gewerbesteuer:true traegt.
    setze('GbR', 'freiberuflich');
    check('GewSt: freiberufliche GbR zahlt keine Gewerbesteuer', R.brauchtGewSt() === false);
    setze('GbR', 'gewerblich');
    check('GewSt: gewerbliche GbR zahlt Gewerbesteuer', R.brauchtGewSt() === true);
    // Die Taetigkeitsart darf NUR dort greifen, wo sie vorgesehen ist.
    setze('OHG', 'freiberuflich');
    check('GewSt: OHG bleibt gewerbesteuerpflichtig, Taetigkeitsart hin oder her',
        R.brauchtGewSt() === true);
}

// ── Freibetrag §11 Abs. 1 GewStG: nur natuerliche Personen und Personengesellschaften ──
{
    setze('Einzelunternehmen');
    const frei = (f) => parseFloat(R.getConfig(f).gewStFreibetrag) || 0;
    check('Freibetrag: Einzelunternehmen 24.500 EUR', frei('Einzelunternehmen') === 24500);
    check('Freibetrag: GbR 24.500 EUR',               frei('GbR') === 24500);
    check('Freibetrag: GmbH & Co. KG 24.500 EUR',     frei('GmbH & Co. KG') === 24500);
    // Kapitalgesellschaften bekommen ihn nicht.
    check('Freibetrag: GmbH bekommt keinen', frei('GmbH') === 0);
    check('Freibetrag: UG bekommt keinen',   frei('UG') === 0);
    // Freiberufler zahlt gar keine GewSt, entsprechend kein Freibetrag.
    check('Freibetrag: Freiberufler 0',      frei('Freiberufler') === 0);
    // js/gewerbesteuer.js::_hatFreibetrag() prueft > 0 (numerisch, nicht === true) —
    // der Vergleich war dort einmal ein Boolean-Vergleich und griff nie.
    check('Freibetrag: Werte sind numerisch, nicht boolean',
        ['Einzelunternehmen', 'GbR', 'GmbH'].every(f => typeof R.getConfig(f).gewStFreibetrag === 'number'));
}

// ── Gewerblich / freiberuflich ───────────────────────────────────────────────
{
    setze('Freiberufler');
    check('gewerblich: Freiberufler nie', R.istGewerblich('Freiberufler') === false);
    setze('GmbH');
    check('gewerblich: Kapitalgesellschaft immer', R.istGewerblich('GmbH') === true);
    setze('OHG');
    check('gewerblich: OHG immer', R.istGewerblich('OHG') === true);
    setze('Einzelunternehmen', 'freiberuflich');
    check('gewerblich: Einzelunternehmen folgt der Taetigkeitsart', R.istGewerblich() === false);
    setze('Einzelunternehmen', 'gewerblich');
    check('gewerblich: ... und zwar in beide Richtungen', R.istGewerblich() === true);
    setze('Einzelunternehmen');
    check('gewerblich: ohne Angabe gilt gewerblich (bisheriges Verhalten)', R.istGewerblich() === true);
}

// ── Rechtsform-Kategorien ────────────────────────────────────────────────────
{
    setze('Einzelunternehmen');
    check('Kategorie: GbR/eGbR/OHG/KG/GmbH & Co. KG sind Personengesellschaften',
        ['GbR', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG'].every(f => R.isPersonengesellschaft(f)));
    check('Kategorie: Einzelunternehmen ist keine Personengesellschaft',
        R.isPersonengesellschaft('Einzelunternehmen') === false);
    check('Kategorie: GmbH und UG sind Kapitalgesellschaften',
        R.isKapitalgesellschaft('GmbH') && R.isKapitalgesellschaft('UG'));
    // Die GmbH & Co. KG ist eine PERSONENgesellschaft — der Komplementaer ist die
    // Kapitalgesellschaft, nicht die KG selbst. Entsprechend keine Koerperschaftsteuer.
    check('Kategorie: GmbH & Co. KG ist KEINE Kapitalgesellschaft',
        R.isKapitalgesellschaft('GmbH & Co. KG') === false);
    check('KSt: GmbH & Co. KG zahlt keine Koerperschaftsteuer',
        R.brauchtKSt('GmbH & Co. KG') === false);
    check('KSt: GmbH und UG zahlen Koerperschaftsteuer',
        R.brauchtKSt('GmbH') === true && R.brauchtKSt('UG') === true);
}

// ── Feststellungserklaerung (§180 AO) und Bilanzpflicht (HGB) ────────────────
{
    setze('Einzelunternehmen');
    check('Feststellung: alle Personengesellschaften',
        ['GbR', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG'].every(f => R.brauchtFeststellung(f)));
    check('Feststellung: Einzelunternehmen und Freiberufler nicht',
        !R.brauchtFeststellung('Einzelunternehmen') && !R.brauchtFeststellung('Freiberufler'));
    check('Bilanz: OHG/KG/GmbH & Co. KG kraft HGB-Kaufmannseigenschaft',
        ['OHG', 'KG', 'GmbH & Co. KG'].every(f => R.brauchtBilanz(f)));
    check('Bilanz: Freiberufler nie bilanzpflichtig', R.brauchtBilanz('Freiberufler') === false);
}

// ── §141 AO — die Weiche, die js/euer.js die EUER-Seite abschalten laesst ────
{
    setze('Einzelunternehmen', 'gewerblich');
    check('§141: Grenzen stehen auf dem Stand seit 1.1.2024 (800.000 / 80.000)',
        R.AO141_UMSATZ_GRENZE === 800000 && R.AO141_GEWINN_GRENZE === 80000);

    global.GbrModul = { _calcJahresgewinn: () => ({ einnahmen: 300000, gewinn: 65000 }) };
    check('§141: unter beiden Grenzen -> EUER bleibt', R.brauchtBilanzStattEuer(2026) === false);

    global.GbrModul = { _calcJahresgewinn: () => ({ einnahmen: 300000, gewinn: 85000 }) };
    check('§141: Gewinn ueber 80.000 -> Bilanz', R.brauchtBilanzStattEuer(2026) === true);

    // Ein freiberuflicher Betrieb faellt nicht unter §141 AO, egal wie hoch der Gewinn ist.
    setze('Einzelunternehmen', 'freiberuflich');
    check('§141: freiberuflich -> keine Bilanzpflicht trotz hohem Gewinn',
        R.brauchtBilanzStattEuer(2026) === false);

    // Kapitalgesellschaften und HGB-Kaufleute brauchen die Schwelle gar nicht.
    setze('GmbH');
    check('§141: GmbH braucht immer Bilanz', R.brauchtBilanzStattEuer(2026) === true);
    setze('OHG');
    check('§141: OHG braucht immer Bilanz (bilanzPflicht)', R.brauchtBilanzStattEuer(2026) === true);
}

// ── Robustheit ───────────────────────────────────────────────────────────────
{
    setze('Einzelunternehmen');
    // Unbekannte Form faellt bewusst auf Einzelunternehmen zurueck, statt undefined zu liefern
    // — sonst wuerde getConfig(...).gewerbesteuer werfen und die Seite bliebe leer.
    check('Robust: unbekannte Rechtsform faellt auf Einzelunternehmen zurueck',
        R.getConfig('Fantasieform GmbH & Partner').label === R.FORMEN['Einzelunternehmen'].label);
    check('Robust: set() weist unbekannte Rechtsform ab', R.set('Fantasieform') === false);
    check('Robust: set() nimmt bekannte Rechtsform an', R.set('GmbH') === true);

    global.Store = { get: () => ({}), set: () => {} };
    check('Robust: ohne gespeicherte Form gilt Einzelunternehmen', R.get() === 'Einzelunternehmen');

    delete global.GbrModul;
    setze('Einzelunternehmen', 'gewerblich');
    check('Robust: ohne GbrModul keine Bilanzpflicht behaupten',
        R.brauchtBilanzStattEuer(2026) === false);

    check('Robust: getAllOptions() liefert alle neun Formen mit Label',
        R.getAllOptions().length === Object.keys(R.FORMEN).length &&
        R.getAllOptions().every(o => o.value && o.label));
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
assert.ok(true);
