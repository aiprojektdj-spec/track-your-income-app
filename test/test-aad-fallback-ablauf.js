// AAD-Migrations-Fallback mit Ablaufdatum:  node test/test-aad-fallback-ablauf.js
//
// Fund R7 (Red-Team-Audit 2026-08-10): _decryptCt in js/cloud-sync.js fängt einen
// fehlgeschlagenen decrypt MIT AAD ab und versucht es OHNE additionalData, damit Chiffrat aus
// der Zeit vor der AAD-Einführung (2026-08-09) weiter lesbar bleibt. Für solches Alt-Chiffrat
// entfällt damit die Bindung an (ownerId, scope) — und weil derselbe Schlüssel für ALLE Scopes
// eines Nutzers gilt, könnte jemand mit Redis-Schreibzugriff (Betreiber oder kompromittierter
// Upstash-Zugang) den Alt-Blob von Firma A in den Slot von Firma B schieben. Der Client nähme
// ihn still an.
//
// Der Fix ist ein hartes Ablaufdatum. Dieser Test prüft, dass es existiert, plausibel liegt und
// tatsächlich WIRKT (der Fallback hinter der Datumsprüfung steht, nicht davor) — ein Ablaufdatum,
// das nur im Kommentar steht, ist keins.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');
let pass = 0;

// 1) Konstante existiert und ist ein gültiges Datum
const m = src.match(/var AAD_FALLBACK_UNTIL = Date\.parse\('([^']+)'\)/);
assert.ok(m, 'AAD_FALLBACK_UNTIL fehlt in js/cloud-sync.js');
const until = Date.parse(m[1]);
assert.ok(!isNaN(until), 'Ablaufdatum ist parsebar: ' + m[1]);
pass++; console.log('✓ Ablaufdatum vorhanden und parsebar (' + m[1] + ')');

// 2) Es liegt NACH der AAD-Einführung (2026-08-09) — sonst wäre der Fallback nie wirksam
//    gewesen — und nicht in ferner Zukunft, sonst ist es kein Ablaufdatum, sondern Dekoration.
const aadIntro = Date.parse('2026-08-09T00:00:00Z');
assert.ok(until > aadIntro, 'Ablauf liegt nach der AAD-Einführung');
const monate = (until - aadIntro) / (1000 * 60 * 60 * 24 * 30.44);
assert.ok(monate >= 1, 'mindestens ein Monat Übergang (Geräte, die lange nicht syncen)');
assert.ok(monate <= 12, 'höchstens ein Jahr — danach ist ein Blob ohne AAD ein Verdachtsfall');
pass++; console.log('✓ Übergangsfenster plausibel (' + monate.toFixed(1) + ' Monate)');

// 3) Die Datumsprüfung steht IM catch-Block VOR dem Fallback-decrypt. Stünde sie danach oder
//    fehlte sie, wäre der Fallback weiterhin unbegrenzt offen.
const catchBlock = src.match(/\} catch \(e\) \{[\s\S]*?additionalData: undefined|\} catch \(e\) \{[\s\S]*?crypto\.subtle\.decrypt\(\{ name: 'AES-GCM', iv: iv \}, key, ct\)/);
assert.ok(catchBlock, 'Fallback-decrypt im catch-Block nicht gefunden');
const guardPos = catchBlock[0].indexOf('AAD_FALLBACK_UNTIL');
const decryptPos = catchBlock[0].indexOf("crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct)");
assert.ok(guardPos !== -1, 'Datumsprüfung fehlt im catch-Block');
assert.ok(guardPos < decryptPos, 'Datumsprüfung muss VOR dem Fallback-decrypt stehen');
assert.ok(/if \(Date\.now\(\) > AAD_FALLBACK_UNTIL\) throw e;/.test(catchBlock[0]),
    'nach Ablauf wird der ursprüngliche Fehler weitergeworfen, nicht stillschweigend gefallbackt');
pass++; console.log('✓ Datumsprüfung wirkt (steht vor dem Fallback-decrypt)');

// 4) Der reguläre Pfad (decrypt MIT AAD) ist von der Prüfung unberührt — sonst wäre nach dem
//    Ablaufdatum der normale Sync kaputt, nicht nur der Migrationsweg.
// (Argument enthält selbst Klammern: _aad(ownerId || _userId(), scope) — daher .*? statt [^)]*)
const withAad = src.match(/pt = await crypto\.subtle\.decrypt\(\{ name: 'AES-GCM', iv: iv, additionalData: _aad\(.*?\) \}, key, ct\);/);
assert.ok(withAad, 'regulärer decrypt mit AAD unverändert vorhanden');
assert.ok(src.indexOf(withAad[0]) < src.indexOf('AAD_FALLBACK_UNTIL) throw e;'),
    'der reguläre Versuch läuft vor der Fallback-Prüfung');
pass++; console.log('✓ regulärer AAD-Pfad bleibt unberührt');

// 5) Der Entfernungs-Auftrag steht im Code, nicht nur in einem Audit-Dokument — sonst bleibt
//    der Block liegen, wenn niemand mehr weiß, warum er da ist (genau das war R7).
assert.ok(/NACH diesem Datum: diesen Block und den Fallback in _decryptCt ersatzlos entfernen/.test(src),
    'Aufräum-Hinweis am Ablaufdatum');
pass++; console.log('✓ Aufräum-Auftrag steht im Code');

console.log('\n' + pass + '/5 Tests bestanden ✅');
