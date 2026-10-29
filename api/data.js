// Vercel Serverless Function — Stackr Daten (serverführende Datenhaltung, Schritt R3)
// =============================================================================
// plan/server-umbau-2026-10-22.md, Abschnitte 1–3. Lesbare Daten in Supabase, nur über die
// Datenfunktionen aus supabase/migrations/20261022000002_server_datenmodell.sql und
// 20261028000001_server_umzug.sql (RLS-Weg E-A: jede Funktion setzt stackr.user = Whop-ID).
// Der Browser spricht nie direkt mit Supabase.
//
// POST mit Whop-Bearer-Token (Pro, s. api/_auth.js), Body { action, company, … }:
//   pull           ohne company: { firmen } (firmen_lesen)
//                  mit company:  aenderungen_seit ab seq (Default 0 = Vollabzug), blätternd
//   changes        { company, seq }  → { seq, bis, mehr, rows }
//   push           { company, ops }  ops: { t:'r', art, id, data, version, geloescht }
//                                      | { t:'s', key, data, version }
//                  → { results: [{ status: ok|konflikt|doppelt|gesperrt|fehlt, … }] },
//                    HTTP 409, sobald ein Ergebnis 'konflikt' ist (Body trotzdem vollständig)
//   firma_anlegen  { company, name, rechtsform, land } → { status: angelegt|vorhanden }
//   migrate        { company, ops }  wie push, aber immer Neuanlage (Version null); ein schon
//                  vorhandener Datensatz mit gleichem Inhalt gilt als 'vorhanden' (Wiederholung)
//   migrate_commit { company, audit?: [Originaltexte], abschluss?, pruefsumme, anker? }
//                  audit → audit_uebernehmen (Stücke, wiederholbar). abschluss → Browser-Kette
//                  aus der DB prüfen, Prüfsumme Server = Browser vergleichen, dann
//                  umzug_abschliessen (Audit-Eintrag „Datenübernahme …“)
//   pruefsumme     { company } → { pruefsumme, records, settings } (Abgleich, täglich)
//   status         { company } → { firma, rolle, umgezogen_am }
//
// Grenzen: Vercel nimmt höchstens 4,5 MB Body — der Browser schickt in Stücken (MAX_OPS,
// MAX_AUDIT); was darüber liegt, lehnt Vercel selbst mit 413 ab. Spalten für Regeln (datum,
// quelle, gesperrt_grund) bestimmt dieser Endpunkt über js/server-abbild.js, nicht der Browser;
// Nummernkreis (p_kreis) und nummer bleiben bis R7 leer.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (api/_db.js), Whop/Owner wie api/sync.js.
// =============================================================================
var crypto  = require('crypto');
var _log    = require('./_log.js');
var db      = require('./_db.js');
var auth    = require('./_auth.js');
var store   = require('./_sync-store.js');
var alertOps = require('./_alert.js').alertOps;
var setzeCorsOrigin = require('./_cors.js');
var Abbild  = require('../js/server-abbild.js');

var COMPANY_RE  = /^co_[a-z0-9]{1,40}$/;   // wie companies.id in der Migration
var MAX_OPS     = 200;                     // je push/migrate
var MAX_AUDIT   = 2000;                    // Einträge je migrate_commit
var PARALLEL    = 4;                       // gleichzeitige RPCs je Request (DB serialisiert je Firma)
var RATE_MAX    = 120;                     // je Nutzer und Minute — der Umzug schickt viele Stücke
var IP_RATE_MAX = 120;                     // je IP und Minute, vor Whop

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

// PostgREST: 42501 (kein Recht) → 403; alles andere ist für den Browser ein Serverfehler.
function rpcFehler(res, e, wo) {
    var m = /HTTP (\d{3})/.exec((e && e.message) || '');
    if (m && m[1] === '403') return res.status(403).json({ error: 'kein_zugriff' });
    _log.logError('data', wo, e);
    return res.status(502).json({ error: 'db_fehler' });
}

// Kleine Warteschlange: höchstens n Aufrufe gleichzeitig, Ergebnisse in Eingangsreihenfolge.
async function jeweils(liste, n, fn) {
    var out = new Array(liste.length), i = 0;
    async function arbeiter() { while (i < liste.length) { var k = i++; out[k] = await fn(liste[k], k); } }
    var a = []; for (var j = 0; j < Math.min(n, liste.length); j++) a.push(arbeiter());
    await Promise.all(a);
    return out;
}

function pruefeOp(op) {
    if (!op || typeof op !== 'object') return 'op';
    if (op.t === 'r') {
        if (!Abbild.ART_RE.test(String(op.art || ''))) return 'art';
        if (typeof op.id !== 'string' || !op.id || op.id.length > 100) return 'id';
        if (!op.geloescht && (!op.data || typeof op.data !== 'object')) return 'data';
    } else if (op.t === 's') {
        if (!Abbild.KEY_RE.test(String(op.key || ''))) return 'key';
        if (op.data === null || op.data === undefined) return 'data';
    } else return 't';
    if (op.version != null && !(Number.isInteger(op.version) && op.version > 0)) return 'version';
    return null;
}

async function schreibeOp(userId, company, op, umzug) {
    if (op.t === 's') {
        var rs = await db.rpc('einstellung_schreiben', {
            p_user: userId, p_company: company, p_key: op.key, p_data: op.data,
            p_version: umzug ? null : (op.version || null)
        });
        if (umzug && rs.status === 'konflikt' && Abbild.kanonisch(rs.data) === Abbild.kanonisch(op.data))
            rs = { status: 'vorhanden', version: rs.version };
        return Object.assign({ t: 's', key: op.key }, rs);
    }
    var data = op.data, version = umzug ? null : (op.version || null);
    // Löschen ohne Inhalt: data bleibt der Server-Stand (das Protokoll hält alt/neu fest)
    if (op.geloescht && !data) {
        var alt = await db.rpc('datensatz_lesen', { p_user: userId, p_company: company, p_art: op.art, p_id: op.id });
        if (!alt) return { t: 'r', art: op.art, id: op.id, status: 'fehlt' };
        data = alt.data;
        if (!version) version = alt.version;
    }
    var sp = Abbild.spalten(data);
    var r = await db.rpc('datensatz_schreiben', {
        p_user: userId, p_company: company, p_art: op.art, p_id: op.id, p_data: data,
        p_version: version, p_datum: sp.datum, p_nummer: null, p_quelle: sp.quelle,
        p_gesperrt_grund: sp.gesperrt_grund, p_geloescht: !!op.geloescht, p_kreis: null
    });
    if (umzug && r.status === 'konflikt' && Abbild.kanonisch(r.data) === Abbild.kanonisch(data))
        r = { status: 'vorhanden', version: r.version };
    return Object.assign({ t: 'r', art: op.art, id: op.id }, r);
}

// Alle Zeilen der Firma vom Server (blätternd) → Prüfsumme wie im Browser.
async function serverPruefsumme(userId, company) {
    var records = [], settings = [], seq = 0, runde = 0;
    for (;;) {
        var s = await db.rpc('aenderungen_seit', { p_user: userId, p_company: company, p_seq: seq, p_limit: 1000 });
        (s.rows || []).forEach(function (z) {
            if (z.t === 'r') records.push({ art: z.art, id: z.id, data: z.data, geloescht: z.geloescht });
            else settings.push({ key: z.key, data: z.data });
        });
        if (!s.mehr || ++runde > 10000) break;
        seq = s.bis;
    }
    return {
        pruefsumme: sha256(Abbild.pruefzeilen(records, settings)),
        records: records.filter(function (r) { return !r.geloescht; }).length,
        settings: settings.length
    };
}

function umzugText(n, kette, summe, anker) {
    var t = 'Datenübernahme aus Browser: ' + n.records + ' Datensätze, ' + n.settings + ' Einstellungen, ' +
            kette.total + ' Protokolleinträge; Kette ' +
            (kette.broken ? 'mit ' + kette.broken + ' Brüchen (Eintrag ' + kette.positionen.map(function (p) { return p + 1; }).join(', ') +
                            (kette.broken > kette.positionen.length ? ', …' : '') + ')' : 'intakt') +
            (kette.clockBack ? ', ' + kette.clockBack + ' Uhr-Rücksprünge' : '') +
            '; SHA-256 des Bundles ' + summe + ' (Browser = Server)';
    // Anker-Abgleich meldet der Browser (CloudSync.verifyAuditAnchors) — Herkunft steht dabei.
    if (anker && typeof anker === 'object') {
        if (!anker.enabled) t += '; Anker-Abgleich: kein Cloud-Sync-Anker';
        else if (anker.error) t += '; Anker-Abgleich: nicht abrufbar';
        else t += '; Anker-Abgleich (Browser): ' + (+anker.ok || 0) + ' von ' + (+anker.total || 0) + ' bestätigt' +
                  (anker.vollstaendig ? ', vollständig' : ', unvollständig');
    }
    return t;
}

module.exports = async function handler(req, res) {
    setzeCorsOrigin(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'method_not_allowed' });

    if (!db.isConfigured()) {
        await alertOps('data', 'supabase-env-missing', 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
        return res.status(503).json({ error: 'data_not_configured' });
    }

    var rateOk = !store.configProblem();
    if (rateOk) {
        try {
            var ip = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
            if (await store.rateHit('data:iprl:' + ip, 60) > IP_RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) { await alertOps('data', 'ip-rate-limit-open', e && e.message); }
    }

    var a = await auth.pruefe(req);
    if (!a.ok) return res.status(a.status).json({ error: a.error });
    if (!a.pro) return res.status(403).json({ error: 'pro_required' });
    var userId = a.userId;

    if (rateOk) {
        try {
            if (await store.rateHit('data:rl:' + userId, 60) > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) { await alertOps('data', 'rate-limit-open', e && e.message); }
    }

    var body = req.body || {};
    var action = body.action;
    var company = String(body.company || '');
    if (!(action === 'pull' && !body.company) && !COMPANY_RE.test(company))
        return res.status(400).json({ error: 'bad_company' });

    try {
        if (action === 'pull' || action === 'changes') {
            if (action === 'pull' && !body.company) {
                return res.status(200).json({ firmen: await db.rpc('firmen_lesen', { p_user: userId }) });
            }
            var seq = body.seq == null ? (action === 'pull' ? 0 : NaN) : Number(body.seq);
            if (!Number.isInteger(seq) || seq < 0) return res.status(400).json({ error: 'bad_seq' });
            var lim = Math.min(Math.max(parseInt(body.limit, 10) || 500, 1), 1000);
            return res.status(200).json(await db.rpc('aenderungen_seit', { p_user: userId, p_company: company, p_seq: seq, p_limit: lim }));
        }

        if (action === 'push' || action === 'migrate') {
            var ops = body.ops;
            if (!Array.isArray(ops) || !ops.length) return res.status(400).json({ error: 'no_ops' });
            if (ops.length > MAX_OPS) return res.status(413).json({ error: 'too_many_ops', max: MAX_OPS });
            for (var i = 0; i < ops.length; i++) {
                var f = pruefeOp(ops[i]);
                if (f) return res.status(400).json({ error: 'bad_op', index: i, feld: f });
            }
            var umzug = action === 'migrate';
            var results = await jeweils(ops, PARALLEL, function (op) { return schreibeOp(userId, company, op, umzug); });
            var konflikt = results.some(function (r) { return r.status === 'konflikt'; });
            return res.status(konflikt ? 409 : 200).json({ results: results });
        }

        if (action === 'firma_anlegen') {
            return res.status(200).json(await db.rpc('firma_anlegen', {
                p_user: userId, p_company: company, p_name: String(body.name || '').slice(0, 200),
                p_rechtsform: body.rechtsform ? String(body.rechtsform).slice(0, 60) : null,
                p_land: String(body.land || 'DE').slice(0, 2).toUpperCase()
            }));
        }

        if (action === 'status') {
            var firmen = await db.rpc('firmen_lesen', { p_user: userId }) || [];
            var fa = firmen.filter(function (x) { return x.id === company; })[0];
            if (!fa) return res.status(200).json({ firma: false });
            var st = fa.rolle === 'owner'
                ? await db.rpc('umzug_stand', { p_user: userId, p_company: company, p_mit_audit: false }) : {};
            return res.status(200).json({ firma: true, rolle: fa.rolle, seq: fa.seq, umgezogen_am: (st && st.umgezogen_am) || null });
        }

        if (action === 'pruefsumme') {
            return res.status(200).json(await serverPruefsumme(userId, company));
        }

        if (action === 'migrate_commit') {
            var out = {};
            if (body.audit != null) {
                var texte = body.audit;
                if (!Array.isArray(texte) || texte.length > MAX_AUDIT) return res.status(400).json({ error: 'bad_audit' });
                for (var k = 0; k < texte.length; k++) {
                    var e = null;
                    if (typeof texte[k] === 'string') { try { e = JSON.parse(texte[k]); } catch (pe) {} }
                    if (!e || typeof e !== 'object' || Array.isArray(e) || e.id == null || String(e.id) === '')
                        return res.status(400).json({ error: 'bad_audit', index: k });
                }
                // Originaltext wortgleich als text[] — nicht über jsonb, dessen Schlüsselreihenfolge
                // die Browser-Prüfsumme bräche (s. Kopf der Migration).
                out.uebernommen = await db.rpc('audit_uebernehmen', { p_user: userId, p_company: company, p_eintraege: texte });
            }
            if (body.abschluss) {
                if (!/^[0-9a-f]{64}$/.test(String(body.pruefsumme || ''))) return res.status(400).json({ error: 'bad_pruefsumme' });
                var stand = await db.rpc('umzug_stand', { p_user: userId, p_company: company, p_mit_audit: true });
                if (stand && stand.umgezogen_am) return res.status(200).json(Object.assign(out, { status: 'vorhanden', umgezogen_am: stand.umgezogen_am }));
                var kette = Abbild.kettePruefen((stand && stand.audit) || []);
                var srv = await serverPruefsumme(userId, company);
                if (srv.pruefsumme !== body.pruefsumme) {
                    return res.status(409).json(Object.assign(out, { status: 'abweichung', server: srv, kette: kette }));
                }
                var text = umzugText(srv, kette, srv.pruefsumme, body.anker);
                var ab = await db.rpc('umzug_abschliessen', { p_user: userId, p_company: company, p_details: text });
                Object.assign(out, { status: ab && ab.status, server: srv, kette: kette, protokoll: text });
            }
            return res.status(200).json(out);
        }
    } catch (e) {
        return rpcFehler(res, e, 'RPC_' + String(action || '').toUpperCase());
    }
    return res.status(400).json({ error: 'bad_action' });
};

module.exports._test = { schreibeOp: schreibeOp, serverPruefsumme: serverPruefsumme, umzugText: umzugText, MAX_OPS: MAX_OPS, MAX_AUDIT: MAX_AUDIT };
