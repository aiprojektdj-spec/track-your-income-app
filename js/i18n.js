// ============================================================
// i18n — Stackr Translation Engine
// Supported: 'de' (default) | 'en'
// Usage:  I18n.t('key')            → translated string
//         I18n.t('key', {n:3})     → with variable substitution
//         I18n.setLang('en')       → switch + reload
//         I18n.getLang()           → 'de' | 'en'
//         I18n.applyAll()          → update data-i18n DOM elements
// ============================================================
var I18n = (function () {
    'use strict';

    var _lang = (function () {
        try { return localStorage.getItem('stackr_lang') || 'de'; } catch (e) { return 'de'; }
    })();

    // ── Translation strings ──────────────────────────────────
    var _t = {

        // ════════════════════════════════════════════════════
        // DEUTSCH
        // ════════════════════════════════════════════════════
        de: {

            // ── Navigation / Topnav ──
            'nav.dashboard':      'Dashboard',
            'nav.finance':        'Finanzen',
            'nav.invoices':       'Rechnungen',
            'nav.receipts':       'Eigenbelege',
            'nav.inventory':      'Lager',
            'nav.euer':           'Steuer & EÜR',
            'nav.academy':        'Akademie',
            'nav.gbr':            'GbR',
            'nav.settings':       'Einstellungen',
            'nav.backup':         'Backup & Daten',

            // ── Sidebar ──
            'sidebar.title':             'Stackr',
            'sidebar.subtitle':          'Dein Finanzüberblick',
            'sidebar.dashboard':         'Dashboard',
            'sidebar.bookings':          'Buchungen',
            'sidebar.expenses':          'Ausgaben',
            'sidebar.private':           'Privatbuchungen',
            'sidebar.invoices':          'Rechnungen',
            'sidebar.receipts':          'Eigenbelege',
            'sidebar.inventory':         'Lager',
            'sidebar.euer':              'EÜR',
            'sidebar.ust':               'USt-Voranmeldung',
            'sidebar.ksk':               'KSK',
            'sidebar.afa':               'AfA',
            'sidebar.drivelog':          'Fahrtenbuch',
            'sidebar.cashbook':          'Kassenbuch',
            'sidebar.returns':           'Retouren',
            'sidebar.materials':         'Materiallager',
            'sidebar.gbr':               'GbR-Verwaltung',
            'sidebar.academy':           'Akademie',
            'sidebar.protocol':          'GoBD-Protokoll',
            'sidebar.taxes':             'Steuertermine',
            'sidebar.svs':               'SV-Beiträge',

            // ── Onboarding ──
            'ob.lang.title':             'Sprache wählen',
            'ob.lang.subtitle':          'Du kannst die Sprache jederzeit in den Einstellungen ändern.',
            'ob.lang.de':                'Deutsch',
            'ob.lang.en':                'English',
            'ob.step1.title':            'Willkommen!',
            'ob.step1.subtitle':         'Lass uns dein Reselling-Business einrichten.',
            'ob.step2.title':            'Adresse',
            'ob.step2.subtitle':         'Deine Geschäftsadresse für Rechnungen.',
            'ob.step3.title':            'Kontakt',
            'ob.step3.subtitle':         'Wie bist du erreichbar?',
            'ob.step4.title':            'Steuer',
            'ob.step4.subtitle':         'Steuerliche Angaben für die EÜR.',
            'ob.step5.title':            'Bankverbindung',
            'ob.step5.subtitle':         'Für Rechnungen und Zahlungen.',
            'ob.finish':                 "Los geht's! 🚀",
            'ob.next':                   'Weiter',
            'ob.back':                   'Zurück',
            'ob.done.toast':             'Einrichtung abgeschlossen! 🎉',

            // ── Onboarding form fields ──
            'field.company':             'Firmenname *',
            'field.name':                'Dein Name',
            'field.name.req':            'Dein Name *',
            'field.address':             'Strasse & Hausnummer',
            'field.zip':                 'PLZ',
            'field.city':                'Ort',
            'field.phone':               'Telefon',
            'field.email':               'E-Mail',
            'field.taxnr':               'Steuernummer',
            'field.ustid':               'USt-ID (optional)',
            'field.ustmode':             'Umsatzsteuer-Modus',
            'field.bank':                'Bankname',
            'field.iban':                'IBAN',
            'field.bic':                 'BIC',
            'field.save':                'Speichern',
            'field.cancel':              'Abbrechen',
            'field.close':               'Schließen',
            'field.delete':              'Löschen',
            'field.edit':                'Bearbeiten',
            'field.add':                 'Hinzufügen',
            'field.create':              'Erstellen',
            'field.search':              'Suchen…',
            'field.filter':              'Filter',
            'field.export':              'Exportieren',
            'field.import':              'Importieren',
            'field.date':                'Datum',
            'field.description':         'Beschreibung',
            'field.amount':              'Betrag',
            'field.category':            'Kategorie',
            'field.notes':               'Notizen',

            // ── USt Picker ──
            'ust.klein.title':           'Kleinunternehmer',
            'ust.klein.law':             '§ 19 UStG',
            'ust.klein.f1':              'Keine USt auf Ausgangsrechnungen',
            'ust.klein.f2':              'Kein Vorsteuerabzug',
            'ust.klein.f3':              'Umsatzgrenze 25.000 € / Jahr',
            'ust.klein.f4':              'Keine USt-Voranmeldung nötig',
            'ust.klein.hint':            'Ideal für Einsteiger & Nebengewerbe',
            'ust.regel.title':           'Regelbesteuerung',
            'ust.regel.law':             '§ 19 UStG Opt-out',
            'ust.regel.f1':              '19 % USt auf Ausgangsrechnungen',
            'ust.regel.f2':              'Vorsteuer vom Finanzamt erstattbar',
            'ust.regel.f3':              'Monatl./viertelj. Voranmeldung',
            'ust.regel.f4':              'Pflicht ab 25.000 € Jahresumsatz',
            'ust.regel.hint':            'Für B2B & höhere Umsätze empfohlen',

            // ── Settings Modal ──
            'settings.title':            'Einstellungen',
            'settings.company':          'Firmenname',
            'settings.name':             'Name',
            'settings.address':          'Adresse',
            'settings.zip':              'PLZ',
            'settings.city':             'Ort',
            'settings.phone':            'Telefon',
            'settings.taxnr':            'Steuernummer',
            'settings.ustid':            'USt-ID',
            'settings.ustmode':          'USt-Modus',
            'settings.bank':             'Bankname',
            'settings.invoicedesign':    'Rechnungs-Design',
            'settings.logo':             'Logo (PNG/JPG)',
            'settings.headercolor':      'Header-Farbe',
            'settings.primarycolor':     'Primärfarbe (Akzent)',
            'settings.language':         'Sprache / Language',
            'settings.lang.de':          '🇩🇪 Deutsch',
            'settings.lang.en':          '🇬🇧 English',
            'settings.privacy':          '🔒 Datenschutzhinweis',
            'settings.license.active':   'Lizenz aktiv',
            'settings.license.for':      'Lizenziert für:',
            'settings.license.type':     'Typ:',
            'settings.license.valid':    'Gültig bis:',
            'settings.license.days':     'noch {n} Tage',
            'settings.license.expired':  'seit {n} Tagen abgelaufen',
            'settings.license.none':     'Keine gültige Lizenz gefunden',
            'settings.license.devmode':  'Entwicklermodus – Lizenzprüfung deaktiviert',

            // ── Dashboard ──
            'dash.revenue':              'Einnahmen',
            'dash.expenses':             'Ausgaben',
            'dash.profit':               'Gewinn',
            'dash.profit.month':         'Gewinn · {m}',
            'dash.profit.year':          'Gewinn {y}',
            'dash.avg.profit':           'Ø Gewinn/Monat',
            'dash.margin':               'Brutto-Marge',
            'dash.inventory':            'Lagerbestand',
            'dash.open.invoices':        'Offen',
            'dash.sales.count':          '{n} Verkäufe',
            'dash.buy.costs':            'Einkauf + Kosten',
            'dash.annual.profit':        'Jahresgewinn',
            'dash.months.elapsed':       '{n} Monate',
            'dash.profit.revenue':       'Gewinn / Einnahmen',
            'dash.invoices.count':       '{n} Rechnungen',
            'dash.overdue':              '{n} überfällig',
            'dash.recent.bookings':      'Letzte Buchungen {y}',
            'dash.rev.vs.exp':           'Einnahmen vs. Ausgaben {y}',
            'dash.year.comparison':      'Jahresvergleich',
            'dash.year.chart':           'Jahresvergleich Chart',
            'dash.monthly.profit':       'Monatsverlauf Gewinn (letzte 12 Monate)',
            'dash.top.brands':           'Top Marken {y}',
            'dash.academy':              'Akademie',
            'dash.pct.learned':          '{n}% gelernt',
            'dash.no.data':              'Noch nicht genug Daten',
            'dash.no.bookings':          'Noch keine Buchungen',

            // ── Chart series ──
            'chart.revenue':             'Einnahmen',
            'chart.expenses':            'Ausgaben',
            'chart.profit':              'Gewinn',

            // ── Jahresvergleich table ──
            'table.revenue':             'Einnahmen',
            'table.expenses':            'Ausgaben',
            'table.profit':              'Gewinn',
            'table.margin':              'Marge',
            'table.sales':               'Verkäufe',
            'table.avg.price':           'Ø VK-Preis',

            // ── Buchungen ──
            'book.title':                'Buchungen',
            'book.add':                  'Buchung hinzufügen',
            'book.date':                 'Datum',
            'book.platform':             'Plattform',
            'book.article':              'Artikel',
            'book.buy.price':            'EK-Preis',
            'book.sell.price':           'VK-Preis',
            'book.shipping.buyer':       'Versand Käufer',
            'book.shipping.seller':      'Versand Verkäufer',
            'book.fees':                 'Gebühren',
            'book.profit':               'Gewinn',
            'book.tax.rate':             'Steuersatz',
            'book.category':             'Kategorie',
            'book.status':               'Status',
            'book.notes':                'Notizen',
            'book.empty':                'Noch keine Buchungen vorhanden.',

            // ── Ausgaben ──
            'exp.title':                 'Ausgaben',
            'exp.add':                   'Ausgabe hinzufügen',
            'exp.date':                  'Datum',
            'exp.description':           'Beschreibung',
            'exp.amount':                'Betrag',
            'exp.category':              'Kategorie',
            'exp.tax.rate':              'Steuersatz',
            'exp.notes':                 'Notizen',
            'exp.empty':                 'Noch keine Ausgaben vorhanden.',

            // ── Rechnungen ──
            'inv.title':                 'Rechnungen',
            'inv.create':                'Neue Rechnung',
            'inv.number':                'Rechnungsnummer',
            'inv.date':                  'Datum',
            'inv.due':                   'Fällig am',
            'inv.client':                'Kunde',
            'inv.status':                'Status',
            'inv.total':                 'Gesamt',
            'inv.draft':                 'Entwurf',
            'inv.sent':                  'Gesendet',
            'inv.paid':                  'Bezahlt',
            'inv.overdue':               'Überfällig',
            'inv.cancelled':             'Storniert',
            'inv.empty':                 'Noch keine Rechnungen vorhanden.',
            'inv.pdf':                   'PDF erstellen',
            'inv.mark.paid':             'Als bezahlt markieren',
            // PDF labels
            'pdf.invoice':               'Rechnung',
            'pdf.invoice.nr':            'Rechnungsnummer',
            'pdf.date':                  'Datum',
            'pdf.due':                   'Fällig am',
            'pdf.recipient':             'Rechnungsempfänger',
            'pdf.pos':                   'Pos.',
            'pdf.description':           'Beschreibung',
            'pdf.qty':                   'Menge',
            'pdf.unit.price':            'Einzelpreis',
            'pdf.total':                 'Gesamt',
            'pdf.subtotal':              'Nettobetrag',
            'pdf.tax':                   'zzgl. {r}% MwSt.',
            'pdf.grand.total':           'Rechnungsbetrag',
            'pdf.klein.note':            'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
            'pdf.payment':               'Zahlungsbedingungen',
            'pdf.bank':                  'Bankverbindung',
            'pdf.iban':                  'IBAN',
            'pdf.bic':                   'BIC',
            'pdf.thank.you':             'Vielen Dank für Ihren Auftrag!',

            // ── Eigenbelege ──
            'rec.title':                 'Eigenbelege',
            'rec.create':                'Neuer Eigenbeleg',
            'rec.empty':                 'Noch keine Eigenbelege vorhanden.',

            // ── Lager ──
            'lag.title':                 'Lagerverwaltung',
            'lag.add':                   'Artikel hinzufügen',
            'lag.article':               'Artikel',
            'lag.quantity':              'Menge',
            'lag.buy.price':             'EK-Preis',
            'lag.sell.price':            'VK-Preis',
            'lag.total.value':           'Lagerwert',
            'lag.status':                'Status',
            'lag.platform':              'Plattform',
            'lag.date':                  'Kaufdatum',
            'lag.notes':                 'Notizen',
            'lag.empty':                 'Lager ist leer.',
            'lag.status.lager':          'Im Lager',
            'lag.status.listing':        'Inseriert',
            'lag.status.sold':           'Verkauft',
            'lag.status.returned':       'Zurückgesendet',

            // ── EÜR ──
            'euer.title':                'Einnahmen-Überschuss-Rechnung',
            'euer.revenue':              'Betriebseinnahmen',
            'euer.expenses':             'Betriebsausgaben',
            'euer.profit':               'Überschuss',
            'euer.export':               'EÜR exportieren',
            'euer.year':                 'Jahr',
            'euer.period':               'Zeitraum',

            // ── USt-Voranmeldung ──
            'ust.title':                 'USt-Voranmeldung',
            'ust.period':                'Zeitraum',
            'ust.revenue':               'Umsatz (brutto)',
            'ust.net':                   'Nettoumsatz',
            'ust.tax':                   'Umsatzsteuer',
            'ust.input':                 'Vorsteuer',
            'ust.payable':               'Zahllast',

            // ── Akademie ──
            'ak.title':                  'Akademie',
            'ak.continue':               'Weiter lernen',
            'ak.modules':                'Module',
            'ak.lessons':                'Lektionen',
            'ak.completed':              'abgeschlossen',
            'ak.locked':                 'Gesperrt',
            'ak.finish.lesson':          'Lektion abschließen',
            'ak.next.lesson':            'Nächste Lektion',
            'ak.back':                   'Zurück zur Übersicht',
            'ak.achievement.unlocked':   'Achievement freigeschaltet!',
            'ak.level.beginner':         'Einsteiger',
            'ak.level.advanced':         'Fortgeschritten',
            'ak.level.pro':              'Profi',
            // Module names
            'ak.mod.grundlagen':         'Reselling Grundlagen',
            'ak.mod.einkauf':            'Einkauf & Sourcing',
            'ak.mod.steuer':             'Steuern & Buchhaltung',
            'ak.mod.listing':            'Listing & Fotografie',
            'ak.mod.mindset':            'Business Mindset',
            'ak.mod.steuerprofi':        'Steuer-Profi',
            'ak.mod.skalierung':         'Skalierung',
            'ak.mod.kundenservice':      'Kundenservice',
            'ak.mod.krankenversicherung':'Krankenversicherung',
            'ak.mod.international':      'International verkaufen',
            'ak.mod.psychologie':        'Verkaufspsychologie',
            'ak.mod.social':             'Social Media & Marketing',
            'ak.mod.afa_recht':          'AfA & Recht',
            // Achievement names
            'ak.ach.first_sale':         'Erste Buchung',
            'ak.ach.ten_sales':          '10 Buchungen',
            'ak.ach.first_lesson':       'Erste Lektion',
            'ak.ach.all_modules':        'Alle Module abgeschlossen',
            'ak.ach.euer_export':        'EÜR exportiert',
            'ak.ach.first_invoice':      'Erste Rechnung',
            'ak.ach.streak_7':           '7-Tage-Streak',

            // ── KSK ──
            'ksk.title':                 'Künstlersozialabgabe',
            'ksk.rate':                  'Abgabesatz',
            'ksk.basis':                 'Berechnungsbasis',
            'ksk.result':                'Abgabe',

            // ── AfA ──
            'afa.title':                 'AfA-Verzeichnis',
            'afa.add':                   'Anlage hinzufügen',
            'afa.asset':                 'Wirtschaftsgut',
            'afa.date':                  'Anschaffungsdatum',
            'afa.cost':                  'Anschaffungskosten',
            'afa.life':                  'Nutzungsdauer (Jahre)',
            'afa.annual':                'Jährl. AfA',
            'afa.residual':              'Restwert',
            'afa.gwg':                   'GWG (sofortabschreibung)',

            // ── Fahrtenbuch ──
            'drive.title':               'Fahrtenbuch',
            'drive.add':                 'Fahrt hinzufügen',
            'drive.date':                'Datum',
            'drive.from':                'Von',
            'drive.to':                  'Nach',
            'drive.km':                  'Kilometer',
            'drive.purpose':             'Zweck',

            // ── Kassenbuch ──
            'cash.title':                'Kassenbuch',
            'cash.add':                  'Eintrag hinzufügen',
            'cash.balance':              'Kassenbestand',

            // ── GoBD Protokoll ──
            'prot.title':                'GoBD-Protokoll',
            'prot.action':               'Aktion',
            'prot.user':                 'Benutzer',
            'prot.timestamp':            'Zeitstempel',
            'prot.before':               'Vorher',
            'prot.after':                'Nachher',

            // ── Steuertermine ──
            'tax.title':                 'Steuertermine',
            'tax.deadline':              'Fälligkeit',
            'tax.type':                  'Art',
            'tax.period':                'Zeitraum',

            // ── Backup ──
            'backup.title':              'Backup & Daten',
            'backup.create':             'Backup erstellen',
            'backup.restore':            'Backup wiederherstellen',
            'backup.export.all':         'Alle Daten exportieren',
            'backup.import':             'Daten importieren',
            'backup.auto':               'Automatisches Backup',
            'backup.last':               'Letztes Backup: {d}',
            'backup.none':               'Noch kein Backup erstellt',
            'backup.success':            'Backup erfolgreich erstellt',
            'backup.restored':           'Backup wiederhergestellt',

            // ── Auth (Web only) ──
            'auth.welcome':              'Willkommen bei Stackr',
            'auth.login':                'Anmelden',
            'auth.register':             'Registrieren',
            'auth.email':                'E-Mail-Adresse',
            'auth.password':             'Passwort',
            'auth.forgot':               'Passwort vergessen?',
            'auth.submit.login':         'Anmelden',
            'auth.submit.register':      'Konto erstellen',
            'auth.trial':                '7 Tage kostenlos testen — danach 15 €/Monat.',
            'auth.security':             'Deine Daten werden verschlüsselt auf EU-Servern gespeichert.',
            'auth.reset.sent':           'Reset-Link gesendet! Bitte prüfe deine E-Mail.',
            'auth.logout':               'Abmelden',
            'auth.account.delete':       'Konto löschen (DSGVO)',
            'auth.sync.now':             '⬆ Jetzt synchronisieren',
            'auth.err.email':            'Bitte E-Mail-Adresse eingeben.',
            'auth.err.password':         'Bitte Passwort eingeben.',
            'auth.err.password.short':   'Passwort muss mindestens 6 Zeichen lang sein.',
            'auth.err.credentials':      'Falsche E-Mail oder falsches Passwort.',
            'auth.err.registered':       'Diese E-Mail ist bereits registriert. Bitte anmelden.',
            'auth.err.confirm':          'Bitte bestätige zuerst deine E-Mail-Adresse.',

            // ── Common toast messages ──
            'toast.saved':               'Gespeichert',
            'toast.deleted':             'Gelöscht',
            'toast.error':               'Fehler beim Speichern',
            'toast.copied':              'Kopiert',
            'toast.exported':            'Export erfolgreich',
            'toast.imported':            'Import erfolgreich',
            'toast.synced':              '{n} Einträge synchronisiert',

            // ── Months / time ──
            'month.jan': 'Januar',   'month.feb': 'Februar',  'month.mar': 'März',
            'month.apr': 'April',    'month.may': 'Mai',      'month.jun': 'Juni',
            'month.jul': 'Juli',     'month.aug': 'August',   'month.sep': 'September',
            'month.oct': 'Oktober',  'month.nov': 'November', 'month.dec': 'Dezember',
            'month.short.jan': 'Jan', 'month.short.feb': 'Feb', 'month.short.mar': 'Mär',
            'month.short.apr': 'Apr', 'month.short.may': 'Mai', 'month.short.jun': 'Jun',
            'month.short.jul': 'Jul', 'month.short.aug': 'Aug', 'month.short.sep': 'Sep',
            'month.short.oct': 'Okt', 'month.short.nov': 'Nov', 'month.short.dec': 'Dez',

            // ── Companies / Multi-Firma ──
            'co.add':                    'Firma hinzufügen',
            'co.switch':                 'Firma wechseln',
            'co.manage':                 'Firmen verwalten',
            'co.delete':                 'Firma löschen',
            'co.welcome':                'Willkommen bei Stackr',
            'co.create.first':           'Erstelle deine erste Firma um zu beginnen.',
        },

        // ════════════════════════════════════════════════════
        // ENGLISH
        // ════════════════════════════════════════════════════
        en: {

            // ── Navigation / Topnav ──
            'nav.dashboard':      'Dashboard',
            'nav.finance':        'Finance',
            'nav.invoices':       'Invoices',
            'nav.receipts':       'Receipts',
            'nav.inventory':      'Inventory',
            'nav.euer':           'Tax & P&L',
            'nav.academy':        'Academy',
            'nav.gbr':            'Partnership',
            'nav.settings':       'Settings',
            'nav.backup':         'Backup & Data',

            // ── Sidebar ──
            'sidebar.title':             'Stackr',
            'sidebar.subtitle':          'Your Financial Overview',
            'sidebar.dashboard':         'Dashboard',
            'sidebar.bookings':          'Sales',
            'sidebar.expenses':          'Expenses',
            'sidebar.private':           'Private Bookings',
            'sidebar.invoices':          'Invoices',
            'sidebar.receipts':          'Receipts',
            'sidebar.inventory':         'Inventory',
            'sidebar.euer':              'P&L',
            'sidebar.ust':               'VAT Return',
            'sidebar.ksk':               'Artist Social Tax',
            'sidebar.afa':               'Depreciation',
            'sidebar.drivelog':          'Mileage Log',
            'sidebar.cashbook':          'Cash Book',
            'sidebar.returns':           'Returns',
            'sidebar.materials':         'Material Stock',
            'sidebar.gbr':               'Partnership',
            'sidebar.academy':           'Academy',
            'sidebar.protocol':          'Audit Log',
            'sidebar.taxes':             'Tax Deadlines',
            'sidebar.svs':               'Social Security',

            // ── Onboarding ──
            'ob.lang.title':             'Choose Language',
            'ob.lang.subtitle':          'You can change the language at any time in settings.',
            'ob.lang.de':                'Deutsch',
            'ob.lang.en':                'English',
            'ob.step1.title':            'Welcome!',
            'ob.step1.subtitle':         "Let's set up your reselling business.",
            'ob.step2.title':            'Address',
            'ob.step2.subtitle':         'Your business address for invoices.',
            'ob.step3.title':            'Contact',
            'ob.step3.subtitle':         'How can customers reach you?',
            'ob.step4.title':            'Tax',
            'ob.step4.subtitle':         'Tax information for your P&L report.',
            'ob.step5.title':            'Bank Account',
            'ob.step5.subtitle':         'For invoices and payments.',
            'ob.finish':                 "Let's go! 🚀",
            'ob.next':                   'Next',
            'ob.back':                   'Back',
            'ob.done.toast':             'Setup complete! 🎉',

            // ── Onboarding form fields ──
            'field.company':             'Company name *',
            'field.name':                'Your name',
            'field.name.req':            'Your name *',
            'field.address':             'Street & house number',
            'field.zip':                 'ZIP code',
            'field.city':                'City',
            'field.phone':               'Phone',
            'field.email':               'E-Mail',
            'field.taxnr':               'Tax number',
            'field.ustid':               'VAT ID (optional)',
            'field.ustmode':             'VAT mode',
            'field.bank':                'Bank name',
            'field.iban':                'IBAN',
            'field.bic':                 'BIC',
            'field.save':                'Save',
            'field.cancel':              'Cancel',
            'field.close':               'Close',
            'field.delete':              'Delete',
            'field.edit':                'Edit',
            'field.add':                 'Add',
            'field.create':              'Create',
            'field.search':              'Search…',
            'field.filter':              'Filter',
            'field.export':              'Export',
            'field.import':              'Import',
            'field.date':                'Date',
            'field.description':         'Description',
            'field.amount':              'Amount',
            'field.category':            'Category',
            'field.notes':               'Notes',

            // ── USt Picker ──
            'ust.klein.title':           'Small Business',
            'ust.klein.law':             '§ 19 UStG',
            'ust.klein.f1':              'No VAT on outgoing invoices',
            'ust.klein.f2':              'No input tax deduction',
            'ust.klein.f3':              'Revenue limit €25,000 / year',
            'ust.klein.f4':              'No VAT return required',
            'ust.klein.hint':            'Ideal for beginners & side businesses',
            'ust.regel.title':           'Standard Taxation',
            'ust.regel.law':             '§ 19 UStG opt-out',
            'ust.regel.f1':              '19% VAT on outgoing invoices',
            'ust.regel.f2':              'Input tax refunded by tax office',
            'ust.regel.f3':              'Monthly/quarterly VAT return',
            'ust.regel.f4':              'Mandatory above €25,000 revenue',
            'ust.regel.hint':            'Recommended for B2B & higher revenue',

            // ── Settings Modal ──
            'settings.title':            'Settings',
            'settings.company':          'Company name',
            'settings.name':             'Name',
            'settings.address':          'Address',
            'settings.zip':              'ZIP code',
            'settings.city':             'City',
            'settings.phone':            'Phone',
            'settings.taxnr':            'Tax number',
            'settings.ustid':            'VAT ID',
            'settings.ustmode':          'VAT mode',
            'settings.bank':             'Bank name',
            'settings.invoicedesign':    'Invoice Design',
            'settings.logo':             'Logo (PNG/JPG)',
            'settings.headercolor':      'Header colour',
            'settings.primarycolor':     'Primary colour (accent)',
            'settings.language':         'Sprache / Language',
            'settings.lang.de':          '🇩🇪 Deutsch',
            'settings.lang.en':          '🇬🇧 English',
            'settings.privacy':          '🔒 Privacy Notice',
            'settings.license.active':   'License active',
            'settings.license.for':      'Licensed to:',
            'settings.license.type':     'Type:',
            'settings.license.valid':    'Valid until:',
            'settings.license.days':     '{n} days remaining',
            'settings.license.expired':  'expired {n} days ago',
            'settings.license.none':     'No valid license found',
            'settings.license.devmode':  'Dev mode – license check disabled',

            // ── Dashboard ──
            'dash.revenue':              'Revenue',
            'dash.expenses':             'Expenses',
            'dash.profit':               'Profit',
            'dash.profit.month':         'Profit · {m}',
            'dash.profit.year':          'Profit {y}',
            'dash.avg.profit':           'Avg. Profit/Month',
            'dash.margin':               'Gross Margin',
            'dash.inventory':            'Inventory',
            'dash.open.invoices':        'Open',
            'dash.sales.count':          '{n} sales',
            'dash.buy.costs':            'Purchase + costs',
            'dash.annual.profit':        'Annual profit',
            'dash.months.elapsed':       '{n} months',
            'dash.profit.revenue':       'Profit / Revenue',
            'dash.invoices.count':       '{n} invoices',
            'dash.overdue':              '{n} overdue',
            'dash.recent.bookings':      'Recent Sales {y}',
            'dash.rev.vs.exp':           'Revenue vs. Expenses {y}',
            'dash.year.comparison':      'Year Comparison',
            'dash.year.chart':           'Year Comparison Chart',
            'dash.monthly.profit':       'Monthly Profit (last 12 months)',
            'dash.top.brands':           'Top Brands {y}',
            'dash.academy':              'Academy',
            'dash.pct.learned':          '{n}% learned',
            'dash.no.data':              'Not enough data yet',
            'dash.no.bookings':          'No sales yet',

            // ── Chart series ──
            'chart.revenue':             'Revenue',
            'chart.expenses':            'Expenses',
            'chart.profit':              'Profit',

            // ── Jahresvergleich table ──
            'table.revenue':             'Revenue',
            'table.expenses':            'Expenses',
            'table.profit':              'Profit',
            'table.margin':              'Margin',
            'table.sales':               'Sales',
            'table.avg.price':           'Avg. sell price',

            // ── Buchungen ──
            'book.title':                'Sales',
            'book.add':                  'Add sale',
            'book.date':                 'Date',
            'book.platform':             'Platform',
            'book.article':              'Item',
            'book.buy.price':            'Buy price',
            'book.sell.price':           'Sell price',
            'book.shipping.buyer':       'Shipping (buyer)',
            'book.shipping.seller':      'Shipping (seller)',
            'book.fees':                 'Fees',
            'book.profit':               'Profit',
            'book.tax.rate':             'Tax rate',
            'book.category':             'Category',
            'book.status':               'Status',
            'book.notes':                'Notes',
            'book.empty':                'No sales yet.',

            // ── Ausgaben ──
            'exp.title':                 'Expenses',
            'exp.add':                   'Add expense',
            'exp.date':                  'Date',
            'exp.description':           'Description',
            'exp.amount':                'Amount',
            'exp.category':              'Category',
            'exp.tax.rate':              'Tax rate',
            'exp.notes':                 'Notes',
            'exp.empty':                 'No expenses yet.',

            // ── Rechnungen ──
            'inv.title':                 'Invoices',
            'inv.create':                'New Invoice',
            'inv.number':                'Invoice number',
            'inv.date':                  'Date',
            'inv.due':                   'Due date',
            'inv.client':                'Client',
            'inv.status':                'Status',
            'inv.total':                 'Total',
            'inv.draft':                 'Draft',
            'inv.sent':                  'Sent',
            'inv.paid':                  'Paid',
            'inv.overdue':               'Overdue',
            'inv.cancelled':             'Cancelled',
            'inv.empty':                 'No invoices yet.',
            'inv.pdf':                   'Create PDF',
            'inv.mark.paid':             'Mark as paid',
            // PDF labels
            'pdf.invoice':               'Invoice',
            'pdf.invoice.nr':            'Invoice number',
            'pdf.date':                  'Date',
            'pdf.due':                   'Due date',
            'pdf.recipient':             'Bill to',
            'pdf.pos':                   'No.',
            'pdf.description':           'Description',
            'pdf.qty':                   'Qty',
            'pdf.unit.price':            'Unit price',
            'pdf.total':                 'Total',
            'pdf.subtotal':              'Subtotal',
            'pdf.tax':                   'plus {r}% VAT',
            'pdf.grand.total':           'Invoice total',
            'pdf.klein.note':            'Pursuant to § 19 UStG (German VAT Act), no VAT is charged.',
            'pdf.payment':               'Payment terms',
            'pdf.bank':                  'Bank details',
            'pdf.iban':                  'IBAN',
            'pdf.bic':                   'BIC',
            'pdf.thank.you':             'Thank you for your business!',

            // ── Eigenbelege ──
            'rec.title':                 'Expense Receipts',
            'rec.create':                'New Receipt',
            'rec.empty':                 'No receipts yet.',

            // ── Lager ──
            'lag.title':                 'Inventory',
            'lag.add':                   'Add item',
            'lag.article':               'Item',
            'lag.quantity':              'Quantity',
            'lag.buy.price':             'Buy price',
            'lag.sell.price':            'Sell price',
            'lag.total.value':           'Inventory value',
            'lag.status':                'Status',
            'lag.platform':              'Platform',
            'lag.date':                  'Purchase date',
            'lag.notes':                 'Notes',
            'lag.empty':                 'Inventory is empty.',
            'lag.status.lager':          'In stock',
            'lag.status.listing':        'Listed',
            'lag.status.sold':           'Sold',
            'lag.status.returned':       'Returned',

            // ── EÜR ──
            'euer.title':                'Profit & Loss Statement',
            'euer.revenue':              'Business revenue',
            'euer.expenses':             'Business expenses',
            'euer.profit':               'Net profit',
            'euer.export':               'Export P&L',
            'euer.year':                 'Year',
            'euer.period':               'Period',

            // ── USt-Voranmeldung ──
            'ust.title':                 'VAT Return',
            'ust.period':                'Period',
            'ust.revenue':               'Revenue (gross)',
            'ust.net':                   'Net revenue',
            'ust.tax':                   'VAT',
            'ust.input':                 'Input tax',
            'ust.payable':               'Tax payable',

            // ── Akademie ──
            'ak.title':                  'Academy',
            'ak.continue':               'Continue learning',
            'ak.modules':                'Modules',
            'ak.lessons':                'Lessons',
            'ak.completed':              'completed',
            'ak.locked':                 'Locked',
            'ak.finish.lesson':          'Complete lesson',
            'ak.next.lesson':            'Next lesson',
            'ak.back':                   'Back to overview',
            'ak.achievement.unlocked':   'Achievement unlocked!',
            'ak.level.beginner':         'Beginner',
            'ak.level.advanced':         'Advanced',
            'ak.level.pro':              'Pro',
            // Module names
            'ak.mod.grundlagen':         'Reselling Basics',
            'ak.mod.einkauf':            'Sourcing & Buying',
            'ak.mod.steuer':             'Tax & Accounting',
            'ak.mod.listing':            'Listings & Photography',
            'ak.mod.mindset':            'Business Mindset',
            'ak.mod.steuerprofi':        'Tax Pro',
            'ak.mod.skalierung':         'Scaling Up',
            'ak.mod.kundenservice':      'Customer Service',
            'ak.mod.krankenversicherung':'Health Insurance',
            'ak.mod.international':      'Selling Internationally',
            'ak.mod.psychologie':        'Sales Psychology',
            'ak.mod.social':             'Social Media & Marketing',
            'ak.mod.afa_recht':          'Depreciation & Law',
            // Achievement names
            'ak.ach.first_sale':         'First Sale',
            'ak.ach.ten_sales':          '10 Sales',
            'ak.ach.first_lesson':       'First Lesson',
            'ak.ach.all_modules':        'All modules completed',
            'ak.ach.euer_export':        'P&L exported',
            'ak.ach.first_invoice':      'First Invoice',
            'ak.ach.streak_7':           '7-day streak',

            // ── KSK ──
            'ksk.title':                 'Artist Social Tax (KSK)',
            'ksk.rate':                  'Contribution rate',
            'ksk.basis':                 'Calculation basis',
            'ksk.result':                'Contribution',

            // ── AfA ──
            'afa.title':                 'Depreciation Schedule',
            'afa.add':                   'Add asset',
            'afa.asset':                 'Asset',
            'afa.date':                  'Purchase date',
            'afa.cost':                  'Acquisition cost',
            'afa.life':                  'Useful life (years)',
            'afa.annual':                'Annual depreciation',
            'afa.residual':              'Residual value',
            'afa.gwg':                   'Low-value asset (immediate write-off)',

            // ── Fahrtenbuch ──
            'drive.title':               'Mileage Log',
            'drive.add':                 'Add trip',
            'drive.date':                'Date',
            'drive.from':                'From',
            'drive.to':                  'To',
            'drive.km':                  'Kilometres',
            'drive.purpose':             'Purpose',

            // ── Kassenbuch ──
            'cash.title':                'Cash Book',
            'cash.add':                  'Add entry',
            'cash.balance':              'Cash balance',

            // ── GoBD Protokoll ──
            'prot.title':                'Audit Log',
            'prot.action':               'Action',
            'prot.user':                 'User',
            'prot.timestamp':            'Timestamp',
            'prot.before':               'Before',
            'prot.after':                'After',

            // ── Steuertermine ──
            'tax.title':                 'Tax Deadlines',
            'tax.deadline':              'Due date',
            'tax.type':                  'Type',
            'tax.period':                'Period',

            // ── Backup ──
            'backup.title':              'Backup & Data',
            'backup.create':             'Create backup',
            'backup.restore':            'Restore backup',
            'backup.export.all':         'Export all data',
            'backup.import':             'Import data',
            'backup.auto':               'Automatic backup',
            'backup.last':               'Last backup: {d}',
            'backup.none':               'No backup created yet',
            'backup.success':            'Backup created successfully',
            'backup.restored':           'Backup restored',

            // ── Auth (Web only) ──
            'auth.welcome':              'Welcome to Stackr',
            'auth.login':                'Sign in',
            'auth.register':             'Sign up',
            'auth.email':                'Email address',
            'auth.password':             'Password',
            'auth.forgot':               'Forgot password?',
            'auth.submit.login':         'Sign in',
            'auth.submit.register':      'Create account',
            'auth.trial':                'Try free for 7 days — then 15 €/month.',
            'auth.security':             'Your data is encrypted and stored on EU servers.',
            'auth.reset.sent':           'Reset link sent! Please check your email.',
            'auth.logout':               'Sign out',
            'auth.account.delete':       'Delete account (GDPR)',
            'auth.sync.now':             '⬆ Sync now',
            'auth.err.email':            'Please enter your email address.',
            'auth.err.password':         'Please enter your password.',
            'auth.err.password.short':   'Password must be at least 6 characters.',
            'auth.err.credentials':      'Incorrect email or password.',
            'auth.err.registered':       'This email is already registered. Please sign in.',
            'auth.err.confirm':          'Please confirm your email address first.',

            // ── Common toast messages ──
            'toast.saved':               'Saved',
            'toast.deleted':             'Deleted',
            'toast.error':               'Error saving',
            'toast.copied':              'Copied',
            'toast.exported':            'Export successful',
            'toast.imported':            'Import successful',
            'toast.synced':              '{n} entries synced',

            // ── Months / time ──
            'month.jan': 'January',   'month.feb': 'February', 'month.mar': 'March',
            'month.apr': 'April',     'month.may': 'May',      'month.jun': 'June',
            'month.jul': 'July',      'month.aug': 'August',   'month.sep': 'September',
            'month.oct': 'October',   'month.nov': 'November', 'month.dec': 'December',
            'month.short.jan': 'Jan', 'month.short.feb': 'Feb', 'month.short.mar': 'Mar',
            'month.short.apr': 'Apr', 'month.short.may': 'May', 'month.short.jun': 'Jun',
            'month.short.jul': 'Jul', 'month.short.aug': 'Aug', 'month.short.sep': 'Sep',
            'month.short.oct': 'Oct', 'month.short.nov': 'Nov', 'month.short.dec': 'Dec',

            // ── Companies / Multi-Firma ──
            'co.add':                    'Add company',
            'co.switch':                 'Switch company',
            'co.manage':                 'Manage companies',
            'co.delete':                 'Delete company',
            'co.welcome':                'Welcome to Stackr',
            'co.create.first':           'Create your first company to get started.',
        }
    };

    // ── Core API ─────────────────────────────────────────────

    function t(key, vars) {
        var strings = _t[_lang] || _t.de;
        var s = (strings[key] !== undefined)
            ? strings[key]
            : (_t.de[key] !== undefined ? _t.de[key] : key);
        if (vars) {
            Object.keys(vars).forEach(function (k) {
                s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
            });
        }
        return s;
    }

    function setLang(lang) {
        if (lang !== 'de' && lang !== 'en') return;
        try { localStorage.setItem('stackr_lang', lang); } catch (e) {}
        location.reload();
    }

    function getLang()  { return _lang; }
    function isEN()     { return _lang === 'en'; }
    function isDE()     { return _lang === 'de'; }

    // Apply translations to static HTML elements
    function applyAll() {
        document.documentElement.lang = _lang; // WCAG 3.1.1
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
    }

    // Render a language toggle button (for embedding)
    function renderToggle(activeClass) {
        var cls = activeClass || 'lang-btn';
        var de = _lang === 'de' ? ' style="font-weight:700;color:var(--accent,#10b981);"' : '';
        var en = _lang === 'en' ? ' style="font-weight:700;color:var(--accent,#10b981);"' : '';
        return '<div style="display:flex;gap:6px;align-items:center;">' +
            '<button class="' + cls + '" data-action="i18n-set-lang" data-args=\'["de"]\' ' + de + '>🇩🇪 DE</button>' +
            '<span style="color:var(--text-muted,#888);font-size:11px;">|</span>' +
            '<button class="' + cls + '" data-action="i18n-set-lang" data-args=\'["en"]\' ' + en + '>🇬🇧 EN</button>' +
        '</div>';
    }

    return { t, setLang, getLang, isEN, isDE, applyAll, renderToggle };

})();

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'i18n-set-lang': function (lang) { I18n.setLang(lang); }
});
