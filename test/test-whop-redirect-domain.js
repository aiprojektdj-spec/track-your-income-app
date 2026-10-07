// Whop-Login auf zwei Domains: getstackr.de und track-your-income-app.vercel.app.
// Authorize (js/whop-auth.js) und Token-Tausch (api/whop-token.js) muessen dieselbe
// redirect_uri verwenden, sonst lehnt Whop den Code ab.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fails = 0;
function check(name, ok) {
    console.log((ok ? 'OK   ' : 'FAIL ') + name);
    if (!ok) fails++;
}

// Ohne Speicher-Env: Rate-Limit meldet sich nur und laesst den Aufruf durch.
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
                 'ALERT_WEBHOOK_URL', 'STORAGE_BACKEND']) delete process.env[k];
process.env.WHOP_CLIENT_SECRET = 'test-secret';

const sent = [];
global.fetch = async (url, opts) => {
    if (String(url).includes('api.whop.com/oauth/token')) sent.push(JSON.parse(opts.body).redirect_uri);
    return { ok: false, json: async () => ({ error: 'invalid_grant' }) };
};

const handler = require(path.join(ROOT, 'api', 'whop-token.js'));

function fakeRes() {
    return { setHeader() {}, status() { return this; }, json() { return this; }, end() { return this; } };
}

async function exchangeFor(host) {
    sent.length = 0;
    await handler({ method: 'POST', headers: { host }, body: { code: 'c', code_verifier: 'v' }, socket: {} }, fakeRes());
    return sent[0];
}

(async () => {
    check('A1 getstackr.de tauscht mit https://getstackr.de/app.html',
          await exchangeFor('getstackr.de') === 'https://getstackr.de/app.html');
    check('A2 alte Domain bleibt bei ihrer Adresse',
          await exchangeFor('track-your-income-app.vercel.app') === 'https://track-your-income-app.vercel.app/app.html');
    check('A3 unbekannter Host (Preview) bekommt die alte Adresse, nicht seinen eigenen',
          await exchangeFor('evil.example') === 'https://track-your-income-app.vercel.app/app.html');

    const auth = fs.readFileSync(path.join(ROOT, 'js', 'whop-auth.js'), 'utf8');
    check('B1 whop-auth.js nutzt auf getstackr.de dieselbe Adresse',
          /location\.hostname === 'getstackr\.de'\s*\?\s*'https:\/\/getstackr\.de\/app\.html'/.test(auth));
    check('B2 whop-auth.js faellt sonst auf die alte Adresse zurueck',
          /:\s*'https:\/\/track-your-income-app\.vercel\.app\/app\.html'/.test(auth));

    if (fails) { console.log(`\n${fails} Fehler`); process.exit(1); }
    console.log('\nAlle Checks gruen');
})();
