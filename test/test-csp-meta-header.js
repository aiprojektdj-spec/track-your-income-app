// Meta-CSP und Header-CSP gleich halten:  node test/test-csp-meta-header.js
// =============================================================================
// Viele Seiten tragen zusätzlich zur CSP aus vercel.json eine eigene im <meta>-Tag. Der
// Browser setzt BEIDE durch — erlaubt ist nur, was beide erlauben. Am 2026-10-12 fiel auf,
// dass die Meta-CSPs der vier App-Seiten kein Supabase kannten: Der Eintrag in vercel.json
// (PR #51) wäre wirkungslos geblieben, und mit BLOB_BACKEND=supabase hätten die Belege nicht
// mehr geladen. Ein Ziel wird deshalb nur an EINER Stelle vergessen, nie unbemerkt.
//
// Geprüft wird `connect-src` (dort lag die Drift). Jede HTML-Seite mit Meta-CSP braucht eine
// Header-Route in vercel.json, und beide connect-src müssen dieselbe Quellenmenge nennen.
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const ROOT = path.join(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

function connectSrc(policy) {
    const d = policy.split(';').map(s => s.trim()).find(s => /^connect-src\s/.test(s));
    return d ? d.split(/\s+/).slice(1).sort().join(' ') : null;
}

// Header-CSP je Route (source), wie in vercel.json
const header = {};
for (const h of vercel.headers || []) {
    const csp = (h.headers || []).find(x => x.key.toLowerCase() === 'content-security-policy');
    if (csp) header[h.source] = csp.value;
}

// Route, unter der eine Datei ausgeliefert wird: x/index.html → /x(.*), sonst /<datei>
function routeOf(file) {
    const m = /^([^/]+)\/index\.html$/.exec(file);
    return m ? '/' + m[1] + '(.*)' : '/' + file;
}

function htmlFiles() {
    const out = fs.readdirSync(ROOT).filter(n => n.endsWith('.html'));
    for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
        if (d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' &&
            fs.existsSync(path.join(ROOT, d.name, 'index.html'))) out.push(d.name + '/index.html');
    }
    return out.sort();
}

let pass = 0, geprueft = 0;
const fehler = [];
for (const f of htmlFiles()) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html);
    if (!m) continue;
    geprueft++;
    const route = routeOf(f);
    if (!header[route]) { fehler.push(f + ': keine Header-CSP für Route ' + route + ' in vercel.json'); continue; }
    const meta = connectSrc(m[1]), hdr = connectSrc(header[route]);
    if (meta !== hdr) fehler.push(f + ': connect-src weicht ab\n    Meta:   ' + meta + '\n    Header: ' + hdr);
}
assert.ok(geprueft >= 10, 'zu wenige Seiten mit Meta-CSP gefunden (' + geprueft + ') — Erkennung kaputt?');
assert.deepStrictEqual(fehler, [], '\n' + fehler.join('\n'));
pass++; console.log('✓ ' + geprueft + ' Seiten: connect-src in Meta- und Header-CSP gleich');

// Die App-Seiten erreichen beide Supabase-Projekte (signierte Beleg-URLs)
for (const f of ['app.html', 'lager/index.html', 'rechnungen/index.html', 'eigenbelege/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const meta = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html)[1];
    for (const ref of ['usrhhjwvoefjdgrwovkg', 'nvtjzeffngwfsqjzdrdz']) {
        assert.ok(connectSrc(meta).split(' ').indexOf('https://' + ref + '.supabase.co') !== -1, f + ' ohne ' + ref);
    }
}
pass++; console.log('✓ App-Seiten erlauben beide Supabase-Projekte');

// Der Vergleich schlägt an — sonst prüft Fall 1 nichts
assert.notStrictEqual(connectSrc("default-src 'self'; connect-src 'self' https://a.example"),
                      connectSrc("connect-src 'self'"));
assert.strictEqual(connectSrc("connect-src https://b 'self'"), connectSrc("x; connect-src 'self' https://b"));
pass++; console.log('✓ Vergleich erkennt Abweichung, Reihenfolge egal');

console.log('\n' + pass + '/3 CSP-Abgleich-Tests bestanden ✅');
