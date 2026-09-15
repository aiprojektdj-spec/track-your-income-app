// Ein Klammerfehler, der still zu falschen Steuerzahlen fuehrt.
//
//     parseFloat(pos.einzelpreis || 0)     <- falsch: `|| 0` INNERHALB der Klammer
//     (parseFloat(pos.einzelpreis) || 0)   <- richtig
//
// Die falsche Fassung faengt nur leer, null und undefined ab. Ein nicht-numerischer Wert
// ("k.A.", ein Importrest, ein Komma statt Punkt in Altdaten) kommt als NaN heraus, und NaN
// steckt jede Summe an, in die es faellt. Das Tueckische daran: NaN ist in JEDEM Vergleich
// false. Eine Schwellenpruefung `summe > GRENZE` meldet dann nicht etwa einen Fehler, sondern
// schlicht "Schwelle nicht erreicht".
//
// Gefunden am 2026-09-15 in js/oss.js beim Bauen des OSS-Harness, danach per Sweep an zwei
// weiteren Stellen mit demselben Muster:
//
//   js/oss.js:39              OSS-Schwelle §3c Abs. 4 UStG — NaN heisst "nie gerissen", der
//                             Nutzer bleibt ungewarnt und versteuert weiter mit deutscher USt
//   js/ustvoranmeldung.js     §25a-Marge fuer Kz. 81 der Voranmeldung — geht ans Finanzamt
//   js/datev.js               Netto und MwSt je Buchungszeile — geht an den Steuerberater
//
// Alle drei am 2026-09-15 gefixt. Dieser Harness prueft nicht die drei Stellen einzeln,
// sondern dass das MUSTER nicht zurueckkommt — auch nicht an einer vierten Stelle. Das ist
// die Lehre aus Fund A3 (plan/funde-vollaudit-2026-09-09.md): ein Fix dort, wo ein Fehler
// auffaellt, schliesst ihn nicht unbedingt.
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

// Kommentare raus, sonst treffen die Regexe die Erklaerungen, die den Fix beschreiben.
function codeOhneKommentare(datei) {
    return fs.readFileSync(datei, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

// Alle .js im Projekt ausser vendor und node_modules.
function alleModule() {
    const wurzel = path.join(__dirname, '..');
    const dirs = ['js', 'api', 'rechnungen/js', 'lager/js', 'eigenbelege/js'];
    const out = [];
    dirs.forEach(d => {
        const p = path.join(wurzel, d);
        if (!fs.existsSync(p)) return;
        fs.readdirSync(p).filter(f => f.endsWith('.js')).forEach(f => out.push(path.join(p, f)));
    });
    return out;
}

const module_ = alleModule();
check('Der Sweep findet ueberhaupt Dateien', module_.length > 40);

// ── Das Muster darf nirgends mehr stehen ─────────────────────────────────────
// Gesucht wird `parseFloat( <irgendwas> || 0 )` auf einem Feld, das gerechnet wird.
// Bewusst eng gefasst auf die Felder, bei denen ein NaN in eine Summe laeuft.
const FELDER = ['einzelpreis', 'menge', 'betrag', 'einkaufspreis', 'verkaufspreis',
                'gesamtkosten', 'erstattungBetrag', 'kosten'];
{
    const treffer = [];
    module_.forEach(datei => {
        const src = codeOhneKommentare(datei);
        FELDER.forEach(feld => {
            const re = new RegExp('parseFloat\\(\\s*[A-Za-z_$][\\w$.]*\\.' + feld + '\\s*\\|\\|\\s*0\\s*\\)', 'g');
            let m;
            while ((m = re.exec(src)) !== null) {
                treffer.push(path.relative(path.join(__dirname, '..'), datei) + ': ' + m[0]);
            }
        });
    });
    check('Kein `parseFloat(x.<rechenfeld> || 0)` mehr im Projekt', treffer.length === 0);
    treffer.forEach(t => console.error('   → ' + t));
}

// ── Dasselbe Muster in JEDER Form, nicht nur auf bekannten Feldnamen ─────────
// Ergaenzt am 2026-09-15. Die Pruefung oben verlangt einen Punktzugriff auf einen Feldnamen
// aus FELDER. Deshalb meldete sie "kein Treffer", waehrend `parseFloat(n || 0)` mit einer
// NACKTEN Variablen noch an fuenf Stellen stand — und zwar ausgerechnet in Formatierern:
//
//   rechnungen/js/xrechnung.js  amt()    → bekommt in Zeile 224 mit li.einzelpreis ein ROHES
//                                          Feld; "NaN" im XML macht die Rechnung nach
//                                          EN 16931 ungueltig
//   js/datev.js                 amtDe()  → schreibt die Umsatzspalte des Buchungsstapels
//   js/utils.js                 formatCurrency() → "NaN €" quer durch die App
//   js/steuerberater.js         fmtCur()
//   eigenbelege/js/app.js       Bruttobetrag (dort kein lebender Fehler, s. Kommentar dort)
//
// Ein Waechter, der "sauber" meldet, waehrend das Muster weiterlebt, ist schaedlicher als
// keiner: er erzeugt Sicherheit, die es nicht gibt. Deshalb hier bewusst weit gefasst, mit
// einer kurzen, begruendeten Ausnahmeliste statt einer engen Suche.
{
    // Einzige erlaubte Ausnahme: ein AEUSSERES `||` faengt das NaN ab und setzt einen eigenen
    // Rueckfallwert dahinter (`(parseFloat(x || 0)) || y`). Nachgerechnet: NaN || y === y.
    // Modul ist seit der CH/AT-Entfernung dormant (plan/ch-at-removal-web.md).
    const ERLAUBT = ['oesterreich.js'];
    const weit = /parseFloat\(\s*[^()]*\|\|\s*0\s*\)/g;
    const treffer = [];
    module_.forEach(datei => {
        if (ERLAUBT.some(a => datei.endsWith(a))) return;
        const src = codeOhneKommentare(datei);
        let m;
        while ((m = weit.exec(src)) !== null) {
            treffer.push(path.relative(path.join(__dirname, '..'), datei) + ': ' + m[0].trim());
        }
    });
    check('Auch mit nackter Variable steht das Muster nirgends mehr', treffer.length === 0);
    treffer.forEach(t => console.error('   → ' + t));

    // Gegenprobe, damit die weite Suche nicht bloss deshalb gruen ist, weil sie nichts findet:
    // sie muss die alte Form erkennen, wenn man sie ihr vorlegt.
    weit.lastIndex = 0;
    check('Die weite Suche erkennt die alte Form ueberhaupt',
        weit.test('return parseFloat(n || 0).toFixed(2);'));
    weit.lastIndex = 0;
    check('…und schlaegt bei der richtigen Form nicht an',
        !weit.test('return (parseFloat(n) || 0).toFixed(2);'));
}

// ── Die drei behobenen Stellen tragen jetzt die richtige Form ────────────────
{
    const erwartet = [
        ['js/oss.js',              '(parseFloat(p.einzelpreis) || 0)'],
        ['js/ustvoranmeldung.js',  '(parseFloat(pos.einzelpreis) || 0)'],
        ['js/datev.js',            '(parseFloat(pos.einzelpreis) || 0)'],
    ];
    erwartet.forEach(([rel, form]) => {
        const src = codeOhneKommentare(path.join(__dirname, '..', rel));
        check(rel + ' rechnet mit `' + form + '`', src.indexOf(form) !== -1);
    });
}

// ── Und das Verhalten selbst, an der reinen Formel ───────────────────────────
// Damit der Harness nicht nur Text prueft: beide Fassungen nebeneinander.
{
    const falsch  = (p) => (parseFloat(p.menge) || 0) * parseFloat(p.einzelpreis || 0);
    const richtig = (p) => (parseFloat(p.menge) || 0) * (parseFloat(p.einzelpreis) || 0);

    const kaputt = { menge: 2, einzelpreis: 'k.A.' };
    check('Zur Erinnerung: die alte Fassung ergibt NaN', Number.isNaN(falsch(kaputt)));
    check('Die neue Fassung ergibt 0', richtig(kaputt) === 0);

    // Der eigentliche Schaden: NaN ist in jedem Vergleich false.
    const summeAlt  = 20000 + falsch(kaputt);
    const summeNeu  = 20000 + richtig(kaputt);
    check('NaN laesst eine gerissene Schwelle als nicht gerissen erscheinen',
        (summeAlt > 10000) === false && (summeNeu > 10000) === true);

    // Bei gueltigen Daten sind beide Fassungen gleich — der Fix aendert nichts Bestehendes.
    [['', 0], [null, 0], [undefined, 0], [0, 0], ['50', 100], [50, 100], ['12.5', 25]]
        .forEach(([ep, soll]) => {
            const p = { menge: 2, einzelpreis: ep };
            check('Gueltige Eingabe unveraendert: einzelpreis=' + JSON.stringify(ep) + ' -> ' + soll,
                richtig(p) === soll && (Number.isNaN(falsch(p)) || falsch(p) === soll));
        });
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
