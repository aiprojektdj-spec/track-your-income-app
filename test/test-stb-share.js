// Self-Test des Envelope-Key-Kerns:  node test/test-stb-share.js
// Prüft: ECDH-Wrap für Empfänger-Pubkey → Empfänger entpackt denselben Datenschlüssel;
//        fremder Private-Key entpackt NICHT (AES-GCM-Auth schlägt fehl);
//        HKDF-Envelope v2 + Rückwärtskompatibilität zu v1 (Delta-Audit-Fund 6, 2026-08-10);
//        Public-Key-Fingerabdruck stabil und unterscheidend (Fund 4).
'use strict';
const assert = require('assert');
const S = require('../js/stb-share.js');
const T = S._test;

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

    // 4) Fund 6: neue Envelopes tragen v:2 und leiten per HKDF ab
    assert.strictEqual(env.v, 2, 'neue Envelopes sind v2');
    assert.strictEqual(T.ENV_V, 2, 'ENV_V');
    pass++; console.log('✓ neue Envelopes sind v2 (HKDF)');

    // 5) Fund 6: v1-Envelopes (rohes ECDH, vor dem HKDF-Wechsel erzeugt) bleiben lesbar.
    //    Nachgebaut wie die alte wrapKey-Implementierung: _sharedKey ohne Version → v1-Pfad.
    const legacyEnv = await (async () => {
        const eph  = await S.genKeyPair();
        const aes  = await T.sharedKey(eph.priv, stb.pub, 1);
        const wc   = require('crypto').webcrypto;
        const iv   = wc.getRandomValues(new Uint8Array(12));
        const ct   = await wc.subtle.encrypt({ name: 'AES-GCM', iv }, aes, dataKey);
        return { ephPub: eph.pub, iv: S._b64(iv), ct: S._b64(new Uint8Array(ct)) };  // kein v-Feld
    })();
    const outLegacy = await S.unwrapKey(legacyEnv, stb.priv);
    assert.deepStrictEqual(Array.from(outLegacy), Array.from(dataKey), 'v1-Envelope weiterhin entpackbar');
    pass++; console.log('✓ v1-Envelope ohne v-Feld bleibt entpackbar');

    // 6) Fund 6: v1 und v2 leiten VERSCHIEDENE Schlüssel ab — ein als v1 deklarierter
    //    v2-Envelope lässt sich also nicht entpacken (kein stiller Downgrade auf rohes ECDH)
    const downgraded = Object.assign({}, env, { v: 1 });
    let dgFailed = false;
    try { await S.unwrapKey(downgraded, stb.priv); } catch (e) { dgFailed = true; }
    assert.ok(dgFailed, 'v2-Envelope als v1 deklariert darf nicht entpacken');
    pass++; console.log('✓ HKDF- und Roh-Ableitung sind unterscheidbar');

    // 7) Fund 4: Fingerabdruck ist deterministisch, schlüsselgebunden und ausreichend lang
    const fp1 = await S.fingerprint(stb.pub);
    const fp2 = await S.fingerprint(JSON.parse(JSON.stringify(stb.pub)));
    const fpOther = await S.fingerprint(other.pub);
    assert.strictEqual(fp1, fp2, 'derselbe Schlüssel → derselbe Fingerabdruck');
    assert.notStrictEqual(fp1, fpOther, 'anderer Schlüssel → anderer Fingerabdruck');
    assert.ok(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(fp1), 'Format AAAA-BBBB-CCCC-DDDD, ist: ' + fp1);
    assert.strictEqual(await S.fingerprint(null), '', 'kein Schlüssel → leerer Fingerabdruck');
    pass++; console.log('✓ Fingerabdruck deterministisch + schlüsselgebunden (' + fp1 + ')');

    // 8) Fund 4: Feldreihenfolge im JWK darf den Fingerabdruck nicht verändern —
    //    sonst zeigen zwei Browser unterschiedliche Werte für denselben Schlüssel
    const reordered = { y: stb.pub.y, crv: stb.pub.crv, x: stb.pub.x, kty: stb.pub.kty, ext: true };
    assert.strictEqual(await S.fingerprint(reordered), fp1, 'JWK-Feldreihenfolge irrelevant');
    pass++; console.log('✓ Fingerabdruck unabhängig von der JWK-Feldreihenfolge');

    console.log('\n' + pass + '/8 Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
