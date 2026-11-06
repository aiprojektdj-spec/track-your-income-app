// Kundenfall 2026-11-04: Backup in frisches Profil einspielen, leere App am vorhandenen Ordner.
//   node test/test-backup-ordner.js
// Echter Store mit isoliertem localStorage und einem Ordner-Handle im Speicher.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

function makeLS(init) {
    const m = new Map(Object.entries(init || {}));
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); }, key: i => Array.from(m.keys())[i] ?? null, get length() { return m.size; } };
}
function welt(id, name) {
    const ls = makeLS({ oyi_companies: JSON.stringify([{ id, name, land: 'DE' }]), oyi_active_company: id, oyi_device_id: 'dev_' + id });
    const c = ladeModule(['js/utils.js', 'js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js', 'js/backup-crypto.js', 'js/backup-ordner.js'], {
        localStorage: ls, sessionStorage: makeLS(), setTimeout: () => 0, clearTimeout: () => {},
        confirm: () => true, prompt: () => null, navigator: {}, TextEncoder, crypto: require('crypto').webcrypto
    });
    c.Utils.showToast = () => {};
    c.CompanyManager = { getActive: () => ({ id, name }) };
    c.Store.setCompany(id);
    return c;
}
function ordner(namen) {
    const dateien = new Map(namen.map(n => [n, 1]));
    const handle = {
        dateien,
        async *keys() { yield* dateien.keys(); },
        async *entries() { for (const n of dateien.keys()) yield [n, {}]; },
        async getFileHandle(n) {
            dateien.set(n, 1);
            return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
        },
        async removeEntry(n) { dateien.delete(n); }
    };
    return handle;
}
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

(async () => {
    // Protokoll beim Import
    {
        const alt = welt('co_alt', 'Firma Alt');
        alt.Store.saveSale({ datum: '2026-06-01', verkaufspreis: 119, steuersatz: 19 });
        alt.Store.saveSale({ datum: '2026-06-02', verkaufspreis: 50, steuersatz: 19 });
        const altIds = alt.Store.getAuditLog().map(e => e.id);
        const backup = alt.Store.exportAll();

        const neu = welt('co_neu', 'Firma Neu');
        neu.Store.importAll(backup);
        assert.strictEqual(neu.Store.getSales().length, 2);
        const log = neu.Store.getAuditLog();
        altIds.forEach(id => assert.ok(log.some(e => e.id === id), 'Backup-Eintrag fehlt: ' + id));
        assert.strictEqual(log[log.length - 1].action, 'import', 'Import-Eintrag gehoert ans Ende');
        assert.ok(neu.Store.verifyAuditChain().valid, 'Kette ungueltig');
        ok('Frisches Profil uebernimmt das Protokoll aus dem Backup, Kette gueltig');

        const mitEintrag = welt('co_neu2', 'Firma Neu');
        mitEintrag.Store.saveSale({ datum: '2026-11-01', verkaufspreis: 10, steuersatz: 19 });
        const eigen = mitEintrag.Store.getAuditLog().map(e => e.id);
        mitEintrag.Store.importAll(backup);
        const log2 = mitEintrag.Store.getAuditLog();
        altIds.concat(eigen).forEach(id => assert.ok(log2.some(e => e.id === id), 'Eintrag fehlt: ' + id));
        assert.ok(mitEintrag.Store.verifyAuditChain().valid, 'Kette ungueltig');
        ok('Profil mit eigenem Protokoll behaelt beide Staende');

        const manipuliert = JSON.parse(backup);
        const aKey = Object.keys(manipuliert).find(k => /audit_log$/.test(k));
        const eintraege = JSON.parse(manipuliert[aKey]);
        eintraege[0].details = 'nachtraeglich geaendert';
        manipuliert[aKey] = JSON.stringify(eintraege);
        delete manipuliert._exportMeta;
        const opfer = welt('co_neu3', 'Firma Neu');
        opfer.Store.importAll(JSON.stringify(manipuliert));
        assert.strictEqual(opfer.Store.verifyAuditChain().valid, false, 'Manipulation wurde durch den Merge geheilt');
        ok('Manipuliertes Backup-Protokoll bleibt als Bruch erkennbar');
    }

    // Leere App am Ordner
    {
        const c = welt('co_a', 'Firma A'), S = c.Store;
        const alte = Array.from({ length: 60 }, (_, i) => `backup_Firma_A_2026-09-${String(i % 28 + 1).padStart(2, '0')}_10-00-${String(i).padStart(2, '0')}_auto.zip`);
        const h = ordner(alte);
        S._fsDirHandle = h;
        assert.strictEqual(c.BackupOrdner.appIstLeer(S), true);
        assert.strictEqual(await S.writeFileSystemBackup('session_end'), false);
        assert.strictEqual(h.dateien.size, 60);
        alte.forEach(f => assert.ok(h.dateien.has(f), 'Backup geloescht: ' + f));
        ok('Leere App schreibt nicht in einen Ordner mit Backups und loescht nichts');

        c.Store._createZip = async () => new Uint8Array(1);
        const leer = ordner([]);
        S._fsDirHandle = leer;
        assert.ok(await S.writeFileSystemBackup('einrichtung'), 'Einrichtung im leeren Ordner blockiert');
        assert.strictEqual(leer.dateien.size, 1);
        ok('Leere App darf in einen leeren Ordner schreiben');

        S.saveSale({ datum: '2026-06-01', verkaufspreis: 119, steuersatz: 19 });
        assert.strictEqual(c.BackupOrdner.appIstLeer(S), false);
        S._fsDirHandle = h;
        assert.ok(await S.writeFileSystemBackup('auto'), 'App mit Daten muss sichern');
        ok('App mit Daten sichert normal');

        const rech = welt('co_b', 'Firma B');
        rech.Store.saveRechInvoice({ id: 'inv1', nummer: 'RE-1', typ: 'rechnung', status: 'versendet', datum: '2026-10-01', positionen: [] });
        assert.strictEqual(rech.BackupOrdner.appIstLeer(rech.Store), false);
        ok('Nur Rechnungen zaehlen als Daten');
    }

    console.log('\n' + n + ' Pruefungen bestanden');
})().catch(e => { console.error(e); process.exit(1); });
