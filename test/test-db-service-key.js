// Service-Key nie in Fehlermeldungen:  node test/test-db-service-key.js
// =============================================================================
// Befund B3 aus plan/audit-supabase-security-2026-10-07.md: Enthält SUPABASE_SERVICE_ROLE_KEY
// ein in HTTP-Headern ungültiges Zeichen (Zeilenumbruch mitten im Wert), wirft fetch
// "Headers.append: "<voller Wert>" is an invalid header value." — und diese Meldung ging über
// _log/alertOps in Log und Alarm-Mail. Geprüft wird mit dem ECHTEN fetch von Node: ein
// kaputter Wert gilt als nicht gesetzt, und keine Fehlermeldung trägt ihn.
// =============================================================================
'use strict';
const assert = require('assert');
const path   = require('path');
const ROOT   = path.join(__dirname, '..');

const GEHEIM = 'sb_secret_GEHEIM123';
const KAPUTT = GEHEIM + '\nZWEITEZEILE';

function lade(env) {
    for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STORAGE_BACKEND', 'STORAGE_MIRROR', 'BLOB_BACKEND',
                     'BLOB_READ_WRITE_TOKEN']) delete process.env[k];
    Object.assign(process.env, env);
    for (const f of ['api/_db.js', 'api/_storage.js', 'api/_sync-store.js']) delete require.cache[path.join(ROOT, f)];
    return { db: require('../api/_db.js'), storage: require('../api/_storage.js'), store: require('../api/_sync-store.js') };
}

// Fehlertext eines Aufrufs, '' wenn er nicht wirft
async function meldung(fn) {
    try { await fn(); return ''; } catch (e) { return String(e && e.message) + ' ' + String(e && e.cause && e.cause.message); }
}

(async () => {
    let pass = 0;
    const ok = (m) => { pass++; console.log('✓ ' + m); };
    // Nicht auflösbarer Host: der Request scheitert sicher, der Header wird vorher geprüft
    const URL_ = 'https://stackr-test.invalid';

    // 1. Gültige Formen bleiben gültig (JWT, sb_secret_, Umbruch am Ende wie nach `echo |`)
    let m = lade({ SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc-_' });
    assert.ok(m.db.isConfigured(), 'JWT gültig');
    m = lade({ SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: GEHEIM + '\n' });
    assert.strictEqual(m.db.serviceKey(), GEHEIM, 'Umbruch am Ende wird abgeschnitten');
    ok('JWT, sb_secret_ und Umbruch am Ende bleiben gültig');

    // 2. Kaputter Wert gilt als nicht gesetzt — Meldungen nennen nur den Namen
    // (NUL kann in einer Env-Variablen nicht stehen — Node schneidet dort ab.)
    for (const kaputt of [KAPUTT, GEHEIM + '\rx', GEHEIM + ' x', GEHEIM + '…']) {
        m = lade({ SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: kaputt, STORAGE_BACKEND: 'supabase', BLOB_BACKEND: 'supabase' });
        assert.strictEqual(m.db.isConfigured(), false, JSON.stringify(kaputt) + ' gilt als nicht gesetzt');
        assert.strictEqual(m.db.serviceKey(), '');
        const texte = [m.store.configProblem(), m.storage.configProblem()];
        assert.ok(texte.every(t => /ungültig/.test(t)), 'Meldung nennt den Grund: ' + texte.join(' | '));
        assert.ok(texte.every(t => t.indexOf('GEHEIM') === -1), 'Meldung ohne Schlüsselwert');
    }
    ok('Umbruch/CR/Leerzeichen/Nicht-ASCII im Schlüssel → nicht konfiguriert, Meldung ohne Wert');

    // 3. Mit echtem fetch: weder rpc noch Storage-Aufrufe tragen den Wert in ihrer Fehlermeldung
    m = lade({ SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KAPUTT, BLOB_BACKEND: 'supabase' });
    const fehler = [
        await meldung(() => m.db.rpc('sync_get', { p_user: 'u', p_scope: '__account' }, 3000)),
        await meldung(() => m.storage.sign(['sb:stackr/attachments/u/__account/f-1'])),
        await meldung(() => m.storage.put('stackr/attachments/u/__account/f', Buffer.from('x'))),
        await meldung(() => m.storage.remove(['sb:stackr/attachments/u/__account/f-1'])),
        await meldung(() => m.storage.read('sb:stackr/attachments/u/__account/f-1'))
    ];
    fehler.forEach((t, i) => {
        assert.ok(t, 'Aufruf ' + i + ' scheitert (Host existiert nicht)');
        assert.ok(t.indexOf('GEHEIM') === -1 && t.indexOf('ZWEITEZEILE') === -1, 'Schlüssel in Meldung ' + i + ': ' + t);
    });
    ok(fehler.length + ' Supabase-Aufrufe: Fehlermeldungen ohne Schlüsselwert');

    // 4. Gegenprobe: genau diese Meldung ist es, die den Wert ohne Prüfung verriete
    const roh = await meldung(() => fetch(URL_, { headers: { apikey: KAPUTT } }));
    assert.ok(roh.indexOf('GEHEIM') !== -1, 'fetch wiederholt einen ungültigen Header-Wert — sonst prüft dieser Test nichts');
    ok('Gegenprobe: fetch selbst gibt den ungültigen Wert in der Meldung aus');

    console.log('\n' + pass + '/4 Service-Key-Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
