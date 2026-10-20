// GoBD: Backup-Restore, Retouren/Materialeinkäufe, Z3-Export (Steuer-Audit 2026-10-18, F1/F2/F3, B7).
//   node test/test-gobd-restore-retoure-z3.js
// Echter Store mit isoliertem localStorage — Daten über die echten save*-Wege, keine Wunschfelder.
// Soll: §146 Abs. 4 AO (keine Veränderung ohne Erkennbarkeit), §14 Abs. 4 Nr. 4 UStG (einmalige
// Rechnungsnummer), §147 Abs. 6 AO (vollständige, maschinell auswertbare Daten).
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

function makeLS(init) {
    const m = new Map(Object.entries(init || {}));
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); }, key: i => Array.from(m.keys())[i] ?? null, get length() { return m.size; } };
}
function welt() {
    const ls = makeLS({ oyi_companies: JSON.stringify([{ id: 'co_a', name: 'Firma A', land: 'DE' }]),
        oyi_active_company: 'co_a', oyi_device_id: 'dev_test' });
    const toasts = [], zips = [];
    const c = ladeModule(['js/utils.js', 'js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js',
        'js/steuer-berechnung.js', 'js/afa.js', 'js/vorsteuer.js', 'js/oss.js', 'js/euer.js', 'js/protokoll.js'], {
        localStorage: ls, sessionStorage: makeLS(), setTimeout: () => 0, clearTimeout: () => {},
        confirm: () => true, prompt: () => null, navigator: {}, TextEncoder, crypto: require('crypto').webcrypto,
        StackrZip: { build: d => { zips.push(d); return new Uint8Array(0); } }
    });
    c.Utils.showToast = (m, t) => toasts.push({ m: String(m), t });
    c.Utils.downloadBytes = () => {};
    c.Store.setCompany('co_a');
    c.Store.set('settings', { ustMode: 'regel', ustVersteuerungsart: 'ist' });
    c.__toasts = toasts; c.__zips = zips;
    return c;
}
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

(async () => {
    // F1 — Restore eines älteren Backups
    {
        const c = welt(), S = c.Store;
        S.saveSale({ datum: '2025-06-01', verkaufspreis: 119, steuersatz: 19 });
        const nr1 = await S.nextRechInvoiceNumber('rechnung');
        S.saveRechInvoice({ id: 'inv1', nummer: nr1, typ: 'rechnung', status: 'versendet', datum: '2026-10-01', positionen: [{ menge: 1, einzelpreis: 100, mwstSatz: 19 }] });
        const backup = S.exportAll();
        S.closeYear(2025);
        const nr2 = await S.nextRechInvoiceNumber('rechnung');
        S.saveRechInvoice({ id: 'inv2', nummer: nr2, typ: 'rechnung', status: 'versendet', datum: '2026-10-10', positionen: [{ menge: 1, einzelpreis: 500, mwstSatz: 19 }] });
        S.saveUstPeriode({ year: 2026, quartal: 2, eingereichtAm: '2026-10-05' });
        const vorRestore = S.getAuditLog().length;
        S.importAll(backup);
        const log = S.getAuditLog();
        assert.ok(log.length >= vorRestore + 1, 'Protokoll geschrumpft: ' + log.length + ' < ' + (vorRestore + 1));
        assert.ok(log.some(e => e.action === 'import'), 'Import-Eintrag fehlt');
        assert.ok(log.some(e => /2025 abgeschlossen/.test(e.details || '')), 'Abschluss-Eintrag fehlt');
        assert.ok(S.verifyAuditChain().valid, 'Kette nach Restore ungültig');
        ok('F1: Protokoll bleibt append-only, Kette gültig');
        assert.deepStrictEqual(Array.from(S.getClosedYears()), [2025]);
        assert.ok(S.getUstPerioden().some(p => p.year === 2026 && p.quartal === 2 && p.eingereichtAm), 'eingereichte UVA-Periode verloren');
        ok('F1: Jahresabschluss 2025 und eingereichte UVA-Periode überleben den Restore');
        assert.strictEqual(await S.nextRechInvoiceNumber('rechnung'), nr2.replace(/\d+$/, '003'));
        ok('F1: nächste Rechnungsnummer ' + nr2.replace(/\d+$/, '003') + ', keine Doppelvergabe');
    }

    // B7 — Stornonummer bei zurückgesetztem Zähler nicht doppelt
    {
        const c = welt(), S = c.Store;
        const sr1 = await S.nextStornoNumber();
        S.saveRechInvoice({ id: 'sr1', nummer: sr1, typ: 'storno', status: 'versendet', datum: '2026-10-10', positionen: [] });
        const z = S.getRechInvoiceCounter(); z.SR = 0; S._rechSet('invoice_counter', z);
        assert.notStrictEqual(await S.nextStornoNumber(), sr1, 'SR-Nummer doppelt vergeben');
        ok('B7: Stornonummer überspringt vorhandene Nummern');
    }

    // F2 — Retoure/Materialeinkauf: Protokoll und Sperre im abgeschlossenen Jahr
    {
        const c = welt(), S = c.Store;
        S.saveSale({ datum: '2025-03-01', verkaufspreis: 119, steuersatz: 19 });
        const r = S.saveRetoure({ datum: '2025-03-20', saleId: S.getSales()[0].id, erstattungBetrag: 107.1, modell: 2, ware: 'keine', artikelIds: [] });
        const m = S.saveMaterialEinkauf({ datum: '2025-04-01', materialId: 'x', menge: 1, gesamtkosten: 10 });
        assert.ok(S.getAuditLog().some(e => e.entityType === 'retoure' && e.action === 'erstellt'), 'Retoure ohne Protokoll');
        assert.ok(S.getAuditLog().some(e => e.entityType === 'materialeinkauf' && e.action === 'erstellt'), 'Materialeinkauf ohne Protokoll');
        S.closeYear(2025);
        const vorher = c.Euer._berechne(2025, 0, 'jahr').gewinn;
        assert.ok(S.deleteRetoure(r.id).blocked, 'Retoure im abgeschlossenen Jahr gelöscht');
        assert.ok(S.deleteMaterialEinkauf(m.id).blocked, 'Materialeinkauf im abgeschlossenen Jahr gelöscht');
        assert.strictEqual(S.saveRetoure(Object.assign({}, r, { erstattungBetrag: 1 })), null, 'Retoure im abgeschlossenen Jahr geändert');
        assert.strictEqual(c.Euer._berechne(2025, 0, 'jahr').gewinn, vorher, 'EÜR 2025 hat sich verändert');
        ok('F2: Retoure/Materialeinkauf im abgeschlossenen Jahr weder lösch- noch änderbar, EÜR stabil');
        S.reopenYear(2025, 'Test');
        S.deleteRetoure(r.id);
        assert.ok(S.getAuditLog().some(e => e.entityType === 'retoure' && e.action === 'loeschung'), 'Löschung ohne Protokoll');
        ok('F2: Löschen in offener Periode wird protokolliert');
    }

    // F3 — Z3 mit echten Feldnamen und vollständigen Tabellen
    {
        const c = welt(), S = c.Store;
        S.saveKassenEintrag({ datum: '2026-03-01', typ: 'Einnahme', betrag: 200, beschreibung: 'Barverkauf', beleg: 'K-001' });
        S.saveKassenEintrag({ datum: '2026-03-02', typ: 'Ausgabe', betrag: 50, beschreibung: 'Porto bar', beleg: 'K-002' });
        S.saveSale({ datum: '2026-03-05', verkaufspreis: 119, versandkostenKaeufer: 5.95, versandkostenVerkaufer: 4.5, steuersatz: 7 });
        S.saveRetoure({ datum: '2026-03-20', saleId: S.getSales()[0].id, erstattungBetrag: 20, modell: 2, ware: 'keine', artikelIds: [] });
        c.Protokoll.exportZ3(2026, 2026);
        const dateien = c.__zips[0];
        const tab = name => {
            const f = dateien.find(d => d.name === name);
            assert.ok(f, name + ' fehlt im Archiv');
            const rows = String(f.data).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map(l => l.split(';').map(x => x.replace(/^"|"$/g, '')));
            return rows.slice(1).map(r => Object.fromEntries(rows[0].map((k, i) => [k, r[i]])));
        };
        const kb = tab('kassenbuch.csv');
        assert.deepStrictEqual(kb.map(r => r['Art']), ['Einnahme', 'Ausgabe']);
        assert.deepStrictEqual(kb.map(r => r['Belegnummer']), ['K-001', 'K-002']);
        assert.deepStrictEqual(kb.map(r => r['Kassenbestand nach Buchung (EUR)']), ['200', '150']);
        ok('F3: Kassenbuch mit Art, Belegnummer und laufendem Bestand');
        const vk = tab('verkaeufe.csv');
        assert.strictEqual(vk[0]['Versand Käufer (EUR)'], '5,95');
        assert.strictEqual(vk[0]['USt-Satz (%)'], '7');
        ok('F3: Verkäufe mit Käuferversand und Steuersatz');
        assert.strictEqual(tab('retouren.csv')[0]['Erstattung (EUR)'], '20');
        ok('F3: Retouren-Tabelle enthalten');
    }
    console.log('\n' + n + '/9 GoBD-Restore/Retoure/Z3-Tests bestanden');
})().catch(e => { console.error(e); process.exit(1); });
