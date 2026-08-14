// Self-Test der parallelen has_access-Logik:  node test/test-whop-access.js
// Stubt global.fetch, prüft die grant/ok/reject/5xx-Semantik von _hasAccessViaToken.
// ACCESS_IDS default = 3 IDs (prod_,prod_,biz_) — der Stub antwortet je nach Map.
//
// Rückgabe-Vertrag seit Fund N2 (Monetarisierungs-Audit 2026-08-12): { ok, detail } statt eines
// nackten Booleans. `ok` ist unverändert true|false|null — die ZUGANGSENTSCHEIDUNG hat sich nicht
// geändert. Neu ist `detail`: Status und Verlängerungszeitpunkt aus demselben Objekt, das den
// Zugang gewährt hat. Vorher warf der Server 'trialing' weg, obwohl _grants() es prüft — deshalb
// konnte die App während der sieben Trial-Tage nicht sagen, dass ein Trial läuft.

const api = require('../api/whop-access.js')._test;
const { _hasAccessViaToken, _statusOf } = api;

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
function check(name, cond, info) {
    if (cond) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + (info ? ' — ' + info : '')); fail++; }
}
async function okIs(name, promise, want) {
    const r = await promise;
    check(name, r && r.ok === want, 'got ' + JSON.stringify(r) + ' want ok=' + JSON.stringify(want));
    return r;
}

(async () => {
    // ein Grant irgendwo → ok:true (auch wenn andere IDs ablehnen/skippen)
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 401 }, prod_p1WHi5t65rAA6: { status: 200, body: { valid: true } }, biz_2OEWYGlOwb8b0f: { status: 404 } });
    await okIs('irgendein Grant → ok:true', _hasAccessViaToken('t'), true);

    // alle 2xx aber kein Grant → ok:false (echtes „kein Abo")
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { valid: false } }, prod_p1WHi5t65rAA6: { status: 200, body: { valid: false } }, biz_2OEWYGlOwb8b0f: { status: 200, body: { valid: false } } });
    await okIs('alle 2xx ohne Grant → ok:false', _hasAccessViaToken('t'), false);

    // alle 401/403, kein einziges 2xx → ok:null (unbestimmt → Fallback/Grace)
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 401 }, prod_p1WHi5t65rAA6: { status: 403 }, biz_2OEWYGlOwb8b0f: { status: 401 } });
    await okIs('alle abgelehnt, kein 2xx → ok:null', _hasAccessViaToken('t'), null);

    // ein 5xx → wirft (→ 502 → Client-Grace)
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { valid: false } }, prod_p1WHi5t65rAA6: { status: 503 }, biz_2OEWYGlOwb8b0f: { status: 401 } });
    let threw = false;
    try { await _hasAccessViaToken('t'); } catch (e) { threw = true; }
    check('ein 5xx → wirft', threw === true);

    // Grant im data-Wrapper erkannt
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { data: { access_level: 'admin' } } }, prod_p1WHi5t65rAA6: { status: 404 }, biz_2OEWYGlOwb8b0f: { status: 404 } });
    await okIs('Grant in data-Wrapper → ok:true', _hasAccessViaToken('t'), true);

    // ── Fund N2: der Trial-Status muss mitkommen ─────────────────────────────────────────────
    const inSieben = Date.now() + 7 * 86400000;
    stubFetch({
        prod_wgVmaJg4sBVOD: { status: 200, body: { status: 'trialing', renewal_period_end: Math.floor(inSieben / 1000) } },
        prod_p1WHi5t65rAA6: { status: 404 }, biz_2OEWYGlOwb8b0f: { status: 404 }
    });
    let r = await okIs('Trial gewährt Zugang', _hasAccessViaToken('t'), true);
    check('Trial-Status kommt mit', r.detail && r.detail.status === 'trialing',
          'detail=' + JSON.stringify(r.detail));
    check('Sekunden-Epoch wird zu Millisekunden', r.detail && Math.abs(r.detail.renewsAt - inSieben) < 1000,
          'renewsAt=' + (r.detail && r.detail.renewsAt) + ' erwartet ~' + inSieben);

    // Ein aktives Abo liefert 'active' — der Client darf daraus KEINEN Trial machen
    stubFetch({
        prod_wgVmaJg4sBVOD: { status: 200, body: { status: 'active', renews_at: new Date(inSieben).toISOString() } },
        prod_p1WHi5t65rAA6: { status: 404 }, biz_2OEWYGlOwb8b0f: { status: 404 }
    });
    r = await okIs('aktives Abo gewährt Zugang', _hasAccessViaToken('t'), true);
    check('active wird als active gemeldet', r.detail && r.detail.status === 'active');
    check('ISO-Datum wird geparst', r.detail && Math.abs(r.detail.renewsAt - inSieben) < 1000);

    // Kein Status im Body (älterer has_access-Shape) → detail null, Zugang trotzdem
    stubFetch({ prod_wgVmaJg4sBVOD: { status: 200, body: { valid: true } }, prod_p1WHi5t65rAA6: { status: 404 }, biz_2OEWYGlOwb8b0f: { status: 404 } });
    r = await okIs('Grant ohne Statusfeld gewährt Zugang', _hasAccessViaToken('t'), true);
    check('ohne Statusfeld bleibt detail leer', r.detail === null, 'detail=' + JSON.stringify(r.detail));

    // ── _statusOf isoliert ───────────────────────────────────────────────────────────────────
    check('_statusOf: null bei leerem Objekt', _statusOf({}) === null);
    check('_statusOf: null bei undefined', _statusOf(undefined) === null);
    check('_statusOf: data-Wrapper wird gelesen',
          (_statusOf({ data: { status: 'trialing' } }) || {}).status === 'trialing');
    check('_statusOf: current_period_end als Alternative',
          (_statusOf({ status: 'active', current_period_end: 1800000000 }) || {}).renewsAt === 1800000000000);
    check('_statusOf: unparsebares Datum → renewsAt null',
          (_statusOf({ status: 'active', renews_at: 'übermorgen' }) || {}).renewsAt === null);
    // Millisekunden-Werte dürfen NICHT ein zweites Mal multipliziert werden
    const ms = 1800000000000;
    check('_statusOf: Millisekunden bleiben Millisekunden',
          (_statusOf({ status: 'active', renews_at: ms }) || {}).renewsAt === ms);

    console.log('\n' + pass + '/' + (pass + fail) + ' Tests bestanden ' + (fail ? '❌' : '✅'));
    process.exit(fail ? 1 : 0);
})();
