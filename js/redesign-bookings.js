// Gemeinsame Buchungsliste: ausschließlich Anzeige vorhandener Datensätze.
// Speichern, Festschreibung, Storno und Belege bleiben in den Fachmodulen.
(function () {
    'use strict';
    if (typeof App === 'undefined' || !App.pages || typeof Buchungen === 'undefined') return;
    var mode = 'list';
    var filters = { kind: '', search: '', from: '', to: '', status: '', page: 1, size: 25 };
    var pendingOriginal = null;
    var pendingCreate = '';
    var currentRecords = [];
    var kinds = { purchase: 'Einkauf', sale: 'Einnahme', expense: 'Ausgabe', private: 'Privat' };
    function esc(value) { return Utils.escapeHtml(String(value == null ? '' : value)); }
    function readonly() {
        if (typeof StbShare !== 'undefined' && StbShare.isReadonly) return StbShare.isReadonly();
        return Store._isReadonlyCompany ? Store._isReadonlyCompany() : false;
    }
    // Buchungsstatus = Festschreibung, NICHT Zahlungsstatus (Audit 2026-10-13, D5): "Offen" las
    // sich bei einer eingegangenen Rechnungszahlung wie "unbezahlt".
    var NICHT_FEST = 'Nicht festgeschrieben';
    function status(record) {
        if (record.storniert) return 'Storniert';
        return Store.isLocked && Store.isLocked(record) ? 'Festgeschrieben' : NICHT_FEST;
    }
    // Wie viele Filter außer der Suche gesetzt sind (D1)
    function aktiveFilter() {
        return ['kind', 'from', 'to', 'status'].filter(function (k) { return !!filters[k]; }).length;
    }
    function chips() {
        var namen = { kind: function (v) { return kinds[v] || v; }, from: function (v) { return 'ab ' + Utils.formatDate(v); },
            to: function (v) { return 'bis ' + Utils.formatDate(v); }, status: function (v) { return v; } };
        return ['kind', 'from', 'to', 'status'].filter(function (k) { return !!filters[k]; }).map(function (k) {
            return '<button class="sr-filter-chip" type="button" data-sr-booking-unfilter="' + k + '" aria-label="Filter entfernen: ' + esc(namen[k](filters[k])) + '">' + esc(namen[k](filters[k])) + ' <span aria-hidden="true">×</span></button>';
        }).join('');
    }
    function rows() {
        var result = [];
        function add(kind, record, amount, label, partner) {
            result.push({ key: kind + ':' + record.id, kind: kind, record: record,
                date: record.datum || '', amount: amount, label: label || kinds[kind],
                partner: partner || '', state: status(record) });
        }
        Store.getPurchases(true).forEach(function (record) {
            add('purchase', record, -(parseFloat(record.einkaufspreis) || 0) * (parseInt(record.anzahl, 10) || 1),
                [record.marke, record.artikeltyp, record.beschreibung].filter(Boolean).join(' · '), record.lieferantName || record.einkaufsquelle);
        });
        // Bezahlte Rechnungen sind bereits als Verkäufe synchronisiert. Rechnungen
        // werden deshalb hier nicht ein zweites Mal als Einnahme aufgenommen.
        Store.getSales(true).forEach(function (record) {
            add('sale', record, parseFloat(record.verkaufspreis) || 0,
                record.beschreibung || [record.marke, record.artikeltyp].filter(Boolean).join(' · ') || (record._invoiceId ? 'Zahlung aus Rechnung' : 'Einnahme'), record.verkaufsplattform);
        });
        Store.getExpenses(true).forEach(function (record) {
            add('expense', record, -(parseFloat(record.betrag) || 0), record.beschreibung || record.kategorie, record.lieferant);
        });
        Store.getPrivatbuchungen().forEach(function (record) {
            var amount = parseFloat(record.betrag) || 0;
            add('private', record, record.typ === 'entnahme' ? -amount : record.typ === 'einlage' ? amount : null,
                record.beschreibung || (record.typ === 'einlage' ? 'Privateinlage' : record.typ === 'entnahme' ? 'Privatentnahme' : 'Privatbuchung – Typ prüfen'), 'Nicht gewinnwirksam');
        });
        return result.sort(function (a, b) { return b.date.localeCompare(a.date) || a.key.localeCompare(b.key); });
    }
    function filtered(records) {
        var term = filters.search.trim().toLocaleLowerCase('de');
        return records.filter(function (row) {
            return (!filters.kind || row.kind === filters.kind) && (!filters.status || row.state === filters.status) &&
                (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to) &&
                (!term || [row.label, row.partner, row.record.belegNr, row.record.artikelNr].join(' ').toLocaleLowerCase('de').indexOf(term) !== -1);
        });
    }
    function options(items, value) {
        return items.map(function (item) { return '<option value="' + esc(item[0]) + '"' + (item[0] === value ? ' selected' : '') + '>' + esc(item[1]) + '</option>'; }).join('');
    }
    function render() {
        if (mode !== 'list') return Buchungen.render();
        return '<div class="page-header"><div><h2>Buchungen</h2><p>Einkäufe, Einnahmen, Ausgaben und private Vorgänge.</p></div>' +
            (!readonly() ? '<div class="page-header-actions"><button class="btn btn-primary" type="button" data-sr-booking="create">Buchung erfassen</button></div>' : '') + '</div>' +
            // Mobil zuerst die Suche, alles Weitere hinter "Filter (n)" (Audit 2026-10-13, D1) —
            // vorher lagen bei 360 px rund 850 px Formular vor der ersten Buchung. Auf breiten
            // Bildschirmen ist der Bereich geöffnet und sieht aus wie bisher.
            '<div class="filter-bar no-print sr-booking-filterbar" id="srBookingFilters">' +
            '<div class="filter-group sr-filter-search"><label for="srBookingSearch">Suchen</label><input class="form-input" type="search" id="srBookingSearch" placeholder="Beschreibung oder Belegnummer" value="' + esc(filters.search) + '"></div>' +
            '<details class="sr-filter-more" id="srBookingMore"' + (filterOffen() ? ' open' : '') + '><summary>Filter' + (aktiveFilter() ? ' (' + aktiveFilter() + ')' : '') + '</summary><div class="sr-filter-more-body">' +
            '<div class="filter-group"><label for="srBookingKind">Art</label><select class="form-select" id="srBookingKind">' + options([['', 'Alle Buchungen'], ['purchase', 'Einkäufe'], ['sale', 'Einnahmen'], ['expense', 'Ausgaben'], ['private', 'Privat']], filters.kind) + '</select></div>' +
            '<div class="filter-group"><label for="srBookingFrom">Von</label><input class="form-input" type="date" id="srBookingFrom" value="' + esc(filters.from) + '"></div>' +
            '<div class="filter-group"><label for="srBookingTo">Bis</label><input class="form-input" type="date" id="srBookingTo" value="' + esc(filters.to) + '"></div>' +
            '<div class="filter-group"><label for="srBookingStatus">Buchungsstatus</label><select class="form-select" id="srBookingStatus">' + options([['', 'Alle Status'], [NICHT_FEST, NICHT_FEST], ['Festgeschrieben', 'Festgeschrieben'], ['Storniert', 'Storniert']], filters.status) + '</select></div>' +
            '</div></details>' +
            '<div class="sr-filter-chips" id="srBookingChips">' + chips() + (aktiveFilter() || filters.search ? '<button class="btn btn-secondary btn-small" type="button" data-sr-booking="reset">Filter zurücksetzen</button>' : '') + '</div></div>' +
            // Dauerhafte Statusregion (D4): bleibt stehen, wenn die Ergebnisliste ausgetauscht
            // wird, und sagt auch "keine Treffer" an — ohne den Fokus aus der Suche zu nehmen.
            '<p class="sr-page-description sr-booking-count" id="srBookingStatusMsg" role="status" aria-live="polite" aria-atomic="true"></p>' +
            '<p class="sr-page-description">Beträge entsprechen den gespeicherten Vorgängen. Private Einlagen und Entnahmen gehören nicht zum Gewinn.</p>' +
            '<div id="srBookingResults"></div><details class="sr-details"><summary>Weitere Buchungswerkzeuge</summary>' +
            '<div class="sr-choice-list"><button class="btn btn-secondary" type="button" data-sr-booking="original-list">Einkäufe und Verkäufe verwalten / exportieren</button>' +
            '<a class="btn btn-secondary" href="app.html?page=bankimport" data-sr-page="bankimport">Bank importieren</a>' +
            '<a class="btn btn-secondary" href="app.html?page=eigenbelege" data-sr-page="eigenbelege">Eigenbelege</a></div></details>';
    }
    function renderResults() {
        var root = document.getElementById('srBookingResults');
        if (!root) return;
        currentRecords = rows();
        var selected = filtered(currentRecords);
        var pages = Math.max(1, Math.ceil(selected.length / filters.size));
        filters.page = Math.max(1, Math.min(filters.page, pages));
        var pageRows = selected.slice((filters.page - 1) * filters.size, filters.page * filters.size);
        var tableRows = pageRows.map(function (row) {
            var extra = row.kind === 'private' ? (row.record.typ === 'entnahme' ? 'Entnahme' : row.record.typ === 'einlage' ? 'Einlage' : 'Typ prüfen') : row.record._invoiceId ? 'Aus Rechnung' : '';
            // Beschreibung und Partner in EINEM Block (D2): sonst wurden Label, Textknoten und
            // Partner in der mobilen Karte zu drei schmalen Flex-Spalten.
            return '<tr class="sr-booking-row"><td class="sr-col-date">' + esc(Utils.formatDate(row.date)) + '</td>' +
                '<td class="sr-col-desc"><div class="sr-cell-text"><span class="sr-cell-main">' + esc(row.label) + '</span>' + (row.partner ? '<span class="sr-cell-sub">' + esc(row.partner) + '</span>' : '') + '</div></td>' +
                '<td class="sr-col-kind"><div class="sr-cell-text"><span class="sr-cell-main">' + kinds[row.kind] + '</span>' + (extra ? '<span class="sr-cell-sub">' + esc(extra) + '</span>' : '') + '</div></td>' +
                '<td class="amount sr-col-amount" style="text-align:right">' + esc(row.amount == null ? 'Vorzeichen prüfen' : Utils.formatCurrency(row.amount)) + '</td><td class="sr-col-state"><span class="badge badge-neutral">' + row.state + '</span></td>' +
                '<td class="sr-col-action"><button class="btn btn-secondary btn-small" type="button" data-sr-booking-detail="' + esc(row.key) + '" aria-label="Details: ' + esc(row.label) + '">Details</button></td></tr>';
        }).join('');
        var msg = document.getElementById('srBookingStatusMsg');
        if (msg) msg.textContent = !selected.length
            ? (currentRecords.length ? 'Keine Buchungen gefunden' : 'Noch keine Buchungen')
            : selected.length + (selected.length === 1 ? ' Buchung' : ' Buchungen') + ' · Seite ' + filters.page + ' von ' + pages;
        if (!selected.length) {
            root.innerHTML = '<div class="empty-state"><h3>' + (currentRecords.length ? 'Keine Treffer' : 'Noch keine Buchungen') + '</h3><p>' +
                (currentRecords.length ? 'Passe die Suche oder den Zeitraum an.' : 'Erfasse deinen ersten Vorgang. Er bleibt mit seinem ursprünglichen Fachbereich verbunden.') + '</p>' +
                (currentRecords.length ? '<button class="btn btn-secondary" type="button" data-sr-booking="reset">Filter zurücksetzen</button>' : '') + '</div>';
            return;
        }
        root.innerHTML = '<div class="table-container" role="region" aria-label="Buchungen" tabindex="0"><table class="data-table sr-booking-table"><thead><tr><th scope="col">Datum</th><th scope="col">Beschreibung / Partner</th><th scope="col">Art</th><th scope="col" style="text-align:right">Betrag</th><th scope="col">Buchungsstatus</th><th scope="col">Details</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
            '<div class="filter-bar no-print"><button class="btn btn-secondary" type="button" data-sr-booking="previous"' + (filters.page === 1 ? ' disabled' : '') + '>Zurück</button>' +
            '<button class="btn btn-secondary" type="button" data-sr-booking="next"' + (filters.page === pages ? ' disabled' : '') + '>Weiter</button>' +
            '<div class="filter-group"><label for="srBookingSize">Pro Seite</label><select class="form-select" id="srBookingSize">' + options([['25', '25'], ['50', '50'], ['100', '100']], String(filters.size)) + '</select></div></div>';
        document.getElementById('srBookingSize').addEventListener('change', function (event) { filters.size = Number(event.target.value); filters.page = 1; renderResults(); });
    }
    function init() {
        if (mode !== 'list') {
            Buchungen.init();
            var tabs = document.querySelector('#content .tabs');
            if (tabs) { tabs.hidden = true; tabs.classList.add('sr-legacy-nav'); }
            var header = document.querySelector('#content .page-header');
            if (header) {
                var title = header.querySelector('h2');
                if (title) title.textContent = Buchungen._activeTab === 'einkauf' ? 'Einkauf erfassen' : Buchungen._activeTab === 'verkauf' ? 'Einnahme erfassen' : 'Einkäufe und Verkäufe';
                header.insertAdjacentHTML('beforeend', '<button class="btn btn-secondary" type="button" data-sr-booking="list">Alle Buchungen</button>');
            }
            return;
        }
        var root = document.getElementById('srBookingFilters');
        // Filter sind keine ungespeicherten Buchungseingaben.
        root.addEventListener('input', function (event) { event.stopPropagation(); applyFilters(); });
        root.addEventListener('change', function (event) { event.stopPropagation(); applyFilters(); });
        var mehr = document.getElementById('srBookingMore');
        if (mehr) mehr.addEventListener('toggle', function () { _mehrOffen = mehr.open; });
        root.addEventListener('click', function (event) {
            var chip = event.target.closest && event.target.closest('[data-sr-booking-unfilter]');
            if (!chip) return;
            filters[chip.getAttribute('data-sr-booking-unfilter')] = '';
            filters.page = 1;
            App.navigate('buchungen');
        });
        renderResults();
    }
    // Auf breiten Bildschirmen offen; mobil nur, wenn der Nutzer ihn geöffnet hat
    var _mehrOffen = null;
    function filterOffen() {
        if (_mehrOffen !== null) return _mehrOffen;
        return !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
    }
    function aktualisiereFilterKopf() {
        var mehr = document.getElementById('srBookingMore');
        var sum = mehr && mehr.querySelector('summary');
        if (sum) sum.textContent = 'Filter' + (aktiveFilter() ? ' (' + aktiveFilter() + ')' : '');
        var c = document.getElementById('srBookingChips');
        if (c) c.innerHTML = chips() + (aktiveFilter() || filters.search ? '<button class="btn btn-secondary btn-small" type="button" data-sr-booking="reset">Filter zurücksetzen</button>' : '');
    }
    function applyFilters() {
        filters.kind = document.getElementById('srBookingKind').value;
        filters.search = document.getElementById('srBookingSearch').value;
        filters.from = document.getElementById('srBookingFrom').value;
        filters.to = document.getElementById('srBookingTo').value;
        filters.status = document.getElementById('srBookingStatus').value;
        filters.page = 1;
        aktualisiereFilterKopf();
        renderResults();
    }
    function changeMode(next, tab) {
        if (App._formDirty && !confirm('Du hast ungespeicherte Eingaben. Ansicht trotzdem verlassen?')) return false;
        App._formDirty = false;
        mode = next;
        if (tab) Buchungen._activeTab = tab;
        App.navigate('buchungen');
        return true;
    }
    function create() {
        if (readonly()) return;
        var privateAllowed = typeof Rechtsform === 'undefined' || Rechtsform.getConfig().privatbuchungen;
        App.showModal('Was möchtest du erfassen?', '<div class="sr-choice-list">' +
            '<button class="btn btn-secondary" type="button" data-sr-booking-create="expense">Ausgabe mit Beleg</button>' +
            '<button class="btn btn-secondary" type="button" data-sr-booking-create="sale">Einnahme oder Verkauf</button>' +
            '<button class="btn btn-secondary" type="button" data-sr-booking-create="purchase">Wareneinkauf</button>' +
            (privateAllowed ? '<button class="btn btn-secondary" type="button" data-sr-booking-create="private">Private Einlage oder Entnahme</button>' : '') +
            '</div>', '<button class="btn btn-secondary" type="button" data-action="close-modal">Abbrechen</button>');
    }
    function start(kind) {
        if (readonly()) return;
        App.closeModal();
        if (kind === 'purchase' || kind === 'sale') {
            if (kind === 'sale') Buchungen._verkaufManual = true;
            changeMode('legacy', kind === 'purchase' ? 'einkauf' : 'verkauf');
        } else {
            var page = kind === 'private' ? 'privatbuchungen' : 'ausgaben';
            pendingCreate = kind;
            App.navigate(page);
            if (App.currentPage !== page) pendingCreate = '';
        }
    }
    function detail(key) {
        var row = currentRecords.find(function (item) { return item.key === key; });
        if (!row) return;
        var record = row.record;
        var pairs = [['Art', kinds[row.kind]], ['Datum', Utils.formatDate(row.date)], ['Beschreibung', row.label], ['Partner / Herkunft', row.partner || 'Nicht angegeben'], ['Betrag', row.amount == null ? Utils.formatCurrency(record.betrag) + ' – Typ und Vorzeichen prüfen' : Utils.formatCurrency(row.amount)], ['Buchungsstatus', row.state]];
        [['belegNr', 'Belegnummer'], ['artikelNr', 'Artikelnummer'], ['anzahl', 'Menge'], ['ustSatz', 'Gespeicherter USt-Satz'], ['ustBetrag', 'Gespeicherter USt-Betrag'], ['lieferantSteuerId', 'Steuernummer / USt-ID des Lieferanten'], ['stornoGrund', 'Stornogrund']].forEach(function (field) {
            if (record[field[0]] != null && record[field[0]] !== '') pairs.push([field[1], record[field[0]]]);
        });
        if (row.kind === 'private') pairs.push(['Gewinn', 'Dieser Vorgang ist nicht gewinnwirksam.']);
        if (record._invoiceId) pairs.push(['Verknüpfung', 'Aus einer Rechnung übernommen. Änderungen erfolgen am ursprünglichen Dokument.']);
        App.showModal('Buchungsdetails', '<dl class="sr-booking-details">' + pairs.map(function (pair) { return '<dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1]) + '</dd>'; }).join('') + '</dl>',
            '<button class="btn btn-secondary" type="button" data-action="close-modal">Schließen</button><button class="btn btn-primary" type="button" data-sr-booking-original="' + esc(key) + '">Original öffnen</button>');
    }
    function original(key) {
        var row = currentRecords.find(function (item) { return item.key === key; });
        if (!row) return;
        App.closeModal();
        pendingOriginal = row;
        if (row.record._invoiceId) {
            App.navigate('rechnungen');
            if (App.currentPage !== 'rechnungen') pendingOriginal = null;
            return;
        }
        if (row.kind === 'purchase' || row.kind === 'sale') {
            Buchungen._filters = { von: row.date, bis: row.date };
            changeMode('legacy', 'alle');
        } else {
            var page = row.kind === 'expense' ? 'ausgaben' : 'privatbuchungen';
            if (page === 'privatbuchungen' && typeof Rechtsform !== 'undefined' && !Rechtsform.getConfig().privatbuchungen) {
                pendingOriginal = null;
                App.showModal('Firmenprofil prüfen', '<p>Die gespeicherte Privatbuchung bleibt in der gemeinsamen Buchungsliste sichtbar. Die Privatverwaltung ist für die aktuelle Rechtsform nicht freigeschaltet.</p>',
                    '<button class="btn btn-secondary" type="button" data-action="close-modal">Schließen</button>');
                return;
            }
            if (row.kind === 'expense') { Ausgaben._filterVon = row.date; Ausgaben._filterBis = row.date; Ausgaben._filterKategorie = ''; }
            if (row.kind === 'private' && row.date) Privatbuchungen._selectedYear = Number(row.date.slice(0, 4));
            App.navigate(page);
            if (App.currentPage !== page) pendingOriginal = null;
        }
    }
    function afterRender(page) {
        if (page !== 'buchungen') mode = 'list';
        if (pendingCreate === 'private' && page === 'privatbuchungen') {
            pendingCreate = '';
            Privatbuchungen._openForm();
        } else if (pendingCreate === 'expense' && page === 'ausgaben') {
            pendingCreate = '';
            var input = document.getElementById('expOcrFile');
            if (input) { input.scrollIntoView({ block: 'center' }); input.focus(); }
        }
        if (pendingOriginal) {
            var row = pendingOriginal;
            pendingOriginal = null;
            if (row.record._invoiceId && page === 'rechnungen' && typeof Dokumente !== 'undefined') {
                RechApp.navigate('dokumente');
                Dokumente.showPreview(row.record._invoiceId);
                return;
            }
            var match = Array.from(document.querySelectorAll('#content [data-edit], #content [data-storno], #content [data-edit-expense], #content [data-storno-expense]')).find(function (el) {
                return [el.dataset.edit, el.dataset.storno, el.dataset.editExpense, el.dataset.stornoExpense].indexOf(String(row.record.id)) !== -1;
            });
            if (match) { match.closest('tr').scrollIntoView({ block: 'center' }); match.focus(); }
        }
    }
    document.addEventListener('click', function (event) {
        var target = event.target.closest('[data-sr-booking], [data-sr-booking-create], [data-sr-booking-detail], [data-sr-booking-original]');
        if (!target) return;
        event.preventDefault();
        if (target.dataset.srBookingCreate) { start(target.dataset.srBookingCreate); return; }
        if (target.dataset.srBookingDetail) { detail(target.dataset.srBookingDetail); return; }
        if (target.dataset.srBookingOriginal) { original(target.dataset.srBookingOriginal); return; }
        var action = target.dataset.srBooking;
        if (action === 'create') create();
        if (action === 'list') changeMode('list');
        if (action === 'original-list') changeMode('legacy', 'alle');
        if (action === 'previous') { filters.page--; renderResults(); }
        if (action === 'next') { filters.page++; renderResults(); }
        if (action === 'reset') {
            filters.kind = filters.search = filters.from = filters.to = filters.status = '';
            filters.page = 1;
            App.navigate('buchungen');
        }
    });
    App.pages.buchungen = { render: render, init: init };
    window.RedesignBookings = { afterRender: afterRender, rows: rows };
})();
