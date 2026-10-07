// Gemeinsamer Einstieg; Speichern, Validierung und Zugriffe bleiben bei den Fachmodulen.
(function () {
    'use strict';
    if (typeof App === 'undefined' || !App.pages) return;
    function row(title, description, attrs) {
        return '<a class="sr-settings-row" ' + attrs + '><span><strong>' + title + '</strong><small>' + description + '</small></span><span class="sr-settings-open" aria-hidden="true">Öffnen</span></a>';
    }
    function route(title, description, page, view) {
        return row(title, description, 'href="app.html?page=' + page + (view ? '&amp;view=' + view : '') + '" data-sr-page="' + page + '"' + (view ? ' data-sr-view="' + view + '"' : ''));
    }
    function action(title, description, name, field) {
        return row(title, description, 'href="#" data-settings-action="' + name + '"' + (field ? ' data-settings-field="' + field + '"' : ''));
    }
    function section(title, description, rows) {
        return '<section class="sr-settings-section"><div><h3>' + title + '</h3><p>' + description + '</p></div><div class="sr-settings-rows">' + rows + '</div></section>';
    }
    App.pages.einstellungen = {
        render: function () {
            return '<div class="page-header"><div><h2>Einstellungen</h2><p>Firma, Vorgaben und persönliche Einstellungen an einem Ort.</p></div></div><div class="sr-settings">' +
                section('Firma und Steuern', 'Angaben zur aktiven Firma und ihren steuerlichen Grundlagen.',
                    action('Firmendaten und Bankverbindung', 'Adresse, Kontakt, Steuernummer, USt-ID und Bankdaten', 'settings', 'set_firmenname') +
                    route('Rechtsform und Pflichten', 'Unternehmensprofil und verfügbare Steuerbereiche', 'rechtsform') +
                    action('Umsatzsteuer und Besteuerung', 'Steuerstatus, Ist/Soll, Voranmeldung und Differenzbesteuerung', 'settings', 'set_ust_picker') +
                    route('Gesellschaft und Gesellschafter', 'Stammdaten und Beteiligungsverhältnisse', 'gbr', 'stammdaten') +
                    action('Firmen verwalten', 'Firmen wechseln, anlegen und bearbeiten', 'companies')) +
                section('Rechnungen und Belege', 'Wiederverwendbare Angaben für deine Dokumente.',
                    route('Rechnungsangaben und Vorgaben', 'Absender, Zahlungsangaben und weitere Rechnungsvorgaben', 'rechnungen', 'unternehmensdaten') +
                    action('Logo und Dokumentgestaltung', 'Logo und bisherige Farboptionen', 'settings', 'set_logo') +
                    route('Eigenbeleg-Einstellungen', 'Firmendaten und Vorgaben für Eigenbelege', 'eigenbelege', 'einstellungen') +
                    route('Eigenbeleg-Kategorien', 'Kategorien der eigenen Belege verwalten', 'eigenbelege', 'kategorien')) +
                section('Lager', 'Übergreifende Vorgaben für Artikel. Lagerorte bleiben direkt am Artikel bearbeitbar.',
                    row('Warenkategorien', 'Kategorien anlegen, umbenennen und löschen', 'href="lager/index.html?verwaltung=kategorien"') +
                    row('Artikelstatus', 'Eigene Status und vorhandene Zuordnungen verwalten', 'href="lager/index.html?verwaltung=status"')) +
                section('Daten und Verbindungen', 'Sicherungen, Geräte und Automatisierungen.',
                    action('Backup und Wiederherstellung', 'Export, Import, automatische Sicherung und Datenverwaltung', 'backup') +
                    action('Cloud-Sync', 'Verbindung, Wiederherstellungscode und Synchronisierungsstatus', 'sync') +
                    action('Make.com-Webhooks', 'Bestehende Ereignisse, Zieladressen und Verbindungstests', 'settings', 'set_webhook_neuer_einkauf')) +
                section('Darstellung und Konto', 'Persönliche Auswahl und Zugang zu Stackr.',
                    '<div class="sr-settings-row"><label for="stackrSettingsTheme"><strong>Darstellung</strong><small>Systemeinstellung übernehmen oder selbst auswählen</small></label><select id="stackrSettingsTheme"><option value="system">System</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></div>' +
                    action('Sprache', 'Verfügbare Oberflächensprachen auswählen', 'settings', 'settingsLanguage') +
                    action('Konto und Mitgliedschaft', 'Kontoinformationen, Aboverwaltung und Abmeldung', 'account') +
                    action('Datenschutz-Einwilligung', 'Bestehende Datenschutzauswahl prüfen', 'privacy') +
                    row('Impressum und Kontakt', 'Anbieterinformationen und Kontaktmöglichkeiten', 'href="impressum.html" target="_blank" rel="noopener"') +
                    row('Datenschutzerklärung', 'Informationen zur Datenverarbeitung', 'href="datenschutz.html" target="_blank" rel="noopener"')) + '</div>';
        },
        init: function () {
            var container = document.getElementById('content');
            var select = document.getElementById('stackrSettingsTheme');
            if (select && typeof Theme !== 'undefined') {
                select.value = Theme.get();
                select.addEventListener('change', function () { if (!locked()) Theme.set(select.value); });
            }
            container.addEventListener('click', onClick);
        }
    };
    function locked() {
        return !!document.querySelector('#authLoadingOverlay, #whopLoginOverlay, #whopNoMemberOverlay, #whopDeviceLockOverlay');
    }
    function onClick(event) {
        var el = event.target.closest('[data-settings-action]');
        if (!el || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (locked()) return;
        switch (el.dataset.settingsAction) {
            case 'settings':
                App.showSettingsModal();
                var field = document.getElementById(el.dataset.settingsField);
                // Webhook-Namen und Sprachoptionen kommen weiterhin aus den vorhandenen Modulen.
                if (!field && el.dataset.settingsField.indexOf('set_webhook_') === 0) field = document.querySelector('[id^="set_webhook_"]');
                if (!field && el.dataset.settingsField === 'settingsLanguage') field = document.querySelector('#modalOverlay [data-action="i18n-set-lang"]');
                if (field) { field.scrollIntoView({ block: 'center' }); if (field.matches('input,select,button,textarea')) field.focus({ preventScroll: true }); }
                break;
            case 'backup': App.showBackupModal(); break;
            case 'sync': if (typeof CloudSync !== 'undefined') CloudSync.openPanel(); break;
            case 'companies': if (typeof CompanyManager !== 'undefined') CompanyManager.openSwitcher(); break;
            case 'account': if (typeof AuthUI !== 'undefined') AuthUI.openUserMenu(document.querySelector('.auth-user-btn') || el); break;
            case 'privacy': App.showDsgvoModal(); break;
        }
    }
})();
