// Stackr — Sperre durch das Admin-Panel abfragen (Helfer, kein Endpunkt)
// =============================================================================
// Das Admin-Panel (admin/) setzt admin_members.suspended_at; sync_admin_gesperrt(user) liefert
// true, wenn ein Nutzer gesperrt ist. api/sync.js, api/blob-upload.js und api/_auth.js (data.js)
// antworten dann mit 403 account_suspended.
//
// Ausnahme (Annahme, User-Entscheid ausstehend): Selbstbedienung — eigene Daten loeschen und
// Freigaben widerrufen — bleibt auch fuer Gesperrte moeglich (Art. 17 DSGVO). Das entscheiden die
// Aufrufer, nicht dieser Helfer.
//
// Faellt die Abfrage aus (Supabase weg, Tabelle fehlt in diesem Projekt), gilt der Nutzer als NICHT
// gesperrt und der Fehler wird geloggt: eine Panel-Stoerung darf zahlende Kunden nicht aussperren.
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var db   = require('./_db.js');
var _log = require('./_log.js');

async function istGesperrt(userId) {
    if (!userId || !db.isConfigured()) return false;
    try {
        return (await db.rpc('sync_admin_gesperrt', { p_user: String(userId) }, 3000)) === true;
    } catch (e) {
        _log.logError('gesperrt', 'GESPERRT_CHECK_FAILED', e);
        return false;
    }
}

module.exports = { istGesperrt: istGesperrt };
