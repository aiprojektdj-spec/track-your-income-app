// Statische Lager-Vorlage = Download in der App:  node test/test-vorlage-statisch.js
// =============================================================================
// vorlagen/stackr-lager-vorlage.csv wird von import-formate.html verlinkt (ohne JavaScript).
// Sie muss byte-genau dem entsprechen, was LagerImport.vorlageCsv() im Dialog „Excel-Import“
// liefert (BOM, Semikolon, CRLF). Aendert sich die Funktion, die Datei neu erzeugen:
//   node -e "const c=require('./test/_lade-module').ladeModule(['js/import-kern.js','js/import-lager.js']);require('fs').writeFileSync('vorlagen/stackr-lager-vorlage.csv',c.LagerImport.vorlageCsv(),'utf8')"
// =============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');

const ctx = ladeModule(['js/import-kern.js', 'js/import-lager.js']);
const soll = Buffer.from(ctx.LagerImport.vorlageCsv(), 'utf8');
const ist = fs.readFileSync(path.join(__dirname, '..', 'vorlagen', 'stackr-lager-vorlage.csv'));

if (Buffer.compare(soll, ist) === 0) {
    console.log('✓ vorlagen/stackr-lager-vorlage.csv = LagerImport.vorlageCsv() (' + ist.length + ' Bytes)');
} else {
    let i = 0;
    while (i < soll.length && i < ist.length && soll[i] === ist[i]) i++;
    console.log('✗ vorlagen/stackr-lager-vorlage.csv weicht ab (erstes abweichendes Byte: ' + i +
        ', Soll ' + soll.length + ' / Ist ' + ist.length + ' Bytes). Datei neu erzeugen, siehe Kopf.');
    process.exit(1);
}
