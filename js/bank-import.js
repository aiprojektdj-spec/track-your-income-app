// ============================================================
// Bank-Import — CAMT.053 XML + MT940 Parser
// Parst Kontoauszüge und überführt Buchungen in Ausgaben/Einnahmen
// ============================================================
var BankImport = (function () {

    // ── CAMT.053 XML Parser ─────────────────────────────────────────────
    function parseCamt(xmlString) {
        var transactions = [];
        try {
            var parser = new DOMParser();
            var doc = parser.parseFromString(xmlString, 'application/xml');
            var parseErr = doc.querySelector('parsererror');
            if (parseErr) throw new Error('XML parse error: ' + parseErr.textContent.slice(0, 100));

            // Handle both namespaced and non-namespaced CAMT
            var entries = doc.querySelectorAll('Ntry');
            if (!entries.length) entries = doc.getElementsByTagNameNS('*', 'Ntry');

            function txt(parent, tagName) {
                var el = parent.querySelector(tagName);
                if (!el) { var els = parent.getElementsByTagNameNS('*', tagName); el = els.length ? els[0] : null; }
                return el ? el.textContent.trim() : '';
            }

            entries.forEach(function (ntry) {
                // Amount
                var amtEl = ntry.querySelector('Amt');
                if (!amtEl) { var els = ntry.getElementsByTagNameNS('*', 'Amt'); amtEl = els.length ? els[0] : null; }
                var amount = amtEl ? parseFloat(amtEl.textContent.trim()) : 0;
                var currency = amtEl ? (amtEl.getAttribute('Ccy') || 'EUR') : 'EUR';

                // Credit/Debit
                var cdtDbt = txt(ntry, 'CdtDbtInd');
                var isCredit = cdtDbt === 'CRDT';

                // Booking date
                var bookingDate = txt(ntry, 'BookgDt') || '';
                if (!bookingDate) bookingDate = txt(ntry, 'ValDt');
                // Date may be inside <Dt> tag
                var dtEl = ntry.querySelector('BookgDt Dt') || ntry.querySelector('ValDt Dt');
                if (!dtEl) {
                    var dtEls = ntry.getElementsByTagNameNS('*', 'Dt');
                    dtEl = dtEls.length ? dtEls[0] : null;
                }
                var date = dtEl ? dtEl.textContent.trim() : bookingDate;

                // Description (unstructured remittance info)
                var ustrd = '';
                var txDtls = ntry.querySelectorAll('TxDtls');
                if (!txDtls.length) txDtls = ntry.getElementsByTagNameNS('*', 'TxDtls');
                if (txDtls.length) {
                    var ustrdEl = txDtls[0].querySelector('Ustrd');
                    if (!ustrdEl) { var us = txDtls[0].getElementsByTagNameNS('*', 'Ustrd'); ustrdEl = us.length ? us[0] : null; }
                    if (ustrdEl) ustrd = ustrdEl.textContent.trim();
                }
                if (!ustrd) {
                    var addtlEntryInf = txt(ntry, 'AddtlNtryInf');
                    ustrd = addtlEntryInf;
                }

                // Creditor/Debitor name
                var counterparty = '';
                var creditorName = ntry.querySelector('Cdtr Name') || ntry.querySelector('Cdtr > Nm');
                var debitorName  = ntry.querySelector('Dbtr Name') || ntry.querySelector('Dbtr > Nm');
                if (!isCredit && creditorName) counterparty = creditorName.textContent.trim();
                if (isCredit  && debitorName)  counterparty = debitorName.textContent.trim();

                if (amount > 0) {
                    transactions.push({
                        date:         normalizeDate(date),
                        amount:       amount,
                        isCredit:     isCredit,
                        currency:     currency,
                        description:  ustrd || counterparty || '',
                        counterparty: counterparty,
                        raw:          'CAMT'
                    });
                }
            });
        } catch (e) {
            console.error('CAMT parse error:', e);
            return { error: e.message, transactions: [] };
        }
        return { transactions: transactions };
    }

    // ── MT940 Text Parser ───────────────────────────────────────────────
    // Format: Swift MT940 statement lines
    // :61: transaction line — YYMMDD[MMDD]C/D[Reversal]Amount[N]FRef//ARref
    // :86: supplementary details (Verwendungszweck etc.)
    function parseMt940(text) {
        var transactions = [];
        try {
            var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            var i = 0;
            var currentTx = null;

            while (i < lines.length) {
                var line = lines[i].trim();

                if (line.startsWith(':61:')) {
                    // New transaction
                    if (currentTx) transactions.push(currentTx);
                    var txLine = line.substring(4);
                    // Parse :61: line
                    // Format: YYMMDD[MMDD]C|D[R]Amount[N]3a[16x]
                    var m = txLine.match(/^(\d{6})(\d{4})?([CD]R?)(\d+,\d{0,2})/);
                    if (m) {
                        var yymmdd = m[1];
                        var year = parseInt(yymmdd.substring(0, 2));
                        year = year >= 90 ? 1900 + year : 2000 + year;
                        var month = yymmdd.substring(2, 4);
                        var day   = yymmdd.substring(4, 6);
                        var cdCode = m[3];
                        var amtStr = m[4].replace(',', '.');
                        var amount = parseFloat(amtStr);
                        var isCredit = cdCode.charAt(0) === 'C';
                        currentTx = {
                            date:        year + '-' + month + '-' + day,
                            amount:      amount,
                            isCredit:    isCredit,
                            currency:    'EUR',
                            description: '',
                            counterparty: '',
                            raw:         'MT940',
                            details:     []
                        };
                    } else {
                        currentTx = null;
                    }
                } else if (line.startsWith(':86:') && currentTx) {
                    // Supplementary info — collect multi-line
                    var detailLine = line.substring(4);
                    currentTx.details.push(detailLine);
                } else if (line.startsWith(':') && currentTx && currentTx.details.length === 0) {
                    // Other tag — not continuation
                } else if (currentTx && currentTx.details.length > 0 && !line.startsWith(':') && line) {
                    // Continuation of :86: field
                    currentTx.details.push(line);
                }

                i++;
            }
            if (currentTx) transactions.push(currentTx);

            // Post-process: extract description from :86: details
            transactions.forEach(function (tx) {
                if (tx.details && tx.details.length) {
                    var raw = tx.details.join(' ');
                    // Parse SWIFT sub-fields (?20-?29 = Verwendungszweck, ?30=BLZ, ?31=IBAN, ?32-33=Name)
                    var vzw = '';
                    var name = '';
                    var subField = raw.match(/\?20([^\?]+)/);
                    if (subField) vzw += subField[1].trim();
                    for (var n = 21; n <= 29; n++) {
                        var sf = raw.match(new RegExp('\\?' + n + '([^\\?]+)'));
                        if (sf) vzw += ' ' + sf[1].trim();
                    }
                    var nameField = raw.match(/\?32([^\?]+)/);
                    if (nameField) name = nameField[1].trim();
                    var name2 = raw.match(/\?33([^\?]+)/);
                    if (name2) name += ' ' + name2[1].trim();

                    tx.description  = (vzw  || raw.substring(0, 80)).trim();
                    tx.counterparty = name.trim();
                    delete tx.details;
                }
            });

        } catch (e) {
            console.error('MT940 parse error:', e);
            return { error: e.message, transactions: [] };
        }
        return { transactions: transactions };
    }

    // ── CSV Kontoauszug (generic) ───────────────────────────────────────
    // Supports common German bank CSV exports (semicolon-separated)
    function parseCsv(csvText) {
        var transactions = [];
        try {
            var lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            if (lines.length < 2) return { error: 'Zu wenig Zeilen', transactions: [] };

            // Try to detect header line
            var headerIdx = 0;
            var header = '';
            for (var i = 0; i < Math.min(5, lines.length); i++) {
                if (lines[i].toLowerCase().includes('datum') || lines[i].toLowerCase().includes('buchungstag')) {
                    headerIdx = i;
                    header = lines[i];
                    break;
                }
            }

            var sep = header.includes(';') ? ';' : ',';
            var cols = header.split(sep).map(function (c) { return c.trim().replace(/^"+|"+$/g, '').toLowerCase(); });

            // Column index detection
            var iDate    = cols.findIndex(function (c) { return c.includes('datum') || c.includes('buchungstag'); });
            var iAmt     = cols.findIndex(function (c) { return c.includes('betrag') || c.includes('umsatz') || c.includes('amount'); });
            var iDescr   = cols.findIndex(function (c) { return c.includes('verwendungs') || c.includes('buchungstext') || c.includes('description'); });
            var iCredDeb = cols.findIndex(function (c) { return c.includes('soll') || c.includes('haben') || c.includes('s/h'); });

            if (iDate < 0 || iAmt < 0) return { error: 'Spalten Datum/Betrag nicht gefunden', transactions: [] };

            for (var li = headerIdx + 1; li < lines.length; li++) {
                var row = lines[li];
                if (!row.trim()) continue;
                var cells = splitCsvRow(row, sep);
                if (cells.length <= iAmt) continue;

                var dateRaw = (cells[iDate] || '').trim().replace(/^"+|"+$/g, '');
                var amtRaw  = (cells[iAmt]  || '').trim().replace(/^"+|"+$/g, '');
                var descr   = iDescr >= 0 ? (cells[iDescr] || '').trim().replace(/^"+|"+$/g, '') : '';
                var sh      = iCredDeb >= 0 ? (cells[iCredDeb] || '').trim().toUpperCase() : '';

                var amount = parseAmount(amtRaw);
                if (isNaN(amount)) continue;
                // S/H-Marker hat Vorrang (viele Banken exportieren vorzeichenlose Beträge),
                // Vorzeichen nur als Fallback ohne Marker
                var isCredit;
                if (sh.indexOf('S') === 0 || sh.indexOf('SOLL') !== -1)       isCredit = false;
                else if (sh.indexOf('H') === 0 || sh.indexOf('HABEN') !== -1) isCredit = true;
                else isCredit = amount > 0;
                if (amount < 0) { amount = Math.abs(amount); isCredit = false; }

                var date = normalizeDate(dateRaw);
                if (!date) continue;

                transactions.push({
                    date:        date,
                    amount:      amount,
                    isCredit:    isCredit,
                    currency:    'EUR',
                    description: descr,
                    counterparty: '',
                    raw:         'CSV'
                });
            }
        } catch (e) {
            console.error('CSV parse error:', e);
            return { error: e.message, transactions: [] };
        }
        return { transactions: transactions };
    }

    // Betrag DE ("1.234,56") und EN ("1,234.56" / "1234.56") korrekt parsen.
    // Vorher wurden alle Punkte gestrichen → englische Dezimalbeträge x100 verfälscht.
    function parseAmount(s) {
        s = String(s || '').replace(/[^\d.,-]/g, '');
        if (!s) return NaN;
        if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, '')); // "1.234" = DE-Tausender
        var lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');  // DE: Komma ist Dezimal
        else                     s = s.replace(/,/g, '');                     // EN: Punkt ist Dezimal
        return parseFloat(s);
    }

    function splitCsvRow(row, sep) {
        var cells = [];
        var inQuote = false;
        var cell = '';
        for (var i = 0; i < row.length; i++) {
            var ch = row[i];
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === sep && !inQuote) { cells.push(cell); cell = ''; }
            else { cell += ch; }
        }
        cells.push(cell);
        return cells;
    }

    // Normalize various date formats to YYYY-MM-DD
    function normalizeDate(str) {
        if (!str) return '';
        str = str.trim();
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        // DD.MM.YYYY
        var m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (m) return m[3] + '-' + m[2] + '-' + m[1];
        // DD/MM/YYYY
        m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return m[3] + '-' + m[2] + '-' + m[1];
        // YYYYMMDD
        m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (m) return m[1] + '-' + m[2] + '-' + m[3];
        return str;
    }

    // ── Auto-detect format ──────────────────────────────────────────────
    function parse(content, filename) {
        var ext = (filename || '').split('.').pop().toLowerCase();
        var trimmed = content.trim();
        if (ext === 'xml' || trimmed.startsWith('<?xml') || trimmed.startsWith('<Document') || trimmed.includes('CrossIndustry') || trimmed.includes('<BkToCstmrStmt')) {
            return parseCamt(content);
        }
        if (ext === 'sta' || trimmed.startsWith(':20:') || trimmed.startsWith(':25:') || trimmed.includes(':61:')) {
            return parseMt940(content);
        }
        // Fallback: try CSV
        return parseCsv(content);
    }

    // ── Zahlungsabgleich: Einnahme ↔ offene Rechnung ─────────────────────
    // Bis 2026-08-12 hat der Import jede Gutschrift mit "Einnahme (kein Import)" verworfen —
    // dabei ist "welche meiner Rechnungen ist bezahlt worden?" der häufigste Grund, einen
    // Kontoauszug überhaupt zu importieren. Gebucht wird hier nichts automatisch: der Import
    // schlägt eine Zuordnung vor, entscheiden muss der Nutzer.

    function invoiceBrutto(inv) {
        var isKlein = inv.isKlein !== undefined ? inv.isKlein : (Store.getSettings().ustMode === 'klein');
        var sum = 0;
        (inv.positionen || []).forEach(function (p) {
            var netto = (p.menge || 0) * (p.einzelpreis || 0);
            sum += netto + (isKlein ? 0 : netto * (parseFloat(p.mwstSatz) || 0) / 100);
        });
        return sum;
    }

    function invoiceRest(inv) {
        var gezahlt = (inv.teilzahlungen || []).reduce(function (s, t) { return s + (parseFloat(t.betrag) || 0); }, 0);
        return Math.max(0, invoiceBrutto(inv) - gezahlt);
    }

    function openInvoices() {
        var all = Store.getRechInvoices ? Store.getRechInvoices() : [];
        return all.filter(function (inv) {
            return inv.typ === 'rechnung' && !inv._storniert &&
                   ['offen', 'versendet', 'ueberfaellig'].indexOf(inv.status) !== -1;
        });
    }

    // Rechnungsnummern stehen im Verwendungszweck in allen denkbaren Schreibweisen:
    // "RE-2026-0007", "RE 2026 0007", "Rechnung Nr. 20260007". Für den Vergleich bleibt
    // deshalb nur, was in jeder Variante gleich ist: Ziffern und Buchstaben.
    function normRef(s) {
        return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function customerName(inv) {
        var k = (Store.getRechCustomers() || []).find(function (c) { return c.id === inv.kundeId; });
        return k ? (k.firma || k.ansprechpartner || '') : '';
    }

    /** Kandidaten für eine Gutschrift, bester zuerst. Kein Treffer => leeres Array. */
    function matchCandidates(tx, invoices) {
        var desc = normRef(tx.description);
        var cands = [];
        invoices.forEach(function (inv) {
            var rest = invoiceRest(inv);
            if (rest <= 0) return;
            var score = 0, gruende = [];

            var nr = normRef(inv.nummer);
            if (nr && nr.length >= 4 && desc.indexOf(nr) !== -1) { score += 100; gruende.push('Rechnungsnummer im Verwendungszweck'); }

            var diff = Math.abs(rest - tx.amount);
            if (diff < 0.005)      { score += 50; gruende.push('Betrag entspricht dem offenen Rest'); }
            else if (diff <= 1.00) { score += 20; gruende.push('Betrag weicht um ' + Utils.formatCurrency(diff) + ' ab'); }
            else if (tx.amount < rest) { score += 5; gruende.push('Teilbetrag von ' + Utils.formatCurrency(rest)); }

            var kunde = normRef(customerName(inv));
            if (kunde && kunde.length >= 4 && desc.indexOf(kunde) !== -1) { score += 25; gruende.push('Kundenname im Verwendungszweck'); }

            // Eine Zahlung vor dem Rechnungsdatum ist möglich (Vorkasse), aber untypisch —
            // sie zählt als Signal gegen die Zuordnung, schließt sie aber nicht aus.
            if (tx.date && inv.datum && tx.date < inv.datum) { score -= 15; gruende.push('Zahlung liegt vor dem Rechnungsdatum'); }

            if (score > 0) cands.push({ inv: inv, rest: rest, score: score, gruende: gruende });
        });
        cands.sort(function (a, b) { return b.score - a.score; });
        return cands;
    }

    /** Vorauswahl nur, wenn die Zuordnung eindeutig ist — sonst entscheidet der Nutzer. */
    function autoPick(cands) {
        if (!cands.length) return null;
        if (cands[0].score < 50) return null;                     // schwacher Treffer: nie vorwählen
        if (cands.length > 1 && cands[1].score === cands[0].score) return null; // Gleichstand
        return cands[0];
    }

    // ── Import UI ───────────────────────────────────────────────────────
    var _parsed = [];

    function render() {
        var html = '<div class="page-header"><h2><i class="ti ti-building-bank"></i> Bank-Import</h2>';
        html += '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">CAMT.053 XML, MT940 (.sta) oder CSV-Kontoauszug importieren</div></div>';

        html += '<div class="card" style="padding:20px;">';
        html += '<div style="font-weight:700;font-size:14px;margin-bottom:8px;">Kontoauszug hochladen</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Unterstützte Formate: <strong>CAMT.053 XML</strong> (alle deutschen Banken), <strong>MT940 / STA</strong> (Swift), <strong>CSV</strong> (Sparkasse, ING, DKB, Comdirect).</div>';
        html += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">';
        html += '<div style="flex:1;min-width:200px;">';
        html += '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Datei wählen</label>';
        html += '<input type="file" id="bankImportFile" accept=".xml,.sta,.mt940,.csv,.txt" style="display:block;width:100%;padding:8px;border:1px dashed var(--border);border-radius:var(--radius);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;cursor:pointer;">';
        html += '</div>';
        html += '<button class="btn btn-primary" id="bankImportParseBtn" style="align-self:flex-end;">Datei analysieren</button>';
        html += '</div>';
        html += '</div>';

        html += '<div id="bankImportPreview" style="margin-top:16px;"></div>';

        return html;
    }

    function init() {
        var parseBtn = document.getElementById('bankImportParseBtn');
        if (parseBtn) {
            parseBtn.addEventListener('click', function () {
                var fileInput = document.getElementById('bankImportFile');
                if (!fileInput || !fileInput.files.length) {
                    Utils.showToast('Bitte eine Datei auswählen', 'warning');
                    return;
                }
                var file = fileInput.files[0];
                var reader = new FileReader();
                reader.onload = function (e) {
                    var content = e.target.result;
                    var result = parse(content, file.name);
                    if (result.error) {
                        Utils.showToast('Fehler beim Lesen: ' + result.error, 'error');
                        return;
                    }
                    _parsed = result.transactions;
                    renderPreview(_parsed);
                };
                // MT940/STA from German banks is often ISO-8859-1; XML/CSV is UTF-8
                const ext = file.name.split('.').pop().toLowerCase();
                const encoding = (ext === 'sta' || ext === 'mt940') ? 'ISO-8859-1' : 'UTF-8';
                reader.readAsText(file, encoding);
            });
        }
    }

    function renderPreview(transactions) {
        var container = document.getElementById('bankImportPreview');
        if (!container) return;
        if (!transactions.length) {
            container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">Keine Buchungen gefunden.</div>';
            return;
        }

        var html = '<div class="card" style="padding:0;overflow:hidden;">';
        html += '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="font-weight:700;font-size:14px;">' + transactions.length + ' Buchungen gefunden</div>';
        html += '<div style="display:flex;gap:8px;">';
        html += '<button class="btn btn-small btn-outline" id="bankSelectAll">Alle auswählen</button>';
        html += '<button class="btn btn-small btn-primary" id="bankImportSelected">Ausgewählte importieren</button>';
        html += '</div>';
        html += '</div>';

        html += '<div class="table-container" style="border:none;border-radius:0;box-shadow:none;"><table>';
        html += '<thead><tr>';
        html += '<th><input type="checkbox" id="bankCheckAll"></th>';
        html += '<th>Datum</th>';
        html += '<th>Betrag</th>';
        html += '<th>Art</th>';
        html += '<th>Beschreibung</th>';
        html += '<th>Kategorie</th>';
        html += '</tr></thead><tbody>';

        var offene = openInvoices();

        transactions.forEach(function (tx, idx) {
            var categories = ['Versandkosten', 'Plattformgebühren', 'Fahrtkosten', 'Büro & Material', 'Wareneinkauf', 'Sonstiges'];
            var autoCategory = guessCategory(tx.description);
            var catOptions = categories.map(function (c) {
                return '<option value="' + c + '"' + (c === autoCategory ? ' selected' : '') + '>' + c + '</option>';
            }).join('');

            html += '<tr data-idx="' + idx + '">';
            html += '<td><input type="checkbox" class="bank-row-check" data-idx="' + idx + '"></td>';
            html += '<td>' + Utils.formatDate(tx.date) + '</td>';
            html += '<td style="font-weight:700;color:' + (tx.isCredit ? 'var(--success)' : 'var(--danger)') + ';">';
            html += (tx.isCredit ? '+' : '−') + Utils.formatCurrency(tx.amount) + '</td>';
            html += '<td><span class="badge ' + (tx.isCredit ? 'badge-success' : 'badge-danger') + '">' + (tx.isCredit ? 'Einnahme' : 'Ausgabe') + '</span></td>';
            html += '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + Utils.escapeHtml(tx.description) + '">' + Utils.escapeHtml(tx.description.substring(0, 60)) + (tx.description.length > 60 ? '…' : '') + '</td>';
            if (!tx.isCredit) {
                html += '<td><select class="form-select bank-cat-select" data-idx="' + idx + '" style="font-size:12px;padding:4px 8px;">' + catOptions + '</select></td>';
            } else {
                var cands = matchCandidates(tx, offene);
                var pick  = autoPick(cands);
                if (!cands.length) {
                    html += '<td style="color:var(--text-muted);font-size:12px;">Keine offene Rechnung passt</td>';
                } else {
                    var opts = '<option value="">-- nicht zuordnen --</option>';
                    cands.forEach(function (c) {
                        var sel = (pick && pick.inv.id === c.inv.id) ? ' selected' : '';
                        opts += '<option value="' + c.inv.id + '"' + sel + '>'
                             +  Utils.escapeHtml(c.inv.nummer || '(ohne Nr.)') + ' · '
                             +  Utils.escapeHtml(customerName(c.inv) || 'ohne Kunde') + ' · offen '
                             +  Utils.formatCurrency(c.rest) + '</option>';
                    });
                    html += '<td><select class="form-select bank-inv-select" data-idx="' + idx + '" style="font-size:12px;padding:4px 8px;">' + opts + '</select>';
                    var top = pick || cands[0];
                    html += '<div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;">' + Utils.escapeHtml(top.gruende.join(' · ')) + '</div>';
                    if (!pick) {
                        html += '<div style="font-size:10.5px;color:var(--warning);margin-top:2px;">Nicht eindeutig — bitte selbst prüfen</div>';
                    }
                    html += '</td>';
                }
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        html += '<div style="padding:10px 16px;font-size:11px;color:var(--text-muted);">Ausgaben werden als Betriebsausgabe gebucht. Einnahmen werden keiner Buchung, sondern einer <strong>offenen Rechnung</strong> zugeordnet: deckt die Zahlung den Restbetrag, gilt die Rechnung als bezahlt, sonst wird sie als Teilzahlung erfasst. Vorschläge werden nie ungefragt gebucht — nur angehakte Zeilen.</div>';
        html += '</div>';

        container.innerHTML = html;

        // Events
        var checkAll = document.getElementById('bankCheckAll');
        if (checkAll) {
            checkAll.addEventListener('change', function () {
                document.querySelectorAll('.bank-row-check').forEach(function (cb) {
                    if (istBuchbar(cb.dataset.idx)) cb.checked = checkAll.checked;
                });
            });
        }

        var selectAllBtn = document.getElementById('bankSelectAll');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function () {
                document.querySelectorAll('.bank-row-check').forEach(function (cb) {
                    if (istBuchbar(cb.dataset.idx)) cb.checked = true;
                });
                if (checkAll) checkAll.checked = true;
            });
        }

        // Wer eine Rechnung zuordnet, will die Zeile auch buchen — Haken automatisch setzen
        // und wieder entfernen, wenn die Zuordnung zurueckgenommen wird.
        document.querySelectorAll('.bank-inv-select').forEach(function (sel) {
            sel.addEventListener('change', function () {
                var cb = document.querySelector('.bank-row-check[data-idx="' + this.dataset.idx + '"]');
                if (cb) cb.checked = !!this.value;
            });
        });

        var importBtn = document.getElementById('bankImportSelected');
        if (importBtn) {
            importBtn.addEventListener('click', importSelected);
        }
    }

    function guessCategory(description) {
        var desc = (description || '').toLowerCase();
        if (desc.includes('dhl') || desc.includes('hermes') || desc.includes('dpd') || desc.includes('versand') || desc.includes('porto')) return 'Versandkosten';
        if (desc.includes('ebay') || desc.includes('amazon') || desc.includes('etsy') || desc.includes('provision') || desc.includes('gebühr')) return 'Plattformgebühren';
        if (desc.includes('tankstelle') || desc.includes('aral') || desc.includes('shell') || desc.includes('bahn') || desc.includes('fahrt')) return 'Fahrtkosten';
        if (desc.includes('büro') || desc.includes('material') || desc.includes('papier') || desc.includes('schreibwaren')) return 'Büro & Material';
        if (desc.includes('einkauf') || desc.includes('kaufland') || desc.includes('otto') || desc.includes('alibaba')) return 'Wareneinkauf';
        return 'Sonstiges';
    }

    /** Anhakbar ist eine Zeile, wenn sie zu einer Buchung führen kann: jede Ausgabe,
     *  und jede Einnahme, für die eine Rechnung ausgewählt ist. */
    function istBuchbar(idx) {
        var tx = _parsed[idx];
        if (!tx) return false;
        if (!tx.isCredit) return true;
        var sel = document.querySelector('.bank-inv-select[data-idx="' + idx + '"]');
        return !!(sel && sel.value);
    }

    function importSelected() {
        var checks = document.querySelectorAll('.bank-row-check:checked');
        if (!checks.length) {
            Utils.showToast('Keine Buchungen ausgewählt', 'warning');
            return;
        }

        var imported = 0;      // Ausgaben
        var bezahlt = 0;       // vollständig beglichene Rechnungen
        var teilzahlungen = 0; // erfasste Teilzahlungen
        var uebersprungen = [];

        checks.forEach(function (cb) {
            var idx = parseInt(cb.dataset.idx);
            var tx = _parsed[idx];
            if (!tx) return;

            // ── Einnahme: einer offenen Rechnung zuordnen ────────────────────
            if (tx.isCredit) {
                var sel = document.querySelector('.bank-inv-select[data-idx="' + idx + '"]');
                var invId = sel ? sel.value : '';
                if (!invId) return; // ohne Zuordnung passiert bewusst nichts

                var inv = (Store.getRechInvoices() || []).find(function (i) { return i.id === invId; });
                if (!inv) { uebersprungen.push('Rechnung nicht mehr vorhanden'); return; }

                var rest = invoiceRest(inv);
                // Zahlung deckt den Rest (Cent-Toleranz gegen Rundung): Rechnung ist beglichen.
                // Überzahlungen zählen ebenfalls als beglichen — die Differenz ist ein
                // Erstattungsfall, den der Zahlungsabgleich nicht entscheiden darf.
                if (tx.amount >= rest - 0.005) {
                    inv.status = 'bezahlt';
                    inv.bezahltAm = tx.date;
                    var saved = Store.saveRechInvoice(inv);
                    if (!saved) { uebersprungen.push((inv.nummer || invId) + ' ist gesperrt'); return; }
                    bezahlt++;
                } else {
                    // Teilzahlung: eigener Store-Pfad, weil er den anteiligen Zufluss nach
                    // §11 EStG zum Zahlungsdatum mitbucht und das Audit-Log schreibt.
                    var res = Store.addRechTeilzahlung(invId, tx.amount, tx.date);
                    if (!res) { uebersprungen.push((inv.nummer || invId) + ' nimmt keine Teilzahlung an'); return; }
                    teilzahlungen++;
                }
                return;
            }

            // ── Ausgabe: unverändert als Betriebsausgabe ─────────────────────
            var catEl = document.querySelector('.bank-cat-select[data-idx="' + idx + '"]');
            var kategorie = catEl ? catEl.value : 'Sonstiges';

            var expense = {
                id:          Store.generateId(),
                datum:       tx.date,
                betrag:      tx.amount,
                kategorie:   kategorie,
                beschreibung: tx.description.substring(0, 100),
                belegnummer:  'BANK-' + tx.date.replace(/-/g, ''),
                createdAt:   new Date().toISOString(),
                _bankImport: true
            };
            Store.saveExpense(expense);
            imported++;
        });

        // Bezahlte Rechnungen in Verkäufe überführen — derselbe Weg, den auch das
        // Dashboard beim Öffnen geht. Erst nach der Schleife, damit jede Rechnung
        // nur einmal betrachtet wird.
        if (bezahlt > 0 && Store.autoSyncInvoices) Store.autoSyncInvoices();

        var teile = [];
        if (imported)      teile.push(imported + ' Ausgabe(n) gebucht');
        if (bezahlt)       teile.push(bezahlt + ' Rechnung(en) als bezahlt markiert');
        if (teilzahlungen) teile.push(teilzahlungen + ' Teilzahlung(en) erfasst');
        var msg = teile.length ? teile.join(', ') : 'Nichts gebucht';

        Utils.showToast(msg + (uebersprungen.length ? ' — ' + uebersprungen.length + ' übersprungen' : ''),
                        teile.length ? 'success' : 'warning');

        var out = '<div style="padding:20px;text-align:center;color:var(--success);font-weight:600;">✓ ' + Utils.escapeHtml(msg) + '</div>';
        if (uebersprungen.length) {
            out += '<div style="padding:0 20px 20px;text-align:center;font-size:12px;color:var(--warning);">Übersprungen: '
                +  Utils.escapeHtml(uebersprungen.join(' · ')) + '</div>';
        }
        document.getElementById('bankImportPreview').innerHTML = out;
        _parsed = [];
    }

    return { render: render, init: init, parse: parse, parseCamt: parseCamt, parseMt940: parseMt940 };
})();
