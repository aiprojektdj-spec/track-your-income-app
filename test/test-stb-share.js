// Self-Test des Envelope-Key-Kerns:  node test/test-stb-share.js
// Prüft: ECDH-Wrap für Empfänger-Pubkey → Empfänger entpackt denselben Datenschlüssel;
//        fremder Private-Key entpackt NICHT (AES-GCM-Auth schlägt fehl).
'use strict';
const assert = require('assert');
const S = require('../js/stb-share.js');

(async () => {
    let pass = 0;

    // 32-Byte-Datenschlüssel wie in cloud-sync.js
    const dataKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) dataKey[i] = (i * 53 + 7) & 255;

    // 1) Roundtrip: Owner verpackt für StB-Pubkey → StB entpackt mit seinem Privkey
    const stb = await S.genKeyPair();
    const env = await S.wrapKey(dataKey, stb.pub);
    assert.ok(env.ephPub && env.iv && env.ct, 'envelope shape');
    const out = await S.unwrapKey(env, stb.priv);
    assert.strictEqual(out.length, 32, 'unwrapped length');
    for (let i = 0; i < 32; i++) assert.strictEqual(out[i], dataKey[i], 'byte ' + i);
    pass++; console.log('✓ envelope wrap/unwrap roundtrip');

    // 2) Fremder Empfänger kann NICHT entpacken (kryptografisch, nicht nur UI)
    const other = await S.genKeyPair();
    let denied = false;
    try { await S.unwrapKey(env, other.priv); } catch (e) { denied = true; }
    assert.ok(denied, 'wrong private key must fail to decrypt');
    pass++; console.log('✓ foreign key cannot unwrap');

    // 3) Jeder Envelope nutzt ein frisches ephemerales Paar (forward secrecy)
    const env2 = await S.wrapKey(dataKey, stb.pub);
    assert.notStrictEqual(JSON.stringify(env.ephPub), JSON.stringify(env2.ephPub), 'fresh ephemeral key per wrap');
    pass++; console.log('✓ fresh ephemeral key per envelope');

    console.log('\n' + pass + '/3 Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
