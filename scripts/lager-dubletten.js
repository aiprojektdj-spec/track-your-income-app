#!/usr/bin/env node
// Auswerter fuer einen Stackr-Lager-Export (CSV) — Fernsupport bei "alles doppelt".
//
//   node scripts/lager-dubletten.js <Lager_Export_2026-09-13.csv>
//
// Warum es das gibt: meldet ein Kunde doppelte Lagereintraege, laesst sich aus der
// Ferne nicht sagen, welcher von zwei grundverschiedenen Faellen vorliegt:
//
//   A) DERSELBE Datensatz liegt zweimal im Bestand  -> gleiche Artikelnummer.
//      Kein Schreibpfad erzeugt das; dann hat ein Merge oder eine Migration danebengegriffen.
//   B) ZWEI echte Speichervorgaenge                 -> gleicher Inhalt, verschiedene Nummern.
//      Store.savePurchase() vergibt die Nummer laufend (YYYY-NNN), zwei Speicherungen
//      bekommen deshalb zwangslaeufig verschiedene.
//
// Die Unterscheidung entscheidet, wo gesucht wird — deshalb ist sie die erste Frage.
//
// Grenzen, die der Bericht selbst nennt, weil sie zu falschen Schluessen fuehren:
//   - Der Export nimmt die GEFILTERTE Ansicht (js/lager.js, _lastAllFiltered). Stand im
//     Lager ein Filter, fehlen Zeilen.
//   - Stornierte Artikel sind nicht enthalten (Store.getPurchases() ohne Argument).
//   - Die interne id steht nicht im Export. Die Artikelnummer ist ein guter, aber kein
//     beweissicherer Ersatz: manuell vergebene Nummern koennen einen doppelt gelaufenen
//     Import wie Fall A aussehen lassen. Im Zweifel entscheidet der Diagnose-Export
//     (App._dublettenBefund), der ueber die echte id zaehlt.

'use strict';
const fs = require('fs');

// ── CSV-Parser ───────────────────────────────────────────────────────────────
// Bewusst ein echter Zustandsautomat statt split(';'): das Notizen-Feld darf
// Semikolons, Anfuehrungszeichen und Zeilenumbrueche enthalten. Ein naives Split
// zerlegt so eine Datei still in die falsche Spaltenzahl — und der Bericht waere
// Unsinn, ohne dass man es sieht.
function parseCsv(text, sep) {
    const zeilen = [];
    let feld = '', zeile = [], inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuote) {
            if (c === '"') {
                if (text[i + 1] === '"') { feld += '"'; i++; }   // "" = ein Anfuehrungszeichen
                else inQuote = false;
            } else feld += c;
            continue;
        }
        if (c === '"')       { inQuote = true; }
        else if (c === sep)  { zeile.push(feld); feld = ''; }
        else if (c === '\r') { /* vor \n ignorieren */ }
        else if (c === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; }
        else feld += c;
    }
    if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
    return zeilen;
}

function lies(pfad) {
    const buf = fs.readFileSync(pfad);
    // XLSX ist ein ZIP — frueh und deutlich abweisen. SheetJS liegt nicht im Repo
    // (kommt zur Laufzeit vom CDN), und `npm install xlsx` ist gesperrt: die Version
    // auf npm ist die verwundbare 0.18.5.
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
        throw new Error('Das ist eine XLSX-Datei. Bitte im Lager "CSV Export" verwenden — '
                      + 'der Auswerter liest kein Excel.');
    }
    let text = buf.toString('utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);   // BOM, den der Export schreibt
    return text;
}

// ── Auswertung ───────────────────────────────────────────────────────────────
function werteAus(text) {
    // Der Export schreibt ';'. Eine fremde Datei koennte ',' benutzen — den Trenner
    // nehmen, der in der Kopfzeile mehr Felder ergibt, statt ihn zu erraten.
    const kopfZeile = text.split('\n')[0] || '';
    const sep = (kopfZeile.split(';').length >= kopfZeile.split(',').length) ? ';' : ',';

    const zeilen = parseCsv(text, sep).filter(z => z.some(f => String(f).trim() !== ''));
    if (zeilen.length < 2) throw new Error('Datei enthaelt keine Datenzeilen.');

    const kopf = zeilen[0].map(h => String(h).trim().toLowerCase());
    const spalte = (...namen) => {
        for (const n of namen) {
            const i = kopf.findIndex(h => h.replace(/[^a-z0-9]/g, '').includes(n));
            if (i >= 0) return i;
        }
        return -1;
    };
    const iNr    = spalte('artnr', 'artikelnr');
    const iDatum = spalte('datum');
    const iMarke = spalte('marke');
    const iBeschr= spalte('beschreibung');
    const iEk    = spalte('ek');

    if (iNr < 0) {
        throw new Error('Spalte "Art.-Nr." nicht gefunden. Kopfzeile: ' + zeilen[0].join(' | '));
    }

    const daten = zeilen.slice(1);
    const proNr = new Map(), proInhalt = new Map();
    let ohneNr = 0;

    daten.forEach((z, idx) => {
        const nr = String(z[iNr] || '').trim();
        const inhalt = JSON.stringify([
            String(z[iDatum]  || '').trim(),
            String(z[iMarke]  || '').trim(),
            String(z[iBeschr] || '').trim(),
            String(z[iEk]     || '').trim()
        ]);
        const eintrag = { zeile: idx + 2, nr, inhalt, roh: z };   // +2: Kopfzeile + 1-basiert
        if (!nr) ohneNr++;
        else {
            if (!proNr.has(nr)) proNr.set(nr, []);
            proNr.get(nr).push(eintrag);
        }
        if (!proInhalt.has(inhalt)) proInhalt.set(inhalt, []);
        proInhalt.get(inhalt).push(eintrag);
    });

    const nrDubletten = [...proNr.entries()].filter(([, v]) => v.length > 1);
    // Fall B nur zaehlen, wo die Nummern sich UNTERSCHEIDEN — sonst waere es Fall A,
    // und derselbe Befund stuende zweimal im Bericht.
    const inhaltDubletten = [...proInhalt.entries()].filter(([, v]) => {
        if (v.length < 2) return false;
        return new Set(v.map(x => x.nr)).size > 1;
    });

    return { gesamt: daten.length, ohneNr, nrDubletten, inhaltDubletten, iEk, iDatum, iBeschr };
}

// ── Bericht ──────────────────────────────────────────────────────────────────
function bericht(r) {
    const L = [];
    const euro = (s) => String(s || '').trim();
    L.push('Lager-Export: ' + r.gesamt + ' Zeilen');
    L.push('');

    if (r.nrDubletten.length === 0 && r.inhaltDubletten.length === 0) {
        L.push('BEFUND: keine Dubletten in dieser Datei.');
        L.push('');
        L.push('Achtung, das ist kein Freispruch: der Export nimmt die GEFILTERTE Ansicht und');
        L.push('laesst stornierte Artikel weg. Stand im Lager ein Filter, fehlen Zeilen.');
        L.push('Bitte Filter zuruecksetzen (Status "alle", Suchfeld leer) und neu exportieren —');
        L.push('oder den Diagnose-Export schicken, der zaehlt ueber alle Firmen und ueber die id.');
        return L.join('\n');
    }

    if (r.nrDubletten.length) {
        L.push('== FALL A: gleiche Artikelnummer mehrfach (' + r.nrDubletten.length + ') ==');
        L.push('Derselbe Datensatz liegt mehrfach im Bestand. Kein Schreibpfad erzeugt das —');
        L.push('zu suchen ist in Merge/Migration: cloud-sync _mergeRecords, backup-crypto');
        L.push('_mergeRecords, CompanyManager-Migration.');
        L.push('');
        r.nrDubletten.slice(0, 15).forEach(([nr, v]) => {
            L.push('  ' + nr + '  ' + v.length + 'x  (CSV-Zeilen ' + v.map(x => x.zeile).join(', ') + ')');
            L.push('      ' + euro(v[0].roh[r.iDatum]) + '  ' + euro(v[0].roh[r.iBeschr]) + '  ' + euro(v[0].roh[r.iEk]));
        });
        if (r.nrDubletten.length > 15) L.push('  … und ' + (r.nrDubletten.length - 15) + ' weitere');
        L.push('');
    }

    if (r.inhaltDubletten.length) {
        L.push('== FALL B: gleicher Inhalt, verschiedene Artikelnummern (' + r.inhaltDubletten.length + ') ==');
        L.push('Zwei echte Speichervorgaenge. Zu suchen ist im Schreibpfad: doppelt ausgeloestes');
        L.push('Formular (js/buchungen.js, lager/page.js) oder ein zweimal gelaufener Import');
        L.push('(js/app.js Excel-Import, js/lager.js Verkaeufe-Import).');
        L.push('');
        r.inhaltDubletten.slice(0, 15).forEach(([, v]) => {
            L.push('  ' + v.map(x => x.nr || '(ohne Nr.)').join(' + ') + '  (CSV-Zeilen ' + v.map(x => x.zeile).join(', ') + ')');
            L.push('      ' + euro(v[0].roh[r.iDatum]) + '  ' + euro(v[0].roh[r.iBeschr]) + '  ' + euro(v[0].roh[r.iEk]));
        });
        if (r.inhaltDubletten.length > 15) L.push('  … und ' + (r.inhaltDubletten.length - 15) + ' weitere');
        L.push('');
    }

    if (r.ohneNr) {
        L.push('== Zeilen ohne Artikelnummer: ' + r.ohneNr + ' ==');
        L.push('Eigener Befund: ohne Nummer laesst sich Fall A von Fall B nicht trennen.');
        L.push('');
    }

    // Kein "ueberwiegt"-Vergleich: A und B sind keine Abstufungen derselben Ursache,
    // sondern zwei verschiedene. Treten beide auf, sind auch beide zu pruefen — eine
    // Mehrheitsaussage wuerde die kleinere Haelfte stillschweigend unter den Tisch fallen
    // lassen.
    if (r.nrDubletten.length && r.inhaltDubletten.length) {
        L.push('Naechster Schritt: BEIDE Faelle liegen vor — das sind zwei verschiedene');
        L.push('Ursachen, keine Abstufung. Merge-/Migrationspfade UND Schreib-/Importpfade');
        L.push('pruefen.');
    } else if (r.nrDubletten.length) {
        L.push('Naechster Schritt: nur Fall A — Merge-/Migrationspfade pruefen.');
    } else {
        L.push('Naechster Schritt: nur Fall B — Schreib- und Importpfade pruefen.');
    }
    return L.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
    const pfad = process.argv[2];
    if (!pfad) {
        console.error('Aufruf: node scripts/lager-dubletten.js <Lager_Export.csv>');
        process.exit(2);
    }
    try {
        console.log(bericht(werteAus(lies(pfad))));
    } catch (e) {
        console.error('Fehler: ' + e.message);
        process.exit(1);
    }
}

module.exports = { parseCsv, werteAus, bericht };
