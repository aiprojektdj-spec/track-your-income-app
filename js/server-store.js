// ============================================================================
// ServerStore — P1 Spiegel: jede lokale Schreibung geht zusätzlich an api/data.js
// ============================================================================
// Schritt R4 aus plan/server-umbau-2026-10-22.md (Abschnitt 2, Phase P1). Lesen bleibt lokal
// (Store._cache), der Browser führt weiter. Dieses Modul schickt nur Änderungen hinterher:
//
//   Store._idbPut/_idbPutAsync/_idbPutBatch/_idbDelete  →  ServerStore.notiere(key)
//     → nach 2 s: Wert aus Store._cache mit dem zuletzt gesendeten Stand („Basis“, je Datensatz
//       ein Hash) vergleichen → Ops in die Outbox (IndexedDB, je Datensatz nur der letzte Stand)
//     → push in Stücken (≤ 200 Ops, ≤ 3,5 MB) an api/data.js.
//   Beim Start und beim Einschalten: Vollabgleich Cache ↔ Basis (fängt Schreibungen anderer
//   Seiten wie lager/, rechnungen/ oder eines anderen Tabs ab).
//   Täglich: Prüfsumme Browser vs. Server (action 'pruefsumme'); Abweichung → Warnung.
//
// Nur für ausdrücklich eingeschaltete Firmen (Testschalter, localStorage 'stackr_server_spiegel'):
//   ServerStore.spiegelEin('co_…')  /  ServerStore.spiegelAus('co_…')  /  ServerStore.status()
// js/server-umzug.js schaltet ihn nach einem erfolgreichen Umzug ein.
//
// Antworten des Servers:
//   ok / vorhanden  → Version merken, Op aus der Outbox
//   konflikt        → Annahme (P1, Browser führt): Server-Version übernehmen und erneut senden,
//                     höchstens 3-mal, danach Abweichung und neuer Versuch beim nächsten
//                     Abgleich (spätestens beim nächsten Start). Ab P2 (R6) übernimmt der Browser
//                     stattdessen den Server-Stand.
//   doppelt / gesperrt / fehlt → Abweichung protokollieren (localStorage, letzte 50), Op raus.
//   Netz/401/5xx    → Op bleibt, neuer Versuch nach 60 s oder beim nächsten Speichern.
//
// Annahme: Ein gelöschter Einstellungsschlüssel wird nicht gespiegelt (es gibt noch keine
// Lösch-Funktion für settings); die tägliche Prüfsumme zeigt so einen Fall als Abweichung.
// ============================================================================
const ServerStore = {
    API:           '/api/data',
    LS_FIRMEN:     'stackr_server_spiegel',
    LS_ABWEICHUNG: 'stackr_server_abweichungen',
    LS_PRUEFUNG:   'stackr_server_pruefung',
    IDB_NAME:      'stackr_server_store',
    MAX_OPS:       200,
    MAX_BYTES:     3.5 * 1024 * 1024,
    VERZOEGERUNG:  2000,
    WIEDERHOLEN:   60000,
    PRUEF_ABSTAND: 24 * 3600 * 1000,

    _dirty: new Set(),
    _timer: null,
    _laeuft: null,
    _meta: Object.create(null),     // company → { basis: { name: {art,ids}|{key,h} }, versionen: { opKey: n } }
    _rev: 0,

    // ── Schalter ────────────────────────────────────────────────────────────
    firmen() {
        try { const l = JSON.parse(localStorage.getItem(this.LS_FIRMEN) || '[]'); return Array.isArray(l) ? l : []; }
        catch (e) { return []; }
    },
    aktiv(company) { return this.firmen().indexOf(company) !== -1; },

    // optionen.versionen: bekannte Server-Versionen (nach dem Umzug), dann ist die Basis = Cache
    async spiegelEin(company, optionen) {
        if (!/^co_[a-z0-9]{1,40}$/.test(String(company || ''))) throw new Error('Firmen-ID ungültig');
        const o = optionen || {};
        if (!o.versionen) {
            const co = (typeof Companies !== 'undefined' && Companies.getAll) ? Companies.getAll().find((c) => c.id === company) : null;
            const r = await this._api({ action: 'firma_anlegen', company, name: co ? co.name : '', land: co ? co.land : 'DE' });
            if (r.status !== 200) throw new Error('Firma auf dem Server anlegen: HTTP ' + r.status);
        }
        const l = this.firmen();
        if (l.indexOf(company) === -1) { l.push(company); localStorage.setItem(this.LS_FIRMEN, JSON.stringify(l)); }
        const m = await this._ladeMeta(company);
        if (o.versionen) {
            m.versionen = Object.assign({}, o.versionen);
            m.basis = this._basisAus(company);
            await this._speicher.putMeta(company, m);
        }
        await this.abgleich(company);
        return this.status();
    },
    spiegelAus(company) {
        localStorage.setItem(this.LS_FIRMEN, JSON.stringify(this.firmen().filter((c) => c !== company)));
    },

    // ── Haken aus js/store.js (synchron, darf nie werfen) ───────────────────
    notiere(fullKey) {
        try {
            const s = ServerAbbild.schluessel(fullKey);
            if (!s || !this.aktiv(s.company)) return;
            this._dirty.add(fullKey);
            clearTimeout(this._timer);
            this._timer = setTimeout(() => { this.verarbeite(); }, this.VERZOEGERUNG);
        } catch (e) {}
    },

    // Alle Schlüssel der Firma (Cache und Basis) als geändert markieren und verarbeiten.
    async abgleich(company) {
        const m = await this._ladeMeta(company);
        const pre = company + '__';
        Object.keys(Store._cache).forEach((k) => { if (k.indexOf(pre) === 0 && ServerAbbild.schluessel(k)) this._dirty.add(k); });
        Object.keys(m.basis).forEach((name) => { if (m.basis[name].voll) this._dirty.add(m.basis[name].voll); });
        return this.verarbeite();
    },

    // Geänderte Schlüssel → Ops in die Outbox, dann senden. Läuft nie doppelt.
    async verarbeite() {
        while (this._laeuft) await this._laeuft;
        this._laeuft = (async () => {
            const keys = Array.from(this._dirty); this._dirty.clear();
            const jeFirma = Object.create(null);
            keys.forEach((k) => { const s = ServerAbbild.schluessel(k); if (s) (jeFirma[s.company] = jeFirma[s.company] || []).push({ k, name: s.name }); });
            for (const company of Object.keys(jeFirma)) {
                if (!this.aktiv(company)) continue;
                const m = await this._ladeMeta(company);
                const ops = [];
                jeFirma[company].forEach((x) => this._diff(m, x.k, x.name, ops));
                if (ops.length) {
                    await this._speicher.putOps(ops.map((op) => ({ k: company + '|' + this._opKey(op), company, op, rev: ++this._rev, versuche: 0 })));
                }
                await this._speicher.putMeta(company, m);
            }
            await this._sende();
        })();
        try { await this._laeuft; } finally { this._laeuft = null; }
    },

    _opKey(op) { return op.t === 's' ? 's/' + op.key : 'r/' + op.art + '/' + op.id; },

    // Vergleicht den aktuellen Cache-Wert eines Schlüssels mit der Basis, hängt Ops an und
    // setzt die Basis auf den neuen Stand.
    _diff(m, fullKey, name, ops) {
        const alt = m.basis[name];
        let wert = null;
        if (Store._cache[fullKey] != null) {
            try { wert = JSON.parse(Store._cache[fullKey]); } catch (e) { this._abweichung('kein JSON: ' + fullKey); return; }
        }
        const z = (wert === null || wert === undefined) ? null : ServerAbbild.zerlege(name, wert);
        if (z && z.fehler) { this._abweichung(z.fehler); return; }
        const neu = !z ? null : z.art
            ? { voll: fullKey, art: z.art, ids: z.records.reduce((o, r) => (o[r.id] = this._hash(JSON.stringify(r.data)), o), {}) }
            : { voll: fullKey, key: z.key, h: this._hash(JSON.stringify(z.data)) };
        if (z && z.art) z.records.forEach((r) => {
            if (!alt || !alt.ids || alt.ids[r.id] !== neu.ids[r.id]) ops.push({ t: 'r', art: z.art, id: r.id, data: r.data });
        });
        if (alt && alt.ids) Object.keys(alt.ids).forEach((id) => {
            if (!neu || !neu.ids || !(id in neu.ids)) ops.push({ t: 'r', art: alt.art, id, geloescht: true });
        });
        if (z && z.key && (!alt || alt.h !== neu.h)) ops.push({ t: 's', key: z.key, data: z.data });
        if (neu) m.basis[name] = neu; else delete m.basis[name];
    },

    // Basis = aktueller Cache, ohne etwas zu senden (nach dem Umzug).
    _basisAus(company) {
        const m = { basis: {} }, pre = company + '__', egal = [];
        Object.keys(Store._cache).forEach((k) => {
            const s = ServerAbbild.schluessel(k);
            if (s && k.indexOf(pre) === 0) this._diff(m, k, s.name, egal);
        });
        return m.basis;
    },

    // ── Senden ──────────────────────────────────────────────────────────────
    async _sende() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return this._spaeter();
        const alle = await this._speicher.alleOps();
        const jeFirma = Object.create(null);
        alle.forEach((e) => { if (this.aktiv(e.company)) (jeFirma[e.company] = jeFirma[e.company] || []).push(e); });
        for (const company of Object.keys(jeFirma)) {
            const m = await this._ladeMeta(company);
            for (const stueck of this._stuecke(jeFirma[company])) {
                const ops = stueck.map((e) => Object.assign({}, e.op, { version: m.versionen[this._opKey(e.op)] || null }));
                let r;
                try { r = await this._api({ action: 'push', company, ops }); }
                catch (err) { return this._spaeter(); }
                if (r.status !== 200 && r.status !== 409) {
                    if (r.status === 413 || r.status === 400) this._abweichung('push abgelehnt: HTTP ' + r.status + ' ' + JSON.stringify(r.json || {}).slice(0, 200));
                    return this._spaeter();
                }
                const results = (r.json && r.json.results) || [];
                const raus = [], neu = [];
                stueck.forEach((e, i) => {
                    const x = results[i] || {}, ok = this._opKey(e.op);
                    if (x.status === 'ok' || x.status === 'vorhanden') { m.versionen[ok] = x.version; raus.push(e); }
                    else if (x.status === 'konflikt' && e.versuche < 3) {
                        if (x.version) m.versionen[ok] = x.version; else delete m.versionen[ok];
                        neu.push(Object.assign({}, e, { versuche: e.versuche + 1 }));
                    } else {
                        this._abweichung(ok + ': ' + (x.status || 'ohne Antwort') + (x.grund ? ' (' + x.grund + ')' : ''));
                        // Aufgegebener Konflikt / keine Antwort: aus der Basis nehmen, damit der
                        // nächste Abgleich (spätestens beim nächsten Start) ihn erneut sendet.
                        // doppelt/gesperrt/fehlt sind endgültig und bleiben gemerkt.
                        if (x.status === 'konflikt' || !x.status) this._vergiss(m, e.op);
                        raus.push(e);
                    }
                });
                await this._speicher.loescheOps(raus);          // nur, wenn rev unverändert
                await this._speicher.ersetzeOps(neu);
                await this._speicher.putMeta(company, m);
                if (neu.length) this._spaeter();
            }
        }
    },

    _vergiss(m, op) {
        const b = m.basis[op.t === 's' ? op.key : op.art];
        if (!b) return;
        if (op.t === 's') b.h = null; else if (b.ids) delete b.ids[op.id];
    },

    _stuecke(eintraege) {
        const out = []; let akt = [], bytes = 0;
        eintraege.forEach((e) => {
            const b = JSON.stringify(e.op).length;
            if (akt.length && (akt.length >= this.MAX_OPS || bytes + b > this.MAX_BYTES)) { out.push(akt); akt = []; bytes = 0; }
            akt.push(e); bytes += b;
        });
        if (akt.length) out.push(akt);
        return out;
    },

    _spaeter() {
        clearTimeout(this._wiederTimer);
        this._wiederTimer = setTimeout(() => { this.verarbeite(); }, this.WIEDERHOLEN);
    },

    // ── Prüfsumme Browser vs. Server ────────────────────────────────────────
    async lokalePruefsumme(company) {
        const z = ServerAbbild.alleZeilen(company, Store._cache);
        return { pruefsumme: await this._sha256(ServerAbbild.pruefzeilen(z.records, z.settings)),
                 records: z.records.length, settings: z.settings.filter((s) => s.data !== null).length, fehler: z.fehler };
    },
    async pruefen(company) {
        if ((await this._speicher.alleOps()).some((e) => e.company === company)) return { offen: true };
        const lokal = await this.lokalePruefsumme(company);
        const r = await this._api({ action: 'pruefsumme', company });
        if (r.status !== 200) return { fehler: r.status };
        const erg = { ts: Date.now(), gleich: r.json.pruefsumme === lokal.pruefsumme, lokal, server: r.json };
        try {
            const alle = JSON.parse(localStorage.getItem(this.LS_PRUEFUNG) || '{}');
            alle[company] = erg; localStorage.setItem(this.LS_PRUEFUNG, JSON.stringify(alle));
        } catch (e) {}
        if (!erg.gleich) {
            console.warn('[ServerStore] Prüfsumme weicht ab', company, erg);
            if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast('Server-Spiegel: Prüfsumme weicht ab (Testfirma). Details: ServerStore.status()', 'warning', 8000);
        }
        return erg;
    },

    async status() {
        const ops = await this._speicher.alleOps();
        let pr = {}, ab = [];
        try { pr = JSON.parse(localStorage.getItem(this.LS_PRUEFUNG) || '{}'); ab = JSON.parse(localStorage.getItem(this.LS_ABWEICHUNG) || '[]'); } catch (e) {}
        return { firmen: this.firmen(), outbox: ops.length, pruefung: pr, abweichungen: ab };
    },

    _abweichung(text) {
        console.warn('[ServerStore]', text);
        try {
            const l = JSON.parse(localStorage.getItem(this.LS_ABWEICHUNG) || '[]');
            l.push({ ts: new Date().toISOString(), text: String(text).slice(0, 300) });
            localStorage.setItem(this.LS_ABWEICHUNG, JSON.stringify(l.slice(-50)));
        } catch (e) {}
    },

    // ── Start ───────────────────────────────────────────────────────────────
    async init() {
        const firmen = this.firmen();
        if (!firmen.length) return;
        let pr = {};
        try { pr = JSON.parse(localStorage.getItem(this.LS_PRUEFUNG) || '{}'); } catch (e) {}
        for (const c of firmen) {
            await this.abgleich(c);
            if (!pr[c] || Date.now() - pr[c].ts > this.PRUEF_ABSTAND) { try { await this.pruefen(c); } catch (e) {} }
        }
        if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', () => this.verarbeite());
    },

    // ── Hilfen ──────────────────────────────────────────────────────────────
    async _ladeMeta(company) {
        if (!this._meta[company]) {
            const m = await this._speicher.getMeta(company);
            this._meta[company] = m || { basis: {}, versionen: {} };
        }
        return this._meta[company];
    },

    // cyrb53 — schneller 53-Bit-Hash für die Basis (nur Änderungserkennung, kein Schutz)
    _hash(str) {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    },

    async _sha256(text) {
        const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
    },

    // Wie CloudSync._api: Token vorausschauend erneuern, bei 401 genau einmal erneuern.
    async _api(body) {
        const auth = (typeof AuthUI !== 'undefined') ? AuthUI : null;
        let tok = (auth && auth.validToken && await auth.validToken()) || '';
        if (!tok) { try { tok = localStorage.getItem('whop_access_token') || ''; } catch (e) {} }
        const send = (t) => fetch(this.API, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify(body)
        });
        let res = await send(tok);
        if (res.status === 401 && auth && auth.refreshToken) {
            const frisch = await auth.refreshToken();
            if (frisch) res = await send(frisch);
        }
        let json = {};
        try { json = await res.json(); } catch (e) {}
        return { status: res.status, json };
    },

    // Outbox + Meta in IndexedDB. Tests ersetzen dieses Objekt durch einen Speicher im RAM.
    _speicher: {
        _db: null,
        _offen() {
            if (this._db) return Promise.resolve(this._db);
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(ServerStore.IDB_NAME, 1);
                req.onupgradeneeded = () => {
                    req.result.createObjectStore('outbox', { keyPath: 'k' });
                    req.result.createObjectStore('meta', { keyPath: 'company' });
                };
                req.onsuccess = () => { this._db = req.result; resolve(this._db); };
                req.onerror = () => reject(req.error);
            });
        },
        async _tx(store, modus, fn) {
            const db = await this._offen();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, modus), os = tx.objectStore(store);
                let erg; const r = fn(os); if (r) r.onsuccess = () => { erg = r.result; };
                tx.oncomplete = () => resolve(erg);
                tx.onerror = tx.onabort = () => reject(tx.error);
            });
        },
        async getMeta(company) { const r = await this._tx('meta', 'readonly', (os) => os.get(company)); return r ? r.m : null; },
        putMeta(company, m) { return this._tx('meta', 'readwrite', (os) => { os.put({ company, m }); }); },
        alleOps() { return this._tx('outbox', 'readonly', (os) => os.getAll()).then((l) => l || []); },
        putOps(liste) { return this._tx('outbox', 'readwrite', (os) => { liste.forEach((e) => os.put(e)); }); },
        // Beide nur, wenn inzwischen kein neuerer Stand desselben Datensatzes eingereiht wurde
        ersetzeOps(liste) { return this._wennRev(liste, (os, e) => os.put(e)); },
        loescheOps(liste) { return this._wennRev(liste, (os, e) => os.delete(e.k)); },
        _wennRev(liste, fn) {
            if (!liste.length) return Promise.resolve();
            return this._tx('outbox', 'readwrite', (os) => {
                liste.forEach((e) => { const g = os.get(e.k); g.onsuccess = () => { if (g.result && g.result.rev === e.rev) fn(os, e); }; });
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.ServerStore = ServerStore;
    // Nach dem Laden der Module, wie CloudSync; ohne eingeschaltete Firma passiert nichts.
    setTimeout(() => { ServerStore.init().catch((e) => console.warn('[ServerStore] init:', e && e.message)); }, 2500);
}
if (typeof module !== 'undefined' && module.exports) module.exports = ServerStore;
