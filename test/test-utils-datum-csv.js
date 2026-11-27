// Utils.parseDateInput, Utils.toISODate, Utils.parseCSV (js/utils.js) — Testluecke A4 #9.
//
// Laedt den echten Code per ladeModule. Zeitzone fest auf Europe/Berlin, damit der
// Lokalzeit-Fix in toISODate (kein toISOString, sonst Vortag vor 1/2 Uhr nachts) auch in der
// CI unter UTC greifbar ist.
//
// bekannt(): dokumentiert einen gefundenen, noch nicht behobenen Fehler. Laesst den Lauf NICHT
// scheitern, meldet aber, sobald der Fehler behoben ist — dann in check() umwandeln.
'use strict';
process.env.TZ = 'Europe/Berlin';
const { ladeModule } = require('./_lade-module');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}
function bekannt(name, istKorrekt) {
    if (istKorrekt) console.log('✓ (Fund behoben, bekannt() -> check() umstellen) ' + name);
    else console.log('⚠ BEKANNTER FUND ' + name);
}

const U = ladeModule(['js/utils.js'], { document: undefined }).Utils;
const pd = s => U.parseDateInput(s);

// ── 1) parseDateInput ──────────────────────────────────────────────────────────
check("'19.04.2026' -> 2026-04-19", pd('19.04.2026') === '2026-04-19');
check("'19 04 2026' -> 2026-04-19", pd('19 04 2026') === '2026-04-19');
check("'19042026' (nur Ziffern, TTMMJJJJ) -> 2026-04-19", pd('19042026') === '2026-04-19');
check("'2026-04-19' bleibt unveraendert", pd('2026-04-19') === '2026-04-19');
check("'1.4.2026' -> 2026-04-01 (einstellig aufgefuellt, Tag vor Monat)", pd('1.4.2026') === '2026-04-01');
check("'19/4/2026' -> 2026-04-19", pd('19/4/2026') === '2026-04-19');
check("'2026-4-9' (ISO kurz) -> 2026-04-09", pd('2026-4-9') === '2026-04-09');
check("' 19.04.2026 ' (Leerzeichen) -> 2026-04-19", pd(' 19.04.2026 ') === '2026-04-19');
check("'01.12.2026' -> 2026-12-01 (nicht 2026-01-12)", pd('01.12.2026') === '2026-12-01');
check("'19.04' (ohne Jahr) -> ''", pd('19.04') === '');
check("'abc' -> ''", pd('abc') === '');
check("'' / null -> ''", pd('') === '' && pd(null) === '');
// Fund: zweistelliges Jahr wird zum Jahr 0026 statt 2026 (js/utils.js:145-151).
// Erreichbar: das Datumsfeld formatiert die Eingabe "190426" zu "19.04.26", _finishDate
// zeigt dann "19.04.0026" ohne roten Rahmen an.
bekannt("'19.04.26' -> 2026-04-19 (ist: " + pd('19.04.26') + ')', pd('19.04.26') === '2026-04-19');
// Fund: keine Plausibilitaetspruefung, 31.02. wird als ISO-Datum durchgereicht.
bekannt("'31.02.2026' -> '' (ist: " + pd('31.02.2026') + ')', pd('31.02.2026') === '');

// ── 2) toISODate: Lokalzeit, nicht UTC ─────────────────────────────────────────
check('Neujahr 00:30 Berlin -> 2026-01-01 (UTC waere 2025-12-31)', U.toISODate(new Date(2026, 0, 1, 0, 30)) === '2026-01-01');
check('Silvester 23:59 Berlin -> 2026-12-31', U.toISODate(new Date(2026, 11, 31, 23, 59)) === '2026-12-31');
check('Sommerzeit 01.07. 01:30 Berlin -> 2026-07-01 (UTC waere 30.06.)', U.toISODate(new Date(2026, 6, 1, 1, 30)) === '2026-07-01');
check('String-Eingabe mit Offset -> Lokaldatum', U.toISODate('2026-03-29T00:30:00+01:00') === '2026-03-29');
check('Monat/Tag zweistellig (2026-02-05)', U.toISODate(new Date(2026, 1, 5)) === '2026-02-05');
check("leer/null -> ''", U.toISODate(null) === '' && U.toISODate('') === '');

// ── 3) parseCSV ────────────────────────────────────────────────────────────────
let r = U.parseCSV('a;b;c\n1;2;3');
check('Semikolon-CSV: 2 Zeilen, 3 Spalten', r.length === 2 && r[1].length === 3 && r[1][2] === '3');
r = U.parseCSV('a,b\n"1,5",2');
check('Komma-CSV: Komma im Anfuehrungszeichen bleibt im Feld', r[1][0] === '1,5' && r[1][1] === '2');
r = U.parseCSV('a;b\n"x;y";"er sagte ""hi"""');
check('Semikolon in Anfuehrungszeichen + doppelte "" -> "', r[1][0] === 'x;y' && r[1][1] === 'er sagte "hi"');
r = U.parseCSV('a;b\r\n1;2\r\n\r\n   \n3;4');
check('CRLF und Leerzeilen: 3 Zeilen', r.length === 3 && r[2][0] === '3' && r[1][1] === '2');
r = U.parseCSV('a;b\n 1 ; 2 ');
check('Felder getrimmt', r[1][0] === '1' && r[1][1] === '2');
r = U.parseCSV('Name,Betrag;x\n1,2;3');
check('Trenner aus Kopfzeile: ein ; dort -> ; gilt (Komma bleibt im Feld, Dezimalkomma)', r[1][0] === '1,2' && r[1][1] === '3');
r = U.parseCSV('a;b\n1;');
check('leeres letztes Feld bleibt erhalten', r[1].length === 2 && r[1][1] === '');
check("leerer Text -> []", U.parseCSV('').length === 0 && U.parseCSV('\n\n').length === 0);
// Fund: Zeilenumbruch in einem Feld mit Anfuehrungszeichen (RFC 4180) zerreisst den Datensatz,
// weil vor dem Quote-Parsing an \n gesplittet wird (js/utils.js:475). Trifft z. B. mehrzeilige
// Beschreibungen aus Excel-Exporten in den Importen (buchungen, import-ausgaben, import-eigenbelege).
r = U.parseCSV('a;b\n"zeile1\nzeile2";2');
bekannt('mehrzeiliges Feld in "" bleibt ein Datensatz (ist: ' + JSON.stringify(r) + ')',
    r.length === 2 && r[1][0] === 'zeile1\nzeile2' && r[1][1] === '2');

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
