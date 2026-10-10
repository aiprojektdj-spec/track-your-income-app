// CORS fuer die API-Endpunkte — Helfer, kein Endpunkt.
//
// Domain-Umzug (plan/domain-umzug-getstackr-2026-10-08.md, Phase 1): Die App laeuft auf
// getstackr.de UND weiter auf der alten Adresse. Bis 2026-10-10 stand in fuenf Endpunkten fest
// 'https://track-your-income-app.vercel.app'. Same-Origin-Aufrufe brauchen den Header gar nicht,
// deshalb fiel das auf getstackr.de nicht auf — aber jede kuenftige Cross-Origin-Nutzung (etwa
// der Umzugs-Assistent) waere dort still gescheitert.
//
// Feste Liste statt Spiegeln des Origin-Headers: eine fremde Origin bekommt nie ihre eigene
// Adresse zurueck (scripts/check-live-exposure.js prueft genau das). Unbekannte Origins,
// Previews eingeschlossen, bekommen wie bisher die alte Adresse.
var ERLAUBT = ['https://getstackr.de', 'https://track-your-income-app.vercel.app'];

module.exports = function setzeCorsOrigin(req, res) {
    var origin = String((req.headers && req.headers['origin']) || '');
    res.setHeader('Access-Control-Allow-Origin', ERLAUBT.indexOf(origin) !== -1 ? origin : ERLAUBT[1]);
    // Die Antwort haengt jetzt vom Origin ab — ohne Vary koennte ein Cache sie fuer die
    // andere Domain wiederverwenden.
    res.setHeader('Vary', 'Origin');
};
module.exports.ERLAUBT = ERLAUBT;
