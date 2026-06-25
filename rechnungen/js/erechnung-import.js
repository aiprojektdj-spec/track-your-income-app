// ============================================================
// E-Rechnung empfangen — Import & Anzeige (EN 16931)
// Parst XRechnung (UBL + CII) und ZUGFeRD/Factur-X (CII).
// Empfangspflicht seit 01.01.2025 für alle inländischen B2B,
// inkl. §19-Kleinunternehmer (§14 UStG i.V.m. WCG).
//
// Local-first: nichts wird hochgeladen. Parsing rein im Browser.
// GoBD: Original unveraendert 8 Jahre aufbewahren (Nutzerpflicht, §14b UStG).
// ============================================================
var ERechnungImport = (function () {
    'use strict';

    var _last = null; // { name, blob }

    // ── Helpers ───────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function fmtAmount(n) {
        if (n == null || n === '') return '—';
        var v = parseFloat(String(n).replace(',', '.'));
        return isNaN(v) ? esc(n) : v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDate(s) {
        if (!s) return '—';
        var m = String(s).trim().match(/^(\d{4})-?(\d{2})-?(\d{2})/);
        return m ? (m[3] + '.' + m[2] + '.' + m[1]) : esc(s);
    }

    // Namespace-agnostische Suche per localName
    function el(root, ln) {
        if (!root) return null;
        var a = root.getElementsByTagName('*');
        for (var i = 0; i < a.length; i++) if (a[i].localName === ln) return a[i];
        return null;
    }
    function els(root, ln) {
        var out = []; if (!root) return out;
        var a = root.getElementsByTagName('*');
        for (var i = 0; i < a.length; i++) if (a[i].localName === ln) out.push(a[i]);
        return out;
    }
    function txt(root, ln) { var e = el(root, ln); return e ? e.textContent.trim() : ''; }
    function elPath(root, names) { var c = root; for (var i = 0; i < names.length && c; i++) c = el(c, names[i]); return c; }
    function directChild(p, ln) { if (!p) return null; var c = p.children; for (var i = 0; i < c.length; i++) if (c[i].localName === ln) return c[i]; return null; }
    function directText(p, ln) { var e = directChild(p, ln); return e ? e.textContent.trim() : ''; }

    // ── Parser: Einstieg ──────────────────────────────────────
    function parseXmlString(xmlStr) {
        var doc;
        try { doc = new DOMParser().parseFromString(String(xmlStr).replace(/^﻿/, '').trim(), 'application/xml'); }
        catch (e) { return { format: 'unbekannt', valid: false, errors: ['XML konnte nicht gelesen werden.'] }; }
        var root = doc && doc.documentElement;
        if (!root || root.localName === 'parsererror') {
            return { format: 'unbekannt', valid: false, errors: ['Kein gültiges XML.'] };
        }
        if (root.localName === 'CrossIndustryInvoice') return parseCII(root);
        if (root.localName === 'Invoice' || root.localName === 'CreditNote') return parseUBL(root, root.localName);
        return { format: 'unbekannt', valid: false, errors: ['Kein E-Rechnungs-Wurzelelement gefunden (<' + esc(root.localName) + '>). Erwartet: CrossIndustryInvoice (CII) oder Invoice (UBL).'] };
    }

    // ── Parser: CII (ZUGFeRD / XRechnung-CII) ─────────────────
    function parseCII(root) {
        var r = { syntax: 'CII' };
        var ctx = el(root, 'GuidelineSpecifiedDocumentContextParameter');
        r.profile = ctx ? txt(ctx, 'ID') : '';
        var exDoc = el(root, 'ExchangedDocument');
        r.nummer = exDoc ? txt(exDoc, 'ID') : '';
        r.typeCode = exDoc ? txt(exDoc, 'TypeCode') : '';
        r.datum = exDoc ? txt(el(exDoc, 'IssueDateTime'), 'DateTimeString') : '';
        r.sellerName = txt(el(root, 'SellerTradeParty'), 'Name');
        r.buyerName = txt(el(root, 'BuyerTradeParty'), 'Name');
        r.currency = txt(root, 'InvoiceCurrencyCode') || 'EUR';
        var sum = el(root, 'SpecifiedTradeSettlementHeaderMonetarySummation');
        if (sum) {
            r.netto = txt(sum, 'TaxBasisTotalAmount') || txt(sum, 'LineTotalAmount');
            r.steuer = txt(sum, 'TaxTotalAmount');
            r.brutto = txt(sum, 'GrandTotalAmount');
        }
        r.iban = txt(root, 'IBANID');
        r.lines = els(root, 'IncludedSupplyChainTradeLineItem').map(function (li) {
            var price = elPath(li, ['SpecifiedLineTradeAgreement', 'NetPriceProductTradePrice', 'ChargeAmount']);
            var qty = el(li, 'BilledQuantity');
            return {
                name: txt(el(li, 'SpecifiedTradeProduct'), 'Name'),
                menge: qty ? qty.textContent.trim() : '',
                preis: price ? price.textContent.trim() : '',
                total: txt(el(li, 'SpecifiedTradeSettlementLineMonetarySummation'), 'LineTotalAmount')
            };
        });
        finalize(r);
        return r;
    }

    // ── Parser: UBL (XRechnung-UBL) ───────────────────────────
    function ublPartyName(wrap) {
        if (!wrap) return '';
        var party = el(wrap, 'Party'); if (!party) return '';
        var rn = txt(el(party, 'PartyLegalEntity'), 'RegistrationName');
        if (rn) return rn;
        return txt(el(party, 'PartyName'), 'Name');
    }
    function parseUBL(root, rn) {
        var r = { syntax: 'UBL' };
        r.profile = directText(root, 'CustomizationID');
        r.nummer = directText(root, 'ID');
        r.typeCode = directText(root, rn === 'CreditNote' ? 'CreditNoteTypeCode' : 'InvoiceTypeCode');
        r.datum = directText(root, 'IssueDate');
        r.currency = directText(root, 'DocumentCurrencyCode') || 'EUR';
        r.sellerName = ublPartyName(el(root, 'AccountingSupplierParty'));
        r.buyerName = ublPartyName(el(root, 'AccountingCustomerParty'));
        var legal = el(root, 'LegalMonetaryTotal');
        if (legal) { r.netto = txt(legal, 'LineExtensionAmount'); r.brutto = txt(legal, 'TaxInclusiveAmount') || txt(legal, 'PayableAmount'); }
        r.steuer = txt(el(root, 'TaxTotal'), 'TaxAmount');
        r.iban = txt(el(root, 'PayeeFinancialAccount'), 'ID');
        r.lines = els(root, rn === 'CreditNote' ? 'CreditNoteLine' : 'InvoiceLine').map(function (li) {
            return {
                name: txt(el(li, 'Item'), 'Name'),
                menge: txt(li, 'InvoicedQuantity') || txt(li, 'CreditedQuantity'),
                preis: txt(el(li, 'Price'), 'PriceAmount'),
                total: txt(li, 'LineExtensionAmount')
            };
        });
        finalize(r);
        return r;
    }

    // ── Format-Label + EN16931-Plausibilität ──────────────────
    function formatLabel(r) {
        var p = (r.profile || '').toLowerCase();
        if (p.indexOf('xrechnung') >= 0) return 'XRechnung (' + r.syntax + ')';
        if (p.indexOf('factur-x') >= 0 || p.indexOf('zugferd') >= 0) {
            var prof = '';
            ['minimum', 'basicwl', 'basic', 'en16931', 'extended'].forEach(function (k) { if (p.indexOf(k) >= 0 && !prof) prof = k.toUpperCase(); });
            return 'ZUGFeRD / Factur-X' + (prof ? ' · ' + prof : '') + ' (' + r.syntax + ')';
        }
        return 'EN 16931 · ' + r.syntax;
    }
    function finalize(r) {
        r.format = formatLabel(r);
        r.errors = []; r.warnings = [];
        if (!r.nummer) r.errors.push('Rechnungsnummer (BT-1) fehlt.');
        if (!r.datum) r.errors.push('Rechnungsdatum (BT-2) fehlt.');
        if (!r.sellerName) r.errors.push('Verkäufer-Name (BT-27) fehlt.');
        if (!r.buyerName) r.warnings.push('Käufer-Name (BT-44) fehlt.');
        if (!r.brutto) r.warnings.push('Gesamtbetrag (BT-112) fehlt.');
        if (!r.iban) r.warnings.push('IBAN (BT-84) nicht gefunden.');
        var p = (r.profile || '').toLowerCase();
        if (p.indexOf('minimum') >= 0) r.errors.push('ZUGFeRD-Profil MINIMUM zählt rechtlich NICHT als vollwertige E-Rechnung (keine vollständigen Steuerangaben).');
        if (p.replace(/[-_]/g, '').indexOf('basicwl') >= 0) r.errors.push('ZUGFeRD-Profil BASIC-WL zählt rechtlich NICHT als E-Rechnung (ohne Positionsdaten).');
        r.valid = r.errors.length === 0;
    }

    // ── PDF: Best-Effort eingebettete XML extrahieren ─────────
    function bytesToLatin1(bytes) {
        var s = '', CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return s;
    }
    function scanInvoiceXml(s) {
        var m = s.match(/<\?xml[\s\S]*?<(?:[\w.-]+:)?CrossIndustryInvoice[\s\S]*?<\/(?:[\w.-]+:)?CrossIndustryInvoice>/);
        if (m) return m[0];
        m = s.match(/<(?:[\w.-]+:)?CrossIndustryInvoice[\s\S]*?<\/(?:[\w.-]+:)?CrossIndustryInvoice>/);
        if (m) return m[0];
        m = s.match(/<\?xml[\s\S]*?<(?:[\w.-]+:)?(?:Invoice|CreditNote)[\s\S]*?<\/(?:[\w.-]+:)?(?:Invoice|CreditNote)>/);
        if (m) return m[0];
        return null;
    }
    async function inflateStreams(bytes) {
        if (typeof DecompressionStream === 'undefined') return null;
        var s = bytesToLatin1(bytes), idx = 0;
        while (true) {
            var start = s.indexOf('stream', idx);
            if (start < 0) break;
            idx = start + 6;
            // "endstream" enthaelt auch "stream" — die ueberspringen wir implizit, da inflate scheitert
            var end = s.indexOf('endstream', idx);
            if (end < 0) break;
            var b0 = start + 6;
            if (s[b0] === '\r') b0++; if (s[b0] === '\n') b0++;
            var chunk = bytes.subarray(b0, end);
            if (chunk.length > 8) {
                try {
                    var ds = new DecompressionStream('deflate');
                    var out = new Response(new Blob([chunk]).stream().pipeThrough(ds));
                    var text = await out.text();
                    var found = scanInvoiceXml(text);
                    if (found) return found;
                } catch (e) { /* kein gueltiger Flate-Stream — weiter */ }
            }
            idx = end + 9;
        }
        return null;
    }
    async function extractFromPdf(arrayBuffer) {
        var bytes = new Uint8Array(arrayBuffer);
        var direct = scanInvoiceXml(bytesToLatin1(bytes));
        if (direct) return direct;
        return await inflateStreams(bytes);
    }

    // ── SHA-256 (GoBD: Integritaets-Fingerprint) ──────────────
    async function sha256Hex(arrayBuffer) {
        try {
            var h = await crypto.subtle.digest('SHA-256', arrayBuffer);
            return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        } catch (e) { return ''; }
    }

    // ── Datei verarbeiten ─────────────────────────────────────
    async function handleFile(file) {
        if (!file) return;
        var resultEl = document.getElementById('erechnung-result');
        if (resultEl) resultEl.innerHTML = '<div style="padding:24px;color:var(--text-secondary);">Verarbeite <strong>' + esc(file.name) + '</strong> …</div>';
        _last = { name: file.name, blob: file };

        var buf = await file.arrayBuffer();
        var hashHex = await sha256Hex(buf);
        var isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
        var xmlStr = null, pdfNote = '';

        if (isPdf) {
            xmlStr = await extractFromPdf(buf);
            if (!xmlStr) {
                renderError('ZUGFeRD-PDF: Die eingebettete Rechnungs-XML konnte nicht automatisch extrahiert werden (oft komprimiert). Bitte lade die <strong>XML-Datei</strong> separat hoch — Stackr zeigt sie dann vollständig an.', file, hashHex);
                return;
            }
            pdfNote = 'XML wurde aus dem ZUGFeRD-PDF extrahiert.';
        } else {
            xmlStr = new TextDecoder('utf-8').decode(buf);
        }

        var parsed = parseXmlString(xmlStr);
        renderResult(parsed, file, hashHex, pdfNote);
    }

    // ── Anzeige ───────────────────────────────────────────────
    function renderError(msg, file, hashHex) {
        var elr = document.getElementById('erechnung-result');
        if (!elr) return;
        elr.innerHTML =
            '<div class="card" style="border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.06);padding:18px 20px;">' +
            '<div style="font-weight:700;color:#f59e0b;margin-bottom:6px;">⚠️ Hinweis</div>' +
            '<div style="font-size:14px;line-height:1.6;">' + msg + '</div>' +
            gobdBox(file, hashHex) +
            '</div>';
        wireDownload(file);
    }

    function badge(text, color) {
        return '<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;background:' + color + '20;color:' + color + ';border:1px solid ' + color + '55;">' + esc(text) + '</span>';
    }

    function row(label, val) {
        return '<tr><td style="padding:7px 12px;color:var(--text-secondary);white-space:nowrap;">' + esc(label) + '</td>' +
            '<td style="padding:7px 12px;font-weight:600;">' + (val == null ? '—' : val) + '</td></tr>';
    }

    function gobdBox(file, hashHex) {
        return '<div style="margin-top:16px;padding:14px 16px;border-radius:10px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);font-size:12.5px;line-height:1.6;color:var(--text-secondary);">' +
            '<strong style="color:var(--accent);">GoBD-Aufbewahrung (deine Pflicht, §14b UStG):</strong> ' +
            'Empfangene E-Rechnungen sind <strong>im Originalformat unverändert 8 Jahre</strong> aufzubewahren. ' +
            'Stackr speichert die Datei nicht für dich — sichere das Original revisionssicher.' +
            '<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
            '<button class="btn btn-outline" id="erechnung-dl" style="font-size:12px;padding:6px 12px;">Original erneut speichern</button>' +
            (hashHex ? '<span style="font-family:monospace;font-size:11px;opacity:.8;">SHA-256: ' + esc(hashHex.slice(0, 24)) + '…</span>' : '') +
            '<span style="font-size:11px;opacity:.8;">Empfangen: ' + new Date().toLocaleString('de-DE') + '</span>' +
            '</div></div>';
    }

    function renderResult(r, file, hashHex, pdfNote) {
        var elr = document.getElementById('erechnung-result');
        if (!elr) return;

        var statusBadge, borderCol;
        if (r.format === 'unbekannt' || (r.errors && r.errors.length && !r.syntax)) {
            statusBadge = badge('Kein gültiges E-Rechnungsformat', '#ef4444'); borderCol = '#ef4444';
        } else if (!r.valid) {
            statusBadge = badge('E-Rechnung erkannt — mit Mängeln', '#f59e0b'); borderCol = '#f59e0b';
        } else {
            statusBadge = badge('Gültige E-Rechnung (EN 16931)', '#10b981'); borderCol = '#10b981';
        }

        var html = '<div class="card" style="border:1px solid ' + borderCol + '55;padding:0;overflow:hidden;">';
        html += '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;flex-wrap:wrap;">' +
            statusBadge + (r.format && r.format !== 'unbekannt' ? badge(r.format, '#6366f1') : '') +
            '<span style="margin-left:auto;font-size:12px;color:var(--text-secondary);">' + esc(file.name) + '</span></div>';

        if (pdfNote) html += '<div style="padding:8px 20px;font-size:12px;color:var(--text-secondary);background:rgba(99,102,241,.06);">' + esc(pdfNote) + '</div>';

        if (r.errors && r.errors.length) {
            html += '<div style="padding:12px 20px;background:rgba(239,68,68,.06);border-bottom:1px solid var(--border);">';
            r.errors.forEach(function (e) { html += '<div style="font-size:13px;color:#f87171;margin:2px 0;">✕ ' + esc(e) + '</div>'; });
            html += '</div>';
        }
        if (r.warnings && r.warnings.length) {
            html += '<div style="padding:12px 20px;background:rgba(245,158,11,.05);border-bottom:1px solid var(--border);">';
            r.warnings.forEach(function (w) { html += '<div style="font-size:13px;color:#f59e0b;margin:2px 0;">⚠ ' + esc(w) + '</div>'; });
            html += '</div>';
        }

        if (r.syntax) {
            html += '<table style="width:100%;border-collapse:collapse;font-size:14px;">';
            html += row('Rechnungsnummer', '<strong>' + esc(r.nummer || '—') + '</strong>');
            html += row('Datum', fmtDate(r.datum));
            html += row('Verkäufer', esc(r.sellerName || '—'));
            html += row('Käufer', esc(r.buyerName || '—'));
            html += row('Netto', r.netto != null ? fmtAmount(r.netto) + ' ' + esc(r.currency) : '—');
            html += row('USt', r.steuer != null ? fmtAmount(r.steuer) + ' ' + esc(r.currency) : '—');
            html += row('Gesamtbetrag', '<strong>' + fmtAmount(r.brutto) + ' ' + esc(r.currency) + '</strong>');
            html += row('IBAN', r.iban ? esc(r.iban) : '—');
            html += '</table>';

            if (r.lines && r.lines.length) {
                html += '<div style="padding:14px 20px 4px;font-weight:700;font-size:13px;">Positionen (' + r.lines.length + ')</div>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
                html += '<tr style="color:var(--text-secondary);text-align:left;"><th style="padding:6px 12px;font-weight:600;">Beschreibung</th><th style="padding:6px 12px;font-weight:600;text-align:right;">Menge</th><th style="padding:6px 12px;font-weight:600;text-align:right;">Einzelpreis</th><th style="padding:6px 12px;font-weight:600;text-align:right;">Netto</th></tr>';
                r.lines.forEach(function (li) {
                    html += '<tr style="border-top:1px solid var(--border);">' +
                        '<td style="padding:6px 12px;">' + esc(li.name || '—') + '</td>' +
                        '<td style="padding:6px 12px;text-align:right;">' + esc(li.menge || '—') + '</td>' +
                        '<td style="padding:6px 12px;text-align:right;">' + fmtAmount(li.preis) + '</td>' +
                        '<td style="padding:6px 12px;text-align:right;">' + fmtAmount(li.total) + '</td></tr>';
                });
                html += '</table>';
            }
        }

        html += '<div style="padding:16px 20px;">' + gobdBox(file, hashHex) + '</div>';
        html += '</div>';
        elr.innerHTML = html;
        wireDownload(file);
    }

    function wireDownload(file) {
        var btn = document.getElementById('erechnung-dl');
        if (btn) btn.addEventListener('click', function () {
            var url = URL.createObjectURL(file);
            var a = document.createElement('a');
            a.href = url; a.download = file.name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
    }

    // ── Render Seite ──────────────────────────────────────────
    function render() {
        return '' +
        '<div class="page-header"><h1>E-Rechnung empfangen</h1>' +
        '<p style="color:var(--text-secondary);margin-top:4px;">Eingehende XRechnung / ZUGFeRD prüfen und anzeigen. Seit 01.01.2025 müssen alle inländischen Unternehmen — auch Kleinunternehmer — E-Rechnungen empfangen können.</p></div>' +
        '<div id="erechnung-drop" style="margin-top:18px;border:2px dashed var(--border);border-radius:14px;padding:38px 24px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;">' +
            '<div style="font-size:38px;line-height:1;margin-bottom:10px;">📥</div>' +
            '<div style="font-weight:700;font-size:15px;">E-Rechnung hierher ziehen oder klicken</div>' +
            '<div style="color:var(--text-secondary);font-size:13px;margin-top:6px;">XRechnung (.xml, UBL + CII) · ZUGFeRD / Factur-X (.xml oder .pdf)</div>' +
            '<input type="file" id="erechnung-file" accept=".xml,.pdf,application/xml,text/xml,application/pdf" style="display:none;">' +
        '</div>' +
        '<div id="erechnung-result" style="margin-top:18px;"></div>' +
        '<div style="margin-top:18px;font-size:12px;color:var(--text-secondary);line-height:1.6;">' +
            'Hinweis: Die Prüfung erfolgt vollständig lokal in deinem Browser — es wird nichts hochgeladen. ' +
            'Diese Anzeige ersetzt keine vollständige EN-16931-Schema-/Schematron-Validierung und keine Steuerberatung.' +
        '</div>';
    }

    function init() {
        var drop = document.getElementById('erechnung-drop');
        var input = document.getElementById('erechnung-file');
        if (!drop || !input) return;

        drop.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () { if (input.files && input.files[0]) handleFile(input.files[0]); });

        ['dragenter', 'dragover'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; drop.style.background = 'rgba(16,185,129,.05)'; });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = 'var(--border)'; drop.style.background = 'transparent'; });
        });
        drop.addEventListener('drop', function (e) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });
    }

    return { render: render, init: init };
})();
