// Regressionstest: Schreibsperre des Nur-Lese-Modus im Store (Fund 1.7, zweite Haelfte).
//
// Die Oberflaechensperre erreichte das Rechnungsmodul nicht - dort stehen 18
// data-action-Attribute gegen 89 direkte addEventListener-Bindungen. Der Guard sitzt
// deshalb jetzt an der Wurzel, wo alle Nutzerpfade zusammenlaufen.
//
// Die WICHTIGSTE Pruefung hier ist die Gegenprobe: der Sync darf NICHT blockiert werden,
// sonst laesst sich die Mandantenfirma gar nicht mehr befuellen.
//
//   node test/test-stb-store-guard.js
'use strict';
const fs = require('fs');
const path = require('path');
const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
const syncSrc  = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');

let pass = 0, total = 0;
const check = (name, cond) => { total++; if (cond) { pass++; console.log('OK   ' + name); } else console.error('FAIL ' + name); };

// ── A) Die Entscheidungsfunktion, isoliert nachgebaut ────────────────────────
function istReadonly(aktiv, firmen) {
  if (!aktiv) return false;
  for (let i = 0; i < firmen.length; i++) {
    if (firmen[i] && firmen[i].id === aktiv) return !!firmen[i]._readonly;
  }
  return false;
}
const firmen = [{ id: 'co_eigen' }, { id: 'co_mandant', _readonly: true }];
check('A1 Mandantenfirma ist gesperrt', istReadonly('co_mandant', firmen) === true);
check('A2 eigene Firma ist frei', istReadonly('co_eigen', firmen) === false);
check('A3 ohne aktive Firma wird nicht gesperrt', istReadonly(null, firmen) === false);
check('A4 unbekannte ID sperrt nicht (sonst legt eine kaputte Registry die App lahm)',
      istReadonly('co_weg', firmen) === false);

// ── B) Verdrahtung an allen drei Nutzer-Schreibwegen ─────────────────────────
const guard = /if \(this\._isReadonlyCompany\(\)\) return this\._refuseReadonly/;
const guard2 = /if \(this\._isReadonlyCompany\(\)\)/;
function rumpf(name) {
  const i = storeSrc.indexOf(name);
  return i < 0 ? '' : storeSrc.slice(i, i + 1200);
}
check('B1 set() ist abgesichert',      guard.test(rumpf('    set(key, value) {')));
check('B2 setAsync() ist abgesichert', guard.test(rumpf('    async setAsync(key, value) {')));
check('B3 _rechSet() ist abgesichert', guard.test(rumpf('    _rechSet(key, value) {')));
check('B4 saveRechInvoice() weist frueh ab und liefert null',
      /_isReadonlyCompany\(\)\) \{ this\._refuseReadonly\([^)]*\); return null; \}/.test(rumpf('    saveRechInvoice(invoice) {')));

// ── C) GEGENPROBE: der Sync darf nicht mitgesperrt werden ────────────────────
// Er befuellt die Nur-Lese-Firma; ein Guard auf seinem Pfad wuerde genau das brechen.
check('C1 der Sync schreibt ueber syncApplyKeys, nicht ueber set()',
      /Store\.syncApplyKeys\(/.test(syncSrc));
check('C2 der Sync ruft die oeffentliche Schreib-API nirgends auf',
      !/Store\.(set|setAsync|saveRech|savePurchase|saveSale)\s*\(/.test(syncSrc));
check('C3 syncApplyKeys traegt KEINEN Readonly-Guard',
      !guard.test(rumpf('    syncApplyKeys')));

// ── D) Der Firmenwechsel muss moeglich bleiben ───────────────────────────────
// Sonst sitzt der Berater in der Mandantenansicht fest und kommt nicht zurueck.
check('D1 setCompany schreibt nicht ueber set() und ist damit nicht gesperrt',
      !guard.test(rumpf('    setCompany(id) {')) && !/this\.set\(/.test(rumpf('    setCompany(id) {'))); 

// ── E) Der Toast ist gedrosselt ──────────────────────────────────────────────
// Ein Speichervorgang schreibt oft mehrere Schluessel - ein Toast pro Schluessel waere
// eine Lawine und wuerde die eigentliche Meldung ueberdecken.
check('E1 _refuseReadonly drosselt die Meldung', /_roToastTs/.test(storeSrc) && /> 3000/.test(storeSrc));
check('E2 und liefert false, damit Aufrufer den Fehlschlag sehen koennen',
      /_refuseReadonly\(key\) \{[\s\S]{0,600}?return false;/.test(storeSrc));

// -- F) Das Protokoll schreibt am Guard vorbei und braucht einen eigenen --
// savePurchase() ruft _addAuditEntry VOR this.set(). Ohne eigenen Guard entstuende in der
// Mandantenansicht ein GoBD-Eintrag fuer eine Aenderung, die gar nicht stattfand.
const auditIdx  = storeSrc.indexOf('    _addAuditEntry(action, entityType, entityId,');
const auditBody = auditIdx < 0 ? '' : storeSrc.slice(auditIdx, auditIdx + 2600);
const batchBody = rumpf('    _addAuditEntriesBatch(items) {');
check('F1 _addAuditEntry schreibt direkt in Cache und IDB, nicht ueber set()',
      auditBody.includes('_cache[this._auditKey] = str;') && auditBody.includes('_idbPut(this._auditKey'));
check('F2 _addAuditEntry ist trotzdem abgesichert', guard2.test(auditBody));
check('F3 auch die Batch-Variante', guard2.test(batchBody));

console.log('');
console.log(pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
