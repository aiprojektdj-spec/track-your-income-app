// Tabler Icons sind auf die genutzten Icons verkleinert (scripts/subset-icons.py).
// Ein neues ti-... im Code, das die Teilmenge nicht enthaelt, waere unsichtbar —
// dieser Test faellt dann, bis das Skript erneut gelaufen ist.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Muss zu SKIP_DIRS in scripts/subset-icons.py passen.
const SKIP = new Set(['node_modules', 'plan', 'test', 'docs', 'scripts', 'compliance', '.git', '.vercel',
    'graphify-out', 'kosit-proben', 'vendor']);

let fails = 0;
function check(name, ok, detail) {
    console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));
    if (!ok) fails++;
}

function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out); }
        else if (/\.(html|js|css)$/.test(e.name)) out.push(path.join(dir, e.name));
    }
    return out;
}

const used = new Set();
for (const f of walk(ROOT, [])) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/ti-[a-z0-9]+(?:-[a-z0-9]+)*/g)) used.add(m[0]);
}

const classes = (css) => new Set([...css.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map((m) => m[1]));
const full = classes(fs.readFileSync(path.join(ROOT, 'scripts', 'vendor-src', 'tabler-icons.min.css'), 'utf8'));
const subsetCss = fs.readFileSync(path.join(ROOT, 'css', 'vendor', 'tabler-icons.min.css'), 'utf8');
const sub = classes(subsetCss);

const missing = [...used].filter((n) => full.has(n) && !sub.has(n));
check('A1 jedes genutzte Tabler-Icon ist in der Teilmenge', missing.length === 0,
      missing.join(', ') + ' → python scripts/subset-icons.py');
check('A2 die Teilmenge ist wirklich klein (< 600 Icons)', sub.size > 0 && sub.size < 600, String(sub.size));

const fontRef = (subsetCss.match(/fonts\/tabler-icons\.woff2\?([^")]+)/) || [])[1];
check('B1 die Schrift hat einen eigenen Versions-Query (Cache)', !!fontRef && fontRef !== 'v3.44.0', fontRef);
const fontSize = fs.statSync(path.join(ROOT, 'css', 'vendor', 'fonts', 'tabler-icons.woff2')).size;
check('B2 ausgelieferte Schrift ist die Teilmenge (< 100 KB)', fontSize < 100 * 1024, String(fontSize));

if (fails) { console.log(`\n${fails} Fehler`); process.exit(1); }
console.log('\nAlle Checks gruen');
