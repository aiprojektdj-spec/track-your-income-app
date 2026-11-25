// Stackr Admin — Zahlungen aus Whop lesen (NUR GET)
// =============================================================================
// Sicherheitsentscheidung User 2026-11-02: Der Whop-Key im Admin-Projekt ist ein Lese-Key. Dieses
// Modul darf nie etwas anderes als GET an Whop schicken (test/test-admin-phase-c.js prueft das).
// Erstattung und Kuendigung laufen im Whop-Dashboard.
//
// Annahme: Whop liefert Betraege als Dezimalzahl in der Hauptwaehrung (z. B. 15.0 = 15 EUR) und
// die Felder total, refunded_amount, currency, status, failure_message, card_brand, card_last4,
// created_at, paid_at, user.id, membership.id (docs.whop.com/api-reference/payments/list-payments).
// Fehlt ein Feld, bleibt es leer bzw. 0.
// =============================================================================

var WHOP_API   = 'https://api.whop.com/api/v1';
var MAX_SEITEN = 200;

// Whop API v1 liefert Betraege als Money-Objekt { amount: "15.00", currency, decimals }
function cents(v) {
    if (v && typeof v === 'object') v = v.amount;
    var n = Number(v);
    return isFinite(n) ? Math.round(n * 100) : 0;
}

// Fehlgeschlagen: Status nennt es, oder Whop liefert eine Fehlermeldung ohne bezahlt-Zeitpunkt
function istFehlgeschlagen(p) {
    var s = String(p.status || '').toLowerCase();
    if (/fail|declin|error/.test(s)) return true;
    return !!p.failure_message && !p.paid_at && s !== 'paid';
}

// v1: Kartendaten unter payment_instrument.card (nur brand und last4 werden uebernommen)
function karte(p) {
    return (p.payment_instrument && p.payment_instrument.card) || {};
}

function zeile(p) {
    return {
        id:              String(p.id),
        whop_user_id:    String((p.user && p.user.id) || p.user_id || ''),
        membership_id:   String((p.membership && p.membership.id) || p.membership_id || ''),
        status:          String(p.status || ''),
        failed:          istFehlgeschlagen(p),
        failure_message: String(p.failure_message || '').slice(0, 300),
        amount_cents:    cents(p.total != null ? p.total : p.final_amount),
        refunded_cents:  cents(p.refunded_amount),
        currency:        String(p.currency || (p.total && p.total.currency) || '').toLowerCase(),
        card_brand:      String(p.card_brand || (karte(p).brand) || ''),
        card_last4:      String(p.card_last4 || (karte(p).last4) || '').slice(-4),
        created_at:      p.created_at || null,
        paid_at:         p.paid_at || null
    };
}

async function zahlungenLaden(env, fetchFn) {
    var firma = env.WHOP_COMPANY_ID || 'biz_2OEWYGlOwb8b0f';
    var rows = [], after = '';
    for (var seite = 0; seite < MAX_SEITEN; seite++) {
        var r = await fetchFn(WHOP_API + '/payments?account_id=' + encodeURIComponent(firma) + '&first=100' +
                              (after ? '&after=' + encodeURIComponent(after) : ''), {
            method:  'GET',
            headers: { 'Authorization': 'Bearer ' + env.WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('Whop payments HTTP ' + r.status);
        var j = await r.json();
        (j.data || []).forEach(function (p) { if (p && p.id) rows.push(zeile(p)); });
        var pi = j.page_info;
        if (!pi || !pi.has_next_page || !pi.end_cursor) break;
        after = pi.end_cursor;
    }
    return rows;
}

module.exports = { zahlungenLaden: zahlungenLaden, zeile: zeile, cents: cents, istFehlgeschlagen: istFehlgeschlagen };
