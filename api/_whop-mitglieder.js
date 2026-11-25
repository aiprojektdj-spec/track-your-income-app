// Whop API v1: E-Mail-Adressen der Mitglieder (Helfer, kein Endpunkt)
// =============================================================================
// Seit Whop API v1 enthaelt eine Mitgliedschaft (GET /memberships) nur noch user_id, kein
// user-Objekt mit E-Mail. Die E-Mail liefert GET /members (Feld email, Nutzer unter user.id).
// Wirft bei HTTP-Fehlern: Aufrufer entscheiden, ob sie ohne E-Mail weitermachen duerfen.
// =============================================================================

var WHOP_API   = 'https://api.whop.com/api/v1';
var MAX_SEITEN = 200;

// Liefert { userId: 'mail@klein.de' } fuer alle Mitglieder der Firma.
async function whopEmails(env, fetchFn) {
    var firma = env.WHOP_COMPANY_ID || 'biz_2OEWYGlOwb8b0f';
    var mails = {}, after = '';
    for (var seite = 0; seite < MAX_SEITEN; seite++) {
        var r = await fetchFn(WHOP_API + '/members?account_id=' + encodeURIComponent(firma) + '&first=100' +
                              (after ? '&after=' + encodeURIComponent(after) : ''), {
            headers: { 'Authorization': 'Bearer ' + env.WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('Whop members HTTP ' + r.status);
        var j = await r.json();
        (j.data || []).forEach(function (m) {
            var u = m && m.user && m.user.id;
            var mail = m && (m.email || (m.user && m.user.email));
            if (u && mail && !mails[u]) mails[u] = String(mail).toLowerCase();
        });
        var pi = j.page_info;
        if (!pi || !pi.has_next_page || !pi.end_cursor) break;
        after = pi.end_cursor;
    }
    return mails;
}

module.exports = { whopEmails: whopEmails };
