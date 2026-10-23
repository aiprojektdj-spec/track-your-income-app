// ============================================
// Ausgaben Module - Expenses Management
// ============================================
const Ausgaben = {
    _filterKategorie: '',
    _filterVon: '',
    _filterBis: '',

    // Die beiden Umsatzsteuer-Kategorien sind keine Betriebsausgaben im engeren Sinn: die EÜR
    // weist sie als "an das Finanzamt gezahlte" bzw. "vom Finanzamt erstattete Umsatzsteuer"
    // aus (js/euer.js KAT_UST_*, Audit 2026-10-13 T01). Die Erstattung wird hier als positiver
    // Betrag erfasst und dort als Einnahme gezählt. Namen nur gemeinsam mit euer.js ändern.
    _kategorien: ['Versand', 'Verpackung', 'Plattformgebühren', 'Fahrtkosten', 'Büro', 'Equipment', 'Software/Abos', 'Honorare an Künstler/Publizisten', 'Bewirtung', 'Geschenke an Geschäftsfreunde', 'Gewerbesteuer', 'Sonstiges', 'Umsatzsteuer an Finanzamt', 'Umsatzsteuer-Erstattung vom Finanzamt'],

    // ── Nicht (voll) abziehbare Betriebsausgaben (Steuer-Audit 2026-10-18, E-07) ──────────────
    // Vorher zog die EÜR jede Ausgabe voll ab. Die EÜR liest _nichtAbziehbar() und nimmt den
    // Betrag aus dem Gewinn heraus; vorsteuer.js/euer.js lesen _vorsteuerGesperrt().
    //  - Bewirtung: 30 % nicht abziehbar (§4 Abs. 5 S. 1 Nr. 2 EStG), Vorsteuer voll (§15 Abs. 1a S. 2 UStG)
    //  - Geschenke: über der Grenze je Empfänger und Wirtschaftsjahr ganz nicht abziehbar (§4 Abs. 5
    //    S. 1 Nr. 1 EStG), dann auch keine Vorsteuer (§15 Abs. 1a S. 1 UStG). Gemessen netto, wenn
    //    Vorsteuerabzug besteht, sonst brutto (R 4.10 Abs. 3 EStR).
    //  - Gewerbesteuer: keine Betriebsausgabe (§4 Abs. 5b EStG)
    KAT_BEWIRTUNG: 'Bewirtung',
    KAT_GESCHENKE: 'Geschenke an Geschäftsfreunde',
    KAT_GEWST: 'Gewerbesteuer',

    // Jahresfunktionen (CLAUDE.md Regel 7): Geschenkgrenze 35 € bis 2023, 50 € ab 2024
    // (Wachstumschancengesetz); Bewirtung 70 % abziehbar seit 2004.
    // Leer/0 → undefined (kein Feld), 1–100 → Zahl, sonst null (ungültig)
    _leseProzent(id) {
        const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
        const raw = el ? String(el.value || '').trim().replace(',', '.') : '';
        if (!raw) return undefined;
        const v = parseFloat(raw);
        if (isNaN(v) || v < 0 || v > 100) return null;
        return v === 0 ? undefined : v;
    },

    _geschenkGrenze(year) { return (parseInt(year, 10) || 0) >= 2024 ? 50 : 35; },
    _bewirtungAbziehbar(year) { return 0.7; },

    // Privatanteil in % (z. B. Telefon, Pkw nach Fahrtenbuchmethode; Entscheidung User 2026-10-23).
    // Der private Teil ist keine Betriebsausgabe (§4 Abs. 4, §12 Nr. 1 EStG) und berechtigt nicht
    // zum Vorsteuerabzug (§15 Abs. 1 S. 1 Nr. 1 UStG, nur für das Unternehmen bezogen).
    _privatQuote(e) {
        const p = parseFloat(e && e.privatAnteil);
        return isNaN(p) ? 0 : Math.min(100, Math.max(0, p)) / 100;
    },
    _privatBetrag(e) { return (parseFloat(e && e.betrag) || 0) * this._privatQuote(e); },
    _betrieblich(e) { return (parseFloat(e && e.betrag) || 0) - this._privatBetrag(e); },
    // Anteil der Vorsteuer, der abziehbar bleibt (0 bei Geschenk über der Grenze)
    _vstFaktor(e, alle) { return this._vorsteuerGesperrt(e, alle) ? 0 : 1 - this._privatQuote(e); },

    _hatVstAbzug(e) {
        const r = parseFloat(this._normUstSatz(e.ustSatz != null && e.ustSatz !== '' ? e.ustSatz : e.steuersatz));
        if (isNaN(r) || r <= 0) return false;
        if (typeof SteuerStatus === 'undefined') return (Store.getSettings ? Store.getSettings() : {}).ustMode === 'regel';
        return SteuerStatus.istRegel(e, Store.getSettings ? Store.getSettings() : {});
    },
    _bemessung(e) {
        const b = this._betrieblich(e);
        if (!this._hatVstAbzug(e)) return b;
        const r = parseFloat(this._normUstSatz(e.ustSatz != null && e.ustSatz !== '' ? e.ustSatz : e.steuersatz));
        return b / (1 + r / 100);
    },
    // Ohne Empfänger zählt das Geschenk für sich allein (Altdaten; das Formular verlangt ihn).
    _geschenkKey(e) {
        const n = String(e.empfaenger || '').trim().toLowerCase().replace(/\s+/g, ' ');
        return n ? 'n:' + n : 'id:' + e.id;
    },
    _geschenkUeberGrenze(e, alle) {
        if (!e || e.kategorie !== this.KAT_GESCHENKE) return false;
        const jahr = String(e.datum || '').slice(0, 4);
        const key = this._geschenkKey(e);
        const liste = alle || (Store.getExpenses ? Store.getExpenses() : []);
        const summe = liste.filter(x => x.kategorie === this.KAT_GESCHENKE && !x.storniert
                && String(x.datum || '').slice(0, 4) === jahr && this._geschenkKey(x) === key)
            .reduce((s, x) => s + this._bemessung(x), 0);
        return summe > this._geschenkGrenze(jahr) + 1e-9;
    },
    _vorsteuerGesperrt(e, alle) { return this._geschenkUeberGrenze(e, alle); },
    // Nicht abziehbarer Teil des abgeflossenen Betrags (inkl. einer nicht abziehbaren Vorsteuer).
    _nichtAbziehbar(e, alle) {
        if (!e) return 0;
        const b = this._betrieblich(e);   // der Privatanteil wird gesondert abgezogen
        if (e.kategorie === this.KAT_GEWST) return b;
        if (e.kategorie === this.KAT_BEWIRTUNG) return this._bemessung(e) * (1 - this._bewirtungAbziehbar(String(e.datum || '').slice(0, 4)));
        if (this._geschenkUeberGrenze(e, alle)) return b;
        return 0;
    },

    // Künstlersozialabgabe (§24-§28 KSVG): Unternehmer, die nicht nur gelegentlich Aufträge an
    // freie Künstler/Publizisten vergeben (Grafik/Foto/Text für eigene Werbung, §24 Abs.2 KSVG),
    // sind abgabepflichtig. Bagatellgrenze ist eine FREIGRENZE (§24 Abs.2 Satz 2 KSVG) — bei
    // Überschreiten im Kalenderjahr wird die GESAMTE Jahressumme abgabepflichtig, nicht nur der
    // übersteigende Teil.
    _KSA_KATEGORIE: 'Honorare an Künstler/Publizisten',

    // Abgabesatz UND Freigrenze sind jahresabhängig — beide waren bis 2026-08-11 als feste
    // Konstante verdrahtet, obwohl _ksaJahressumme(year) für ein beliebiges Jahr rechnet. Folge:
    // 2025er-Honorare wurden mit den 2026er-Werten bewertet (ein Nutzer mit 850 € Honoraren in
    // 2025 galt als nicht abgabepflichtig, obwohl er über der damaligen 700-€-Grenze lag), und
    // zum 1.1.2027 wäre der Satz still zu niedrig geblieben. Muster übernommen von
    // App._getUstGrenzen (js/app.js) — dort wird die Jahresabhängigkeit seit je richtig gemacht.
    //
    //   Abgabesatz (Künstlersozialabgabe-Verordnung, jährlich neu):
    //     2027      → 5,0 %   (KSA-VO 2027, BMAS Juli 2026)
    //     2026      → 4,9 %   (einmalige Absenkung)
    //     bis 2025  → 5,0 %   (Niveau 2023-2025)
    //   Freigrenze (§24 Abs.2 Satz 2 KSVG, geändert durch Art. 56 Nr. 1 BEG IV):
    //     ab 2026   → 1.000 €
    //     2025      →   700 € (Übergangsregelung "abweichend von §24 Abs.2 Satz 2")
    //     bis 2024  →   450 €
    //
    // Beim Jahreswechsel 2027/2028 muss der dann veröffentlichte Satz hier ergänzt werden; ohne
    // neuen Eintrag rechnet Stackr mit dem letzten bekannten Wert weiter (5,0 %) — bewusst so,
    // ein zu hoher geschätzter Satz ist besser als eine stille Unterzahlung.
    _getKsaWerte(year) {
        const y = parseInt(year) || new Date().getFullYear();
        const satz      = (y === 2026) ? 0.049 : 0.050;
        const bagatelle = (y >= 2026) ? 1000 : (y === 2025 ? 700 : 450);
        return { satz, bagatelle, satzText: (satz * 100).toLocaleString('de-DE', { minimumFractionDigits: 1 }) + '%' };
    },

    // Bemessungsgrundlage der KSA ist das Entgelt OHNE gesondert ausgewiesene Umsatzsteuer
    // (§25 Abs. 2 KSVG). Bis zum Steuer-Audit 2026-10-18 (E-03) wurde der Bruttobetrag summiert:
    // 1.190 € brutto (1.000 € netto) rissen die 1.000-€-Freigrenze und lösten 58,31 € KSA aus.
    // Ohne ausgewiesenen Satz (Kleinunternehmer-Künstler, Reverse Charge, unklar) zählt der Betrag.
    _ksaNetto(betrag, ustSatz) {
        const b = parseFloat(betrag) || 0;
        const r = this._normUstSatz(ustSatz);
        return (typeof r === 'number' && r > 0) ? b / (1 + r / 100) : b;
    },

    _ksaJahressumme(year) {
        return Store.getExpenses().filter(e => e.kategorie === this._KSA_KATEGORIE && (e.datum || '').startsWith(String(year)))
            .reduce((s, e) => s + this._ksaNetto(e.betrag, e.ustSatz !== undefined ? e.ustSatz : e.steuersatz), 0);
    },

    // USt-Satz einer Ausgabe: 19 | 7 | 0 | 'rc' (Reverse Charge) | 'unklar' (nicht klassifiziert).
    // Altbestand vor diesem Feld (2026-07-30) hat gar kein ustSatz-Feld gespeichert — MUSS als
    // 'unklar' gelesen werden, NIE automatisch als 19% (sonst droht ein unbelegter Vorsteuerabzug,
    // s. js/vorsteuer.js). Diese Normalisierung ist die einzige Quelle der Wahrheit dafür.
    _normUstSatz(v) {
        if (v === undefined || v === null || v === '') return 'unklar';
        if (v === 'rc' || v === 'unklar') return v;
        const n = parseFloat(v);
        return isNaN(n) ? 'unklar' : n;
    },

    _ustSatzOptions(selected) {
        const sel = this._normUstSatz(selected);
        const opts = [
            ['unklar', 'Unklar / nicht klassifiziert'],
            [19, '19% (Regelsteuersatz)'],
            [7, '7% (ermäßigt)'],
            [0, '0% (steuerfrei / nicht steuerbar)'],
            ['rc', 'Reverse Charge (§13b UStG)']
        ];
        return opts.map(([v, label]) =>
            `<option value="${v}" ${sel === v ? 'selected' : ''}>${label}</option>`
        ).join('');
    },

    // ── Belegerkennung im Ausgaben-Formular ─────────────────────────────────────────
    // Motor: js/beleg-ocr-ui.js (Engine, Worker, PDF-Textschicht). Heuristik:
    // js/beleg-ocr.js. Hier steht nur, welcher Treffer in welches Feld darf.
    //
    // Nichts wird automatisch eingetragen. Das ist keine Vorsicht um ihrer selbst willen:
    // ein falsch vorbefuellter USt-Satz landet ueber js/vorsteuer.js direkt im
    // Vorsteuerabzug, und ein zu hoch gelesener Betrag zieht ihn mit nach oben. Beide
    // Fehler gehen in dieselbe Richtung — zu hohe Erstattung — und fallen beim
    // Gegenlesen des Formulars nicht auf.
    _ocrDatei: null,
    _ocrLaeuft: false,

    _ocrStatus(text, prozent) {
        const el = document.getElementById('expOcrStatus');
        if (!el) return;
        if (!text) { el.style.display = 'none'; el.innerHTML = ''; return; }
        el.style.display = 'block';
        el.innerHTML = BelegOcrUi.statusHtml(text, prozent);
    },

    _ocrChipsSetzen(treffer) {
        const setze = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };
        const t = treffer || {};
        const AKTION = 'exp-ocr-uebernehmen';

        setze('expOcrChipDatum', t.datum
            ? BelegOcrUi.chipHtml('exp_datum', Utils.formatDate(t.datum.wert), t.datum.wert, t.datum.roh, null, AKTION) : '');

        setze('expOcrChipBetrag', t.betrag
            ? BelegOcrUi.chipHtml('exp_betrag', Utils.formatCurrency(t.betrag.wert), t.betrag.wert.toFixed(2),
                t.betrag.korrigiertVon || t.betrag.roh,
                t.betrag.korrigiertVon
                    ? `korrigiert auf ${t.betrag.roh} — dieser Betrag steht mehrfach auf dem Beleg`
                    : null, AKTION) : '');

        setze('expOcrChipLieferant', t.haendler
            ? BelegOcrUi.chipHtml('exp_lieferant', t.haendler.wert, t.haendler.wert, t.haendler.roh, null, AKTION) : '');

        // USt-Satz: nur anbieten, wenn das Auswahlfeld diesen Satz ueberhaupt kennt. Ein
        // Beleg aus einem frueheren Jahr kann 16 % tragen — ein select.value, fuer den es
        // keine Option gibt, faellt stillschweigend auf leer zurueck, und der Chip taete
        // scheinbar nichts. Bewusst gegen die Optionen geprueft und nicht gegen eine Liste
        // gueltiger Saetze im Code (Regel 7: Gesetzeswerte gehoeren nicht als Konstante her).
        let ustHtml = '';
        if (t.ustSatz) {
            const sel = document.getElementById('exp_ustSatz');
            const kennt = sel && Array.prototype.some.call(sel.options,
                o => parseFloat(o.value) === t.ustSatz.wert);
            if (kennt) {
                // Der Steuerbetrag bekommt keinen eigenen Chip — das Formular speichert ihn
                // nicht, es speichert den Satz. Er steht als Hinweis daneben, damit der
                // Nutzer den Satz gegen die Zahl auf dem Beleg pruefen kann.
                const hinweis = t.ustBetrag
                    ? (t.ustBetrag.berechnet
                        ? `Steueranteil ${Utils.formatCurrency(t.ustBetrag.wert)} — aus Betrag und Satz gerechnet`
                        : `Steueranteil ${Utils.formatCurrency(t.ustBetrag.wert)} — so auf dem Beleg`)
                    : null;
                ustHtml = BelegOcrUi.chipHtml('exp_ustSatz', t.ustSatz.wert + ' %', String(t.ustSatz.wert),
                    t.ustSatz.roh, hinweis, AKTION);
            }
        }
        setze('expOcrChipUst', ustHtml);
    },

    _ocrChipsLeeren() { this._ocrChipsSetzen({}); },

    async _ocrStarten() {
        if (!this._ocrDatei || this._ocrLaeuft) return;
        this._ocrLaeuft = true;
        // Die Datei wird festgehalten: ein Lauf dauert Sekunden, und das Dateifeld bleibt
        // bedienbar. Wer mittendrin eine andere waehlt, bekaeme sonst die Vorschlaege der
        // alten ueber den Feldern.
        const datei = this._ocrDatei;
        const btn = document.getElementById('expOcrStart');
        if (btn) btn.disabled = true;
        try {
            const treffer = await BelegOcrUi.lese(datei, (txt, p) => this._ocrStatus(txt, p));
            if (this._ocrDatei !== datei) {
                this._ocrStatus('Es wurde ein anderer Beleg gewaehlt — bitte erneut auslesen.', null);
                return;
            }
            this._ocrChipsSetzen(treffer);
            const felder = ['datum', 'betrag', 'haendler', 'ustSatz'];
            const anzahl = felder.filter(k => treffer[k]).length;
            this._ocrStatus(anzahl
                ? `${anzahl} von ${felder.length} Feldern erkannt — Vorschlag anklicken, um ihn zu übernehmen.`
                : 'Nichts Verwertbares erkannt. Bitte von Hand eintragen.', null);
        } catch (err) {
            console.warn('[Ausgaben] Belegerkennung fehlgeschlagen:', err);
            this._ocrChipsLeeren();
            // Ein PDF ohne Textschicht ist kein Ausfall, sondern eine Eigenschaft der Datei —
            // und der Nutzer kann etwas dagegen tun. Deshalb die Meldung aus lese() woertlich.
            const istPdfHinweis = err && /Scan|Textschicht|auslesbaren Text/i.test(err.message || '');
            this._ocrStatus(istPdfHinweis
                ? err.message
                : 'Belegerkennung nicht möglich. Die Felder lassen sich wie gewohnt von Hand ausfüllen.', null);
        } finally {
            this._ocrLaeuft = false;
            if (btn) btn.disabled = !this._ocrDatei;
        }
    },

    _bindOcr() {
        const file = document.getElementById('expOcrFile');
        const start = document.getElementById('expOcrStart');
        if (!file || !start) return;
        this._ocrDatei = null;
        this._ocrChipsLeeren();
        this._ocrStatus('', null);

        file.addEventListener('change', () => {
            this._ocrDatei = (file.files && file.files[0]) || null;
            // Vorschlaege gehoeren zu genau der Datei, aus der sie stammen. Wer eine zweite
            // waehlt, saehe sonst weiter die Chips der ersten — und ein Klick darauf traegt
            // Datum und Betrag des falschen Belegs ein.
            this._ocrChipsLeeren();
            start.disabled = !this._ocrDatei || this._ocrLaeuft;
            this._ocrStatus(this._ocrDatei ? 'Bereit — auf „Beleg auslesen“ klicken.' : '', null);
        });
        start.addEventListener('click', () => this._ocrStarten());

        if (typeof Actions !== 'undefined' && Actions.register) {
            Actions.register({
                'exp-ocr-uebernehmen': function () {
                    // `this` ist der Chip-Button; Ziel und Wert haengen als data-Attribute dran.
                    BelegOcrUi.uebernehmen(this.getAttribute('data-ziel'), this.getAttribute('data-wert'));
                }
            });
        }
    },

    _ustSatzBadge(v) {
        const norm = this._normUstSatz(v);
        if (norm === 'unklar') return `<span class="badge badge-warning" title="USt-Satz nicht klassifiziert — kein automatischer Vorsteuerabzug, bitte nachpflegen">USt: unklar</span>`;
        if (norm === 'rc') return `<span class="badge badge-neutral" title="Reverse Charge §13b UStG">RC</span>`;
        return `<span class="badge badge-neutral" title="USt-Satz">${norm}%</span>`;
    },

    render() {
        const activeExpenses = Store.getExpenses();      // nur aktive (für Totals/Breakdown)
        const expenses = Store.getExpenses(true);        // inkl. stornierte (für Tabellenansicht)
        const f = this;

        // Summary — nur aktive Ausgaben zählen
        const totalExpenses = activeExpenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const catBreakdown = {};
        this._kategorien.forEach(k => catBreakdown[k] = 0);
        activeExpenses.forEach(e => {
            const cat = e.kategorie || 'Sonstiges';
            catBreakdown[cat] = (catBreakdown[cat] || 0) + (parseFloat(e.betrag) || 0);
        });

        // Filter
        let filtered = [...expenses];
        if (f._filterKategorie) filtered = filtered.filter(e => e.kategorie === f._filterKategorie);
        if (f._filterVon) filtered = filtered.filter(e => e.datum >= f._filterVon);
        if (f._filterBis) filtered = filtered.filter(e => e.datum <= f._filterBis);
        filtered.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const katOptions = this._kategorien.map(k =>
            `<option value="${Utils.escapeHtml(k)}">${Utils.escapeHtml(k)}</option>`
        ).join('');

        // Summary cards - top categories
        const topCats = Object.entries(catBreakdown).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
        let summaryCards = `
            <div class="card stat-card danger">
                <div class="card-label">Gesamtausgaben</div>
                <div class="card-value">${Utils.formatCurrency(totalExpenses)}</div>
                <div class="card-subtitle">${expenses.length} Posten</div>
            </div>
        `;
        topCats.forEach(([cat, val]) => {
            summaryCards += `
                <div class="card stat-card">
                    <div class="card-label">${Utils.escapeHtml(cat)}</div>
                    <div class="card-value">${Utils.formatCurrency(val)}</div>
                    <div class="card-subtitle">${((val / totalExpenses) * 100).toFixed(1)}% der Ausgaben</div>
                </div>
            `;
        });

        const ksaJahr = new Date().getFullYear();
        const ksaSumme = this._ksaJahressumme(ksaJahr);
        const ksaWerte = this._getKsaWerte(ksaJahr);
        const ksaPflichtig = ksaSumme > ksaWerte.bagatelle;
        if (ksaSumme > 0) {
            summaryCards += `
                <div class="card stat-card ${ksaPflichtig ? 'danger' : ''}">
                    <div class="card-label">Künstlersozialabgabe ${ksaJahr}</div>
                    <div class="card-value">${ksaPflichtig ? Utils.formatCurrency(ksaSumme * ksaWerte.satz) : Utils.formatCurrency(0)}</div>
                    <div class="card-subtitle">${ksaPflichtig
                        ? `Freigrenze überschritten (${Utils.formatCurrency(ksaSumme)} Honorare, ${ksaWerte.satzText})`
                        : `${Utils.formatCurrency(ksaSumme)} von ${Utils.formatCurrency(ksaWerte.bagatelle)} Freigrenze`}</div>
                    ${ksaPflichtig ? '' : `<div class="card-subtitle" style="margin-top:6px;color:var(--text-muted);">
                        Gilt für den Regelfall. <strong>Nicht</strong> für „typische Verwerter" nach §24 Abs.1 KSVG
                        (Verlage, Werbeagenturen, Theater, Galerien u.ä.) — die sind ab dem ersten Euro
                        abgabepflichtig, ohne Freigrenze.</div>`}
                </div>
            `;
        }

        let rows = '';
        if (filtered.length === 0) {
            // "vorhanden/gefunden" liest sich fuer den Erstnutzer wie eine fehlgeschlagene
            // Suche - er sucht den Fehler bei sich. Leerer Datenbestand und leeres
            // Filterergebnis brauchen deshalb verschiedene Texte, und der leere Bestand
            // einen Hinweis auf den naechsten Schritt statt einer Sackgasse.
            const gefiltert = !!(f._filterKategorie || f._filterVon || f._filterBis);
            rows = gefiltert
                ? '<tr><td colspan="6" class="table-empty">Keine Ausgabe passt zu diesem Filter.</td></tr>'
                : '<tr><td colspan="6" class="table-empty">Noch keine Ausgaben erfasst — trag die erste oben im Formular „Neue Ausgabe“ ein.</td></tr>';
        } else {
            rows = filtered.map(e => `
                <tr${e.storniert ? ' class="row-storniert"' : ''}>
                    <td>${Utils.formatDate(e.datum)}</td>
                    <td><span class="badge badge-info">${Utils.escapeHtml(e.kategorie || '')}</span> <span class="badge badge-neutral" title="SKR03-Konto (DATEV)" style="font-family:monospace;">${typeof DatevExport !== 'undefined' ? DatevExport.kontoForKategorie(e.kategorie, 'SKR03') : ''}</span> ${this._ustSatzBadge(e.ustSatz)}</td>
                    <td>${Utils.escapeHtml(e.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(e.betrag)}</td>
                    <td>${Utils.escapeHtml(e.belegNr || '')}</td>
                    <td class="table-actions">
                        ${e.storniert
                            ? `<span class="badge badge-neutral" title="${Utils.escapeHtml(e.stornoGrund || 'Storniert')}">Storniert</span>`
                            : !Store.canEdit(e)
                                ? `<span class="badge badge-warning" title="Periode festgeschrieben — nur Storno möglich" style="margin-right:4px;"><i class="ti ti-lock"></i></span>
                                   <button class="btn btn-small btn-danger" data-storno-expense="${e.id}">Stornieren</button>`
                                : `<button class="btn btn-small" data-edit-expense="${e.id}">Bearbeiten</button>
                                   <button class="btn btn-small btn-danger" data-delete-expense="${e.id}" title="In offener Periode löschen (wird protokolliert)">Löschen</button>`
                        }
                    </td>
                </tr>
            `).join('');
        }

        return `
            <div class="page-header">
                <h2>Ausgaben</h2>
                <div class="page-header-actions no-print">
                    <button class="btn" id="expenseExportCSV">CSV Export</button>
                </div>
            </div>

            <div class="stats-grid">${summaryCards}</div>

            <div class="info-box" style="margin-bottom:16px;padding:12px 16px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">Betriebsausgaben vs. Wareneinkauf</strong><br>
                Hier erfasst du <strong>Betriebsausgaben</strong> (z.B. Versandmaterial, Software, Büro, Fahrtkosten).
                <strong>Wareneinkauf</strong> (Artikel, die du weiterverkaufst) wird unter
                <a href="#" data-action="navigate" data-args=\'["buchungen"]\' style="color:var(--info);">Buchungen → Einkauf</a> erfasst
                und fließt automatisch in die EÜR ein.
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header">
                    <div class="card-title">Neue Ausgabe</div>
                </div>
                <form id="expenseForm">
                    <!-- Belegerkennung. Motor in js/beleg-ocr-ui.js, Heuristik in js/beleg-ocr.js.
                         Steht hier seit dem 2026-09-21: der Vorsteuerabzug haengt an den Ausgaben,
                         nicht an den Eigenbelegen — und genau dorthin gehoeren USt-Satz und
                         USt-Betrag aus dem Beleg (Kriterium 2.1 des Anforderungsprofils,
                         plan/pruefliste-buchhaltung-2026-09-21.md). -->
                    <div class="card" style="padding:14px 16px;margin-bottom:14px;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:var(--radius);">
                        <div style="font-weight:600;font-size:13px;margin-bottom:4px;">
                            <i class="ti ti-scan"></i> Beleg auslesen
                            <span style="font-weight:400;color:var(--text-muted);font-size:12px;">– optional</span>
                        </div>
                        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">
                            Foto, Scan oder PDF des Belegs auswählen. Die Erkennung läuft vollständig auf diesem Gerät —
                            <strong>die Datei wird nicht hochgeladen</strong>. Bei einem PDF mit Textschicht geht es sofort;
                            bei Bildern lädt der erste Lauf einmalig die Erkennungsdateien und dauert deshalb länger.
                            Erkannte Werte werden <em>nie</em> automatisch eingetragen — sie stehen als Vorschlag über dem Feld.
                        </div>
                        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                            <input type="file" accept="image/*,application/pdf,.pdf" id="expOcrFile" style="font-size:12px;max-width:100%;">
                            <button type="button" class="btn btn-secondary btn-sm" id="expOcrStart" disabled>
                                <i class="ti ti-scan"></i> Beleg auslesen
                            </button>
                        </div>
                        <div id="expOcrStatus" style="display:none;margin-top:10px;"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <div id="expOcrChipDatum"></div>
                            <input type="date" class="form-input" id="exp_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategorie</label>
                            <select class="form-select" id="exp_kategorie">${katOptions}</select>
                            <div id="exp_ustZeitraumWrap" style="display:none;margin-top:6px;">
                                <label class="form-label" for="exp_ustZeitraum">Für Voranmeldungszeitraum</label>
                                <input type="text" class="form-input" id="exp_ustZeitraum" maxlength="7" placeholder="z. B. 2025-12 oder 2025-Q4">
                                <div class="form-hint">Wichtig für die Zehn-Tage-Regel (§11 Abs. 2 EStG): Die Zahlung für Dezember/Q4 bis zum 10.01. zählt ins Vorjahr.</div>
                            </div>
                            <div id="exp_empfaengerWrap" style="display:none;margin-top:6px;">
                                <label class="form-label" for="exp_empfaenger">Empfänger des Geschenks *</label>
                                <input type="text" class="form-input" id="exp_empfaenger" maxlength="200" placeholder="Name des Beschenkten">
                                <div class="form-hint">Pflicht nach §4 Abs. 7 EStG. Über 50 € je Empfänger und Jahr ist das Geschenk nicht abziehbar (auch keine Vorsteuer).</div>
                            </div>
                            <div id="exp_fahrtHint" style="display:none;margin-top:6px;padding:7px 10px;background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-sm);font-size:12px;color:var(--warning);">
                                Fahrten mit <strong>Kilometerpauschale</strong> übernimmt das Fahrtenbuch automatisch in die EÜR — dafür hier nichts eintragen. Belege hier erfassen, wenn die Fahrt im Fahrtenbuch mit „tatsächlichen Kosten“ steht oder gar nicht dort erfasst ist (z. B. Tankquittung, Taxi).
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Betrag</label>
                            <div id="expOcrChipBetrag"></div>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="exp_betrag" placeholder="0,00">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">USt-Satz *</label>
                            <div id="expOcrChipUst"></div>
                            <select class="form-select" id="exp_ustSatz">${this._ustSatzOptions('unklar')}</select>
                            <div class="form-hint" style="font-size:12px;color:var(--text-muted);">
                                Bestimmt den Vorsteuerabzug (Vorsteuer-Übersicht). „Unklar" = kein automatischer Abzug, bis nachgepflegt — wird NIE automatisch als 19% behandelt.
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="exp_privatAnteil">Privatanteil in %</label>
                            <input type="number" class="form-input" id="exp_privatAnteil" min="0" max="100" step="1" placeholder="0">
                            <div class="form-hint" style="font-size:12px;color:var(--text-muted);">Z. B. Telefon oder Pkw (Fahrtenbuch). Der private Teil zählt nicht als Betriebsausgabe und nicht zur Vorsteuer.</div>
                        </div>
                    </div>
                    <div id="exp_ksaHint" style="display:none;margin-bottom:12px;padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;line-height:1.6;"></div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Beschreibung</label>
                            <input type="text" class="form-input" id="exp_beschreibung" maxlength="300" placeholder="Was wurde bezahlt?">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beleg-Nr. (optional)</label>
                            <input type="text" class="form-input" id="exp_belegNr" maxlength="100" placeholder="z.B. RE-2026-001">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Lieferant / Aussteller</label>
                            <div id="expOcrChipLieferant"></div>
                            <input type="text" class="form-input" id="exp_lieferant" maxlength="200" placeholder="Name des Rechnungsausstellers">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Steuernr. / USt-IdNr. Lieferant</label>
                            <input type="text" class="form-input" id="exp_lieferantSteuerId" maxlength="50" placeholder="nur bei Rechnung >250€ Pflicht">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beleg-Foto/Scan (empfohlen, §14 UStG)</label>
                        <input type="file" accept="image/*" class="form-input" id="exp_belegFoto">
                        <div class="form-hint" style="font-size:12px;color:var(--text-muted);">
                            Für den Vorsteuerabzug musst du eine ordnungsgemäße Rechnung <em>besitzen</em> — hier hinterlegen macht das prüfbar.
                        </div>
                    </div>
                    <div id="expMatLagerSection" style="display:none;border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-bottom:12px;background:var(--info-bg);">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <input type="checkbox" id="exp_matToggle" style="width:16px;height:16px;">
                            <label for="exp_matToggle" style="font-size:13px;font-weight:600;color:var(--info);cursor:pointer;">
                                Als Materiallager erfassen (Mengen tracken)
                            </label>
                        </div>
                        <div id="expMatDetail" style="display:none;">
                            <div class="form-row" style="margin-top:8px;">
                                <div class="form-group" style="flex:2">
                                    <label class="form-label">Materialart</label>
                                    <select class="form-select" id="exp_matArt">
                                        <option value="">– Manuell –</option>
                                        ${Store.getMaterialBestand().map(m =>
                                            `<option value="${m.id}">${Utils.escapeHtml(m.name)}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Menge (Stück)</label>
                                    <input type="number" step="1" min="1" max="9999999" class="form-input" id="exp_matMenge" placeholder="50">
                                </div>
                            </div>
                            <div class="form-hint" style="font-size:12px;color:var(--text-muted);">
                                Der Einkauf wird im Materiallager eingebucht. Bestand und gleitender Durchschnittspreis werden aktualisiert.
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Ausgabe speichern</button>
                    </div>
                </form>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Kategorie</label>
                    <select class="form-select" id="expFilterKat">
                        <option value="">Alle</option>
                        ${this._kategorien.map(k => `<option value="${Utils.escapeHtml(k)}" ${f._filterKategorie === k ? 'selected' : ''}>${Utils.escapeHtml(k)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Von</label>
                    <input type="date" class="form-input" id="expFilterVon" value="${f._filterVon}">
                </div>
                <div class="filter-group">
                    <label>Bis</label>
                    <input type="date" class="form-input" id="expFilterBis" value="${f._filterBis}">
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Kategorie</th>
                            <th>Beschreibung</th>
                            <th style="text-align:right">Betrag</th>
                            <th>Beleg-Nr.</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        // Show/hide material section based on category
        const katSel = document.getElementById('exp_kategorie');
        const matSection = document.getElementById('expMatLagerSection');
        const matToggle = document.getElementById('exp_matToggle');
        const matDetail = document.getElementById('expMatDetail');

        // Zeitraumfeld nur bei USt-Zahlungen an das Finanzamt (R-TAX-08)
        const ustZrWrap = document.getElementById('exp_ustZeitraumWrap');
        const empfWrap = document.getElementById('exp_empfaengerWrap');
        const updateUstZeitraum = () => {
            if (ustZrWrap) ustZrWrap.style.display = katSel && katSel.value === 'Umsatzsteuer an Finanzamt' ? '' : 'none';
            if (empfWrap) empfWrap.style.display = katSel && katSel.value === this.KAT_GESCHENKE ? '' : 'none';
        };
        if (katSel) katSel.addEventListener('change', updateUstZeitraum);
        updateUstZeitraum();

        const updateMatSection = () => {
            if (!matSection) return;
            const isVerpackung = katSel && (katSel.value === 'Verpackung' || katSel.value === 'Verpackung / Versandmaterial');
            matSection.style.display = isVerpackung ? '' : 'none';
            if (!isVerpackung && matToggle) matToggle.checked = false;
            // Fahrtkosten warning
            const fahrtHint = document.getElementById('exp_fahrtHint');
            if (fahrtHint) fahrtHint.style.display = (katSel && katSel.value === 'Fahrtkosten') ? '' : 'none';
        };
        if (katSel) { katSel.addEventListener('change', updateMatSection); updateMatSection(); }
        if (matToggle) matToggle.addEventListener('change', () => {
            if (matDetail) matDetail.style.display = matToggle.checked ? '' : 'none';
        });

        // KSA-Hinweis (Künstlersozialabgabe): live bei Kategorie-/Betrag-/Datumsänderung
        const ksaHint = document.getElementById('exp_ksaHint');
        const updateKsaHint = () => {
            if (!ksaHint) return;
            const isKsa = katSel && katSel.value === this._KSA_KATEGORIE;
            ksaHint.style.display = isKsa ? '' : 'none';
            if (!isKsa) return;
            const year = (Utils.getDateInputValue('exp_datum') || Utils.todayISO()).slice(0, 4);
            const neuerBetrag = this._ksaNetto(document.getElementById('exp_betrag')?.value, document.getElementById('exp_ustSatz')?.value);
            const jahressumme = this._ksaJahressumme(year) + neuerBetrag;
            const kw = this._getKsaWerte(year);
            const ueberGrenze = jahressumme > kw.bagatelle;
            ksaHint.style.background = ueberGrenze ? 'var(--danger-bg)' : 'var(--info-bg)';
            ksaHint.style.border = `1px solid var(${ueberGrenze ? '--danger' : '--info'})`;
            ksaHint.style.color = `var(${ueberGrenze ? '--danger' : '--info'})`;
            ksaHint.innerHTML = ueberGrenze
                ? `Jahressumme ${year} inkl. dieser Ausgabe (netto): <strong>${Utils.formatCurrency(jahressumme)}</strong> — übersteigt die ${Utils.formatCurrency(kw.bagatelle)}-Freigrenze (§24 Abs.2 Satz 2 KSVG). Dann ist die <strong>gesamte</strong> Jahressumme künstlersozialabgabepflichtig, nicht nur der übersteigende Teil. Voraussichtliche KSA: <strong>${Utils.formatCurrency(jahressumme * kw.satz)}</strong> (${kw.satzText} für ${year}), zusätzlich zum Honorar an die Künstlersozialkasse zu melden und zu zahlen.`
                : `Jahressumme ${year} inkl. dieser Ausgabe (netto): <strong>${Utils.formatCurrency(jahressumme)}</strong> von ${Utils.formatCurrency(kw.bagatelle)} Freigrenze (§24 Abs.2 Satz 2 KSVG). Bemessungsgrundlage ist der Nettobetrag ohne USt. Betrifft nur Leistungen mit gestalterischem/kreativem Charakter (§25 KSVG), z.B. Grafik, Foto, Text — reine technische Ausführung ohne kreativen Spielraum fällt idR nicht darunter. <strong>Ausnahme:</strong> Als „typischer Verwerter" nach §24 Abs.1 KSVG (Verlag, Werbeagentur, Theater, Galerie u.ä.) gilt die Freigrenze für dich <strong>nicht</strong> — dann besteht die Abgabepflicht ab dem ersten Euro.`;
        };
        if (katSel) katSel.addEventListener('change', updateKsaHint);
        const betragInput = document.getElementById('exp_betrag');
        if (betragInput) betragInput.addEventListener('input', updateKsaHint);
        const datumInput = document.getElementById('exp_datum');
        if (datumInput) datumInput.addEventListener('change', updateKsaHint);
        updateKsaHint();

        this._bindOcr();

        // Form submit
        document.getElementById('expenseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const datum = Utils.getDateInputValue('exp_datum');
            const betrag = parseFloat(document.getElementById('exp_betrag').value) || 0;
            if (!Number.isFinite(betrag) || betrag < 0 || betrag > 99999999) {
                Utils.showToast('Betrag ungültig', 'error');
                return;
            }
            if (this._leseProzent('exp_privatAnteil') === null) {
                Utils.showToast('Privatanteil bitte zwischen 0 und 100 % angeben', 'warning');
                return;
            }
            if (document.getElementById('exp_kategorie').value === this.KAT_GESCHENKE
                && !(document.getElementById('exp_empfaenger')?.value || '').trim()) {
                Utils.showToast('Bitte den Empfänger des Geschenks angeben (§4 Abs. 7 EStG)', 'warning');
                return;
            }
            const belegFotoFile = document.getElementById('exp_belegFoto')?.files?.[0];
            let belegFoto;
            if (belegFotoFile) {
                try { belegFoto = await Utils.sanitizeImageFile(belegFotoFile); }
                catch (err) { Utils.showToast(Utils.errorText(err, 'Beleg-Foto konnte nicht gelesen werden'), 'error'); return; }
            }
            // Rueckgabewert festhalten: traegt die vergebene id und verknuepft unten den
            // Materialeinkauf mit GENAU dieser Ausgabe. Ohne die Verknuepfung stuende der
            // Betrag zweimal in der EUER — einmal als Betriebsausgabe, einmal als
            // Materialeinkauf (s. Kommentar bei saveMaterialEinkauf weiter unten).
            const gespeicherteAusgabe = Store.saveExpense({
                datum,
                kategorie: document.getElementById('exp_kategorie').value,
                beschreibung: document.getElementById('exp_beschreibung').value.trim(),
                betrag,
                ustSatz: this._normUstSatz(document.getElementById('exp_ustSatz')?.value),
                belegNr: document.getElementById('exp_belegNr').value.trim(),
                lieferant: document.getElementById('exp_lieferant').value.trim(),
                lieferantSteuerId: document.getElementById('exp_lieferantSteuerId').value.trim(),
                // Zehn-Tage-Regel (R-TAX-08): Zeitraum und Dauerfristverlängerung zum Erfassungszeitpunkt
                ustZeitraum: (document.getElementById('exp_kategorie').value === 'Umsatzsteuer an Finanzamt'
                    && /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test((document.getElementById('exp_ustZeitraum')?.value || '').trim()))
                    ? document.getElementById('exp_ustZeitraum').value.trim() : undefined,
                ustDauerfrist: document.getElementById('exp_kategorie').value === 'Umsatzsteuer an Finanzamt'
                    ? !!Store.getSettings().ustDauerfristverlaengerung : undefined,
                empfaenger: document.getElementById('exp_kategorie').value === this.KAT_GESCHENKE
                    ? (document.getElementById('exp_empfaenger')?.value || '').trim() : undefined,
                privatAnteil: this._leseProzent('exp_privatAnteil'),
                belegFoto
            });

            // Optionally book to materiallager
            if (matToggle?.checked) {
                const matId = document.getElementById('exp_matArt')?.value;
                const menge = parseInt(document.getElementById('exp_matMenge')?.value) || 0;
                if (menge > 0 && Store.getMaterialBestand().length > 0) {
                    if (matId) {
                        const mat = Store.getMaterialBestand().find(m => m.id === matId);
                        if (mat) {
                            const kostenProEinheit = menge > 0 ? Math.round(betrag / menge * 1000) / 1000 : 0;
                            const altBestand = parseInt(mat.bestand) || 0;
                            const altKosten = parseFloat(mat.kostenProEinheit) || 0;
                            const neuerBestand = altBestand + menge;
                            mat.kostenProEinheit = neuerBestand > 0
                                ? Math.round(((altBestand * altKosten + menge * kostenProEinheit) / neuerBestand) * 1000) / 1000
                                : kostenProEinheit;
                            mat.bestand = neuerBestand;
                            Store.saveMaterialBestandItem(mat);
                            // ausgabeId verknuepft diesen Einkauf mit der Ausgabe von oben.
                            // Die EUER zieht Materialeinkaeufe als Betriebsausgabe ab
                            // (Abflussprinzip §4 Abs. 3 EStG) und MUSS die hier entstandenen
                            // ueberspringen — ihr Betrag steckt schon in den Betriebsausgaben.
                            // `lieferant: 'Ausgabe'` bleibt als Anzeigetext und als Rueckfall
                            // fuer Altdaten stehen, taugt aber nicht als Schluessel: der Text
                            // laesst sich im Materiallager frei eintippen.
                            Store.saveMaterialEinkauf({ datum, materialId: matId, materialName: mat.name, einheit: mat.einheit || 'Stück', menge, gesamtkosten: betrag, kostenProEinheit, lieferant: 'Ausgabe', ausgabeId: gespeicherteAusgabe && gespeicherteAusgabe.id });
                            Utils.showToast(`${menge} × ${Utils.escapeHtml(mat.name)} ins Materiallager eingebucht`, 'success');
                        }
                    }
                }
            }

            Utils.showToast('Ausgabe gespeichert', 'success');
            this._refresh();
        });

        // Filters
        const applyFilters = () => {
            this._filterKategorie = document.getElementById('expFilterKat').value;
            this._filterVon = document.getElementById('expFilterVon').value;
            this._filterBis = document.getElementById('expFilterBis').value;
            this._refresh();
        };
        ['expFilterKat', 'expFilterVon', 'expFilterBis'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilters);
        });

        // Edit
        document.querySelectorAll('[data-edit-expense]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.editExpense;
                const exp = Store.getExpenses().find(e => e.id === id);
                if (!exp) return;
                const katOpts = this._kategorien.map(k =>
                    `<option value="${Utils.escapeHtml(k)}" ${exp.kategorie === k ? 'selected' : ''}>${Utils.escapeHtml(k)}</option>`
                ).join('');
                const body = `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="ee_datum" value="${exp.datum || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategorie</label>
                            <select class="form-select" id="ee_kategorie">${katOpts}</select>
                        </div>
                    </div>
                    <div class="form-group" id="ee_empfaengerWrap" style="${exp.kategorie === this.KAT_GESCHENKE ? '' : 'display:none;'}">
                        <label class="form-label" for="ee_empfaenger">Empfänger des Geschenks *</label>
                        <input type="text" class="form-input" id="ee_empfaenger" maxlength="200" value="${Utils.escapeHtml(exp.empfaenger || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beschreibung</label>
                        <input type="text" class="form-input" id="ee_beschreibung" maxlength="300" value="${Utils.escapeHtml(exp.beschreibung || '')}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Betrag</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="ee_betrag" value="${exp.betrag || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beleg-Nr.</label>
                            <input type="text" class="form-input" id="ee_belegNr" maxlength="300" value="${Utils.escapeHtml(exp.belegNr || '')}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">USt-Satz *</label>
                            <select class="form-select" id="ee_ustSatz">${this._ustSatzOptions(exp.ustSatz)}</select>
                            <div class="form-hint" style="font-size:12px;color:var(--text-muted);">„Unklar" = kein automatischer Vorsteuerabzug, bis nachgepflegt.</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="ee_privatAnteil">Privatanteil in %</label>
                            <input type="number" class="form-input" id="ee_privatAnteil" min="0" max="100" step="1" value="${exp.privatAnteil || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Lieferant / Aussteller</label>
                            <input type="text" class="form-input" id="ee_lieferant" maxlength="200" value="${Utils.escapeHtml(exp.lieferant || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Steuernr. / USt-IdNr. Lieferant</label>
                            <input type="text" class="form-input" id="ee_lieferantSteuerId" maxlength="50" value="${Utils.escapeHtml(exp.lieferantSteuerId || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beleg-Foto/Scan ${exp.belegFoto ? '(vorhanden — Datei wählen zum Ersetzen)' : ''}</label>
                        ${exp.belegFoto ? `<div style="margin-bottom:6px;"><a href="#" id="ee_belegFotoView" style="font-size:12px;">aktuelles Beleg-Foto ansehen</a></div>` : ''}
                        <input type="file" accept="image/*" class="form-input" id="ee_belegFoto">
                    </div>
                `;
                const footer = `
                    <button class="btn" data-action="close-modal">Abbrechen</button>
                    <button class="btn btn-primary" id="saveExpenseEdit">Speichern</button>
                `;
                App.showModal('Ausgabe bearbeiten', body, footer);
                const eeKatSel = document.getElementById('ee_kategorie');
                if (eeKatSel) eeKatSel.addEventListener('change', () => {
                    const w = document.getElementById('ee_empfaengerWrap');
                    if (w) w.style.display = eeKatSel.value === this.KAT_GESCHENKE ? '' : 'none';
                });
                const belegFotoViewLink = document.getElementById('ee_belegFotoView');
                if (belegFotoViewLink) belegFotoViewLink.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    App.showModal('Beleg-Foto', `<img src="${exp.belegFoto}" style="max-width:100%;border-radius:var(--radius-sm);">`, '<button class="btn" data-action="close-modal">Schließen</button>');
                });
                document.getElementById('saveExpenseEdit').addEventListener('click', async () => {
                    const newFotoFile = document.getElementById('ee_belegFoto')?.files?.[0];
                    let belegFoto = exp.belegFoto;
                    if (newFotoFile) {
                        try { belegFoto = await Utils.sanitizeImageFile(newFotoFile); }
                        catch (err) { Utils.showToast(Utils.errorText(err, 'Beleg-Foto konnte nicht gelesen werden'), 'error'); return; }
                    }
                    const eeBetragVal = parseFloat(document.getElementById('ee_betrag').value) || 0;
                    if (eeBetragVal < 0) {
                        Utils.showToast('Betrag darf nicht negativ sein', 'warning');
                        return;
                    }
                    const eeKat = document.getElementById('ee_kategorie').value;
                    const eeEmpf = (document.getElementById('ee_empfaenger')?.value || '').trim();
                    if (this._leseProzent('ee_privatAnteil') === null) {
                        Utils.showToast('Privatanteil bitte zwischen 0 und 100 % angeben', 'warning');
                        return;
                    }
                    if (eeKat === this.KAT_GESCHENKE && !eeEmpf) {
                        Utils.showToast('Bitte den Empfänger des Geschenks angeben (§4 Abs. 7 EStG)', 'warning');
                        return;
                    }
                    Store.saveExpense({
                        id: exp.id,
                        datum: Utils.getDateInputValue('ee_datum'),
                        kategorie: document.getElementById('ee_kategorie').value,
                        beschreibung: document.getElementById('ee_beschreibung').value.trim(),
                        betrag: eeBetragVal,
                        ustSatz: this._normUstSatz(document.getElementById('ee_ustSatz')?.value),
                        belegNr: document.getElementById('ee_belegNr').value.trim(),
                        lieferant: document.getElementById('ee_lieferant').value.trim(),
                        lieferantSteuerId: document.getElementById('ee_lieferantSteuerId').value.trim(),
                        // saveExpense ersetzt den Datensatz — Felder ohne Eingabe im Dialog mitnehmen
                        // (sonst ging die Zuordnung der Zehn-Tage-Regel beim Bearbeiten verloren)
                        ustZeitraum: eeKat === 'Umsatzsteuer an Finanzamt' ? exp.ustZeitraum : undefined,
                        ustDauerfrist: eeKat === 'Umsatzsteuer an Finanzamt' ? exp.ustDauerfrist : undefined,
                        empfaenger: eeKat === this.KAT_GESCHENKE ? eeEmpf : undefined,
                        privatAnteil: this._leseProzent('ee_privatAnteil'),
                        belegFoto,
                        createdAt: exp.createdAt
                    });
                    App.closeModal();
                    Utils.showToast('Ausgabe aktualisiert', 'success');
                    this._refresh();
                });
            });
        });

        // Storno
        document.querySelectorAll('[data-storno-expense]').forEach(btn => {
            btn.addEventListener('click', () => {
                const grund = prompt('Stornogrund angeben (Pflicht fuer Revisionssicherheit):');
                if (!grund) return;
                Store.stornoExpense(btn.dataset.stornoExpense, grund);
                Utils.showToast('Ausgabe storniert', 'success');
                this._refresh();
            });
        });

        // Löschen — offene Periode: echtes Löschen mit Protokoll; festgeschrieben: Storno
        document.querySelectorAll('[data-delete-expense]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Ausgabe löschen? In einer offenen Periode wird sie entfernt und im Änderungsprotokoll dokumentiert.')) return;
                const res = Store.deleteExpense(btn.dataset.deleteExpense);
                if (res && res.storno) Utils.showToast('Periode ist abgeschlossen — storniert statt gelöscht', 'warning');
                else Utils.showToast('Ausgabe gelöscht', 'success');
                this._refresh();
            });
        });

        // CSV Export
        const exportBtn = document.getElementById('expenseExportCSV');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const expenses = Store.getExpenses();
                const rows = [['Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'USt-Satz', 'Beleg-Nr.']];
                expenses.forEach(e => rows.push([e.datum, e.kategorie, e.beschreibung, e.betrag, this._normUstSatz(e.ustSatz), e.belegNr || '']));
                Utils.downloadCSV(rows, 'ausgaben_export.csv');
                Utils.showToast('CSV exportiert', 'success');
            });
        }
    },

    _refresh() {
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    }
};
