// Harness fuer scripts/lager-dubletten.js — den Auswerter des Kunden-Lagerexports.
//
// Der Auswerter entscheidet, in welcher Haelfte des Codes gesucht wird. Zaehlt er falsch,
// schickt er die Fehlersuche in die falsche Richtung — teurer als gar keine Zahl. Deshalb
// ist jeder der beiden Faelle einzeln geprueft, plus die Gegenprobe auf saubere Daten.
//
// Der CSV-Parser bekommt eigenes Gewicht: das Notizen-Feld des Exports darf Semikolons,
// Anfuehrungszeichen und Zeilenumbrueche enthalten. Ein Parser, der daran zerbricht, liefert
// eine falsche Spaltenzahl und damit einen Bericht, dem man den Fehler nicht ansieht.

const { parseCsv, werteAus } = require('../scripts/lager-dubletten.js');

let pass = 0, total = 0;
function check(name, ok) {
    total++;
    if (ok) { pass++; console.log('OK    ' + name); }
    else console.log('FAIL  ' + name);
}

const KOPF = '"Art.-Nr.";"Datum";"Marke";"Artikeltyp";"Beschreibung";"Größe";"EK (€)";"Status";"Lagerort";"Quelle";"Notizen"';
function zeile(nr, datum, marke, beschr, ek, notiz) {
    return ['"' + nr + '"', '"' + datum + '"', '"' + marke + '"', '""',
            '"' + beschr + '"', '""', '"' + ek + '"', '"Verfügbar"', '""', '""',
            '"' + (notiz || '') + '"'].join(';');
}
const bauCsv = (...zeilen) => '﻿' + [KOPF, ...zeilen].join('\r\n');
// lies() entfernt den BOM sonst; hier direkt werteAus() gefuettert.
const ohneBom = (s) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;

console.log('\n== CSV-Parser ==');
{
    const r = parseCsv('"a";"b"\r\n"1";"2"\r\n', ';');
    check('Grundfall: 2 Zeilen, 2 Spalten', r.length === 2 && r[0].length === 2 && r[1][1] === '2');
}
{
    // Der echte Fallstrick: Semikolon INNERHALB eines Feldes.
    const r = parseCsv('"a";"b"\r\n"x;y";"2"\r\n', ';');
    check('Semikolon im Feld zerlegt die Zeile nicht', r[1].length === 2 && r[1][0] === 'x;y');
}
{
    const r = parseCsv('"a";"b"\r\n"Zeile1\nZeile2";"2"\r\n', ';');
    check('Zeilenumbruch im Feld erzeugt keine neue Zeile', r.length === 2 && r[1][0] === 'Zeile1\nZeile2');
}
{
    const r = parseCsv('"a"\r\n"er sagte ""hallo"""\r\n', ';');
    check('doppeltes Anfuehrungszeichen wird entpackt', r[1][0] === 'er sagte "hallo"');
}

console.log('\n== Saubere Daten ==');
{
    const r = werteAus(ohneBom(bauCsv(
        zeile('2026-001', '2026-01-01', 'Nike', 'Air Max', '80,00'),
        zeile('2026-002', '2026-01-02', 'Adidas', 'Samba', '60,00')
    )));
    check('keine Nummern-Dublette', r.nrDubletten.length === 0);
    check('keine Inhalts-Dublette', r.inhaltDubletten.length === 0);
    check('Zeilenzahl stimmt', r.gesamt === 2);
}

console.log('\n== Fall A: gleiche Artikelnummer ==');
{
    const r = werteAus(ohneBom(bauCsv(
        zeile('2026-001', '2026-01-01', 'Nike', 'Air Max', '80,00'),
        zeile('2026-001', '2026-01-01', 'Nike', 'Air Max', '80,00'),
        zeile('2026-002', '2026-01-02', 'Adidas', 'Samba', '60,00')
    )));
    check('Fall A erkannt', r.nrDubletten.length === 1 && r.nrDubletten[0][1].length === 2);
    check('Fall A wird NICHT zusaetzlich als Fall B gezaehlt', r.inhaltDubletten.length === 0);
    check('CSV-Zeilennummern stimmen (2 und 3)',
        r.nrDubletten[0][1].map(x => x.zeile).join(',') === '2,3');
}

console.log('\n== Fall B: gleicher Inhalt, verschiedene Nummern ==');
{
    const r = werteAus(ohneBom(bauCsv(
        zeile('2026-001', '2026-01-01', 'Nike', 'Air Max', '80,00'),
        zeile('2026-002', '2026-01-01', 'Nike', 'Air Max', '80,00')
    )));
    check('Fall B erkannt', r.inhaltDubletten.length === 1);
    check('Fall B erzeugt keine Nummern-Dublette', r.nrDubletten.length === 0);
}

console.log('\n== Keine Falschmeldung bei aehnlichen Artikeln ==');
{
    // Gleiche Marke, gleicher Tag, aber anderer Artikel und anderer Preis: kein Befund.
    const r = werteAus(ohneBom(bauCsv(
        zeile('2026-001', '2026-01-01', 'Nike', 'Air Max', '80,00'),
        zeile('2026-002', '2026-01-01', 'Nike', 'Air Force', '90,00')
    )));
    check('verschiedene Artikel sind keine Dublette', r.inhaltDubletten.length === 0);
}

console.log('\n== Zeilen ohne Artikelnummer ==');
{
    const r = werteAus(ohneBom(bauCsv(
        zeile('', '2026-01-01', 'Nike', 'Air Max', '80,00'),
        zeile('', '2026-01-02', 'Adidas', 'Samba', '60,00'),
        zeile('2026-003', '2026-01-03', 'Puma', 'Suede', '50,00')
    )));
    check('ohne Nummer wird gezaehlt', r.ohneNr === 2);
    check('leere Nummern zaehlen nicht als Fall A', r.nrDubletten.length === 0);
}

console.log('\n== XLSX wird deutlich abgewiesen ==');
{
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const p = path.join(os.tmpdir(), 'stackr-test-' + Date.now() + '.xlsx');
    fs.writeFileSync(p, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));   // ZIP-Signatur
    const { execFileSync } = require('child_process');
    let meldung = '';
    try {
        execFileSync(process.execPath, [__dirname + '/../scripts/lager-dubletten.js', p],
                     { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { meldung = String(e.stderr || ''); }
    fs.unlinkSync(p);
    check('XLSX nennt den Ausweg (CSV Export)', /CSV Export/.test(meldung));
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
process.exit(pass === total ? 0 : 1);
