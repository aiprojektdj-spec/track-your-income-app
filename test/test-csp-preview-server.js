// Vorschau-Routing, CSP und Cache-Schutz ohne echten Listener pruefen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/csp-preview-server.js'), 'utf8');

function load(port) {
    let handler;
    let address;
    vm.runInNewContext(source, {
        __dirname: path.join(root, 'scripts'),
        process: { argv: ['node', 'csp-preview-server.js', port] },
        console: { log() {} },
        require(name) {
            if (name !== 'http') return require(name);
            return {
                createServer(callback) {
                    handler = callback;
                    return { listen(...args) { address = args.slice(0, 2); } };
                },
            };
        },
    });
    return {
        address,
        request(url) {
            return new Promise(resolve => {
                const result = { headers: {} };
                handler({ url }, {
                    setHeader(key, value) { result.headers[key.toLowerCase()] = value; },
                    writeHead(status) { result.status = status; return this; },
                    end(body) { result.body = String(body); resolve(result); },
                });
            });
        },
    };
}

(async () => {
    const server = load('4368');
    assert.deepEqual(server.address, [4368, '127.0.0.1']);
    assert.throws(() => load('ungueltig'), /Vorschau-Port/);
    assert.throws(() => load('65536'), /Vorschau-Port/);

    const home = await server.request('/?preview=1');
    assert.equal(home.status, 200);
    assert.equal(home.body, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    assert.equal(home.headers['x-content-type-options'], 'nosniff');
    assert.equal(home.headers['x-frame-options'], 'DENY');
    assert.match(home.headers['content-security-policy'], /script-src-attr 'none'/);
    assert.equal(home.headers['cache-control'], 'no-store, max-age=0');
    assert.equal(home.headers['x-robots-tag'], 'noindex, nofollow');

    const app = await server.request('/app');
    assert.equal(app.status, 200);
    assert.equal(app.body, fs.readFileSync(path.join(root, 'app.html'), 'utf8'));
    assert.match(app.headers['content-security-policy'], /https:\/\/api\.whop\.com/);

    const module = await server.request('/rechnungen/');
    assert.equal(module.status, 200);
    assert.match(module.headers['content-security-policy'], /frame-ancestors 'none'/);

    const asset = await server.request('/js/vendor/chart.min.js');
    assert.equal(asset.status, 200);
    assert.equal(asset.headers['cache-control'], 'no-store, max-age=0');
    assert.equal(asset.headers['x-content-type-options'], 'nosniff');
    assert.equal((await server.request('/%ungueltig')).status, 400);
    assert.equal((await server.request('/%2e%2e%2fverboten.txt')).status, 403);
    assert.equal((await server.request('/api/whop-access.js')).status, 501);
    assert.equal((await server.request('/nicht-vorhanden.html')).status, 404);
    console.log('OK: Preview-Port, Loopback, Rewrite, CSP, Schutzheader, No-Cache und Pfadgrenzen.');
})().catch(error => { console.error(error); process.exitCode = 1; });
