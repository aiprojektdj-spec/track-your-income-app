// Test: OCR-Worker und CSP müssen zusammenpassen
//
//   node test/test-ocr-worker-csp.js
//
// WORUM ES GEHT — der stille Ausfall, den dieser Test verhindert:
//
// Der Tesseract-Kern ist WebAssembly. Die CSP von /eigenbelege erlaubt kein WASM
// (`script-src 'self'`, kein 'wasm-unsafe-eval'), und trotzdem läuft OCR. Der Grund ist
// eine einzige Zeile in eigenbelege/js/app.js:
//
//     workerBlobURL: false
//
// Damit lädt tesseract.js seinen Worker als **eigenes Skript von der eigenen Herkunft**.
// Ein solcher Worker bezieht seine CSP aus den Headern seines eigenen Skripts, nicht vom
// Dokument — die Dokument-CSP greift dort also gar nicht, und der Kern darf kompilieren.
// Am Build belegt (js/vendor/VERSIONS.md): `WebAssembly.compile()` im Main Thread wird von
// genau dieser CSP blockiert, der OCR-Lauf daneben liefert 3 von 3 Feldern.
//
// Stellt jemand die Option auf `true`, startet der Worker aus einer `blob:`-URL und **erbt
// dann die Dokument-CSP**. Ab da bräuchte es 'wasm-unsafe-eval' und `worker-src blob:` —
// ohne beides ist OCR tot. Und zwar lautlos: kein Test wird rot, die Extraktionstests in
// test-beleg-ocr.js laufen ohne Browser und ohne WASM, die merken davon nichts.
//
// Der Test verbietet die Umstellung NICHT. Er verlangt nur, dass beide Seiten
// zusammenpassen: entweder Worker aus eigener Datei UND harte CSP, oder blob:-Worker UND
// die passenden Direktiven. Der inkonsistente Zustand ist der einzige, der scheitert.

'use strict';
const fs   = require('fs');
const path = require('path');

const wurzel = path.join(__dirname, '..');
const lies   = (...p) => fs.readFileSync(path.join(wurzel, ...p), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else      { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}

// ── 1. Die Option ist überhaupt gesetzt ────────────────────────────────────────────────
// Fehlt sie, gilt der tesseract.js-Standard — und der ist `true`, also der blob:-Weg.
// Ein stillschweigendes Verlassen auf den Default wäre schon der Fehler.
// Seit dem 2026-09-21 steht der Worker nicht mehr in eigenbelege/js/app.js, sondern im
// gemeinsamen Unterbau js/beleg-ocr-ui.js — die Belegerkennung haengt jetzt auch im
// Ausgaben-Formular (Kriterium 2.1, plan/pruefliste-buchhaltung-2026-09-21.md). Damit
// gilt dieselbe Kopplung fuer ZWEI Routen: /eigenbelege und /app.html.
const uiSrc = lies('js', 'beleg-ocr-ui.js');
const treffer = uiSrc.match(/workerBlobURL\s*:\s*(true|false)/);
check('workerBlobURL ist in js/beleg-ocr-ui.js ausdrücklich gesetzt', !!treffer,
      'nicht gefunden — tesseract.js faellt sonst auf den blob:-Weg zurueck');

// Gegenprobe, dass der Umzug vollstaendig war: eine zweite Kopie der Option waere eine
// zweite Stelle, die dieser Test nicht mitliest.
check('keine zweite Worker-Konfiguration in eigenbelege/js/app.js',
      !/workerBlobURL/.test(lies('eigenbelege', 'js', 'app.js')));

const blobWorker = treffer ? treffer[1] === 'true' : true;

// ── 2. Die CSP beider Stellen einsammeln ───────────────────────────────────────────────
// Die CSP steht zweimal: als HTTP-Header in vercel.json (verbindlich) und als <meta> in
// der Seite (greift zusaetzlich). Browser werten mehrere CSPs als SCHNITTMENGE — es reicht
// also nicht, die Direktive an einer Stelle zu setzen. Genau deshalb werden hier beide
// geprueft und nicht nur eine.
const vercel = JSON.parse(lies('vercel.json'));
const cspVonRoute = muster => {
    const r = (vercel.headers || []).find(h => muster.test(h.source || ''));
    return r
        ? ((r.headers || []).find(k => /Content-Security-Policy/i.test(k.key || '')) || {}).value || ''
        : null;
};
const cspEigenbelege = cspVonRoute(/eigenbeleg/);
const cspApp         = cspVonRoute(/^\/app\.html$/);
check('vercel.json hat eine CSP-Route fuer /eigenbelege', cspEigenbelege !== null);
check('vercel.json hat eine CSP-Route fuer /app.html',     cspApp !== null);

const metaCspVon = (...p) =>
    (lies(...p).match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i) || [])[1] || '';

// Beide Seiten laden die Belegerkennung. Geprueft wird die strengste Kombination: was an
// EINER der vier Stellen fehlt, fehlt effektiv ueberall — Browser schneiden mehrere CSPs.
const headerCsp = [cspEigenbelege, cspApp].filter(c => c !== null).join(' ;; ');
const metaCsp   = [metaCspVon('eigenbelege', 'index.html'), metaCspVon('app.html')].join(' ;; ');

// Nur die echten Direktiven zaehlen, nicht die Erwaehnung in einem Kommentar daneben —
// im Kopf von eigenbelege/index.html steht ausdruecklich, warum die Direktive FEHLT.
// Die zusammengesetzte Zeichenkette enthaelt zwei CSPs. `jede` verlangt die Direktive in
// BEIDEN — eine davon genuegt nicht, sonst waere die haertere Route nicht abgedeckt.
const jede      = (c, re) => c.split(' ;; ').every(teil => re.test(teil));
const hatWasm   = c => jede(c, /script-src[^;]*'wasm-unsafe-eval'/);
const hatBlobWk = c => jede(c, /worker-src[^;]*blob:/);

const wasmErlaubt   = hatWasm(headerCsp) && hatWasm(metaCsp);
const blobWkErlaubt = hatBlobWk(headerCsp) && hatBlobWk(metaCsp);

// ── 3. Die eigentliche Kopplung ────────────────────────────────────────────────────────
if (blobWorker) {
    check('blob:-Worker gewaehlt -> CSP fuehrt wasm-unsafe-eval an BEIDEN Stellen', wasmErlaubt,
          'Header: ' + hatWasm(headerCsp) + ', Meta: ' + hatWasm(metaCsp));
    check('blob:-Worker gewaehlt -> CSP fuehrt worker-src blob: an BEIDEN Stellen', blobWkErlaubt,
          'Header: ' + hatBlobWk(headerCsp) + ', Meta: ' + hatBlobWk(metaCsp));
} else {
    check('Worker laedt als eigene Datei — CSP darf hart bleiben', true);
    // Gegenrichtung: wer die Direktive setzt, ohne sie zu brauchen, weicht die Haertung
    // ohne Gegenwert auf. Das ist kein Ausfall, aber ein Rueckschritt — deshalb hier ein
    // Hinweis statt eines Fehlers.
    if (wasmErlaubt) {
        console.log('  HINWEIS  wasm-unsafe-eval steht in der CSP, wird bei workerBlobURL:false');
        console.log('           aber nicht gebraucht — ersatzlos entfernbar.');
    }
}

// ── 4. Die Worker-Datei muss es auch geben ─────────────────────────────────────────────
// Bei workerBlobURL:false zeigt tesseract.js auf eine echte Datei. Fehlt sie im Repo,
// laeuft OCR lokal (Working Tree) und ist live tot — derselbe Fehler wie c982264.
if (!blobWorker) {
    check('js/vendor/tesseract-worker.min.js ist vorhanden',
          fs.existsSync(path.join(wurzel, 'js', 'vendor', 'tesseract-worker.min.js')));
}

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen\n');
process.exit(fail ? 1 : 0);
