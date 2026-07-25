// ============================================
// Utils - Formatting & Helper Functions
// ============================================
const Utils = {
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0\u20ac';
    },

    getCurrencySymbol() {
        return '\u20ac';
    },

    formatNumber(num) {
        return parseFloat(num || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    toISODate(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        // Lokalzeit statt UTC: toISOString() lieferte vor 1/2 Uhr nachts das Vortagsdatum
        return d.toLocaleDateString('sv-SE');
    },

    todayISO() {
        return this.toISODate(new Date());
    },

    // ── Smarte Datumseingabe ─────────────────────────────────────────────────
    // Parst "19.04.2026", "19 04 2026", "19042026", "2026-04-19" → "2026-04-19"
    parseDateInput(str) {
        if (!str) return '';
        str = str.trim();
        // ISO bereits: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        // Nur Ziffern: 8 Stellen → DDMMYYYY
        const digits = str.replace(/\D/g, '');
        if (digits.length === 8) {
            const d = digits.slice(0,2), m = digits.slice(2,4), y = digits.slice(4,8);
            return `${y}-${m}-${d}`;
        }
        // TT.MM.JJJJ / TT MM JJJJ / TT/MM/JJJJ
        const parts = str.split(/[.\s\/\-]+/);
        if (parts.length === 3) {
            // Prüfen ob erstes Teil 4-stellig (YYYY) → ISO-ähnlich
            if (parts[0].length === 4) {
                return `${parts[0].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
            }
            return `${parts[2].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return '';
    },

    // "2026-04-19" → "19.04.2026"
    isoToDisplay(iso) {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        if (!y || !m || !d) return iso;
        return `${d}.${m}.${y}`;
    },

    // Erstellt HTML für ein smartes Datumsfeld (gibt ISO intern zurück)
    // Verwendung: Utils.dateInputHtml(id, isoValue, extraStyle)
    dateInputHtml(id, isoValue, extraStyle) {
        const display = this.isoToDisplay(isoValue || this.todayISO());
        return `<input type="text" class="form-input date-input-smart" id="${id}"
                    value="${display}"
                    placeholder="TT.MM.JJJJ"
                    maxlength="10"
                    autocomplete="off"
                    inputmode="numeric"
                    style="${extraStyle || ''}"
                    data-action-input="u-date-fmt"
                    data-action-blur="u-date-finish">`;
    },

    // Auto-Format während Tippen: fügt Punkte nach Tag und Monat ein
    _autoFormatDate(input) {
        let v = input.value.replace(/\D/g, ''); // nur Ziffern
        if (v.length > 8) v = v.slice(0, 8);
        let out = '';
        if (v.length <= 2)      out = v;
        else if (v.length <= 4) out = v.slice(0,2) + '.' + v.slice(2);
        else                    out = v.slice(0,2) + '.' + v.slice(2,4) + '.' + v.slice(4);
        // Cursor ans Ende
        const pos = out.length;
        input.value = out;
        try { input.setSelectionRange(pos, pos); } catch(e) {}
        // Trigger für Live-Vorschau (falls vorhanden)
        input.dispatchEvent(new Event('change', { bubbles: true }));
    },

    // Beim Verlassen: validieren + normalisieren
    _finishDate(input) {
        const iso = this.parseDateInput(input.value);
        if (iso) {
            input.value = this.isoToDisplay(iso);
            input.style.borderColor = '';
        } else if (input.value.trim()) {
            input.style.borderColor = 'var(--danger)';
        }
    },

    // Liest ISO-Wert aus einem Datumsfeld (type="date" gibt bereits ISO zurück)
    getDateInputValue(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        // type="date" → Wert ist bereits YYYY-MM-DD; text-fallback über parseDateInput
        return el.value || '';
    },

    calculateNetRevenue(verkaufspreis, versandkostenKaeufer, plattformgebuehrProzent, versandkostenVerkaufer) {
        const vk = parseFloat(verkaufspreis) || 0;
        const vkKaeufer = parseFloat(versandkostenKaeufer) || 0;
        const gebProzent = parseFloat(plattformgebuehrProzent) || 0;
        const vkVerkaufer = parseFloat(versandkostenVerkaufer) || 0;
        const plattformGebuehr = (vk + vkKaeufer) * (gebProzent / 100);
        return vk - plattformGebuehr - vkVerkaufer;
    },

    getMonthName(monthIndex) {
        const months = ['Januar', 'Februar', 'M\u00e4rz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        return months[monthIndex];
    },

    getMonthShort(monthIndex) {
        const months = ['Jan', 'Feb', 'M\u00e4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        return months[monthIndex];
    },

    isInPeriod(dateStr, startDate, endDate) {
        const d = new Date(dateStr);
        // Ungültiges/leeres Datum: NaN-Vergleiche sind immer false → wäre sonst in JEDER Periode enthalten
        if (isNaN(d)) return false;
        if (startDate && d < new Date(startDate)) return false;
        if (endDate && d > new Date(endDate)) return false;
        return true;
    },

    isCurrentMonth(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    },

    isCurrentYear(dateStr) {
        return new Date(dateStr).getFullYear() === new Date().getFullYear();
    },

    escapeHtml(str) {
        if (!str) return '';
        // Escaped auch Quotes — sicher für Attribut-Kontexte (value="…", title="…")
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Logo-Upload-Sanitizer: prüft Magic Bytes statt dem client-seitig spoofbaren
    // declared MIME-Type, und entschärft SVGs (Script/Event-Handler/javascript:-URIs
    // strippen), bevor sie als data:-URL im Logo-Feld landen.
    sanitizeImageFile(file) {
        return new Promise((resolve, reject) => {
            const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
            if (isSvg) {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
                reader.onload = () => {
                    let text = String(reader.result || '');
                    if (!/^\s*(<\?xml[^>]*>\s*)?(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)) {
                        reject(new Error('Keine gültige SVG-Datei.'));
                        return;
                    }
                    text = text
                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
                        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
                        .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
                        .replace(/(xlink:href|href)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"')
                        .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
                    resolve('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text))));
                };
                reader.readAsText(file);
                return;
            }

            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
            reader.onload = () => {
                const bytes = new Uint8Array(reader.result);
                const hex = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
                const isPng  = hex === '89504e47';
                const isJpeg = hex.startsWith('ffd8ff');
                const isGif  = hex.startsWith('47494638');
                if (!isPng && !isJpeg && !isGif) {
                    reject(new Error('Dateityp nicht erkannt — nur PNG, JPEG, GIF oder SVG erlaubt.'));
                    return;
                }
                const blob = new Blob([bytes], { type: file.type });
                const r2 = new FileReader();
                r2.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
                r2.onload = () => resolve(r2.result);
                r2.readAsDataURL(blob);
            };
            reader.readAsArrayBuffer(file);
        });
    },

    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    downloadCSV(rows, filename) {
        const BOM = '\uFEFF';
        const csv = BOM + rows.map(row => row.map(cell => {
            let str = String(cell == null ? '' : cell);
            // CSV-/Formel-Injection: Excel/Sheets interpretieren Zellen, die mit =, +, -
            // oder @ beginnen, als Formel (z.B. via importiertem SEPA-Verwendungszweck).
            // F\u00FChrendes Apostroph erzwingt Text-Interpretation.
            if (/^[=+\-@]/.test(str)) str = "'" + str;
            return str.includes(';') || str.includes(',') || str.includes('"') || str.includes('\n')
                ? '"' + str.replace(/"/g, '""') + '"'
                : str;
        }).join(';')).join('\n');
        this.downloadFile(csv, filename, 'text/csv;charset=utf-8');
    },

    parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return [];
        const sep = lines[0].includes(';') ? ';' : ',';
        return lines.map(line => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (inQuotes) {
                    if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
                    else if (ch === '"') inQuotes = false;
                    else current += ch;
                } else {
                    if (ch === '"') inQuotes = true;
                    else if (ch === sep) { result.push(current.trim()); current = ''; }
                    else current += ch;
                }
            }
            result.push(current.trim());
            return result;
        });
    },

    // ── aria-live region for screen readers (WCAG 4.1.3) ───────────────────
    _ensureAriaLive() {
        if (this._ariaLive) return;
        const el = document.createElement('div');
        el.id = 'toast-aria-live';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
        document.body.appendChild(el);
        this._ariaLive = el;
    },

    showToast(message, type = 'success') {
        // Emoji-Präfixe/-Suffixe strippen — der Toast-Typ (Farbe) trägt die Semantik bereits
        message = String(message)
            .replace(/^[\s️\p{Extended_Pictographic}]+/u, '')
            .replace(/[\s️\p{Extended_Pictographic}]+$/u, '');

        // Announce to screen readers
        this._ensureAriaLive();
        this._ariaLive.textContent = '';
        setTimeout(() => { this._ariaLive.textContent = message; }, 50);

        if (typeof Notyf !== 'undefined') {
            if (!this._notyf) {
                this._notyf = new Notyf({
                    duration: 3000,
                    position: { x: 'right', y: 'top' },
                    types: [
                        { type: 'success', background: '#10b981', dismissible: false },
                        { type: 'error',   background: '#ef4444', dismissible: true  },
                        { type: 'warning', background: '#f59e0b', dismissible: false },
                        { type: 'info',    background: '#3b82f6', dismissible: false }
                    ]
                });
            }
            if      (type === 'success') this._notyf.success(message);
            else if (type === 'error')   this._notyf.error(message);
            else                         this._notyf.open({ type: type, message });
            return;
        }
        // Fallback wenn Notyf nicht geladen
        let stack = document.getElementById('toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toast-stack';
            document.body.appendChild(stack);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ── Globaler Date-Input-Konverter ──────────────────────────────────────
    // Konvertiert alle type="date" Inputs zu smarten Text-Inputs (TT.MM.JJJJ)
    // Das versteckte type="date" Input behält die ID → bestehender Save-Code unverändert
    _convertDateInput(input) {
        if (!input || input.type !== 'date' || input.dataset.smartConverted) return;
        input.dataset.smartConverted = '1';

        const origId    = input.id;
        const origValue = input.value; // ISO: YYYY-MM-DD

        // Flatpickr-Integration: Calendar-Popup mit deutscher Lokalisierung
        if (typeof flatpickr !== 'undefined') {
            flatpickr(input, {
                locale: (flatpickr.l10ns && flatpickr.l10ns.de) ? 'de' : 'default',
                dateFormat: 'Y-m-d',   // interner Wert bleibt ISO
                altInput: true,         // sichtbares Feld zeigt TT.MM.JJJJ
                altFormat: 'd.m.Y',
                defaultDate: origValue || null,
                allowInput: true,
                disableMobile: false
            });
            return;
        }
        const origStyle = input.getAttribute('style') || '';
        const origClass = input.className;
        const origRequired = input.required;

        // Verstecktes Input behält die original ID (damit bestehender Code .value liest)
        input.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;tabindex:-1;';
        input.removeAttribute('id'); // temporär ID entfernen

        // Sichtbares Text-Input
        const textEl = document.createElement('input');
        textEl.type        = 'text';
        textEl.className   = origClass + ' date-input-smart';
        textEl.id          = origId;          // Text-Input bekommt die sichtbare ID
        textEl.placeholder = 'TT.MM.JJJJ';
        textEl.maxLength   = 10;
        textEl.autocomplete = 'off';
        textEl.inputMode   = 'numeric';
        textEl.required    = origRequired;
        textEl.setAttribute('style', origStyle);
        textEl.value       = this.isoToDisplay(origValue);

        // Hilfsfunktionen: Text → ISO → hidden input aktualisieren
        const syncHidden = () => {
            const iso = this.parseDateInput(textEl.value);
            if (iso) input.value = iso;
        };

        textEl.addEventListener('input', () => {
            this._autoFormatDate(textEl);
            syncHidden();
        });
        textEl.addEventListener('blur', () => {
            this._finishDate(textEl);
            syncHidden();
        });

        // Text-Input direkt VOR dem hidden Input einfügen
        input.parentNode.insertBefore(textEl, input);

        // hidden input bekommt keine sichtbare ID mehr — Code soll textEl lesen
        // ABER: Für Kompatibilität mit altem Code der getElementById(origId) nutzt:
        // textEl hat jetzt die ID — Utils.getDateInputValue(id) liest textEl.value → parst
    },

    // Scannt einen Container und konvertiert alle date inputs darin
    initSmartDates(root) {
        (root || document).querySelectorAll('input[type="date"]:not([data-smart-converted])').forEach(el => {
            this._convertDateInput(el);
        });
    },

    // Startet den globalen MutationObserver (einmalig beim App-Start aufrufen)
    startDateObserver() {
        if (this._dateObserver) return; // bereits gestartet
        const convert = (node) => {
            if (node.nodeType !== 1) return;
            if (node.tagName === 'INPUT' && node.type === 'date') this._convertDateInput(node);
            if (node.querySelectorAll) node.querySelectorAll('input[type="date"]:not([data-smart-converted])').forEach(el => this._convertDateInput(el));
        };
        this._dateObserver = new MutationObserver(mutations => {
            mutations.forEach(m => m.addedNodes.forEach(convert));
        });
        this._dateObserver.observe(document.body, { childList: true, subtree: true });
        // Bestehende konvertieren
        this.initSmartDates(document);
    },

    // ── A11y: verwaiste Formular-Labels nachträglich verknüpfen (WCAG 1.3.1 / 4.1.2) ──
    // Die App rendert durchgehend `<label class="form-label">Text</label><input id="x">`
    // ohne `for=`. Ohne Verknüpfung liest ein Screenreader das Feld unbenannt vor und der
    // Klick aufs Label fokussiert nichts. Statt ~1000 Render-Stellen einzeln anzufassen
    // wird die Verknüpfung zur Laufzeit nachgezogen.
    // ponytail: nimmt das erste Formularelement, das dem Label im DOM folgt (max. 4
    // Geschwister weit, stoppt am nächsten Label). Verschachtelte Sonderfälle, in denen
    // Label und Feld in getrennten Wrappern liegen, bleiben ungelabelt — dort direkt ein
    // `aria-label` am Feld setzen.
    _a11ySeq: 0,
    linkOrphanLabels(root) {
        const FIELD = 'input:not([type="hidden"]),select,textarea';
        (root || document).querySelectorAll('label:not([for])').forEach(lab => {
            if (lab.querySelector(FIELD)) return; // Label umschließt das Feld bereits
            let node = lab.nextElementSibling, field = null, hops = 0;
            while (node && hops++ < 4) {
                if (node.tagName === 'LABEL') break;
                field = node.matches(FIELD) ? node : node.querySelector(FIELD);
                if (field) break;
                node = node.nextElementSibling;
            }
            if (!field || field.closest('label')) return;
            if (field.getAttribute('aria-label') || field.getAttribute('aria-labelledby')) return;
            if (field.labels && field.labels.length) return; // schon anderweitig verknüpft
            if (!field.id) field.id = 'a11y-f' + (++Utils._a11ySeq);
            lab.setAttribute('for', field.id);
        });
    },

    // Einmalig beim App-Start: bestehende Labels verknüpfen + neu gerenderte nachziehen.
    startLabelObserver() {
        if (this._labelObserver) return;
        this._labelObserver = new MutationObserver(() => {
            clearTimeout(this._labelTimer);
            this._labelTimer = setTimeout(() => this.linkOrphanLabels(document), 60);
        });
        this._labelObserver.observe(document.body, { childList: true, subtree: true });
        this.linkOrphanLabels(document);
    }
};

// A11y-Label-Verknüpfung automatisch starten (alle 4 App-Seiten laden utils.js).
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Utils.startLabelObserver());
    } else {
        Utils.startLabelObserver();
    }
}

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'u-date-fmt':    function (e, el) { Utils._autoFormatDate(el); },
    'u-date-finish': function (e, el) { Utils._finishDate(el); }
});
