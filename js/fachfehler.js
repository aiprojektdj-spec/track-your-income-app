// ============================================
// FachFehler — fachliche Formularfehler dauerhaft am Feld und in einer Übersicht
//
// Audit 2026-10-13, D3: Fehler wie "0 %-Position ohne Art des Umsatzes" oder "Reverse-Charge-Kunde
// mit deutscher USt" kamen nur als Toast, der nach drei Sekunden verschwand — welche Position
// betroffen war, blieb offen. Native Pflichtfeldfehler bereitet js/redesign-ui.js schon am Feld
// auf; dieses Modul macht dasselbe für fachliche Prüfungen, die kein `invalid`-Ereignis auslösen:
//  - Übersicht (role="alert") über dem Formular mit Sprung-Schaltflächen je Fehler,
//  - am Feld: aria-invalid="true", Meldung direkt darunter, per aria-describedby verknüpft,
//  - Fokus auf die Übersicht; die Meldungen bleiben, bis neu geprüft wird.
// Ändert der Nutzer das Feld, entfernt js/redesign-ui.js die Markierung am Feld (validity.valid).
// ============================================
const FachFehler = {
    _ids: [],
    _nr: 0,

    leeren() {
        const box = document.getElementById('srFachFehler');
        if (box) box.remove();
        this._ids.forEach(id => {
            const msg = document.getElementById(id);
            const feld = msg && msg._feld;
            if (msg) msg.remove();
            if (feld) {
                feld.removeAttribute('aria-invalid');
                const refs = (feld.getAttribute('aria-describedby') || '').split(' ').filter(r => r && r !== id);
                if (refs.length) feld.setAttribute('aria-describedby', refs.join(' ')); else feld.removeAttribute('aria-describedby');
            }
        });
        this._ids = [];
    },

    // anker: Element, VOR dem die Übersicht erscheint. fehler: [{ text, feld?, ort? }]
    zeige(anker, fehler) {
        this.leeren();
        if (!fehler || !fehler.length) return;
        const liste = fehler.map((f, i) => {
            let sprung = '';
            if (f.feld) {
                if (!f.feld.id) f.feld.id = 'sr-fach-feld-' + (++this._nr);
                f.feld.setAttribute('aria-invalid', 'true');
                const id = 'sr-fach-' + (++this._nr);
                const msg = document.createElement('p');
                msg.id = id;
                msg.className = 'field-error';
                msg.textContent = f.text;
                msg._feld = f.feld;
                f.feld.insertAdjacentElement('afterend', msg);
                f.feld.setAttribute('aria-describedby', [f.feld.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
                this._ids.push(id);
                sprung = ' <button type="button" class="btn btn-small btn-secondary" data-sr-fach-sprung="' + Utils.escapeHtml(f.feld.id) + '">' + Utils.escapeHtml(f.ort || 'Zum Feld') + '</button>';
            }
            return '<li>' + Utils.escapeHtml(f.text) + sprung + '</li>';
        }).join('');
        const box = document.createElement('div');
        box.id = 'srFachFehler';
        box.className = 'sr-fach-fehler';
        box.setAttribute('role', 'alert');
        box.tabIndex = -1;
        box.innerHTML = '<strong>Nicht gespeichert — bitte korrigieren:</strong><ul>' + liste + '</ul>';
        box.addEventListener('click', ev => {
            const b = ev.target.closest && ev.target.closest('[data-sr-fach-sprung]');
            if (!b) return;
            const feld = document.getElementById(b.getAttribute('data-sr-fach-sprung'));
            if (feld) { feld.scrollIntoView && feld.scrollIntoView({ block: 'center' }); feld.focus(); }
        });
        if (anker && anker.parentNode) anker.parentNode.insertBefore(box, anker);
        box.focus && box.focus();
    }
};

if (typeof window !== 'undefined') window.FachFehler = FachFehler;
if (typeof module !== 'undefined' && module.exports) module.exports = FachFehler;
