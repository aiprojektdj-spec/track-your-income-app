// Stackr Admin — schmaler Supabase-Zugriff (PostgREST-RPC per fetch, kein supabase-js)
// =============================================================================
// Eigene Kopie von api/_db.js (reduziert): das Admin-Panel ist ein eigenes Vercel-Projekt
// mit Root-Verzeichnis admin/ und kann nicht aus ../api importieren.
//
// Env (Vercel-Projekt "stackr-admin", Sensitive):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — Service-Key nie in den Browser
// Fehler nennen nur Funktionsname und Status, nie den Antwort-Body.
// =============================================================================

function config() {
    var key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    return {
        url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
        key: /^[\x21-\x7e]+$/.test(key) ? key : ''
    };
}

function isConfigured() {
    var c = config();
    return !!(c.url && c.key);
}

async function rpc(name, args, timeoutMs) {
    var c = config();
    var r = await fetch(c.url + '/rest/v1/rpc/' + name, {
        method:  'POST',
        headers: {
            'apikey': c.key, 'Authorization': 'Bearer ' + c.key,
            'Content-Type': 'application/json', 'Accept': 'application/json'
        },
        body:   JSON.stringify(args || {}),
        signal: AbortSignal.timeout(timeoutMs || 8000)
    });
    if (!r.ok) throw new Error('Supabase rpc ' + name + ' HTTP ' + r.status);
    var text = await r.text();
    return text ? JSON.parse(text) : null;
}

module.exports = { config: config, isConfigured: isConfigured, rpc: rpc };
