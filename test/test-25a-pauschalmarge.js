// Regressionstest: §25a Abs. 3 Satz 3 UStG — Pauschalmarge von 30 % (2026-09-05)
//
// Gesetzeswortlaut, an der Primaerquelle geholt:
//   Satz 3: "Laesst sich der Einkaufspreis eines Kunstgegenstandes (Nummer 53 der Anlage 2) nicht
//            ermitteln oder ist der Einkaufspreis unbedeutend, wird der Betrag, nach dem sich der
//            Umsatz bemisst, mit 30 Prozent des Verkaufspreises angesetzt."
//   Satz 4: "Die Umsatzsteuer gehoert nicht zur Bemessungsgrundlage."
//
// Daraus folgen die beiden Kernpunkte, die hier abgesichert sind:
//  A) Die Pauschale ERSETZT vk-ek vollstaendig — ein vorhandener Einkaufspreis wird ignoriert.
//     Der Tatbestand setzt ja gerade voraus, dass es keinen brauchbaren gibt.
//  B) Die 30 % sind ein BRUTTObetrag: die USt wird herausgerechnet, nicht aufgeschlagen (Satz 4).
//     Der haeufigste denkbare Implementierungsfehler waere, 19 % auf die 30 % aufzuschlagen.
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'steuer-berechnung.js'), 'utf8');
const SteuerBerechnung = new Function(src + '\nreturn SteuerBerechnung;')();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}
const rund = n => Math.round(n * 100) / 100;

// ── A) Die Pauschale greift und ersetzt vk-ek ────────────────────────────────
const pauschal = { verkaufspreis: 1000, pauschalmarge: true, satz: 19 };
const e1 = SteuerBerechnung.margeEinzeldifferenz([pauschal]);
check('A1 30 % von 1000 = 300 Bemessungsgrundlage (brutto)',
      rund(e1.margeBrutto) === 300);

// Ein mitgeschleppter Einkaufspreis darf das Ergebnis NICHT veraendern.
const mitEk = { verkaufspreis: 1000, einkaufspreis: 900, pauschalmarge: true, satz: 19 };
check('A2 vorhandener Einkaufspreis wird ignoriert (nicht 100, sondern 300)',
      rund(SteuerBerechnung.margeEinzeldifferenz([mitEk]).margeBrutto) === 300);

// Gegenprobe: derselbe Fall OHNE Flag rechnet weiter vk-ek.
check('A3 ohne Flag unveraendert vk-ek = 100',
      rund(SteuerBerechnung.margeEinzeldifferenz([{ verkaufspreis: 1000, einkaufspreis: 900, satz: 19 }]).margeBrutto) === 100);

// ── B) Satz 4: USt wird HERAUSgerechnet ──────────────────────────────────────
// 300 brutto bei 19 % -> netto 300/1,19 = 252,10 / USt 47,90.
// Waere die USt aufgeschlagen, stuende hier 357,00 bzw. eine USt von 57,00.
check('B1 netto 252,10 (herausgerechnet, nicht aufgeschlagen)',
      rund(e1.margeNetto) === 252.10);
check('B2 USt 47,90',
      rund(e1.ust) === 47.90);
check('B3 USt liegt unter 30 % der Pauschale — Aufschlag waere 57,00',
      rund(e1.ust) < 57);

// ── C) Gesamtdifferenz rechnet dieselbe Pauschale ────────────────────────────
const g1 = SteuerBerechnung.margeGesamtdifferenz([pauschal], 0, 19);
check('C1 Gesamtdifferenz: Bemessungsgrundlage 300',
      rund(g1.bemessungsgrundlage) === 300);
check('C2 Gesamtdifferenz: USt 47,90',
      rund(g1.ust) === 47.90);
check('C3 Gesamtdifferenz mischt Pauschal- und Normalposition',
      rund(SteuerBerechnung.margeGesamtdifferenz(
          [pauschal, { verkaufspreis: 200, einkaufspreis: 150 }], 0, 19).bemessungsgrundlage) === 350);

// ── D) Korrektur und Floor wirken weiter ─────────────────────────────────────
// Volle Retoure auf eine Pauschalposition: die 300 muessen wieder verschwinden.
const retoure = [
    { ref: 'k1', verkaufspreis: 1000, pauschalmarge: true, satz: 19 },
    { ref: 'k1', margeKorrektur: -300, satz: 19 }
];
check('D1 volle Retoure loescht die Pauschalmarge',
      rund(SteuerBerechnung.margeEinzeldifferenz(retoure).margeBrutto) === 0);

// Ueberschiessende Retoure darf keine negative Marge erzeugen (Floor pro Position).
const ueber = [
    { ref: 'k1', verkaufspreis: 1000, pauschalmarge: true, satz: 19 },
    { ref: 'k1', margeKorrektur: -500, satz: 19 },
    { ref: 'k2', verkaufspreis: 500, einkaufspreis: 400, satz: 19 }
];
check('D2 Floor wirkt pro Position — k2 bleibt bei 100',
      rund(SteuerBerechnung.margeEinzeldifferenz(ueber).margeBrutto) === 100);

// ── E) Randfaelle ────────────────────────────────────────────────────────────
check('E1 Verkaufspreis 0 ergibt 0',
      rund(SteuerBerechnung.margeEinzeldifferenz([{ verkaufspreis: 0, pauschalmarge: true, satz: 19 }]).margeBrutto) === 0);
check('E2 negativer Verkaufspreis wird durch den Floor auf 0 gezogen',
      rund(SteuerBerechnung.margeEinzeldifferenz([{ verkaufspreis: -100, pauschalmarge: true, satz: 19 }]).margeBrutto) === 0);
check('E3 fehlender Verkaufspreis ergibt 0 statt NaN',
      rund(SteuerBerechnung.margeEinzeldifferenz([{ pauschalmarge: true, satz: 19 }]).margeBrutto) === 0);

// ── F) Arbeitsregel 7: Jahresfunktion, keine jahresfeste Konstante ───────────
check('F1 pauschalmargeSatz() existiert',
      typeof SteuerBerechnung.pauschalmargeSatz === 'function');
check('F2 liefert 0,30',
      SteuerBerechnung.pauschalmargeSatz(2026) === 0.30);
check('F3 auch ohne Jahresangabe belastbar',
      SteuerBerechnung.pauschalmargeSatz() === 0.30);
check('F4 der Wert steht NICHT als jahresfeste Konstante im Rechenweg',
      /pauschalmargeSatz\(/.test(src));

// ── G) Regressionsschutz: die gewoehnliche Marge bleibt unberuehrt ───────────
check('G1 Standardfall ohne jedes Flag unveraendert',
      rund(SteuerBerechnung.margeEinzeldifferenz([{ verkaufspreis: 150, einkaufspreis: 100, satz: 19 }]).margeBrutto) === 50);
check('G2 negative Marge weiter auf 0 gefloort',
      rund(SteuerBerechnung.margeEinzeldifferenz([{ verkaufspreis: 80, einkaufspreis: 100, satz: 19 }]).margeBrutto) === 0);
check('G3 Vortrag der Gesamtdifferenz unveraendert',
      rund(SteuerBerechnung.margeGesamtdifferenz([{ verkaufspreis: 80, einkaufspreis: 100 }], 0, 19).neuerVortrag) === -20);

// ── H) Verdrahtung: der Rechenkern nuetzt nichts, wenn ihn niemand fuettert ──
// Quelltextpruefung wie in test-25a-retoure-marge.js Abschnitt C: ein spaeterer Umbau soll das
// Flag nicht still fallen lassen. Der Rechenkern rechnet dann klaglos vk-ek weiter.
const uva   = fs.readFileSync(path.join(__dirname, '..', 'js', 'ustvoranmeldung.js'), 'utf8');
const euer  = fs.readFileSync(path.join(__dirname, '..', 'js', 'euer.js'), 'utf8');
const gbr   = fs.readFileSync(path.join(__dirname, '..', 'js', 'gbr-modul.js'), 'utf8');
const lager = fs.readFileSync(path.join(__dirname, '..', 'js', 'lager.js'), 'utf8');

// Jede Push-Stelle mit verkaufspreis muss pauschalmarge mitgeben.
const pushMitVk = uva.split('\n').filter(l => /diff25aPositionenRoh\.push\(\{[^}]*verkaufspreis/.test(l));
check('H1 UVA: alle Verkaufs-Push-Stellen geben pauschalmarge mit (' + pushMitVk.length + ' Stellen)',
      pushMitVk.length >= 3 && pushMitVk.every(l => /pauschalmarge/.test(l)));

// Beide §17-Korrekturwege muessen die PAUSCHALE zuruecknehmen, nicht vk-ek.
check('H2 UVA: Gutschrift nimmt die Pauschale zurueck, nicht vk-ek',
      /urspruenglich\s*=\s*istPauschal[\s\S]{0,120}pauschalmargeSatz/.test(uva));
check('H3 UVA: Retoure nimmt die Pauschale zurueck, nicht vk-ek',
      /_saleIstPauschal25a\(linked\)[\s\S]{0,120}pauschalmargeSatz/.test(uva));

// Nur Kunstgegenstaende (Anlage 2 Nr. 53) - Sammlerstuecke duerfen die Pauschale nie ausloesen.
check('H4 UVA prueft die Warenart mit',
      /pauschalmarge\s*&&\s*p\.warenart\s*===\s*'kunst'/.test(uva));
check('H5 EUER prueft die Warenart mit',
      /pauschalmarge\s*&&[\s\S]{0,40}warenart\s*===\s*'kunst'/.test(euer));
check('H6 GbR prueft die Warenart mit',
      /pauschalmarge\s*&&[\s\S]{0,40}warenart\s*===\s*'kunst'/.test(gbr));
check('H7 Lager speichert nur bei Warenart kunst',
      /pauschalmarge:[\s\S]{0,300}le_warenart[\s\S]{0,40}===\s*'kunst'/.test(lager));

// Pauschalpositionen duerfen nicht in die Gesamtdifferenz fallen (§25a Abs. 4: Einkaufspreis
// "uebersteigt 750 EUR nicht" laesst sich bei unermittelbarem Einkaufspreis nicht bejahen).
// Ohne diese Zeile rutschen sie still hinein, weil `undefined > 750` false ergibt.
check('H8 UVA haelt Pauschalpositionen aus der Gesamtdifferenz heraus',
      /_istUeber750\s*=\s*p\s*=>[^;]*p\.pauschalmarge\s*===\s*true/.test(uva));

console.log('\n' + pass + '/' + total + ' Checks bestanden');
process.exit(pass === total ? 0 : 1);
