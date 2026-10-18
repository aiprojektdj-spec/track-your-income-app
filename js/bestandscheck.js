// ============================================
// Bestandscheck — Altlasten aus der Zeit vor den Audit-Fixes vom 2026-10-15
//
// Die Fixes (EÜR als Zahlungsrechnung, Steuerstatus je Vorgang, Bankimport-Dublettenschutz,
// Storno/Retoure als eigene Rückzahlung, Verkauf ohne vorab vergebene ID) wirken nur für neue
// Vorgänge. Was vorher entstand, bleibt, wie es ist. Dieses Modul sucht solche Altlasten in der
// aktiven Firma und zeigt sie als Vorschau — es ändert nichts von sich aus.
//
// Grundsätze:
//  - pruefe() liest nur. Jede Änderung läuft über anwenden(schluessel) und wird vom Nutzer
//    einzeln bestätigt. anwenden() prüft den Bestand neu und wendet nur an, was der frische
//    Befund noch vorschlägt — eine veraltete Vorschau kann so nichts Falsches schreiben.
//  - Ein Korrekturvorschlag gibt es nur, wo die Korrektur eindeutig ist. Alles andere ist ein
//    Hinweis mit Erklärung.
//  - GoBD: jede Änderung mit Protokolleintrag; festgeschriebene Vorgänge werden nicht geändert,
//    sondern storniert und neu gebucht (oder bleiben, wenn die Änderung nichts bewirken würde).
// ============================================
const Bestandscheck = {
    _MAX_ANZEIGE: 200,
    _UST_ZAHLUNG: 'Umsatzsteuer an Finanzamt',
    // Zwei Importläufe gelten als verschieden, wenn ihre Zeitstempel weiter auseinander liegen.
    // Ein Lauf schreibt alle Zeilen in einer Schleife, also binnen Sekunden.
    _LAUF_ABSTAND_MS: 120000,

    _cent(x) { return Math.round((parseFloat(x) || 0) * 100); },
    _norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); },
    _settings() { return Store.getSettings ? Store.getSettings() : {}; },
    _hatStatus() { return typeof SteuerStatus !== 'undefined'; },
    _gesperrt(rec) { return !!(Store.isLocked && Store.isLocked(rec)); },
    _saleBrutto(s) { return (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0); },
    _saleText(s) { return [s.marke, s.artikeltyp].filter(Boolean).join(' ') || s.beschreibung || 'Verkauf'; },

    // ── Prüfung ─────────────────────────────────────────────────────────────────────────
    pruefe() {
        const ctx = {
            settings: this._settings(),
            sales: Store.getAllSalesRaw(),
            purchases: Store.getAllPurchasesRaw(),
            expenses: Store.getAllExpensesRaw(),
            retouren: Store.getRetouren ? Store.getRetouren() : [],
            dokumente: Store.getRechInvoices ? (Store.getRechInvoices() || []) : [],
            audit: Store.getAuditLog ? Store.getAuditLog() : [],
            verbrauch: Store.getMaterialVerbrauch ? Store.getMaterialVerbrauch() : []
        };
        const funde = [
            this._bankDubletten(ctx),
            this._teilzahlungDubletten(ctx),
            this._retourenAlt(ctx),
            this._stornoAlt(ctx),
            this._historieUnbelegt(ctx),
            this._ohneSteuerstatus(ctx),
            this._ohneSteuersatz(ctx),
            this._ustZahlungKategorie(ctx),
            this._verkaufOhneProtokoll(ctx),
            this._materialVerwaist(ctx)
        ].filter(f => f && f.eintraege.length);
        return { geprueftAm: new Date().toISOString(), funde };
    },

    // 1. Bankimport vor cc40704: jede Zeile bekam eine neue ID, derselbe Auszug zweimal ergab
    //    zwei Ausgaben. Altimporte tragen _bankImport, aber keine Umsatzkennung (_bankTx).
    //    Gleich aussehende Zeilen aus EINEM Importlauf sind zwei echte Zahlungen (so wertet es
    //    auch der neue Import). Kommen sie aus verschiedenen Läufen, ist die wahre Anzahl die des
    //    größten Laufs (ein überlappender Auszug enthält alle) — der Rest ist doppelt.
    _bankDubletten(ctx) {
        const gruppen = {};
        ctx.expenses.filter(e => e && e._bankImport && !e._bankTx && !e.storniert).forEach(e => {
            const k = [e.datum, this._cent(e.betrag), this._norm(e.beschreibung)].join('|');
            (gruppen[k] = gruppen[k] || []).push(e);
        });
        const eintraege = [];
        Object.keys(gruppen).forEach(k => {
            const g = gruppen[k];
            if (g.length < 2) return;
            const ohneZeit = g.filter(e => !Date.parse(e.createdAt || ''));
            if (ohneZeit.length) {
                g.forEach(e => eintraege.push({
                    id: 'bank-dublette:' + e.id, datum: e.datum, betrag: parseFloat(e.betrag) || 0,
                    text: (e.beschreibung || 'Ausgabe') + ' — ' + g.length + '× gleich importiert',
                    hinweis: 'Ohne Importzeitpunkt lässt sich nicht unterscheiden, ob das eine Dublette oder eine zweite echte Zahlung ist. Bitte mit dem Kontoauszug abgleichen.',
                    korrektur: null
                }));
                return;
            }
            // In Importläufe aufteilen
            const sortiert = g.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
            const laeufe = [];
            sortiert.forEach(e => {
                const t = Date.parse(e.createdAt);
                const letzter = laeufe[laeufe.length - 1];
                if (letzter && t - letzter.ende <= this._LAUF_ABSTAND_MS) { letzter.eintraege.push(e); letzter.ende = t; }
                else laeufe.push({ ende: t, eintraege: [e] });
            });
            if (laeufe.length < 2) return;
            // Größter Lauf bleibt (bei Gleichstand der früheste)
            let behalten = laeufe[0];
            laeufe.forEach(l => { if (l.eintraege.length > behalten.eintraege.length) behalten = l; });
            const bleibt = behalten.eintraege[0];
            laeufe.filter(l => l !== behalten).forEach(l => l.eintraege.forEach(e => {
                const fest = this._gesperrt(e);
                eintraege.push({
                    id: 'bank-dublette:' + e.id, datum: e.datum, betrag: parseFloat(e.betrag) || 0,
                    text: (e.beschreibung || 'Ausgabe') + ' — importiert am ' + String(e.createdAt).slice(0, 10)
                        + ', derselbe Umsatz ist schon am ' + String(bleibt.createdAt).slice(0, 10) + ' importiert worden',
                    hinweis: behalten.eintraege.length > 1
                        ? 'Der Auszug vom ' + String(bleibt.createdAt).slice(0, 10) + ' enthält diesen Umsatz ' + behalten.eintraege.length + '×; so oft bleibt er stehen.'
                        : '',
                    korrektur: {
                        aktion: 'dublette-entfernen', zielId: e.id,
                        text: fest ? 'Doppelte Ausgabe stornieren (Zeitraum festgeschrieben)' : 'Doppelte Ausgabe löschen (mit Protokolleintrag)'
                    }
                });
            }));
        });
        return {
            art: 'bank-dublette', titel: 'Doppelte Ausgaben aus dem Bankimport',
            erklaerung: 'Bis zum 14.10.2026 erkannte der Kontoimport bereits importierte Umsätze nicht. Wer denselben Auszug zweimal einlas, hat die Ausgaben doppelt — und damit den Gewinn zu niedrig.',
            eintraege
        };
    },

    // 1b. Einnahmen aus dem Bankimport landeten als Teilzahlung an der Rechnung. Doppelt
    //     eingelesen: zwei gleiche Teilzahlungen. Ob der Kunde wirklich zweimal gleich viel am
    //     selben Tag gezahlt hat, sieht man nur am Kontoauszug — deshalb nur ein Hinweis.
    _teilzahlungDubletten(ctx) {
        const eintraege = [];
        ctx.dokumente.forEach(inv => {
            const tz = Array.isArray(inv.teilzahlungen) ? inv.teilzahlungen : [];
            const zaehler = {};
            tz.forEach(t => { const k = t.datum + '|' + this._cent(t.betrag); zaehler[k] = (zaehler[k] || 0) + 1; });
            Object.keys(zaehler).filter(k => zaehler[k] > 1).forEach(k => {
                const [datum, cent] = k.split('|');
                eintraege.push({
                    id: 'teilzahlung-doppelt:' + inv.id + ':' + k, datum, betrag: parseInt(cent, 10) / 100,
                    text: 'Rechnung ' + (inv.nummer || inv.id) + ': ' + zaehler[k] + ' gleiche Teilzahlungen am selben Tag',
                    hinweis: 'Kann ein doppelter Kontoimport sein oder zwei echte Zahlungen. Bitte mit dem Kontoauszug abgleichen; eine doppelte Teilzahlung über die Rechnung korrigieren.',
                    korrektur: null
                });
            });
        });
        return {
            art: 'teilzahlung-doppelt', titel: 'Gleiche Teilzahlungen mehrfach an einer Rechnung',
            erklaerung: 'Zahlungseingänge aus dem Kontoimport wurden vor dem 14.10.2026 ebenfalls nicht wiedererkannt.',
            eintraege
        };
    },

    // 2. Retoure im alten Muster: der verknüpfte Verkauf wurde storniert. Damit fehlt der ganze
    //    Verkauf als Einnahme (auch bei einer Teilerstattung), und zwar im Zeitraum des Verkaufs
    //    statt der Rückzahlung. Die Auswertungen ziehen die Erstattung deshalb nicht noch einmal
    //    ab. Ein Umbau hieße: Verkauf neu buchen (auch in bereits gemeldeten Zeiträumen) und die
    //    Retoure umstellen — das ist keine eindeutige Korrektur, sondern eine Entscheidung.
    _retourenAlt(ctx) {
        const byId = {};
        ctx.sales.forEach(s => { byId[s.id] = s; });
        const eintraege = ctx.retouren.filter(r => r && r.modell !== 2 && r.saleId && byId[r.saleId] && byId[r.saleId].storniert)
            .map(r => {
                const s = byId[r.saleId];
                const brutto = this._saleBrutto(s);
                const erstattet = parseFloat(r.erstattungBetrag) || 0;
                const fehlt = Math.round((brutto - erstattet) * 100) / 100;
                return {
                    id: 'retoure-alt:' + r.id, datum: r.datum, betrag: erstattet,
                    text: 'Retoure ' + (r.nummer || '') + ' zu ' + this._saleText(s) + ' (Verkauf vom ' + (s.datum || '?') + ', ' + brutto.toFixed(2).replace('.', ',') + ' €) — Verkauf storniert',
                    hinweis: (fehlt > 0.004
                        ? 'Erstattet wurden nur ' + erstattet.toFixed(2).replace('.', ',') + ' €; die übrigen ' + fehlt.toFixed(2).replace('.', ',') + ' € fehlen als Einnahme. '
                        : '')
                        + (String(s.datum || '').slice(0, 7) !== String(r.datum || '').slice(0, 7)
                            ? 'Die Rückzahlung wirkt im Monat des Verkaufs (' + String(s.datum || '').slice(0, 7) + ') statt im Monat der Rückzahlung (' + String(r.datum || '').slice(0, 7) + '). '
                            : '')
                        + 'Zum Umstellen den Verkauf neu erfassen und die Retoure mit Erstattung neu anlegen; liegt der Verkauf in einem gemeldeten Zeitraum, mit der Steuerberatung klären.',
                    korrektur: null
                };
            });
        return {
            art: 'retoure-alt', titel: 'Retouren im alten Muster (Verkauf storniert)',
            erklaerung: 'Bis zum 14.10.2026 stornierte jede verknüpfte Retoure den ganzen Verkauf. Richtig ist: Der Verkauf bleibt als Einnahme stehen, die Erstattung ist eine eigene Rückzahlung zu ihrem Datum.',
            eintraege
        };
    },

    // 2b. Rechnungsstorno im alten Muster (ohne stornoModell 2): Die Zahlungseingänge zur
    //     Rechnung zählen in der EÜR nicht mehr — gleich ob tatsächlich zurückgezahlt wurde —,
    //     und in der Soll-UVA verschwindet auch das Original aus seinem Zeitraum.
    _stornoAlt(ctx) {
        const eintraege = ctx.dokumente
            .filter(inv => inv && inv.typ !== 'stornorechnung' && inv.typ !== 'angebot'
                && (inv.status === 'storniert' || inv._storniert) && inv.stornoModell !== 2)
            .map(inv => {
                const zahlungen = ctx.sales.filter(s => s._invoiceId === inv.id);
                const summe = zahlungen.reduce((x, s) => x + this._saleBrutto(s), 0);
                const storniertVerkaeufe = zahlungen.filter(s => s.storniert).length;
                return {
                    id: 'storno-alt:' + inv.id, datum: inv.datum, betrag: summe,
                    text: 'Rechnung ' + (inv.nummer || inv.id) + ' vom ' + (inv.datum || '?') + ', storniert am ' + String(inv.storniertAm || '').slice(0, 10),
                    hinweis: (summe > 0.004
                        ? 'Zur Rechnung sind ' + summe.toFixed(2).replace('.', ',') + ' € Zahlungseingang gebucht'
                          + (storniertVerkaeufe ? ' (' + storniertVerkaeufe + ' davon mitstorniert)' : '')
                          + '; sie zählen in der EÜR nicht. Das stimmt nur, wenn das Geld im selben Zeitraum zurückgezahlt wurde. '
                        : 'Zur Rechnung ist kein Zahlungseingang gebucht. ')
                        + 'Bei Soll-Versteuerung fehlt die Rechnung auch in der Voranmeldung ihres Zeitraums. Ein Umbau ist eine Entscheidung im Einzelfall, keine automatische Korrektur.',
                    korrektur: null
                };
            });
        return {
            art: 'storno-alt', titel: 'Rechnungsstornos im alten Muster',
            erklaerung: 'Bis zum 14.10.2026 ließ ein Storno bereits eingegangenes Geld rückwirkend verschwinden. Seitdem bleibt der Zufluss stehen; eine echte Rückzahlung wird als eigener, datierter Vorgang gebucht.',
            eintraege
        };
    },

    // 3a. Firma ohne belegte USt-Historie: alles ohne Stempel läuft mit dem heutigen Modus.
    _historieUnbelegt(ctx) {
        if (!this._hatStatus() || !SteuerStatus.unbelegt(ctx.settings)) return null;
        const ohne = [ctx.sales, ctx.purchases, ctx.expenses].reduce((n, l) => n + l.filter(r => r && !r.storniert && !r.ustBehandlung).length, 0);
        if (!ohne) return null;
        const modus = ctx.settings.ustMode === 'regel' ? 'Regelbesteuerung' : 'Kleinunternehmerregelung';
        return {
            art: 'historie-unbelegt', titel: 'Seit wann gilt welcher Umsatzsteuer-Status?',
            erklaerung: 'Für diese Firma ist kein datierter Wechsel des Umsatzsteuer-Status festgehalten. ' + ohne + ' ältere Vorgänge ohne eigenen Status werden deshalb mit dem heutigen Status (' + modus + ') ausgewertet.',
            eintraege: [{
                id: 'historie-unbelegt', datum: '', betrag: null,
                text: 'Heutiger Status: ' + modus + ' — gilt damit auch für alle früheren Jahre',
                hinweis: 'Nur bestätigen, wenn der Status seit Gründung nie gewechselt hat. War die Firma früher anders besteuert, stattdessen in den Einstellungen unter „Umsatzsteuer und Besteuerung“ den Wechsel mit dem Datum „gilt ab“ eintragen. Erst danach schlägt der Bestandscheck vor, den Status an die Vorgänge zu schreiben.',
                // Die Aussage "nie gewechselt" kann nur der Nutzer treffen — deshalb ein
                // ausdrücklich bestätigter Vorschlag, kein stiller Standard.
                korrektur: { aktion: 'historie-bestaetigen', modus: ctx.settings.ustMode === 'regel' ? 'regel' : 'klein',
                    text: 'Bestätigen: „' + modus + '“ gilt seit Beginn unverändert' }
            }]
        };
    },

    // 3b. Vorgänge ohne Steuerstatus. Mit belegter Historie ist die Korrektur eindeutig: der
    //     Modus laut Historie zum Vorgangsdatum — genau das, was die Auswertung schon heute
    //     annimmt. Der Stempel macht es dauerhaft. Festgeschriebene Vorgänge bleiben: der Stempel
    //     änderte an ihrer Auswertung nichts.
    _ohneSteuerstatus(ctx) {
        if (!this._hatStatus()) return null;
        const belegt = !SteuerStatus.unbelegt(ctx.settings);
        const eintraege = [];
        const arten = [['verkauf', ctx.sales, 'Verkauf'], ['einkauf', ctx.purchases, 'Einkauf'], ['ausgabe', ctx.expenses, 'Ausgabe']];
        arten.forEach(([typ, liste, label]) => {
            liste.filter(r => r && !r.storniert && r.ustBehandlung !== 'klein' && r.ustBehandlung !== 'regel' && r.datum).forEach(r => {
                const modus = SteuerStatus.modeAm(r.datum, ctx.settings);
                const name = modus === 'regel' ? 'Regelbesteuerung' : 'Kleinunternehmer';
                const fest = this._gesperrt(r);
                const text = label + ' ' + (typ === 'ausgabe' ? (r.beschreibung || r.kategorie || '') : this._saleText(r));
                let korrektur = null, hinweis = '';
                if (!belegt) hinweis = 'Erst die Statushistorie der Firma klären (siehe oben).';
                else if (fest) hinweis = 'Festgeschrieben — bleibt unverändert; ausgewertet wird er bereits als „' + name + '“.';
                else korrektur = { aktion: 'ust-stempel', typ, zielId: r.id, modus, text: 'Status „' + name + '“ eintragen (laut Historie zum ' + r.datum + ')' };
                eintraege.push({ id: 'ohne-steuerstatus:' + typ + ':' + r.id, datum: r.datum,
                    betrag: typ === 'verkauf' ? this._saleBrutto(r) : (parseFloat(typ === 'einkauf' ? r.einkaufspreis : r.betrag) || 0),
                    text, hinweis, korrektur });
            });
        });
        return {
            art: 'ohne-steuerstatus', titel: 'Vorgänge ohne eigenen Umsatzsteuer-Status',
            erklaerung: 'Seit dem 14.10.2026 trägt jeder neue Verkauf, Einkauf und jede Ausgabe ihren Umsatzsteuer-Status selbst. Ältere Vorgänge richten sich nach der Statushistorie der Firma; ändert sich die, ändert sich rückwirkend auch ihre Auswertung.',
            eintraege
        };
    },

    // 4. Regelbesteuerte Verkäufe ohne Steuersatz — die Auswertung rechnet 19 %. Ob 7 oder 19 %
    //    richtig ist, weiß nur der Nutzer: kein Vorschlag. Kriterium wie Euer.ohneSteuersatz.
    _ohneSteuersatz(ctx) {
        if (!this._hatStatus()) return null;
        const eintraege = ctx.sales.filter(s => s && !s.storniert && !s._invoiceId
            && SteuerStatus.istRegel(s, ctx.settings)
            && (s.steuersatz == null || s.steuersatz === '' || isNaN(parseFloat(s.steuersatz)))
            && !(s.steuersaetze && Object.keys(s.steuersaetze).length)
            && !(typeof SteuerBerechnung !== 'undefined' && SteuerBerechnung._sondersatz && SteuerBerechnung._sondersatz(s, {}) !== null))
            .map(s => ({
                id: 'ohne-steuersatz:' + s.id, datum: s.datum, betrag: this._saleBrutto(s),
                text: 'Verkauf ' + this._saleText(s),
                hinweis: 'Wird mit 19 % gerechnet. Bitte den Steuersatz am Verkauf eintragen' + (this._gesperrt(s) ? ' — der Zeitraum ist festgeschrieben, also per Storno und Neubuchung.' : '.'),
                korrektur: null
            }));
        return {
            art: 'ohne-steuersatz', titel: 'Regelbesteuerte Verkäufe ohne Steuersatz',
            erklaerung: 'Diese Verkäufe fallen unter die Regelbesteuerung, tragen aber keinen Steuersatz. EÜR und Voranmeldung rechnen sie mit 19 % — bei 7 %-Ware ist das zu viel Umsatzsteuer.',
            eintraege
        };
    },

    // 5. Umsatzsteuer-Zahlungen ans Finanzamt als normale Ausgabe. Seit T01 haben sie eine eigene
    //    Kategorie: eigene EÜR-Zeile, nie Vorsteuer, DATEV 1780. Erkannt am Text — eindeutig nur,
    //    wenn er auf eine USt-Zahlung zeigt, nicht bloß "Finanzamt" (ESt/GewSt) oder "inkl. USt".
    _UST_TEXT: /(ustva|ust-va|ust\.-?va|umsatzsteuer-?voranmeldung|umsatzsteuer-?vorauszahlung|ust-?vorauszahlung|ust-?vz\b|umsatzsteuervoranmeldung|umsatzsteuervorauszahlung)/i,
    _UST_FA: /finanzamt/i,
    _UST_WORT: /(\bumsatzsteuer\b|\bust\b)/i,
    _istUstZahlungText(e) {
        const t = [e.beschreibung, e.notizen, e.lieferant].filter(Boolean).join(' ');
        if (/erstattung/i.test(t)) return false;
        return this._UST_TEXT.test(t) || (this._UST_FA.test(t) && this._UST_WORT.test(t));
    },
    _ustZahlungKategorie(ctx) {
        const eintraege = ctx.expenses.filter(e => e && !e.storniert && !/^Umsatzsteuer/.test(e.kategorie || '') && this._istUstZahlungText(e))
            .map(e => {
                const fest = this._gesperrt(e);
                return {
                    id: 'ust-zahlung:' + e.id, datum: e.datum, betrag: parseFloat(e.betrag) || 0,
                    text: (e.beschreibung || 'Ausgabe') + ' — Kategorie „' + (e.kategorie || 'ohne') + '“',
                    hinweis: 'Der Text deutet auf eine Umsatzsteuer-Zahlung hin. Bitte prüfen, ob es nicht doch eine andere Steuer ist.',
                    korrektur: {
                        aktion: 'ust-kategorie', zielId: e.id,
                        text: fest ? 'Stornieren und als „' + this._UST_ZAHLUNG + '“ neu buchen (Zeitraum festgeschrieben)'
                                   : 'Kategorie auf „' + this._UST_ZAHLUNG + '“ ändern'
                    }
                };
            });
        return {
            art: 'ust-zahlung', titel: 'Umsatzsteuer-Zahlungen als normale Ausgabe',
            erklaerung: 'Zahlungen der Umsatzsteuer an das Finanzamt gehören in die Kategorie „' + this._UST_ZAHLUNG + '“. Als normale Ausgabe stehen sie in der EÜR unter den Betriebsausgaben statt in der eigenen Zeile, im DATEV-Export auf dem falschen Konto, und eine eingetragene Vorsteuer würde mitgezählt.',
            eintraege
        };
    },

    // 6a. Verkäufe aus dem alten ID-Fehler (bis 530f98a): saveSale nahm den Bearbeiten-Zweig,
    //     ohne Audit 'erstellt', createdAt und Steuerstatus. Die Korrektur ist ein ehrlicher
    //     Nachtrag ins Protokoll — rückdatieren kann und soll man ihn nicht.
    _verkaufOhneProtokoll(ctx) {
        const protokolliert = new Set(ctx.audit
            .filter(a => a && a.entityType === 'verkauf' && (a.action === 'erstellt' || a.action === 'nachgetragen'))
            .map(a => a.entityId));
        const eintraege = ctx.sales.filter(s => s && s.id && !s.createdAt && !protokolliert.has(s.id))
            .map(s => ({
                id: 'verkauf-ohne-protokoll:' + s.id, datum: s.datum, betrag: this._saleBrutto(s),
                text: 'Verkauf ' + this._saleText(s) + (s.storniert ? ' (storniert)' : ''),
                hinweis: 'Im Änderungsprotokoll steht kein Eintrag „erstellt“ zu diesem Verkauf.',
                korrektur: { aktion: 'protokoll-nachtrag', zielId: s.id, text: 'Erstellung heute im Protokoll nachtragen (als Nachtrag gekennzeichnet)' }
            }));
        return {
            art: 'verkauf-ohne-protokoll', titel: 'Verkäufe ohne Erstellungs-Protokoll',
            erklaerung: 'Bis zum 15.10.2026 legte das Verkaufsformular neue Verkäufe so an, dass das Änderungsprotokoll (GoBD) keinen Eintrag „erstellt“ bekam. Der Verkauf selbst ist richtig gebucht.',
            eintraege
        };
    },

    // 6b. Materialverbrauch, dessen referenzId auf keinen Verkauf zeigt (Paketverkäufe aus dem
    //     ID-Fehler). Eindeutig neu verknüpfbar nur, wenn genau ein Verkauf am selben Tag mit
    //     derselben Bezeichnung existiert, der noch keinen Materialverbrauch hat.
    _materialVerwaist(ctx) {
        const saleIds = new Set(ctx.sales.map(s => s.id));
        const mitMaterial = new Set(ctx.verbrauch.filter(v => v && v.referenzId).map(v => v.referenzId));
        const gruppen = {};
        ctx.verbrauch.filter(v => v && v.grund === 'verkauf' && v.referenzId && !saleIds.has(v.referenzId) && !v.storniert)
            .forEach(v => { (gruppen[v.referenzId] = gruppen[v.referenzId] || []).push(v); });
        const eintraege = Object.keys(gruppen).map(ref => {
            const vs = gruppen[ref];
            const v0 = vs[0];
            const bez = this._norm(v0.referenzBez);
            const kandidaten = ctx.sales.filter(s => s.datum === v0.datum && !mitMaterial.has(s.id)
                && this._norm((s.marke || '') + ' ' + (s.artikeltyp || '')) === bez);
            const kosten = vs.reduce((x, v) => x + (parseFloat(v.kosten) || 0), 0);
            const ziel = kandidaten.length === 1 ? kandidaten[0] : null;
            return {
                id: 'material-verwaist:' + ref, datum: v0.datum, betrag: Math.round(kosten * 100) / 100,
                text: vs.map(v => v.menge + ' ' + (v.einheit || '') + ' ' + (v.materialName || '')).join(', ') + ' für „' + (v0.referenzBez || '').trim() + '“',
                hinweis: ziel ? 'Passt eindeutig zu einem Verkauf vom selben Tag mit derselben Bezeichnung.'
                    : kandidaten.length ? kandidaten.length + ' Verkäufe kommen in Frage — bitte von Hand zuordnen.'
                    : 'Kein passender Verkauf gefunden. Bei einer Retoure wird dieses Material nicht zurückgebucht.',
                korrektur: ziel ? { aktion: 'material-verknuepfen', referenzId: ref, zielId: ziel.id,
                    text: 'Mit Verkauf ' + this._saleText(ziel) + ' vom ' + ziel.datum + ' verknüpfen' } : null
            };
        });
        return {
            art: 'material-verwaist', titel: 'Materialverbrauch ohne Verkauf',
            erklaerung: 'Bei Paketverkäufen bis zum 15.10.2026 zeigte der Materialverbrauch auf eine Verkaufs-ID, die nie gespeichert wurde. Storno oder Retoure des Verkaufs buchen das Material dann nicht zurück.',
            eintraege
        };
    },

    // ── Korrektur ───────────────────────────────────────────────────────────────────────
    // schluessel = eintrag.id aus pruefe(). Rückgabe { ok, text } oder { ok:false, fehler }.
    anwenden(schluessel) {
        if (Store._isReadonlyCompany && Store._isReadonlyCompany()) return { ok: false, fehler: 'Nur-Lese-Ansicht — hier wird nichts geändert.' };
        let eintrag = null;
        this.pruefe().funde.some(f => (eintrag = f.eintraege.find(e => e.id === schluessel)) && true);
        if (!eintrag) return { ok: false, fehler: 'Der Befund besteht nicht mehr — bitte neu prüfen.' };
        const k = eintrag.korrektur;
        if (!k) return { ok: false, fehler: 'Für diesen Befund gibt es keinen automatischen Vorschlag.' };
        switch (k.aktion) {
            case 'dublette-entfernen': return this._dubletteEntfernen(k);
            case 'ust-stempel':        return this._ustStempel(k);
            case 'ust-kategorie':      return this._ustKategorie(k);
            case 'protokoll-nachtrag': return this._protokollNachtrag(k);
            case 'material-verknuepfen': return this._materialVerknuepfen(k);
            case 'historie-bestaetigen': return this._historieBestaetigen(k);
        }
        return { ok: false, fehler: 'Unbekannte Korrektur' };
    },

    // Wie überall in der App: offen → löschen mit Protokoll, festgeschrieben → Storno.
    _dubletteEntfernen(k) {
        const e = Store.getAllExpensesRaw().find(x => x.id === k.zielId);
        if (!e) return { ok: false, fehler: 'Ausgabe nicht gefunden' };
        if (this._gesperrt(e)) {
            Store.stornoExpense(e.id, 'Bestandscheck: doppelter Bankimport');
            return { ok: true, text: 'Doppelte Ausgabe storniert' };
        }
        const res = Store.deleteExpense(e.id);
        return res && res.deleted ? { ok: true, text: 'Doppelte Ausgabe gelöscht' } : { ok: false, fehler: 'Ausgabe konnte nicht entfernt werden' };
    },

    // Ändert einen offenen Datensatz direkt (ohne die Nebenwirkungen von saveSale & Co.) und
    // protokolliert alt/neu. Festgeschriebenes wird abgewiesen.
    _KEYS: { verkauf: 'sales', einkauf: 'purchases', ausgabe: 'expenses' },
    _aendere(typ, id, aendern, details) {
        const key = this._KEYS[typ];
        const liste = Store.get(key) || [];
        const rec = liste.find(r => r.id === id);
        if (!rec) return { ok: false, fehler: 'Vorgang nicht gefunden' };
        if (this._gesperrt(rec)) return { ok: false, fehler: 'Vorgang ist festgeschrieben' };
        const alt = Object.assign({}, rec);
        aendern(rec);
        Store._stampRecord(rec);
        if (!Store.set(key, liste)) return { ok: false, fehler: 'Nicht gespeichert' };
        Store._addAuditEntry('bearbeitet', typ, id, alt, rec, details);
        return { ok: true };
    },

    _ustStempel(k) {
        const r = this._aendere(k.typ, k.zielId, rec => { rec.ustBehandlung = k.modus; },
            'Bestandscheck: Umsatzsteuer-Status „' + k.modus + '“ laut Historie nachgetragen');
        return r.ok ? { ok: true, text: 'Status eingetragen' } : r;
    },

    _ustKategorie(k) {
        const e = Store.getAllExpensesRaw().find(x => x.id === k.zielId);
        if (!e) return { ok: false, fehler: 'Ausgabe nicht gefunden' };
        const grund = 'Bestandscheck: Umbuchung von „' + (e.kategorie || '') + '“ nach „' + this._UST_ZAHLUNG + '“';
        if (!this._gesperrt(e)) {
            const r = this._aendere('ausgabe', e.id, rec => { rec.kategorie = this._UST_ZAHLUNG; }, grund);
            return r.ok ? { ok: true, text: 'Kategorie geändert' } : r;
        }
        // Festgeschrieben: Storno + Neubuchung mit denselben Daten in der richtigen Kategorie
        const neu = Object.assign({}, e);
        ['id', 'createdAt', 'updatedAt', '_dev', '_checksum', 'storniert', 'storniertAm', 'stornoGrund', 'gesperrt'].forEach(f => delete neu[f]);
        neu.kategorie = this._UST_ZAHLUNG;
        neu.notizen = ((neu.notizen ? neu.notizen + ' — ' : '') + 'Umbuchung (Bestandscheck), ersetzt stornierte Ausgabe ' + e.id).slice(0, 500);
        Store.stornoExpense(e.id, grund);
        const gespeichert = Store.saveExpense(neu);
        if (!gespeichert || !gespeichert.id) return { ok: false, fehler: 'Storniert, aber die Neubuchung ist nicht gespeichert — bitte von Hand nachbuchen.' };
        return { ok: true, text: 'Storniert und neu gebucht' };
    },

    _protokollNachtrag(k) {
        const s = Store.getAllSalesRaw().find(x => x.id === k.zielId);
        if (!s) return { ok: false, fehler: 'Verkauf nicht gefunden' };
        const e = Store._addAuditEntry('nachgetragen', 'verkauf', s.id, null, s,
            'Nachtrag (Bestandscheck): Erstellung dieses Verkaufs war nicht protokolliert (Fehler im Verkaufsformular bis 15.10.2026). Datum und Inhalt unverändert.');
        return e ? { ok: true, text: 'Protokolleintrag nachgetragen' } : { ok: false, fehler: 'Nicht protokolliert' };
    },

    // Hält den heutigen Modus als unbefristeten Anfangszustand fest (wie SteuerStatus.wechsel()
    // es beim ersten Wechsel tut). Ändert keinen Vorgang; danach ist die Historie belegt.
    _historieBestaetigen(k) {
        const alt = Store.getSettings();
        if (!SteuerStatus.unbelegt(alt)) return { ok: false, fehler: 'Historie ist bereits festgehalten' };
        if ((alt.ustMode === 'regel' ? 'regel' : 'klein') !== k.modus) return { ok: false, fehler: 'Status hat sich geändert — bitte neu prüfen.' };
        const neu = Object.assign({}, alt, { ustModeHistorie: [{ ab: '0000-01-01', mode: k.modus, erfasst: new Date().toISOString(), quelle: 'bestandscheck' }] });
        Store.saveSettings(neu);
        if (SteuerStatus.unbelegt(Store.getSettings())) return { ok: false, fehler: 'Nicht gespeichert' };
        Store._addAuditEntry('bearbeitet', 'system', 'ust_historie', { ustModeHistorie: alt.ustModeHistorie || null }, { ustModeHistorie: neu.ustModeHistorie },
            'Bestandscheck: Umsatzsteuer-Status „' + k.modus + '“ als seit Beginn unverändert bestätigt');
        return { ok: true, text: 'Statushistorie festgehalten' };
    },

    _materialVerknuepfen(k) {
        const vs = Store.getMaterialVerbrauch().filter(v => v.referenzId === k.referenzId && v.grund === 'verkauf');
        if (!vs.length) return { ok: false, fehler: 'Materialverbrauch nicht gefunden' };
        for (const v of vs) {
            const alt = Object.assign({}, v);
            v.referenzId = k.zielId;
            if (!Store.saveMaterialVerbrauchEintrag(v)) return { ok: false, fehler: 'Nicht gespeichert' };
            Store._addAuditEntry('bearbeitet', 'material', v.id, alt, v, 'Bestandscheck: Materialverbrauch mit Verkauf ' + k.zielId + ' verknüpft');
        }
        return { ok: true, text: 'Materialverbrauch verknüpft' };
    },

    // ── Seite ───────────────────────────────────────────────────────────────────────────
    _befund: null,

    render() {
        const b = this._befund = this.pruefe();
        const fmt = n => (n == null ? '' : Utils.formatCurrency(n));
        const esc = s => Utils.escapeHtml(s == null ? '' : String(s));
        const anzahl = b.funde.reduce((n, f) => n + f.eintraege.length, 0);
        const abschnitte = b.funde.map(f => {
            const zeilen = f.eintraege.slice(0, this._MAX_ANZEIGE).map(e => `
                <tr>
                    <td>${e.datum ? esc(Utils.formatDate ? Utils.formatDate(e.datum) : e.datum) : ''}</td>
                    <td>${esc(e.text)}${e.hinweis ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${esc(e.hinweis)}</div>` : ''}</td>
                    <td style="text-align:right;white-space:nowrap;">${fmt(e.betrag)}</td>
                    <td>${e.korrektur
                        ? `<div style="font-size:12px;margin-bottom:4px;">Vorschlag: ${esc(e.korrektur.text)}</div>
                           <button class="btn btn-small" data-bestandscheck-korrektur="${esc(e.id)}">Übernehmen</button>`
                        : '<span style="font-size:12px;color:var(--text-muted);">nur Hinweis</span>'}</td>
                </tr>`).join('');
            const mehr = f.eintraege.length > this._MAX_ANZEIGE
                ? `<p style="font-size:12px;color:var(--text-muted);">… und ${f.eintraege.length - this._MAX_ANZEIGE} weitere. Nach dem Abarbeiten neu prüfen.</p>` : '';
            return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">${esc(f.titel)} <span class="badge badge-warning">${f.eintraege.length}</span></div></div>
                <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px;">${esc(f.erklaerung)}</p>
                <div class="table-container"><table>
                    <thead><tr><th>Datum</th><th>Vorgang</th><th style="text-align:right">Betrag</th><th>Korrektur</th></tr></thead>
                    <tbody>${zeilen}</tbody>
                </table></div>${mehr}
            </div>`;
        }).join('');
        return `
            <div class="page-header"><div><h2>Bestandscheck</h2>
                <p>Sucht in der aktiven Firma nach Buchungen aus der Zeit vor den Korrekturen vom 14./15.10.2026. Es wird nichts geändert, bevor du einen Vorschlag einzeln übernimmst; jede Übernahme steht im Änderungsprotokoll, festgeschriebene Zeiträume werden nur per Storno korrigiert.</p>
            </div></div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
                <button class="btn btn-small" id="bestandscheckNeu"><i class="ti ti-refresh"></i> Neu prüfen</button>
                <span role="status" id="bestandscheckStatus" style="font-size:13px;color:var(--text-secondary);">${anzahl ? anzahl + ' Befunde in ' + b.funde.length + ' Bereichen' : 'Keine Altlasten gefunden.'}</span>
            </div>
            ${abschnitte}`;
    },

    init() {
        const content = document.getElementById('content');
        if (!content) return;
        const neu = () => { content.innerHTML = this.render(); this.init(); };
        const btn = document.getElementById('bestandscheckNeu');
        if (btn) btn.addEventListener('click', neu);
        content.querySelectorAll('[data-bestandscheck-korrektur]').forEach(el => el.addEventListener('click', () => {
            const id = el.dataset.bestandscheckKorrektur;
            let eintrag = null;
            (this._befund ? this._befund.funde : []).some(f => (eintrag = f.eintraege.find(e => e.id === id)) && true);
            if (!eintrag || !eintrag.korrektur) return;
            if (!confirm('Korrektur übernehmen?\n\n' + eintrag.text + '\n\n→ ' + eintrag.korrektur.text)) return;
            el.disabled = true;
            const r = this.anwenden(id);
            Utils.showToast(r.ok ? r.text : r.fehler, r.ok ? 'success' : 'error');
            neu();
        }));
    }
};

if (typeof window !== 'undefined') window.Bestandscheck = Bestandscheck;
if (typeof module !== 'undefined' && module.exports) module.exports = Bestandscheck;
