// Drittes Alarmziel Supabase (ops_alerts) in api/_alert.js:  node test/test-alert-supabase.js
//  A) Ohne SUPABASE_* kein Aufruf an Supabase (Verhalten wie vorher).
//  B) Mit SUPABASE_* genau ein rpc sync_alert_add mit source/event/detail/env, kurzer Timeout.
//  C) Ein streikendes Supabase wirft nicht durch, Webhook und Blob laufen trotzdem.
//  D) alertZiele() meldet supabase true/false, ohne Werte preiszugeben.
//  E) rpc-Parameter passen zur Migration, Rechte nur für service_role.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

// Blob-Attrappe wie in test-alert-ops.js
const BLOBMOD = require.resolve('@vercel/blob');
let puts = [];
require.cache[BLOBMOD] = { id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
    put: function (p) { puts.push(p); return Promise.resolve({ url: 'https://blob.example/' + p }); }
} };

let calls = [], sbMode = 'ok';
global.fetch = function (url, opts) {
    calls.push({ url: url, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers, signal: opts.signal });
    if (url.indexOf('http://sb.mock/') === 0) {
        if (sbMode === 'throw') return Promise.reject(new Error('supabase weg'));
        if (sbMode === '500')   return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') });
        return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
    }
    return Promise.resolve({ ok: true, status: 200 });
};

function fresh(env) {
    ['ALERT_WEBHOOK_URL', 'BLOB_READ_WRITE_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(k => delete process.env[k]);
    Object.assign(process.env, env);
    for (const f of ['_alert.js', '_db.js']) delete require.cache[path.join(ROOT, 'api', f)];
    calls = []; puts = []; sbMode = 'ok';
    return require('../api/_alert.js');
}
const sbCalls = () => calls.filter(c => c.url.indexOf('http://sb.mock/') === 0);

const origErr = console.error;
console.error = function () {};   // _log.logError je Alarm

(async () => {
    // A
    let m = fresh({});
    await m.alertOps('sync', 'rate-limit-open', 'x');
    check('A ohne SUPABASE_* kein Supabase-Aufruf', sbCalls().length === 0);
    check('A alertZiele().supabase = false', m.alertZiele().supabase === false);

    // B
    m = fresh({ SUPABASE_URL: 'http://sb.mock', SUPABASE_SERVICE_ROLE_KEY: 'svc' });
    process.env.VERCEL_ENV = 'production';
    await m.alertOps('sync', 'ip-rate-limit-open', 'Redis: timeout');
    const c = sbCalls();
    check('B genau ein rpc', c.length === 1 && c[0].url === 'http://sb.mock/rest/v1/rpc/sync_alert_add');
    check('B Nutzlast vollständig', c[0] && c[0].body.p_source === 'sync' && c[0].body.p_event === 'ip-rate-limit-open' &&
          c[0].body.p_detail === 'Redis: timeout' && c[0].body.p_env === 'production');
    check('B Service-Key im Header', c[0] && c[0].headers.apikey === 'svc');
    check('B Timeout gesetzt', c[0] && c[0].signal && typeof c[0].signal.aborted === 'boolean');
    check('D alertZiele().supabase = true, ohne Wert', m.alertZiele().supabase === true &&
          !JSON.stringify(m.alertZiele()).includes('svc'));
    await m.alertOps('sync', 'ip-rate-limit-open', 'nochmal');
    check('B Entprellung gilt auch für Supabase', sbCalls().length === 1);
    delete process.env.VERCEL_ENV;

    // C
    for (const mode of ['throw', '500']) {
        m = fresh({ SUPABASE_URL: 'http://sb.mock', SUPABASE_SERVICE_ROLE_KEY: 'svc', ALERT_WEBHOOK_URL: 'https://hook.example', BLOB_READ_WRITE_TOKEN: 't' });
        sbMode = mode;
        let geworfen = false, r;
        try { r = await m.alertOps('blob-upload', 'byte-budget-open', 'x'); } catch (e) { geworfen = true; }
        check('C Supabase ' + mode + ': wirft nicht, meldet true', !geworfen && r === true);
        check('C Supabase ' + mode + ': Webhook und Blob trotzdem', calls.some(x => x.url === 'https://hook.example') && puts.length === 1);
    }

    // E
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261008000003_ops_alerts.sql'), 'utf8');
    const def = /create or replace function sync_alert_add\(([^)]*)\)/.exec(sql);
    const sqlParams = def ? def[1].split(',').map(a => a.trim().split(/\s+/)[0]).sort() : [];
    const src = fs.readFileSync(path.join(ROOT, 'api/_alert.js'), 'utf8');
    const call = /db\.rpc\('sync_alert_add',\s*\{([^}]*)\}/.exec(src);
    const jsParams = call ? call[1].split(',').map(p => p.split(':')[0].trim()).filter(Boolean).sort() : [];
    check('E rpc-Parameter = Migration', sqlParams.length === 4 && JSON.stringify(sqlParams) === JSON.stringify(jsParams));
    check('E Rechte: anon/authenticated entzogen, nur service_role',
          /revoke all on ops_alerts from public, anon, authenticated/.test(sql) &&
          /revoke all on function sync_alert_add\(text, text, text, text\) from public, anon, authenticated/.test(sql) &&
          /grant execute on function sync_alert_add\(text, text, text, text\) to service_role/.test(sql) &&
          /enable row level security/.test(sql));
    check('E Aufbewahrung 30 Tage und Deckel', /interval '30 days'/.test(sql) && /- 10000/.test(sql));

    console.error = origErr;
    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    process.exit(pass === total ? 0 : 1);
})().catch(e => { console.error = origErr; console.error(e); process.exit(1); });
