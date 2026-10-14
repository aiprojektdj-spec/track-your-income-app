// ============================================
// Steuerstatus — welche Umsatzsteuerbehandlung galt für einen Vorgang?
//
// Bis zum Audit 2026-10-13 (T06) gab es nur das globale Firmenfeld `ustMode`. Wer von
// Kleinunternehmer auf Regelbesteuerung wechselte, bekam damit auch alle ALTEN Jahre als
// regelbesteuert neu ausgewertet: ein KU-Verkauf über 119 € aus 2025 wurde in der EÜR 2025
// plötzlich zu 100 € Erlös + 19 € USt.
//
// Modell:
//  1. Ein Vorgang kann seine Behandlung selbst tragen: `ustBehandlung: 'klein' | 'regel'`.
//     Das wird beim Anlegen gestempelt (Store) und hat Vorrang.
//  2. Sonst entscheidet die Historie der Firma: `settings.ustModeHistorie` =
//     [{ ab: 'YYYY-MM-DD', mode: 'klein'|'regel' }, …], aufsteigend. Maßgeblich ist der
//     letzte Eintrag mit ab <= Vorgangsdatum.
//  3. Fehlt beides, gilt das heutige Feld `ustMode` — das ist der Altbestand vor diesem Modell.
//     Ob der stimmt, lässt sich nachträglich nicht belegen; der Bestandscheck
//     (js/bestandscheck.js) weist solche Firmen als Klärungsfall aus.
//
// Ein Wechsel schreibt nur einen neuen Historieneintrag. Er ändert keinen Vorgang, keinen
// festgeschriebenen Zeitraum und keinen UVA-Snapshot.
// ============================================
const SteuerStatus = {
    _MODI: ['klein', 'regel'],

    historie(settings) {
        const s = settings || {};
        const h = Array.isArray(s.ustModeHistorie) ? s.ustModeHistorie
            .filter(e => e && this._MODI.indexOf(e.mode) !== -1 && /^\d{4}-\d{2}-\d{2}$/.test(String(e.ab || '')))
            .slice().sort((a, b) => a.ab < b.ab ? -1 : a.ab > b.ab ? 1 : 0) : [];
        if (!h.length) return [{ ab: '0000-01-01', mode: s.ustMode === 'regel' ? 'regel' : 'klein', unbelegt: true }];
        return h;
    },

    // Modus an einem Datum laut Historie.
    modeAm(datum, settings) {
        const d = String(datum || '').slice(0, 10);
        const h = this.historie(settings);
        let mode = h[0].mode;
        for (const e of h) { if (e.ab <= d) mode = e.mode; else break; }
        return mode;
    },

    // Behandlung eines konkreten Vorgangs: eigener Stempel vor Historie.
    fuerVorgang(vorgang, settings, datumFeld) {
        if (vorgang && this._MODI.indexOf(vorgang.ustBehandlung) !== -1) return vorgang.ustBehandlung;
        const d = vorgang ? (vorgang[datumFeld || 'datum'] || vorgang.datum) : '';
        return this.modeAm(d, settings);
    },
    istRegel(vorgang, settings, datumFeld) {
        return this.fuerVorgang(vorgang, settings, datumFeld) === 'regel';
    },

    // true, wenn die Firma keine belegte Historie hat (Altbestand).
    unbelegt(settings) {
        return !!this.historie(settings)[0].unbelegt;
    },

    // Wechsel eintragen. Liefert die geänderten Settings (Kopie), schreibt nichts selbst.
    // ab: erster Tag mit dem neuen Modus. Ohne Historie wird der bisherige Modus als
    // unbefristeter Anfangszustand festgehalten, damit Vorgänge VOR dem Wechsel ihn behalten.
    wechsel(settings, neuerMode, ab) {
        if (this._MODI.indexOf(neuerMode) === -1) throw new Error('Unbekannter USt-Modus: ' + neuerMode);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ab || ''))) throw new Error('Wechseldatum fehlt');
        const s = Object.assign({}, settings || {});
        const alt = s.ustMode === 'regel' ? 'regel' : 'klein';
        let h = Array.isArray(s.ustModeHistorie) ? s.ustModeHistorie.slice() : [];
        if (!h.length) h.push({ ab: '0000-01-01', mode: alt });
        // Ein späterer Eintrag ab demselben Tag ersetzt den früheren — kein Doppel.
        h = h.filter(e => e.ab !== ab);
        h.push({ ab, mode: neuerMode, erfasst: new Date().toISOString() });
        h.sort((a, b) => a.ab < b.ab ? -1 : a.ab > b.ab ? 1 : 0);
        s.ustModeHistorie = h;
        // `ustMode` bleibt das Feld für "heute" (Formulare, Rechnungsvorlagen).
        s.ustMode = this.modeAm(new Date().toLocaleDateString('sv-SE'), s);
        return s;
    }
};

if (typeof window !== 'undefined') window.SteuerStatus = SteuerStatus;
if (typeof module !== 'undefined' && module.exports) module.exports = SteuerStatus;
