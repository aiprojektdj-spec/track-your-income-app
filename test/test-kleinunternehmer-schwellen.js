// Self-Test der §19-UStG-Schwellenwertlogik:  node test/test-kleinunternehmer-schwellen.js
//
// js/app.js kann in Node nicht direkt per require() geladen werden — App.pages referenziert
// ~25 Browser-Globals (Dashboard, Buchungen, ...) die beim Auswerten des Objekt-Literals sofort
// einen ReferenceError werfen, und am Dateiende hängt ein document.addEventListener(...)-Aufruf.
// Statt die Datei invasiv modulfähig zu machen (außerhalb des erlaubten Scopes), wird die reine
// _getUstGrenzen-Funktion direkt aus dem Quelltext von js/app.js extrahiert und isoliert ausgeführt
// (testet also den ECHTEN Code, nicht eine Kopie). Die beiden Vergleichsoperatoren (> statt >=) in
// _checkUstThreshold werden zusätzlich per Quelltext-Assertion abgesichert, damit ein Rückfall auf
// „>=" hier auffliegt, auch wenn _checkUstThreshold selbst (DOM/Store-Aufrufe) nicht ausführbar ist.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const akademieSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'akademie.js'), 'utf8');

let pass = 0, fail = 0;
function eq(name, got, want) {
    const g = JSON.stringify(got);
    const w = JSON.stringify(want);
    if (g === w) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + ' — got ' + g + ' want ' + w); fail++; }
}
function ok(name, cond) {
    if (cond) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + ' — Bedingung falsch'); fail++; }
}

// ── _getUstGrenzen(year) aus js/app.js extrahieren und live ausführen ──────────────────
const grenzenMatch = appSrc.match(/_getUstGrenzen\(year\)\s*\{([\s\S]*?)\n\s*\},/);
assert(grenzenMatch, '_getUstGrenzen konnte nicht aus js/app.js extrahiert werden — Funktion umbenannt/verschoben?');
const getUstGrenzen = new Function('year', grenzenMatch[1]);

// ── Historische Schwellenwerte (verifiziert per §19 UStG / IHK / nwb.de, siehe Audit-Kommentar
//    in js/app.js): vor 2020 → 17.500/50.000 €; 2020–2024 → 22.000/50.000 €; ab 2025 → 25.000/100.000 € ──
eq('Grenzen 2026 (aktuell)', getUstGrenzen(2026), { vj: 25000, lfd: 100000 });
eq('Grenzen 2025 (erstes Jahr neue Fassung)', getUstGrenzen(2025), { vj: 25000, lfd: 100000 });
eq('Grenzen 2024 (alte Fassung, letztes Jahr)', getUstGrenzen(2024), { vj: 22000, lfd: 50000 });
eq('Grenzen 2020 (Einführung 22k/50k)', getUstGrenzen(2020), { vj: 22000, lfd: 50000 });
eq('Grenzen 2019 (Ur-Fassung 17.500)', getUstGrenzen(2019), { vj: 17500, lfd: 50000 });
eq('Grenzen 2010 (Ur-Fassung)', getUstGrenzen(2010), { vj: 17500, lfd: 50000 });

// ── Operator-Fix absichern: strikt "größer als" (>), nicht ">=" ────────────────────────
ok('obere Grenze prüft strikt ">" (nicht ">=")',
    /if\s*\(umsatz\s*>\s*GRENZE_LFD\)/.test(appSrc) && !/if\s*\(umsatz\s*>=\s*GRENZE_LFD\)/.test(appSrc));
ok('Vorjahresgrenze prüft strikt ">" (nicht ">=")',
    /if\s*\(umsatz\s*>\s*GRENZE_VJ\)/.test(appSrc) && !/if\s*\(umsatz\s*>=\s*GRENZE_VJ\)/.test(appSrc));

// ── End-to-End-Klassifikation: nutzt die ECHTE getUstGrenzen() + die (quelltext-verifizierten)
//    ">"-Vergleiche, um die drei geforderten Szenarien nachzubilden ─────────────────────
function classify(umsatz, year) {
    const { vj, lfd } = getUstGrenzen(year);
    if (umsatz > lfd) return 'sofort';     // 100k/50k/50k-Grenze überschritten → sofortiger Wechsel
    if (umsatz > vj)  return 'folgejahr';  // Vorjahresgrenze überschritten → Wechsel ab Folgejahr
    return 'klein';                        // Kleinunternehmer bleibt bestehen
}

// Szenario 1: exakt 25.000,00 € Vorjahresumsatz (2026) → Grenze NICHT überschritten → bleibt Kleinunternehmer
eq('Vorjahresumsatz exakt 25.000,00 € (2026) → Kleinunternehmer bleibt', classify(25000.00, 2026), 'klein');

// Szenario 2: 25.000,01 € (2026) → Grenze überschritten → Wechsel ab Folgejahr
eq('Vorjahresumsatz 25.000,01 € (2026) → Wechsel zur Regelbesteuerung', classify(25000.01, 2026), 'folgejahr');

// Szenario 3: 23.000 € im Jahr 2022 → historische Grenze (22.000 €) bereits überschritten,
// obwohl 23.000 € < 25.000 € (aktuelle, aber für 2022 falsche Grenze) — testet die Jahres-Differenzierung
eq('Vorjahresumsatz 23.000 € im Jahr 2022 → historische 22k-Grenze überschritten', classify(23000, 2022), 'folgejahr');
// Gegenprobe: dieselben 23.000 € wären 2026 noch unter der (höheren) aktuellen Grenze
eq('Gegenprobe: dieselben 23.000 € wären 2026 noch Kleinunternehmer', classify(23000, 2026), 'klein');

// ── Akademie: Achievement-Schwelle und -Text müssen konsistent sein (beide 25.000 €) ───
const achMatch = akademieSrc.match(/\{\s*id:\s*'umsatz_25k'[\s\S]*?\}/);
ok('Achievement umsatz_25k existiert (umbenannt von umsatz_22k)', !!achMatch);
if (achMatch) {
    const block = achMatch[0];
    ok('Achievement-Text nennt 25.000-€-Grenze', /25\.000-€-Grenze/.test(block));
    ok('Achievement-Check löst bei >= 25000 aus', /d\.totalRevenue >= 25000/.test(block));
    ok('Achievement-Check nutzt NICHT mehr die alte 22000-Schwelle', !/d\.totalRevenue >= 22000/.test(block));
}
// alte ID darf nicht mehr vorkommen (durchgängig umbenannt)
ok('alte Achievement-ID umsatz_22k kommt nicht mehr vor', !/umsatz_22k/.test(akademieSrc));
// keine veralteten 22.000/50.000-Angaben mehr im Kleinunternehmer-Kontext
ok('js/akademie.js enthält keine veralteten 22.000/50.000-€-Angaben mehr',
    !/22\.000\s*€/.test(akademieSrc) && !/50\.000\s*€/.test(akademieSrc));

console.log('\n' + pass + '/' + (pass + fail) + ' Tests bestanden ' + (fail ? '❌' : '✅'));
process.exit(fail ? 1 : 0);
