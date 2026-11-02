// Stackr — Feature-Flags aus dem Admin-Panel auswerten (Helfer, kein Endpunkt)
// =============================================================================
//   var flags = require('./_flags.js');
//   if (await flags.isEnabled('neues.feature', { id: userId, plan: planId, accountId: companyId })) { ... }
//
// Gepflegt werden Flags im Admin-Panel (admin/, Tabelle admin_flags). Vorrang der Auswertung:
//   1. killed (Notaus)            -> aus
//   2. status 'off' / 'on'        -> aus / an fuer alle
//   3. status 'rules':  Nutzer-ID, Konto-ID oder Plan in den Listen  -> an
//                       sonst Prozent-Rollout: stabiler Hash aus key + Nutzer-ID, Eimer 0..99
//                       (wer einmal drin ist, bleibt bei gleichem Prozentwert immer drin)
//   Unbekanntes Flag, fehlender Nutzer, Ladefehler -> aus.
//
// Zwischenspeicher im Speicher der Instanz: 30 s. Faellt das Laden aus, gilt der letzte Stand bis
// zu 5 min weiter (Panel-Stoerung soll keine Funktionen springen lassen), danach "aus".
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var crypto = require('crypto');
var db     = require('./_db.js');
var _log   = require('./_log.js');

var TTL_MS   = 30000;
var STALE_MS = 300000;
var cache    = { at: 0, flags: null };

function bucket(key, userId) {
    var h = crypto.createHash('sha256').update(key + ':' + userId, 'utf8').digest();
    return h.readUInt32BE(0) % 100;
}

// Reine Auswertung eines Flag-Datensatzes (fuer Tests und isEnabled)
function auswerten(flag, user) {
    if (!flag || flag.killed === true) return false;
    if (flag.status === 'on') return true;
    if (flag.status !== 'rules') return false;
    if (!user || !user.id) return false;
    if ((flag.user_ids || []).indexOf(user.id) !== -1) return true;
    if (user.accountId && (flag.account_ids || []).indexOf(user.accountId) !== -1) return true;
    if (user.plan && (flag.plan_ids || []).indexOf(user.plan) !== -1) return true;
    return (flag.percent || 0) > 0 && bucket(flag.key, user.id) < flag.percent;
}

async function laden(jetzt) {
    if (cache.flags && jetzt - cache.at < TTL_MS) return cache.flags;
    try {
        if (!db.isConfigured()) throw new Error('db nicht konfiguriert');
        var list = (await db.rpc('sync_admin_flags_list', {}, 3000)) || [];
        var map = {};
        list.forEach(function (f) { map[f.key] = f; });
        cache = { at: jetzt, flags: map };
        return map;
    } catch (e) {
        _log.logError('flags', 'FLAGS_LOAD_FAILED', e);
        return cache.flags && jetzt - cache.at < STALE_MS ? cache.flags : {};
    }
}

async function isEnabled(key, user) {
    var flags = await laden(Date.now());
    return auswerten(flags[key], user);
}

function _reset() { cache = { at: 0, flags: null }; }

module.exports = { isEnabled: isEnabled, auswerten: auswerten, bucket: bucket, _reset: _reset };
