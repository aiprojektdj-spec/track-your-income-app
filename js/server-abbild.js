// ============================================================================
// ServerAbbild — Browser-Schlüssel ↔ Server-Zeilen (records / settings)
// ============================================================================
// Gemeinsam für den Browser (js/server-store.js, js/server-umzug.js) und den Server
// (api/data.js) — beide Seiten müssen Datensätze gleich zerlegen und dieselbe Prüfsumme
// rechnen, sonst meldet der Abgleich Unterschiede, die es nicht gibt. Reine Funktionen,
// kein DOM, kein Store-Zugriff.
//
// Zerlegung (plan/server-umbau-2026-10-22.md, Abschnitt 1 „Welche Store-Schlüssel wohin“):
//   co_<id>__reselling_<n>      → Name <n>          (reselling_sales → sales)
//   co_<id>__rechnungsbuch_<n>  → Name rech_<n>
//   co_<id>__eigenbelege_<n>    → Name eb_<n>
//   Wert = Array, in dem jedes Element ein Objekt mit id ist → je Element eine Zeile in
//   `records` (art = Name). Alles andere → eine Zeile in `settings` (key = Name).
//   Doppelte id in einem Array: ab dem zweiten Vorkommen id + '#2', '#3' … (data bleibt
//   unverändert) — verlustfrei und auf beiden Seiten gleich.
//   Ausgenommen: audit_log (geht über audit_uebernehmen), reselling_tombstones (entfällt).
//
// Annahme: Zähler (invoice_counter …) und Festschreibungen (closed_years, ust_perioden)
// liegen bis R7 als gewöhnliche settings auf dem Server; nummernkreise/perioden füllt erst
// R7. Die Nummer vergibt bis dahin der Browser, die Spalte `nummer` bleibt leer.
// ============================================================================
const ServerAbbild = {
    FIRMA_RE: /^(co_[a-z0-9]{1,40})__(.+)$/,
    ART_RE:   /^[a-z0-9_]{1,40}$/,
    KEY_RE:   /^[a-z0-9_]{1,60}$/,
    AUSGENOMMEN: ['audit_log', 'reselling_tombstones'],

    // 'co_x__reselling_sales' → { company: 'co_x', name: 'sales' }; null = kein Firmenschlüssel
    // oder ausgenommen. name kann ungültig sein (ART_RE/KEY_RE) — das meldet zerlege().
    schluessel(fullKey) {
        const m = this.FIRMA_RE.exec(String(fullKey || ''));
        if (!m || this.AUSGENOMMEN.indexOf(m[2]) !== -1) return null;
        const rest = m[2];
        let name;
        if (rest.indexOf('reselling_') === 0)          name = rest.slice(10);
        else if (rest.indexOf('rechnungsbuch_') === 0) name = 'rech_' + rest.slice(14);
        else if (rest.indexOf('eigenbelege_') === 0)   name = 'eb_' + rest.slice(12);
        else return null;
        return { company: m[1], name };
    },

    // → { art, records: [{ id, data }] } | { key, data } | { fehler }
    zerlege(name, wert) {
        const istListe = Array.isArray(wert) && wert.length > 0 && wert.every(function (e) {
            return e && typeof e === 'object' && !Array.isArray(e) &&
                   (typeof e.id === 'string' || typeof e.id === 'number') && String(e.id) !== '';
        });
        if (istListe) {
            if (!this.ART_RE.test(name)) return { fehler: 'ungueltige Art: ' + name };
            const gesehen = Object.create(null);
            const records = wert.map(function (e) {
                const basis = String(e.id);
                const n = (gesehen[basis] = (gesehen[basis] || 0) + 1);
                return { id: n === 1 ? basis : basis + '#' + n, data: e };
            });
            if (records.some(function (r) { return r.id.length > 100; })) return { fehler: 'id zu lang in ' + name };
            return { art: name, records };
        }
        // Leere Liste: nichts zu speichern (auf beiden Seiten gleich, s. pruefzeilen)
        if (Array.isArray(wert) && wert.length === 0) return { art: name, records: [] };
        if (!this.KEY_RE.test(name)) return { fehler: 'ungueltiger Schluessel: ' + name };
        return { key: name, data: wert };
    },

    // Alle Zeilen einer Firma aus dem Store-Cache (Schlüssel → JSON-Text).
    // → { records: [{ art, id, data }], settings: [{ key, data }], fehler: [] }
    alleZeilen(company, cache) {
        const out = { records: [], settings: [], fehler: [] };
        Object.keys(cache || {}).sort().forEach((k) => {
            const s = this.schluessel(k);
            if (!s || s.company !== company) return;
            let wert;
            try { wert = JSON.parse(cache[k]); } catch (e) { out.fehler.push('kein JSON: ' + k); return; }
            if (wert === null || wert === undefined) return;
            const z = this.zerlege(s.name, wert);
            if (z.fehler) out.fehler.push(z.fehler);
            else if (z.art) z.records.forEach(function (r) { out.records.push({ art: z.art, id: r.id, data: r.data }); });
            else out.settings.push({ key: z.key, data: z.data });
        });
        return out;
    },

    // Spalten für die GoBD-Regeln — setzt api/data.js, nicht der Browser.
    //   datum:  wie Store.isLocked (datum || anschaffungsdatum), nur gültiges JJJJ-MM-TT
    //   gesperrt_grund: storniert | gegengebucht | gesperrt (Satz-Sperre aus Store.isLocked;
    //           die Perioden-Sperre kommt mit R7 über `perioden`)
    //   quelle: nur Shopify (Doppelimport-Index, Plan 1 Punkt 5). Andere quelle-Werte wie
    //           'bestandscheck' sind nicht eindeutig und bleiben nur im JSON.
    spalten(data) {
        const d = data || {};
        let datum = d.datum || d.anschaffungsdatum;
        datum = (typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(datum)) ? datum.slice(0, 10) : null;
        if (datum) {
            const t = new Date(datum + 'T00:00:00Z');
            if (isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== datum) datum = null;
        }
        const grund = d.storniert ? 'storniert'
            : (d.gegengebucht || d._gegenbuchungZu) ? 'gegengebucht'
            : d.gesperrt ? 'gesperrt' : null;
        let quelle = null;
        const q = d.quelle;
        if (q && typeof q === 'object' && q.art === 'shopify' && q.shop && q.orderId != null) {
            quelle = q.refundId != null
                ? 'shopify:' + q.shop + ':refund:' + q.refundId
                : 'shopify:' + q.shop + ':' + q.orderId + (q.teil != null && q.teil !== '' ? ':' + q.teil : '');
        }
        return { datum, gesperrt_grund: grund, quelle };
    },

    // JSON mit sortierten Schlüsseln — jsonb hält die Reihenfolge nicht.
    kanonisch(v) {
        if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
        if (Array.isArray(v)) return '[' + v.map((x) => this.kanonisch(x)).join(',') + ']';
        return '{' + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort()
            .map((k) => JSON.stringify(k) + ':' + this.kanonisch(v[k])).join(',') + '}';
    },

    // Grundlage der Prüfsumme (SHA-256 bildet jede Seite selbst): eine Zeile je Datensatz und
    // Einstellung, sortiert. Gelöschte Datensätze und null-Einstellungen zählen nicht.
    pruefzeilen(records, settings) {
        const z = [];
        (records || []).forEach((r) => { if (!r.geloescht) z.push('r\t' + r.art + '\t' + r.id + '\t' + this.kanonisch(r.data)); });
        (settings || []).forEach((s) => { if (s.data !== null && s.data !== undefined) z.push('s\t' + s.key + '\t' + this.kanonisch(s.data)); });
        return z.sort().join('\n');
    },

    // Identisch zu Store._calcChecksum (js/store.js) — test/test-server-data.js vergleicht beide.
    calcChecksum(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    },

    // Browser-Audit-Kette prüfen wie Store.verifyAuditChain; Einträge als Originaltext.
    // → { total, broken, clockBack, positionen (die ersten 20 gebrochenen, 0-basiert) }
    kettePruefen(texte) {
        let broken = 0, clockBack = 0, vorige = null;
        const positionen = [];
        (texte || []).forEach((t, i) => {
            let e = null;
            try { e = JSON.parse(t); } catch (err) {}
            let kaputt = !e || typeof e !== 'object';
            if (!kaputt) {
                if (e._clockBack) clockBack++;
                if (e._kettenbruch) kaputt = true;
                else if (e.checksum !== this.calcChecksum(JSON.stringify(Object.assign({}, e, { checksum: '' })))) kaputt = true;
                else if (e.prevHash !== (i === 0 ? 'GENESIS' : ((vorige && vorige.checksum) || ''))) kaputt = true;
            }
            if (kaputt) { broken++; if (positionen.length < 20) positionen.push(i); }
            vorige = e;
        });
        return { total: (texte || []).length, broken, clockBack, positionen };
    }
};

if (typeof window !== 'undefined') window.ServerAbbild = ServerAbbild;
if (typeof module !== 'undefined' && module.exports) module.exports = ServerAbbild;
