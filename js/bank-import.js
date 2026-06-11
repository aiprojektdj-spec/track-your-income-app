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
                var amtRaw  = (cells[iAmt]  || '').trim().replace(/^"+|"+$/g, '').replace(/\./g, '').replace(',', '.');
                var descr   = iDescr >= 0 ? (cells[iDescr] || '').trim().replace(/^"+|"+$/g, '') : '';
                var sh      = iCredDeb >= 0 ? (cells[iCredDeb] || '').trim() : '';

                var amount = parseFloat(amtRaw);
                if (isNaN(amount)) continue;
                var isCredit = amount > 0 || sh.toUpperCase().includes('H') || sh.toUpperCase().includes('HABEN');
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
                reader.readAsText(file, 'UTF-8');
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

        html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
        html += '<thead><tr style="background:var(--bg-secondary);">';
        html += '<th style="padding:8px 12px;text-align:left;"><input type="checkbox" id="bankCheckAll"></th>';
        html += '<th style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">Datum</th>';
        html += '<th style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">Betrag</th>';
        html += '<th style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">Art</th>';
        html += '<th style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">Beschreibung</th>';
        html += '<th style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">Kategorie</th>';
        html += '</tr></thead><tbody>';

        transactions.forEach(function (tx, idx) {
            var categories = ['Versandkosten', 'Plattformgebühren', 'Fahrtkosten', 'Büro & Material', 'Wareneinkauf', 'Sonstiges'];
            var autoCategory = guessCategory(tx.description);
            var catOptions = categories.map(function (c) {
                return '<option value="' + c + '"' + (c === autoCategory ? ' selected' : '') + '>' + c + '</option>';
            }).join('');

            html += '<tr style="border-top:1px solid var(--border);" data-idx="' + idx + '">';
            html += '<td style="padding:8px 12px;"><input type="checkbox" class="bank-row-check" data-idx="' + idx + '"></td>';
            html += '<td style="padding:8px 12px;font-size:12px;">' + Utils.formatDate(tx.date) + '</td>';
            html += '<td style="padding:8px 12px;font-weight:700;font-size:13px;color:' + (tx.isCredit ? 'var(--success)' : 'var(--danger)') + ';">';
            html += (tx.isCredit ? '+' : '−') + Utils.formatCurrency(tx.amount) + '</td>';
            html += '<td style="padding:8px 12px;"><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:' + (tx.isCredit ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)') + ';color:' + (tx.isCredit ? 'var(--success)' : 'var(--danger)') + ';">' + (tx.isCredit ? 'Einnahme' : 'Ausgabe') + '</span></td>';
            html += '<td style="padding:8px 12px;font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + Utils.escapeHtml(tx.description) + '">' + Utils.escapeHtml(tx.description.substring(0, 60)) + (tx.description.length > 60 ? '…' : '') + '</td>';
            if (!tx.isCredit) {
                html += '<td style="padding:8px 12px;"><select class="form-select bank-cat-select" data-idx="' + idx + '" style="font-size:12px;padding:4px 8px;">' + catOptions + '</select></td>';
            } else {
                html += '<td style="padding:8px 12px;font-size:12px;color:var(--text-muted);">Einnahme (kein Import)</td>';
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        html += '<div style="padding:10px 16px;font-size:11px;color:var(--text-muted);">Nur Ausgaben werden als Betriebsausgabe importiert. Einnahmen müssen über das Rechnungsmodul erfasst werden.</div>';
        html += '</div>';

        container.innerHTML = html;

        // Events
        var checkAll = document.getElementById('bankCheckAll');
        if (checkAll) {
            checkAll.addEventListener('change', function () {
                document.querySelectorAll('.bank-row-check').forEach(function (cb) {
                    if (!_parsed[cb.dataset.idx].isCredit) cb.checked = checkAll.checked;
                });
            });
        }

        var selectAllBtn = document.getElementById('bankSelectAll');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function () {
                document.querySelectorAll('.bank-row-check').forEach(function (cb) {
                    if (!_parsed[cb.dataset.idx].isCredit) cb.checked = true;
                });
                if (checkAll) checkAll.checked = true;
            });
        }

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

    function importSelected() {
        var checks = document.querySelectorAll('.bank-row-check:checked');
        if (!checks.length) {
            Utils.showToast('Keine Buchungen ausgewählt', 'warning');
            return;
        }

        var imported = 0;
        checks.forEach(function (cb) {
            var idx = parseInt(cb.dataset.idx);
            var tx = _parsed[idx];
            if (!tx || tx.isCredit) return; // Only import expenses

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

        Utils.showToast(imported + ' Buchung(en) als Ausgabe importiert!', 'success');
        // Clear preview
        document.getElementById('bankImportPreview').innerHTML = '<div style="padding:20px;text-align:center;color:var(--success);font-weight:600;">✓ ' + imported + ' Ausgaben importiert!</div>';
        _parsed = [];
    }

    return { render: render, init: init, parse: parse, parseCamt: parseCamt, parseMt940: parseMt940 };
})();
