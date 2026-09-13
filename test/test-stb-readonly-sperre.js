// Regressionstest: Schreibsperre des Steuerberater-Nur-Lese-Modus (Fund 1.7).
//
// Die Sperre hat drei Schichten (CSS-Suffixe, Namensregex am zentralen data-action-Router,
// und seit 2026-09-05 derselbe Check im eb-Router). Dieser Harness haelt fest, WAS sie
// abdeckt und was nicht - damit eine spaetere Aenderung nicht unbemerkt Reichweite verliert
// und die bekannten Luecken nicht in Vergessenheit geraten.
//
//   node test/test-stb-readonly-sperre.js
'use strict';
const fs = require('fs');
const path = require('path');
const P = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const stbSrc  = P('js/stb-share.js');
const actSrc  = P('js/actions.js');
const ebSrc   = P('eigenbelege/js/app.js');
const cssSrc  = P('css/style.css');
const rechSrc = P('rechnungen/js/rechnung.js');
const euerSrc = P('js/euer.js');

let pass = 0, total = 0;
const check = (name, cond) => { total++; if (cond) { pass++; console.log('OK   ' + name); } else console.error('FAIL ' + name); };

// Regex und Allowlist im Wortlaut aus der Quelle schneiden, nicht abtippen.
const WRITE_RE  = eval(stbSrc.match(/var WRITE_RE\s*=\s*(\/.*\/i);/)[1]);
const ALLOW_SET = eval('(' + stbSrc.match(/var ALLOW_SET\s*=\s*(\{[^}]*\});/)[1] + ')');
// Tolerant gelesen: verschwindet BLOCK_SET, soll C5 sauber fehlschlagen statt den ganzen
// Harness mit einem TypeError abzuraeumen - die uebrigen Pruefungen sollen weiterlaufen.
const _mBlock   = stbSrc.match(/var BLOCK_SET\s*=\s*(\{[^}]*\});/);
const BLOCK_SET = _mBlock ? eval('(' + _mBlock[1] + ')') : {};
const blockt = n => !ALLOW_SET[n] && (!!BLOCK_SET[n] || WRITE_RE.test(n));

// A) Die Entscheidungsfunktion selbst
check('A1 typische Schreibnamen werden gesperrt',
      ['afa-save','eb-delete','pb-storno','ksk-save-config','eb-alle-loeschen'].every(blockt));
check('A2 Ansicht und Navigation bleiben frei',
      ['navigate','goto','reload','print-page','stb-exit','close-modal'].every(n => !blockt(n)));
check('A3 stb-cancel-invite ist ausdruecklich erlaubt (WRITE_RE trifft auf "cancel")',
      WRITE_RE.test('stb-cancel-invite') && !blockt('stb-cancel-invite'));
check('A4 der Firmenwechsel bleibt moeglich - sonst sitzt der Berater fest',
      !blockt('co-switch'));

// B) Verdrahtung an den Routern
check('B1 zentraler Router fragt StbShare.blocks',
      /StbShare\.blocks\s*&&\s*StbShare\.blocks\(name\)/.test(actSrc));
check('B2 eb-Router fragt sie ebenfalls (bis 2026-09-05 lief er daran vorbei)',
      /StbShare\.blocks\(d\.action\)/.test(ebSrc));
check('B3 der eb-Check sitzt VOR dem switch, sonst laeuft der Handler trotzdem',
      ebSrc.indexOf('StbShare.blocks(d.action)') < ebSrc.indexOf("case 'eb-navigate'"));

// C) Bekannte, bewusst offene Luecken. Schlaegt einer dieser Tests fehl, ist die Luecke
// geschlossen worden - dann gehoert 01-AUFGABEN.md 1.7 nachgezogen und der Test hierher
// umgeschrieben. Ein gruener Test bedeutet hier also NICHT "alles gut".
check('C1 uva-mark ist gesperrt (war bis 2026-09-09 offen)', blockt('uva-mark'));
check('C2 app-ust-switch-regel ist gesperrt (war bis 2026-09-09 offen)',
      blockt('app-ust-switch-regel'));
// Gegenprobe zur Erweiterung: "switch" trifft auch den Firmenwechsel. Waere der gesperrt,
// kaeme der Berater aus der Mandantenansicht nicht mehr heraus.
check('C1b co-switch bleibt trotz "switch" in WRITE_RE erlaubt',
      WRITE_RE.test('co-switch') && !blockt('co-switch'));
// "pick" ist bewusst NICHT aufgenommen: die drei pick-Aktionen fassen nur das DOM an.
check('C1c app-pick-ust bleibt frei (reine DOM-Manipulation)', !blockt('app-pick-ust'));
check('C1d lg-pick-swatch bleibt frei (reine DOM-Manipulation)', !blockt('lg-pick-swatch'));
// Gefunden am 2026-09-13 beim Durchsehen aller 114 ungesperrten Namen: app-ust-dismiss
// schreibt (Store.set), traegt aber kein Verb aus WRITE_RE. Geloest ueber BLOCK_SET statt
// ueber ein neues Verb - C5b sagt, warum.
check('C5 app-ust-dismiss ist gesperrt (ueber BLOCK_SET, war bis 2026-09-13 offen)',
      blockt('app-ust-dismiss'));
check('C5b app-dismiss-backup-banner bleibt frei - genau deshalb kein Verb "dismiss"',
      !blockt('app-dismiss-backup-banner'));
check('C5c "dismiss" ist NICHT in WRITE_RE gelandet (sonst faellt C5b)',
      !WRITE_RE.test('app-dismiss-backup-banner'));

check('C3 invSave traegt weiterhin kein data-action - nur die ID-Regel und der Store greifen',
      /getElementById\('invSave'\)\.addEventListener/.test(rechSrc)
      && !/data-action[^>]*invSave|invSave[^>]*data-action/.test(rechSrc));
check('C4 kein rechnungen/js-Modul kennt StbShare - dort traegt allein der Store-Guard',
      !/StbShare/.test(rechSrc));

// D) Die CSS-Schicht ist Suffix-basiert und deshalb noch enger als der Regex
const suffixe = (cssSrc.match(/body\.stb-readonly \[data-action\$=/g) || []).length;
check('D1 CSS blendet ueber Suffixe aus (dokumentiert: 8 Stueck)', suffixe === 8);
check('D2 CSS greift nicht bei Namen, die nicht auf das Suffix enden',
      !/body\.stb-readonly \[data-action\$="-mark"\]/.test(cssSrc));
// Das Rechnungsmodul vergibt IDs statt data-action - dort haelt nur eine ID-Regel.
check('D3 der Speichern-Knopf der Rechnung wird ausgeblendet',
      /body\.stb-readonly #invSave/.test(cssSrc));
check('D4 auch die Einstiege "Neue Rechnung"/"Neues Angebot"',
      ['#dashNewInvoice','#dashNewOffer','#emptyNewInvoice','#emptyNewOffer']
        .every(id => cssSrc.includes('body.stb-readonly ' + id)));
check('D5 Vorschau und Abbrechen bleiben sichtbar (lesend bzw. Ausweg)',
      !/body\.stb-readonly #invPreview/.test(cssSrc) && !/body\.stb-readonly #invCancel/.test(cssSrc));

// E) Die Attribut-Luecke. Der Chokepoint prueft blocks() NUR fuer data-action und
// data-action-submit; an -input/-change/-blur haengen weitere Namen, die ein Namensfilter
// deshalb grundsaetzlich nicht erreicht. euer-hebesatz war der belegte Schreibfall darin
// (Store.saveSettings) und ist am Markup geloest, nicht ueber den Namen.
check('E1 der Chokepoint prueft weiterhin nur data-action und -submit (Luecke dokumentiert)',
      /attr === 'data-action' \|\| attr === 'data-action-submit'/.test(actSrc));
check('E2 euer-hebesatz haengt an data-action-input, wird vom Namensfilter also nie erreicht',
      /data-action-input="euer-hebesatz"/.test(euerSrc));
check('E3 das Hebesatz-Feld wird in der Nur-Lese-Ansicht auf readonly gesetzt',
      /StbShare\.isReadonly\(\)/.test(euerSrc) && /\breadonly\b/.test(euerSrc));
check('E4 das readonly-Attribut steht wirklich am Hebesatz-Feld',
      /data-action-input="euer-hebesatz"\$\{hebesatzRo\}/.test(euerSrc));
check('E5 nur lesen, nicht verstecken - der Berater soll den Hebesatz weiter sehen',
      !/body\.stb-readonly #gewstHebesatz/.test(cssSrc));

console.log('');
console.log(pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
