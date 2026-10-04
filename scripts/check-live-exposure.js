#!/usr/bin/env node
// Live-Check nach jedem Deploy:  node scripts/check-live-exposure.js [basis-url]
//
// Seiten-Check R2 (plan/seiten-check-40-2026-10-03.md). Prüft von außen, was nach einem Deploy
// nie wieder kaputtgehen darf: interne Dateien liefern 404, Security-Header sind überall da,
// die API gibt ohne Token nichts heraus, CORS bleibt auf der eigenen Origin, das ausgelieferte
// JS enthält keine Schlüssel, HTTPS-Weiterleitung und Zertifikat stimmen.
//
// Nur GET/HEAD/OPTIONS bzw. POST ohne Token — nichts wird gespeichert. Zwischen den Anfragen
// liegt eine Pause (CHECK_DELAY_MS, Default 300 ms), damit Vercels Firewall nicht anspringt.
// Exit-Code 1, sobald eine Prüfung rot ist. Keine Abhängigkeiten (Node >= 18).
'use strict';
const tls = require('tls');

const BASE = (process.argv[2] || process.env.CHECK_BASE_URL || 'https://track-your-income-app.vercel.app').replace(/\/+$/, '');
const DELAY = parseInt(process.env.CHECK_DELAY_MS || '300', 10);
const OWN_ORIGIN = 'https://track-your-income-app.vercel.app';

// Muss zu .vercelignore passen: je Eintrag dort mindestens ein Pfad, der live existieren würde.
const LEAK_PATHS = [
    '/CLAUDE.md', '/CLOUD-SYNC.md', '/plan/00-STAND.md', '/plan/vercel-einrichtung.md',
    '/test/test-api-sync.js', '/scripts/lager-dubletten.js', '/scripts/check-live-exposure.js',
    '/build-deploy.py', '/ui-lab.html', '/css/ui-lab.css', '/js/ui-lab.js',
    '/js/vendor/VERSIONS.md', '/.github/workflows/tests.yml', '/graphify-out/GRAPH_REPORT.md',
    '/.env', '/.env.local', '/.git/config', '/.vercel/project.json', '/package.json',
    '/package-lock.json', '/vercel.json',
];

const PAGES = ['/', '/app', '/lager/', '/rechnungen/', '/eigenbelege/', '/impressum.html', '/datenschutz.html'];
const API_POST = ['/api/sync', '/api/blob-upload', '/api/whop-access'];

const SECRET_PATTERNS = [
    /sk_live_[A-Za-z0-9]{8,}/, /apik_[A-Za-z0-9]{8,}/, /whsec_[A-Za-z0-9]{8,}/,
    /vercel_blob_rw_[A-Za-z0-9_]{8,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(KV_REST_API_TOKEN|BLOB_READ_WRITE_TOKEN|WHOP_API_KEY|WHOP_CLIENT_SECRET)\s*[:=]\s*['"][^'"]{8,}/,
];

let fail = 0, pass = 0, unknown = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };
const bad = (m) => { fail++; console.log('✗ ' + m); };
const unsure = (m) => { unknown++; console.log('? ' + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(path, opts) {
    await sleep(DELAY);
    return fetch(BASE + path, Object.assign({ redirect: 'manual' }, opts));
}

// Vercels Security Checkpoint antwortet bei zu vielen Anfragen mit 403/429 und einer
// Challenge-Seite. Das ist kein Leck, aber auch kein Beweis für 404 → „unbestimmt“.
function isCheckpoint(res) {
    return (res.status === 403 || res.status === 429) && /vercel/i.test(res.headers.get('server') || '');
}

async function checkLeaks() {
    for (const p of LEAK_PATHS) {
        const res = await req(p, { method: 'GET' });
        if (res.status === 404) ok('404 ' + p);
        else if (isCheckpoint(res)) unsure(res.status + ' (Vercel-Checkpoint) ' + p);
        else bad(res.status + ' statt 404: ' + p);
    }
}

async function checkHeaders() {
    for (const p of PAGES) {
        const res = await req(p, { method: 'GET' });
        const h = (n) => res.headers.get(n) || '';
        if (res.status !== 200) { bad(p + ': Status ' + res.status); continue; }
        const missing = [];
        if (!/max-age=\d{8,}/.test(h('strict-transport-security'))) missing.push('HSTS');
        const csp = h('content-security-policy');
        if (!csp) missing.push('CSP');
        if (!/frame-ancestors/.test(csp) && !h('x-frame-options')) missing.push('Frame-Schutz');
        if (h('x-content-type-options') !== 'nosniff') missing.push('nosniff');
        if (!h('referrer-policy')) missing.push('Referrer-Policy');
        if (!h('permissions-policy')) missing.push('Permissions-Policy');
        if (h('x-powered-by')) missing.push('X-Powered-By gesetzt');
        if (missing.length) bad(p + ': ' + missing.join(', '));
        else ok('Header vollständig ' + p);
    }
}

async function checkApi() {
    for (const p of API_POST) {
        const res = await req(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        const text = await res.text();
        if (res.status !== 400 && res.status !== 401 && res.status !== 403) bad(p + ' ohne Token: ' + res.status);
        else if (/\bat .+:\d+:\d+|Error:|stack/i.test(text)) bad(p + ': Antwort enthält Stack/Fehlertext');
        else ok(p + ' ohne Token → ' + res.status);

        const pre = await req(p, { method: 'OPTIONS', headers: { origin: 'https://example.com', 'access-control-request-method': 'POST' } });
        const acao = pre.headers.get('access-control-allow-origin') || '';
        if (acao === '*' || acao === 'https://example.com') bad(p + ': CORS erlaubt fremde Origin (' + acao + ')');
        else ok(p + ': CORS nur ' + (acao || 'keine Origin'));
    }
    const cron = await req('/api/blob-cleanup', { method: 'GET' });
    if (cron.status === 401) ok('/api/blob-cleanup ohne Secret → 401');
    else bad('/api/blob-cleanup ohne Secret: ' + cron.status);
}

async function checkScripts() {
    const srcs = new Set();
    for (const p of ['/', '/app']) {
        const html = await (await req(p, { method: 'GET' })).text();
        for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
            const u = m[1].split('?')[0];
            if (!/^https?:/.test(u)) srcs.add('/' + u.replace(/^\.?\//, ''));
        }
    }
    for (const s of srcs) {
        const res = await req(s, { method: 'GET' });
        if (res.status !== 200) { bad(s + ': Status ' + res.status); continue; }
        const js = await res.text();
        const hit = SECRET_PATTERNS.find((re) => re.test(js));
        if (hit) bad(s + ': sieht nach Schlüssel aus (' + hit + ')');
        else if (!s.startsWith('/js/vendor/') && /sourceMappingURL=/.test(js)) bad(s + ': verweist auf Source-Map');
        else ok('sauber ' + s);
    }
}

async function checkTransport() {
    const host = new URL(BASE).host;
    await sleep(DELAY);
    const res = await fetch('http://' + host + '/', { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    if (res.status >= 301 && res.status <= 308 && loc.startsWith('https://')) ok('http → ' + res.status + ' https');
    else bad('http leitet nicht auf https um (' + res.status + ')');

    const days = await new Promise((resolve) => {
        const s = tls.connect({ host, port: 443, servername: host }, () => {
            const c = s.getPeerCertificate();
            s.end();
            resolve((new Date(c.valid_to) - Date.now()) / 864e5);
        });
        s.on('error', () => resolve(-1));
    });
    if (days > 14) ok('Zertifikat noch ' + Math.floor(days) + ' Tage');
    else bad('Zertifikat läuft in ' + Math.floor(days) + ' Tagen ab (oder TLS-Fehler)');
}

(async () => {
    console.log('Live-Check gegen ' + BASE + '\n');
    await checkLeaks();
    await checkHeaders();
    await checkApi();
    await checkScripts();
    await checkTransport();
    console.log('\n' + pass + ' ok, ' + fail + ' rot, ' + unknown + ' unbestimmt');
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('✗ Abbruch:', e.message); process.exit(1); });
