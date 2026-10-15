// ============================================
// Storno einer Rechnung als fachlicher Vorgang (Audit 2026-10-13, L1)
//
// Vier verschiedene Sachverhalte, die vorher in zwei Pfaden unterschiedlich vermischt waren:
//  1. Dokument: Stornorechnung mit negativen Positionen (Store.createStornoRechnung).
//  2. Forderung: das Original ist storniert, es wird nichts mehr geschuldet.
//  3. Geld: Ein bereits eingegangener Betrag bleibt eingegangen (§11 EStG). Nur eine TATSÄCHLICHE
//     Rückzahlung wird gebucht — als eigene, datierte Erstattung (Retoure, modell 2) auf den
//     Verkauf der Rechnung. Ohne Rückzahlung entsteht kein fiktiver Geldabfluss.
//  4. Lager: verknüpfte Artikel werden nur wieder verfügbar, wenn die Ware zurück ist bzw. nie
//     geliefert wurde.
//
// Vorher: der sichtbare Dialog erzeugte nur das Dokument (Verkauf blieb aktiv, Artikel blieb
// "verkauft", die EÜR blendete den Verkauf per Sonderregel aus, die Ist-UVA nicht); der
// unsichtbare Pfad Store.stornoRechInvoice() stornierte dagegen alle Verkäufe — und damit auch
// bereits zugeflossenes Geld rückwirkend.
//
// Original und Stornorechnung tragen stornoModell: 2. Daran erkennen EÜR und Soll-UVA, dass der
// Zufluss stehen bleibt und die Korrektur (§17 UStG) im Zeitraum der Stornorechnung wirkt.
// ============================================
const StornoVorgang = {
    _busy: {},

    // Was zur Rechnung schon gezahlt wurde (aktive Verkäufe aus Rechnung/Teilzahlungen) abzüglich
    // bereits gebuchter Erstattungen.
    bezahlt(invoiceId) {
        const sales = Store.getSales(true).filter(s => s._invoiceId === invoiceId && !s.storniert);
        const ids = new Set(sales.map(s => s.id));
        const erstattet = (Store.getRetouren ? Store.getRetouren() : [])
            .filter(r => r.saleId && ids.has(r.saleId))
            .reduce((sum, r) => sum + (parseFloat(r.erstattungBetrag) || 0), 0);
        const summe = sales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
        return { sales, summe, erstattet, offen: Math.round((summe - erstattet) * 100) / 100 };
    },

    // Artikel, die zur Rechnung gehören (Positionen und verknüpfte Verkäufe)
    artikel(inv) {
        const ids = new Set();
        (inv.positionen || []).forEach(p => { if (p.lagerArtikelId) ids.add(p.lagerArtikelId); });
        Store.getSales(true).filter(s => s._invoiceId === inv.id && !s.storniert).forEach(s => {
            (s.purchaseIds || (s.purchaseId ? [s.purchaseId] : [])).forEach(id => ids.add(id));
        });
        return Array.from(ids);
    },

    // e: { invoiceId, grund, grundText, erstattung: { betrag, datum } | null, wareZurueck: bool }
    // Rückgabe: { ok, stornoDoc, hinweise[] } oder { ok:false, fehler }
    async ausfuehren(e) {
        const inv = (Store.getRechInvoices() || []).find(i => i.id === e.invoiceId);
        if (!inv) return { ok: false, fehler: 'Rechnung nicht gefunden' };
        if (inv.status === 'storniert' || inv._storniert) return { ok: false, fehler: 'Rechnung ist bereits storniert' };
        if (this._busy[inv.id]) return { ok: false, fehler: 'Storno läuft bereits' };
        if (!e.grund) return { ok: false, fehler: 'Bitte einen Stornogrund auswählen.' };

        // Alles prüfen, bevor geschrieben wird
        const zahl = this.bezahlt(inv.id);
        let erstattung = null;
        if (e.erstattung) {
            const betrag = Math.round((parseFloat(e.erstattung.betrag) || 0) * 100) / 100;
            if (!(betrag > 0)) return { ok: false, fehler: 'Erstattungsbetrag fehlt' };
            if (betrag > zahl.offen + 0.005) return { ok: false, fehler: 'Erstattung über dem gezahlten Betrag' };
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.erstattung.datum || ''))) return { ok: false, fehler: 'Datum der Rückzahlung fehlt' };
            if (!zahl.sales.length) return { ok: false, fehler: 'Zur Rechnung ist keine Zahlung gebucht' };
            erstattung = { betrag, datum: e.erstattung.datum };
        }
        const artikelIds = e.wareZurueck ? this.artikel(inv) : [];

        this._busy[inv.id] = true;
        const hinweise = [];
        try {
            const stornoDoc = await Store.createStornoRechnung(inv.id, e.grund, e.grundText || '', { stornoModell: 2 });
            if (!stornoDoc) return { ok: false, fehler: 'Stornorechnung konnte nicht erstellt werden' };

            if (erstattung) {
                // Auf den größten Zahlungsverkauf buchen — sein Satz bestimmt die USt-Berichtigung.
                const ziel = zahl.sales.slice().sort((a, b) => (parseFloat(b.verkaufspreis) || 0) - (parseFloat(a.verkaufspreis) || 0))[0];
                const r = Store.saveRetoure({
                    datum: erstattung.datum, saleId: ziel.id, rechnungId: inv.id, modell: 2,
                    erstattungBetrag: erstattung.betrag, ware: 'keine', zustand: 'Keine Ware zurück', artikelIds: [],
                    marke: 'Rechnung', artikeltyp: inv.nummer || '', vkPreis: zahl.summe,
                    notizen: 'Rückzahlung zu Storno ' + (stornoDoc.nummer || '')
                });
                // Das Dokument ist GoBD-bedingt nicht zurücknehmbar — deshalb ehrlich melden statt
                // eine Erfolgsmeldung über einen halben Vorgang.
                if (!r) hinweise.push('Rückzahlung NICHT gebucht — bitte unter Retouren nachtragen.');
            }

            if (artikelIds.length) {
                const purchases = Store.getAllPurchasesRaw();
                let geaendert = false;
                artikelIds.forEach(pid => {
                    const p = purchases.find(x => x.id === pid);
                    if (!p || p.storniert || p.status === 'verfuegbar') return;
                    const alt = Object.assign({}, p);
                    p.status = 'verfuegbar';
                    Store._stampRecord(p);
                    Store._addAuditEntry('lager-status', 'einkauf', pid, alt, p, 'Storno ' + (stornoDoc.nummer || '') + ': Ware zurück');
                    geaendert = true;
                });
                if (geaendert) {
                    try { Store.set('purchases', purchases); }
                    catch (err) { hinweise.push('Lagerstatus nicht aktualisiert — bitte im Lager prüfen.'); }
                }
            }
            return { ok: true, stornoDoc, hinweise };
        } finally {
            delete this._busy[inv.id];
        }
    }
};

if (typeof window !== 'undefined') window.StornoVorgang = StornoVorgang;
if (typeof module !== 'undefined' && module.exports) module.exports = StornoVorgang;
