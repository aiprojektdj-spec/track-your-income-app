// Stackr — Cloud-Daten 30 Tage nach Abo-Ende löschen (täglich aus api/blob-cleanup.js)
// =============================================================================
// Entscheidung User 2026-10-26 (plan/02-ENTSCHEIDUNGEN.md):
//   - Frist beginnt mit dem Ende der Bezahlzeit: erster Tageslauf, an dem Whop keine gültige
//     Mitgliedschaft mehr kennt (≤ 1 Tag nach Periodenende). Kein rückwirkender Beginn — wer beim
//     ersten Lauf schon lange inaktiv ist, bekommt ebenfalls volle 30 Tage.
//   - Vorwarnung per Mail zweimal: sofort beim Vormerken (Mail 1) und ab Tag 23 (Mail 2).
//   - Gelöscht wird frühestens an Tag 30 UND frühestens 7 Tage nach Mail 2 — scheitert der
//     Versand ein paar Tage, verschiebt sich die Löschung, die Ankündigung bleibt wahr.
//     Ohne bekannte E-Mail-Adresse wird an Tag 30 ohne Mail gelöscht (im Bericht gezählt).
//   - Gelöscht: Sync-Snapshots aller Scopes, Scope-Liste, Anhänge (stackr/attachments/<user>/,
//     stackr/tmp/<user>/), erteilte Steuerberater-Freigaben, öffentlicher Schlüssel (nur wenn
//     der Nutzer nicht selbst Empfänger einer Freigabe ist). BLEIBT: Prüfliste sync_anchors
//     (Art. 17 Abs. 3 lit. b DSGVO, DSE 6.1) — dieselbe Regel wie action=delete in api/sync.js.
//   - Probelauf ist Standard: Ohne SYNC_LOESCHUNG=aktiv wird vorgemerkt und gemeldet, aber
//     weder gelöscht noch eine Mail an Kunden geschickt.
//     Annahme: Im Probelauf geht die Vorwarnung NICHT an Kunden, sondern nur als Zählung an den
//     Betreiber — eine Kunden-Mail „wir löschen am …“ wäre falsch, solange nichts gelöscht wird.
//
// Schutz gegen Massenlöschung durch eine kaputte Whop-Antwort: Fehler oder null gültige
// Mitgliedschaften → Abbruch; mehr als 3 neue Vormerkungen UND mehr als die Hälfte aller
// Nutzer mit Daten an einem Tag → Abbruch ohne Änderung, Alarm. Owner (SYNC_OWNER_IDS,
// WHOP_OWNER_IDS) sind ausgenommen.
//
// Mails gehen über ALERT_WEBHOOK_URL (Make) mit event 'loeschung-vorwarnung' und denselben
// Feldern wie die Kündigungsbestätigung (email, mail_betreff, mail_text). Das Make-Szenario muss
// diese Ereignisse an die Adresse in `email` schicken — Anleitung plan/rechtsaudit-2026-10-24.md.
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var TAG          = 86400000;
var FRIST_TAGE   = 30;
var MAIL2_TAG    = 23;
var VORLAUF_TAGE = 7;
var GUELTIG      = { active: 1, trialing: 1, past_due: 1 };
var WHOP_API     = 'https://api.whop.com/api/v1';
var MAX_SEITEN   = 200;

function _ids(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }

function _datum(t) { return new Date(t).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long' }); }

// Alle Mitgliedschaften der Firma: { aktiv: Set(userId), info: { userId: { email } }, n }
async function whopMitglieder(env, fetchFn) {
    var firma = env.WHOP_COMPANY_ID || 'biz_2OEWYGlOwb8b0f';
    var aktiv = new Set(), info = {}, after = '', n = 0;
    for (var seite = 0; seite < MAX_SEITEN; seite++) {
        var r = await fetchFn(WHOP_API + '/memberships?account_id=' + encodeURIComponent(firma) + '&first=100' +
                              (after ? '&after=' + encodeURIComponent(after) : ''), {
            headers: { 'Authorization': 'Bearer ' + env.WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('Whop memberships HTTP ' + r.status);
        var j = await r.json();
        (j.data || []).forEach(function (m) {
            var u = (m && m.user && m.user.id) || (m && m.user_id);
            if (!u) return;
            n++;
            if (m.valid === true || GUELTIG[m.status]) aktiv.add(u);
            if (m.user && m.user.email && !info[u]) info[u] = { email: String(m.user.email).toLowerCase() };
        });
        var pi = j.page_info;
        if (!pi || !pi.has_next_page || !pi.end_cursor) break;
        after = pi.end_cursor;
    }
    return { aktiv: aktiv, info: info, n: n };
}

function mailText(nr, loeschAb) {
    var d = _datum(loeschAb);
    var betreff = nr === 1
        ? 'Dein Stackr-Abo ist beendet — Cloud-Daten werden ab dem ' + d + ' gelöscht'
        : 'Erinnerung: Deine Stackr-Cloud-Daten werden ab dem ' + d + ' gelöscht';
    var text = (nr === 1 ? 'Hallo,\n\ndein Stackr-Abo ist abgelaufen.' : 'Hallo,\n\nkurze Erinnerung zu deinem beendeten Stackr-Abo.') +
        '\n\nDie bei uns gespeicherten Daten deines Cloud-Sync (verschlüsselte Sync-Stände und Belege) ' +
        'löschen wir ab dem ' + d + '. Die Daten in deinem Browser löschen wir nicht.' +
        '\n\nWillst du die Cloud-Daten behalten, verlängere dein Abo vor diesem Datum — dann bleibt alles erhalten.' +
        '\n\nDenk an deine Aufbewahrungspflichten (§ 147 AO, § 14b UStG): Sichere deine Buchhaltung, ' +
        'solange du Zugriff hast, z. B. über Backup → Export.' +
        '\n\nBestehen bleibt nur die Prüfliste zur Unveränderbarkeit deiner Buchungen (Prüfwerte ohne Inhalte), ' +
        'bis die gesetzliche Aufbewahrungsfrist abgelaufen ist (Datenschutzerklärung Ziffer 6.1).' +
        '\n\nFragen: https://getstackr.de/kontakt.html\n\nViele Grüße\nStackr';
    return { betreff: betreff, text: text };
}

// Löscht die Cloud-Daten eines Nutzers. Prüfliste bleibt.
async function loescheNutzer(u, d, now) {
    var scopes = await d.store.listScopesAlle(u);
    if (scopes.indexOf('__account') === -1) scopes.push('__account');
    for (var i = 0; i < scopes.length; i++) await d.store.del(u, scopes[i]);
    await d.store.clearScopes(u);
    await d.storage.sweep('stackr/attachments/' + u + '/', null, now);
    await d.storage.sweep('stackr/tmp/' + u + '/', null, now);
    var empfaenger = (await d.store.listGranteesBy(u)) || [];   // [{ id: granteeId, data }]
    for (var g = 0; g < empfaenger.length; g++) {
        if (empfaenger[g] && empfaenger[g].id) await d.store.revokeGrant(u, empfaenger[g].id);
    }
    var selbstEmpfaenger = ((await d.store.listGrantsFor(u)) || []).length > 0;
    if (!selbstEmpfaenger) await d.store.delPubkey(u);
}

// d = { store, storage, db, fetch, melden(source, event, detail), mail(email, nr, {betreff, text}), env, now }
async function tageslauf(d) {
    var env = d.env, now = d.now;
    var scharf = env.SYNC_LOESCHUNG === 'aktiv';
    if (!d.db.isConfigured() || d.store.configProblem() || !env.WHOP_API_KEY) return { status: 'aus' };

    var whop;
    try { whop = await whopMitglieder(env, d.fetch); }
    catch (e) { await d.melden('loeschung', 'whop-fehler', e && e.message); return { status: 'abbruch', grund: 'whop' }; }
    if (!whop.aktiv.size) { await d.melden('loeschung', 'whop-leer', whop.n + ' Mitgliedschaften, keine gueltige'); return { status: 'abbruch', grund: 'whop-leer' }; }

    var owner = new Set(_ids(env.SYNC_OWNER_IDS).concat(_ids(env.WHOP_OWNER_IDS)));
    var nutzer = await d.store.listUsers();
    var plan = {};
    ((await d.db.rpc('sync_loeschplan_liste', {})) || []).forEach(function (r) { plan[r.user_id] = r; });

    var wieder = [], neu = [];
    nutzer.forEach(function (u) {
        var aktiv = whop.aktiv.has(u) || owner.has(u);
        if (aktiv && plan[u]) wieder.push(u);
        if (!aktiv && !plan[u]) neu.push(u);
    });
    // Planzeilen ohne Daten mehr (Nutzer hat selbst gelöscht) oder wieder aktiv → raus
    Object.keys(plan).forEach(function (u) { if (nutzer.indexOf(u) === -1 && wieder.indexOf(u) === -1) wieder.push(u); });

    if (neu.length > 3 && neu.length * 2 > nutzer.length) {
        await d.melden('loeschung', 'massen-vormerkung', neu.length + ' von ' + nutzer.length + ' Nutzern auf einmal inaktiv — Lauf abgebrochen, nichts geaendert');
        return { status: 'abbruch', grund: 'massen' };
    }

    for (var w = 0; w < wieder.length; w++) { await d.db.rpc('sync_loeschplan_entfernen', { p_user: wieder[w] }); delete plan[wieder[w]]; }
    if (neu.length) {
        await d.db.rpc('sync_loeschplan_vormerken', { p_users: neu });
        neu.forEach(function (u) { plan[u] = { user_id: u, inaktiv_seit: new Date(now).toISOString(), mail1_am: null, mail2_am: null }; });
    }

    var bericht = { vorgemerkt: neu.length, wieder: wieder.length, mail1: 0, mail2: 0, geloescht: 0, faellig: [], ohneMail: 0, fehler: 0 };
    var ids = Object.keys(plan);
    for (var i = 0; i < ids.length; i++) {
        var u = ids[i], r = plan[u];
        var seit = new Date(r.inaktiv_seit).getTime();
        var tage = (now - seit) / TAG;
        var email = whop.info[u] && whop.info[u].email;
        var loeschAb = seit + FRIST_TAGE * TAG;
        try {
            if (scharf && email && !r.mail1_am && tage < FRIST_TAGE - VORLAUF_TAGE) {
                if (await d.mail(email, 1, mailText(1, loeschAb))) { await d.db.rpc('sync_loeschplan_mail', { p_user: u, p_nr: 1 }); bericht.mail1++; }
            }
            if (scharf && email && !r.mail2_am && tage >= MAIL2_TAG) {
                if (await d.mail(email, 2, mailText(2, Math.max(loeschAb, now + VORLAUF_TAGE * TAG)))) {
                    await d.db.rpc('sync_loeschplan_mail', { p_user: u, p_nr: 2 }); r.mail2_am = new Date(now).toISOString(); bericht.mail2++;
                }
            }
            if (tage < FRIST_TAGE) continue;
            var gewarnt = r.mail2_am && (now - new Date(r.mail2_am).getTime()) >= VORLAUF_TAGE * TAG;
            if (!email) bericht.ohneMail++;
            if (!scharf) { bericht.faellig.push(u); continue; }
            if (!gewarnt && email) continue;
            await loescheNutzer(u, d, now);
            await d.db.rpc('sync_loeschplan_entfernen', { p_user: u });
            bericht.geloescht++;
        } catch (e) {
            bericht.fehler++;
            await d.melden('loeschung', 'nutzer-fehler', u + ': ' + (e && e.message));
        }
    }

    if (bericht.vorgemerkt || bericht.wieder || bericht.mail1 || bericht.mail2 || bericht.geloescht || bericht.faellig.length) {
        await d.melden('loeschung', scharf ? 'tagesbericht' : 'probelauf',
            (scharf ? '' : 'PROBELAUF (SYNC_LOESCHUNG nicht aktiv) — ') +
            'vorgemerkt ' + bericht.vorgemerkt + ', wieder aktiv ' + bericht.wieder + ', Mail 1: ' + bericht.mail1 +
            ', Mail 2: ' + bericht.mail2 + ', geloescht ' + bericht.geloescht +
            (bericht.faellig.length ? ', wuerde loeschen ' + bericht.faellig.length + ' (' + bericht.faellig.slice(0, 5).join(', ') + ')' : '') +
            (bericht.ohneMail ? ', ohne E-Mail ' + bericht.ohneMail : '') + ', im Plan ' + ids.length);
    }
    return { status: scharf ? 'aktiv' : 'probelauf', bericht: bericht };
}

// Kunden-Mail über den Make-Webhook, gleiche Felder wie api/kuendigung.js. true = angenommen.
async function mailSenden(env, fetchFn, email, nr, m) {
    if (!env.ALERT_WEBHOOK_URL) return false;
    try {
        var r = await fetchFn(env.ALERT_WEBHOOK_URL, {
            method:  'POST',
            // charset MUSS mit, sonst dekodiert Make als Latin-1 (s. api/_alert.js)
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body:    JSON.stringify({
                text:         '[Stackr] loeschung — Vorwarnung ' + nr + ' an ' + email,
                source:       'loeschung',
                event:        'loeschung-vorwarnung',
                env:          env.VERCEL_ENV || 'unknown',
                ts:           new Date().toISOString(),
                email:        email,
                mail_betreff: m.betreff,
                mail_text:    m.text
            }),
            signal: AbortSignal.timeout(4000)
        });
        return !!r.ok;
    } catch (e) { return false; }
}

// Aufruf aus api/blob-cleanup.js mit den echten Modulen. Wirft nie.
async function laufen(now) {
    var alertOps = require('./_alert.js').alertOps;
    try {
        return await tageslauf({
            store:   require('./_sync-store.js'),
            storage: require('./_storage.js'),
            db:      require('./_db.js'),
            fetch:   fetch,
            env:     process.env,
            now:     now,
            melden:  alertOps,
            mail:    function (email, nr, m) { return mailSenden(process.env, fetch, email, nr, m); }
        });
    } catch (e) {
        await alertOps('loeschung', 'lauf-fehler', e && e.message);
        return { status: 'fehler' };
    }
}

module.exports = { laufen: laufen, tageslauf: tageslauf, mailText: mailText,
                   _intern: { whopMitglieder: whopMitglieder, loescheNutzer: loescheNutzer, mailSenden: mailSenden } };
