// Regression Audit 2026-10-13, S1 — META-CSP und HTTP-CSP je Route sind deckungsgleich.
//
// Der Browser setzt BEIDE Richtlinien durch; die strengere gewinnt je Direktive. Die META-CSP der
// Hauptapp erlaubte die Supabase-Hosts nicht, die der Unterapps zusätzlich Vercel Blob nicht —
// ausgelagerte Snapshots und Anhänge wurden dort blockiert, obwohl die HTTP-CSP sie zuließ.
//
// Geprüft wird die Invariante "jede Direktive in META = dieselbe Quellenmenge wie im HTTP-Header
// derselben Route" (ausgenommen frame-ancestors, das META nicht kennt). Ein Hostname-Test allein
// wäre zu wenig; der Browsernachweis mit echten Headern (scripts/csp-preview-server.js) steht im
// Abschlussbericht des Audit-Fixes.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const http = {};
cfg.headers.forEach(h => h.headers.forEach(x => { if (x.key.toLowerCase() === 'content-security-policy') http[h.source] = x.value; }));
const parse = c => {
    const d = {};
    c.split(';').map(s => s.trim()).filter(Boolean).forEach(p => { const [k, ...v] = p.split(/\s+/); d[k] = v.slice().sort().join(' '); });
    return d;
};

let fail = 0;
for (const [datei, route] of [['app.html', '/app.html'], ['app.html', '/app'], ['lager/index.html', '/lager(.*)'],
    ['rechnungen/index.html', '/rechnungen(.*)'], ['eigenbelege/index.html', '/eigenbelege(.*)'], ['index.html', '/index.html']]) {
    const html = fs.readFileSync(path.join(ROOT, datei), 'utf8');
    const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
    try {
        assert.ok(http[route], 'keine HTTP-CSP für ' + route);
        if (!m) { console.log('✓ ' + datei + ' (' + route + '): keine META-CSP'); continue; }
        const M = parse(m[1]), H = parse(http[route]);
        const keys = new Set(Object.keys(M).concat(Object.keys(H)));
        keys.delete('frame-ancestors');
        keys.forEach(k => assert.strictEqual(M[k], H[k], `${datei} ${k}: META „${M[k]}" ≠ HTTP „${H[k]}"`));
        console.log('✓ ' + datei + ' (' + route + ')');
    } catch (e) { fail++; console.log('✗ ' + e.message); }
}
if (fail) process.exit(1);
