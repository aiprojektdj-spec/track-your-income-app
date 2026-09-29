// Stackr — Browser-Fehler: Bereinigen, Zählen, Tageszusammenfassung
// (plan/betrieb-luecken-2026-09-29.md §4)
// =============================================================================
// Genutzt von api/client-error.js (Annahme) und api/blob-cleanup.js (Zusammenfassung
// im täglichen Cron). Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route
// ausliefert.
//
// DATENSPARSAMKEIT — das ist der Kern dieser Datei:
//   Gespeichert wird nur, was zum Wiederfinden eines Fehlers im Code nötig ist:
//   Fehlerart, Meldung, Quelldatei (nur Pfad), Zeile/Spalte, App-Version, Zeitpunkt.
//   Kein Stack, keine User-Agent-Kennung, keine Seiten-URL, keine IP (die IP dient nur
//   dem Rate-Limit und verfällt nach 60 s), keine Nutzer-ID.
//   Die Meldung selbst kann Daten enthalten ("… 'Müller GmbH' is not a function") —
//   deshalb werden E-Mail-Adressen und Ziffernfolgen ab 4 Stellen (Beträge, IBAN,
//   Rechnungsnummern) vor dem Speichern ersetzt. Das fasst nebenbei gleichartige
//   Fehler zu einem Typ zusammen.
//
// SPEICHER: Redis statt Blob. Ein Zähler pro Tag und Fehlertyp; alle Schlüssel
// verfallen per TTL nach 30 Tagen von selbst, ohne Aufräumlauf.
//   clerr:d:<JJJJ-MM-TT>    Hash  <typ-hash> → Anzahl
//   clerr:new:<JJJJ-MM-TT>  Set   Typen, die an diesem Tag zum ersten Mal auftraten
//   clerr:m:<typ-hash>      JSON  bereinigter Eintrag (erstes Auftreten)
//   clerr:iprl:<ip>         Rate-Limit, 60 s
//   clerr:total:<JJJJ-MM-TT> Tagesdeckel über alle Absender
// =============================================================================

var crypto = require('crypto');

var TTL_S         = 30 * 24 * 60 * 60;
var MSG_MAX       = 300;
var SRC_MAX       = 100;
var TYPES         = { js: 1, promise: 1, manual: 1 };

function redisConf() {
    return {
        url:   process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '',
        token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
    };
}

function redisCmd(cmd) {
    var c = redisConf();
    return fetch(c.url, {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + c.token, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cmd),
        signal:  AbortSignal.timeout(3000)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
          if (j && j.error) throw new Error('Redis: ' + j.error);
          return j ? j.result : null;
      });
}

// UTC-Tag, wie in api/_alert.js: eine Serverless-Instanz hat keine sinnvolle Ortszeit.
function tag(ms) { return new Date(ms).toISOString().slice(0, 10); }

function _text(s, max) {
    return String(s == null ? '' : s)
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '<email>')
        .replace(/\d[\d.,' ]{2,}\d/g, '#')
        .trim()
        .slice(0, max);
}

// Nur der Pfad der Quelldatei: kein Host, keine Query (?v=…, Tokens), kein Fragment.
function _source(s) {
    s = String(s == null ? '' : s);
    if (!s) return '';
    try { s = new URL(s, 'https://x.invalid').pathname; } catch (e) { s = ''; }
    return s.replace(/[^A-Za-z0-9/_.\-]/g, '').slice(0, SRC_MAX);
}

function _int(n) {
    n = parseInt(n, 10);
    return (n >= 0 && n < 1e7) ? n : 0;
}

// Feld-Whitelist. Alles, was hier nicht steht, fällt weg.
function sanitize(raw, now) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    var v = String(raw.v == null ? '' : raw.v);
    return {
        type:    TYPES[raw.type] ? raw.type : 'js',
        message: _text(raw.message, MSG_MAX),
        source:  _source(raw.source),
        line:    _int(raw.line),
        col:     _int(raw.col),
        v:       /^[A-Za-z0-9._-]{1,20}$/.test(v) ? v : '',
        ts:      new Date(now).toISOString()
    };
}

// Fehlertyp = Art + Meldung + Datei + Zeile. Spalte und Version bewusst nicht:
// derselbe Fehler nach einem Deploy bleibt derselbe Typ.
function typHash(e) {
    return crypto.createHash('sha256')
        .update(e.type + '|' + e.message + '|' + e.source + '|' + e.line)
        .digest('hex').slice(0, 16);
}

// Zählt einen bereinigten Eintrag. Wirft bei Redis-Fehlern (Aufrufer entscheidet).
async function store(e, now) {
    var d = tag(now), h = typHash(e);
    var dKey = 'clerr:d:' + d, nKey = 'clerr:new:' + d;
    await redisCmd(['HINCRBY', dKey, h, '1']);
    await redisCmd(['EXPIRE', dKey, String(TTL_S), 'NX']);
    var neu = await redisCmd(['SET', 'clerr:m:' + h, JSON.stringify(e), 'NX', 'EX', String(TTL_S)]);
    if (neu === 'OK') {
        await redisCmd(['SADD', nKey, h]);
        await redisCmd(['EXPIRE', nKey, String(TTL_S), 'NX']);
    }
    return h;
}

// Text für die tägliche Meldung über den Alarmweg. null = nichts zu melden.
// Gemeldet wird nur, wenn gestern ein NEUER Fehlertyp auftrat — ein bekannter
// Fehler, der jeden Tag wieder kommt, soll nicht jeden Morgen eine Mail auslösen.
async function summary(now) {
    var c = redisConf();
    if (!c.url || !c.token) return null;
    var d = tag(now - 24 * 60 * 60 * 1000);

    var flat = await redisCmd(['HGETALL', 'clerr:d:' + d]) || [];
    var counts = {};
    for (var i = 0; i + 1 < flat.length; i += 2) counts[flat[i]] = parseInt(flat[i + 1], 10) || 0;
    var typen = Object.keys(counts);
    if (!typen.length) return null;

    var neu = await redisCmd(['SMEMBERS', 'clerr:new:' + d]) || [];
    if (!neu.length) return null;

    var summe = typen.reduce(function (s, h) { return s + counts[h]; }, 0);
    var top = neu.slice().sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0); }).slice(0, 3);
    var zeilen = [];
    for (var j = 0; j < top.length; j++) {
        var m = null;
        try { m = JSON.parse(await redisCmd(['GET', 'clerr:m:' + top[j]]) || 'null'); } catch (x) {}
        if (m) zeilen.push((counts[top[j]] || 0) + 'x ' + m.message.slice(0, 80) +
                           ' (' + (m.source || '?') + ':' + m.line + ')');
    }
    return d + ': ' + neu.length + ' neue Fehlertypen, ' + typen.length + ' Typen gesamt, ' +
           summe + ' Vorkommen. ' + zeilen.join(' | ');
}

module.exports = {
    sanitize: sanitize, typHash: typHash, store: store, summary: summary,
    redisCmd: redisCmd, redisConf: redisConf, tag: tag
};
