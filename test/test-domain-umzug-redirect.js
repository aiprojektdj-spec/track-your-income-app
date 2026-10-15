// Domain-Umzug Phase 1 (plan/domain-umzug-getstackr-2026-10-08.md): Auf der alten Adresse leiten
// Startseite und Rechtsseiten nach getstackr.de um — App, Module und API dagegen NIE, denn die
// Buchhaltungsdaten haengen am Origin. Ein Redirect auf app.html wuerde Bestandskunden in eine
// leere App schicken.
'use strict';
const vercel = require('../vercel.json');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

const ALT = 'track-your-income-app.vercel.app';
const umzug = (vercel.redirects || []).filter(r => (r.has || []).some(h => h.type === 'host' && h.value === ALT));

// Nachbau der beiden hier benutzten Formen: "/" exakt und "/:name(a|b)" als Alternativen.
function trifft(source, pfad) {
    if (source === pfad) return true;
    const m = source.match(/^\/:\w+\((.*)\)$/);
    return !!m && new RegExp('^/(' + m[1] + ')$').test(pfad);
}
const leitetUm = pfad => umzug.some(r => trifft(r.source, pfad));

check('R1 es gibt Umzugs-Redirects, alle nur fuer den alten Host', umzug.length > 0);
['/', '/index.html', '/agb.html', '/datenschutz.html', '/impressum.html', '/cookies.html',
 '/refund.html', '/barrierefreiheit.html', '/landing-v2.html'].forEach(p =>
    check('R2 ' + p + ' leitet auf getstackr.de um', leitetUm(p)));
['/app', '/app.html', '/lager/', '/lager/index.html', '/rechnungen/', '/eigenbelege/',
 '/api/sync', '/api/whop-token', '/api/whop-access', '/js/app.js', '/sitemap.xml'].forEach(p =>
    check('R3 ' + p + ' bleibt auf der alten Adresse', !leitetUm(p)));
check('R4 Ziel ist immer getstackr.de', umzug.every(r => r.destination.indexOf('https://getstackr.de/') === 0));
check('R5 kein Umzugs-Redirect ist permanent (bleibt umkehrbar, kein Browser-Cache fuer immer)',
    umzug.every(r => r.permanent === false));

console.log('\n' + pass + '/' + total + ' Checks bestanden');
