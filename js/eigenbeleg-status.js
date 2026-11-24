// Bestaetigungsstatus der Eigenbelege. Ein Eigenbeleg ersetzt einen fehlenden Fremdbeleg; per CSV
// importierte Belege sind zunaechst UNBESTAETIGT (bestaetigt === false) und zaehlen erst nach dem
// Klick auf "Bestaetigen" in EUER, DATEV-Stapel und den Summen. Belege ohne Feld oder mit
// bestaetigt !== false gelten wie bisher als bestaetigt (Altbestand aendert sich nicht).
// Reine Funktionen, kein DOM/Store. Test: test/test-eigenbeleg-status.js.
const EigenbelegStatus = (function () {
    'use strict';

    // Zaehlt der Beleg in Auswertungen und Exporten? (als Filter-Callback verwendbar)
    function zaehlt(b) { return !!b && b.bestaetigt !== false; }

    // Darf bestaetigt werden? { ok, grund }. opt.gesperrt(datum) = Periodensperre (Store.isPeriodLocked).
    function kannBestaetigen(b, opt) {
        if (!b) return { ok: false, grund: 'Beleg nicht gefunden' };
        if (b.storniert) return { ok: false, grund: 'Beleg ist storniert' };
        if (b.bestaetigt !== false) return { ok: false, grund: 'Beleg ist bereits bestätigt' };
        if (opt && opt.gesperrt && opt.gesperrt(b.belegDatum)) return { ok: false, grund: 'Periode festgeschrieben' };
        return { ok: true };
    }

    // Neuer Datensatz mit bestaetigt:true (das Original bleibt unveraendert); jetzt = ISO-Zeitstempel
    function bestaetigt(b, jetzt) {
        return Object.assign({}, b, { bestaetigt: true, bestaetigtAm: jetzt });
    }

    return { zaehlt: zaehlt, kannBestaetigen: kannBestaetigen, bestaetigt: bestaetigt };
})();
if (typeof window !== 'undefined') window.EigenbelegStatus = EigenbelegStatus;
