// Stackr — schmaler Supabase-Zugriff für api/ (PostgREST per fetch, kein supabase-js)
// =============================================================================
// Entscheidung E3 (2026-10-06): keine neue Abhängigkeit. Jede Speicheroperation ist
// eine Postgres-Funktion aus supabase/migrations/ und wird über /rest/v1/rpc/<name>
// aufgerufen — eine Anfrage, eine Transaktion.
//
// Env (Vercel, als Sensitive anlegen — trägt der User selbst ein):
//   SUPABASE_URL                https://<projekt>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   Service-Key; umgeht RLS, darf NIE in den Browser
//
// Fehler tragen nur Funktionsname und HTTP-Status, nie den Antwort-Body: der kann
// bei PostgREST Parameterwerte wiederholen (siehe api/_log.js).
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

function config() {
    return {
        url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
        key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    };
}

function isConfigured() {
    var c = config();
    return !!(c.url && c.key);
}

async function rpc(name, args) {
    var c = config();
    var r = await fetch(c.url + '/rest/v1/rpc/' + name, {
        method:  'POST',
        headers: {
            'apikey':        c.key,
            'Authorization': 'Bearer ' + c.key,
            'Content-Type':  'application/json',
            'Accept':        'application/json'
        },
        body:   JSON.stringify(args || {}),
        signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('Supabase rpc ' + name + ' HTTP ' + r.status);
    // void-Funktionen antworten mit 204 bzw. leerem Body
    var text = await r.text();
    return text ? JSON.parse(text) : null;
}

module.exports = { rpc: rpc, isConfigured: isConfigured };
