// Lokaler Test-Server, der die Header aus vercel.json wirklich anwendet.
// Zweck: die CSP-Header gegen die echten Seiten fahren und die Browser-Konsole
// auf Violations pruefen, bevor deployed wird. Kein Produktionscode.
//   node scripts/csp-preview-server.js   →   http://localhost:4321
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg  = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',   '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon'
};

// vercel-source → RegExp. Deckt die hier genutzten Formen ab: :path*, (.*), Literale.
function toRegExp(source) {
    let re = source
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')   // literal escapen, * und : bleiben
        .replace(/\\\(\\\.\\\*\\\)/g, '.*')     // "(.*)" wieder als Wildcard
        .replace(/:[A-Za-z_]+\*/g, '.*')        // ":path*"
        .replace(/:[A-Za-z_]+/g, '[^/]+');      // ":slug"
    return new RegExp('^' + re + '$');
}

const RULES = cfg.headers.map(h => ({ re: toRegExp(h.source), headers: h.headers }));

function headersFor(urlPath) {
    const out = [];
    for (const r of RULES) if (r.re.test(urlPath)) out.push(...r.headers);
    return out;
}

function resolveFile(urlPath) {
    for (const rw of (cfg.rewrites || [])) {
        if (toRegExp(rw.source).test(urlPath)) { urlPath = rw.destination; break; }
    }
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    return path.join(ROOT, decodeURIComponent(urlPath));
}

http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const file    = resolveFile(urlPath);

    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

    fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end('not found: ' + urlPath); return; }
        // Bewusst die Header der ANGEFRAGTEN URL, nicht der aufgeloesten Datei —
        // genau so matcht Vercel (Rewrite passiert nach dem Header-Matching).
        headersFor(urlPath).forEach(h => res.setHeader(h.key, h.value));
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
        res.writeHead(200).end(buf);
    });
}).listen(4321, () => console.log('CSP-Preview auf http://localhost:4321'));
