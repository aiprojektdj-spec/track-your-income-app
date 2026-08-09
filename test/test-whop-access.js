// Self-Test der parallelen has_access-Logik:  node test/test-whop-access.js
// Stubt global.fetch, prüft die grant/ok/reject/5xx-Semantik von _hasAccessViaToken.
// ACCESS_IDS default = 3 IDs (prod_,prod_,biz_) — der Stub antwortet je nach Map.

const { _hasAccessViaToken } = require('../api/whop-access.js')._test;

// stub: map { '<id-suffix>': {status, body} } — id-Suffix = Teil nach letztem '/'
function stubFetch(map) {
    global.fetch = async (url) => {
        const id = url.split('/').pop();
        const m = map[id] || { status: 404 };
        return {
            status: m.status,
            ok: m.status >= 200 && m.status < 300,
            json: async () => m.body || {},
        };
    };
}

let pass = 0, fail = 0;
async function eq(name, got, want) {
    const g = await got;
    if (g === want) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + ' — got ' + JSON.stringify(g) + ' want ' + JSON.stringify(want)); fail++; }
}

(async () => {
    // ein Grant irgendwo → true (auch wenn andere IDs ablehnen/skippen)
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 401 }, prod_p1WHi5t65rAA6: { status: 200, body: { valid: true } }, biz_2OEWYGlOwb8b0f: { status: 404 } });
    await eq('irgendein Grant → true', _hasAccessViaToken('t'), true);

    // alle 2xx aber kein Grant → false (echtes „kein Abo")
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { valid: false } }, prod_p1WHi5t65rAA6: { status: 200, body: { valid: false } }, biz_2OEWYGlOwb8b0f: { status: 200, body: { valid: false } } });
    await eq('alle 2xx ohne Grant → false', _hasAccessViaToken('t'), false);

    // alle 401/403, kein einziges 2xx → null (unbestimmt → Fallback/Grace)
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 401 }, prod_p1WHi5t65rAA6: { status: 403 }, biz_2OEWYGlOwb8b0f: { status: 401 } });
    await eq('alle abgelehnt, kein 2xx → null', _hasAccessViaToken('t'), null);

    // ein 5xx → wirft (→ 502 → Client-Grace)
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { valid: false } }, prod_p1WHi5t65rAA6: { status: 503 }, biz_2OEWYGlOwb8b0f: { status: 401 } });
    let threw = false;
    try { await _hasAccessViaToken('t'); } catch (e) { threw = true; }
    await eq('ein 5xx → wirft', threw, true);

    // Grant im data-Wrapper erkannt
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { data: { access_level: 'admin' } } }, prod_p1WHi5t65rAA6: { status: 404 }, biz_2OEWYGlOwb8b0f: { status: 404 } });
    await eq('Grant in data-Wrapper → true', _hasAccessViaToken('t'), true);

    console.log('\n' + pass + '/' + (pass + fail) + ' Tests bestanden ' + (fail ? '❌' : '✅'));
    process.exit(fail ? 1 : 0);
})();
