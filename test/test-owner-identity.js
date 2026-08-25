// Owner-Bypass über den Anzeigenamen:  node test/test-owner-identity.js
//
// Fund R3 (Red-Team-Audit 2026-08-10, verschärft beim Fixen): Alle drei Endpunkte leiteten die
// Owner-Entscheidung aus `username = me.preferred_username || me.name || …` ab. `me.name` ist der
// Whop-ANZEIGENAME — frei wählbar und NICHT eindeutig. Ein Angreifer ohne Whop-Benutzernamen, der
// seinen Anzeigenamen auf den Owner-Namen setzt, bekam damit den Owner-Bypass: voller Pro-Zugang
// ohne Abo, inklusive Cloud-Sync-Push und Blob-Upload.
//
// Geprüft wird die Entscheidungslogik aus api/sync.js, api/blob-upload.js und api/whop-access.js.
// Die Funktionen werden aus den Dateien geschnitten (Serverless-Funktionen ohne gemeinsames Modul,
// die Logik liegt dreifach vor und MUSS deckungsgleich bleiben).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const OWNER_NAME = 'secondlifevintage41';        // frueherer Default, seit c413228 entfernt —
                                                 // hier nur noch als Beispiel fuer eine
                                                 // ausdruecklich gesetzte Namensliste
const OWNER_ID   = 'user_ownerRealId';

function loadDecider(file, fnName, envIds) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'api', file), 'utf8');
    const re = new RegExp('function ' + fnName + '\\([\\s\\S]*?\\n\\}', 'm');
    const m = src.match(re);
    assert.ok(m, fnName + ' in api/' + file + ' nicht gefunden');
    // OWNER_IDS/OWNERS im Scope nachbilden, wie die Datei sie aus den Env-Vars aufbaut
    return new Function('OWNER_IDS', 'OWNERS', m[0] + '; return ' + fnName + ';')(envIds, [OWNER_NAME]);
}

let pass = 0;

// ── 1. Übergangsmodus (keine *_OWNER_IDS gesetzt): Namensliste, aber nur preferred_username ──
for (const [file, fn] of [['sync.js', 'isOwnerIdentity'], ['blob-upload.js', 'isOwnerIdentity']]) {
    const isOwner = loadDecider(file, fn, []);
    assert.strictEqual(isOwner(OWNER_ID, OWNER_NAME), true, file + ': echter Owner erkannt');
    assert.strictEqual(isOwner('user_attacker', OWNER_NAME), true, file + ': Name entscheidet im Altmodus');
    assert.strictEqual(isOwner('user_attacker', ''), false, file + ': ohne Username kein Owner');
    assert.strictEqual(isOwner('user_attacker', 'irgendwer'), false, file + ': fremder Username kein Owner');
    assert.strictEqual(isOwner('', ''), false, file + ': leere Identität kein Owner');
}
pass++; console.log('✓ Übergangsmodus: nur preferred_username zählt, leer ist nie Owner');

// ── 2. Der eigentliche Angriff: Anzeigename = Owner-Name, kein preferred_username ──────────
// So sah die alte Ableitung aus. Sie ist hier NACHGEBAUT, um zu zeigen, was der Fix verhindert.
const altAbleitung = (me) => me.preferred_username || me.name || me.username || '';
const angreifer = { sub: 'user_attacker', name: OWNER_NAME };   // Anzeigename gesetzt, Username nicht
assert.strictEqual(altAbleitung(angreifer), OWNER_NAME, 'alte Ableitung liefert den Owner-Namen');

for (const [file, fn] of [['sync.js', 'isOwnerIdentity'], ['blob-upload.js', 'isOwnerIdentity']]) {
    const isOwner = loadDecider(file, fn, []);
    const prefOnly = angreifer.preferred_username || '';        // was der Fix übergibt
    assert.strictEqual(isOwner(angreifer.sub, prefOnly), false,
        file + ': Anzeigename darf keinen Owner-Zugang geben');
}
pass++; console.log('✓ Anzeigename-Spoofing führt nicht mehr zum Owner-Bypass');

// ── 3. ID-Modus (*_OWNER_IDS gesetzt): ausschließlich die unveränderliche user_-ID zählt ───
for (const [file, fn] of [['sync.js', 'isOwnerIdentity'], ['blob-upload.js', 'isOwnerIdentity']]) {
    const isOwner = loadDecider(file, fn, [OWNER_ID]);
    assert.strictEqual(isOwner(OWNER_ID, ''), true, file + ': ID genügt, Name irrelevant');
    assert.strictEqual(isOwner(OWNER_ID, 'beliebig'), true, file + ': ID gewinnt');
    assert.strictEqual(isOwner('user_attacker', OWNER_NAME), false,
        file + ': im ID-Modus hilft der Owner-NAME nicht mehr');
    assert.strictEqual(isOwner('', OWNER_NAME), false, file + ': ohne ID kein Owner');
}
pass++; console.log('✓ ID-Modus: Owner-Name verliert jede Wirkung');

// ── 4. whop-access.js nimmt das ganze me-Objekt — gleiche Semantik prüfen ───────────────────
function loadWhopAccess(envIds) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'whop-access.js'), 'utf8');
    const m = src.match(/function _isOwner\([\s\S]*?\n\}/m);
    assert.ok(m, '_isOwner in api/whop-access.js nicht gefunden');
    return new Function('OWNER_IDS', 'OWNERS', m[0] + '; return _isOwner;')(envIds, [OWNER_NAME]);
}
let wa = loadWhopAccess([]);
assert.strictEqual(wa({ sub: OWNER_ID, preferred_username: OWNER_NAME }), true, 'echter Owner');
assert.strictEqual(wa({ sub: 'user_attacker', name: OWNER_NAME }), false, 'Anzeigename zieht nicht');
assert.strictEqual(wa({ sub: 'user_attacker' }), false, 'ohne Namen kein Owner');
assert.strictEqual(wa({}), false, 'leeres me kein Owner');
assert.strictEqual(wa(null), false, 'kein me kein Owner');
wa = loadWhopAccess([OWNER_ID]);
assert.strictEqual(wa({ sub: OWNER_ID }), true, 'ID-Modus: Owner erkannt');
assert.strictEqual(wa({ sub: 'user_attacker', preferred_username: OWNER_NAME }), false,
    'ID-Modus: Username hilft nicht');
pass++; console.log('✓ whop-access.js verhält sich identisch (inkl. null/leerem me)');

// ── 5. Die drei Kopien müssen deckungsgleich bleiben ───────────────────────────────────────
const bodyOf = (file, fn) => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'api', file), 'utf8');
    const m = src.match(new RegExp('function ' + fn + '\\([\\s\\S]*?\\n\\}', 'm'));
    return m[0].replace(/^function \w+\([^)]*\)/, '').replace(/\s+/g, ' ').trim();
};
assert.strictEqual(bodyOf('sync.js', 'isOwnerIdentity'), bodyOf('blob-upload.js', 'isOwnerIdentity'),
    'sync.js und blob-upload.js müssen dieselbe Owner-Logik haben');
pass++; console.log('✓ sync.js und blob-upload.js sind deckungsgleich');

console.log('\n' + pass + '/5 Tests bestanden ✅');
