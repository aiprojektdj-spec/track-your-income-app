// Domain-Umzug: neue Geraete auf der alten Adresse gehen sofort nach getstackr.de
// (js/domain-weiterleitung.js). Bestandskunden mit Firma oder Cloud-Sync bleiben.
const W = require('../js/domain-weiterleitung.js');
const ALT = 'track-your-income-app.vercel.app';

let fails = 0;
function check(name, ok) {
    console.log((ok ? 'OK   ' : 'FAIL ') + name);
    if (!ok) fails++;
}
function ls(werte) {
    return { getItem: (k) => (k in werte ? werte[k] : null) };
}

check('W1 alte Adresse, leerer Browser: umleiten', W.sollUmleiten(ALT, ls({})) === true);
check('W2 nur Whop-Token/Theme, keine Daten: umleiten',
      W.sollUmleiten(ALT, ls({ whop_access_token: 'x', oyi_theme: 'dark' })) === true);
check('W3 leeres Firmenverzeichnis: umleiten', W.sollUmleiten(ALT, ls({ oyi_companies: '[]' })) === true);
check('W4 Firma angelegt: bleiben',
      W.sollUmleiten(ALT, ls({ oyi_companies: '[{"id":"co_a"}]' })) === false);
check('W5 Cloud-Sync eingerichtet: bleiben', W.sollUmleiten(ALT, ls({ oyi_sync_enabled: '1' })) === false);
check('W6 Store-Spiegel vorhanden (Verzeichnis kaputt): bleiben',
      W.sollUmleiten(ALT, ls({ _oyi_lsmirror: '{"k":"v"}' })) === false);
check('W7 Firmenverzeichnis unlesbar: bleiben', W.sollUmleiten(ALT, ls({ oyi_companies: '{kaputt' })) === false);
check('W8 localStorage wirft: bleiben',
      W.sollUmleiten(ALT, { getItem() { throw new Error('gesperrt'); } }) === false);
check('W9 getstackr.de leitet nie um', W.sollUmleiten('getstackr.de', ls({})) === false);
check('W10 localhost/Preview leitet nie um', W.sollUmleiten('localhost', ls({})) === false);
check('W11 Ziel ist getstackr.de/app.html ohne Query (alter OAuth-Code gilt dort nicht)',
      W.ZIEL === 'https://getstackr.de/app.html');

console.log(fails ? `\n${fails} Fehler` : '\nAlle Checks gruen');
process.exit(fails ? 1 : 0);
