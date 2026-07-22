// ============================================
// Rechtsform-Manager
// Zentrale Steuerung: welche Module/Pflichten
// je nach Unternehmensform aktiv sind
// ============================================
const Rechtsform = {

    // Alle unterstuetzten Rechtsformen mit steuerlichen Pflichten
    FORMEN: {
        'Einzelunternehmen': {
            label:      'Einzelunternehmen',
            kurz:       'EU',
            gewinnermittlung: 'euer',        // EÜR (unter 600k Umsatz / 60k Gewinn)
            bilanzPflicht:    false,          // nur wenn HGB-Grenzen überschritten
            bilanzOptional:   true,           // freiwillig möglich
            gewerbesteuer:    true,
            gewStFreibetrag:  24500,
            koerperschaftsteuer: false,
            ustPflicht:       true,           // §19-Befreiung möglich
            kleinunternehmer: true,           // §19 UStG möglich
            vorsteuer:        true,
            feststellung:     false,
            gesellschafter:   false,
            lohnsteuer:       false,           // nur mit Angestellten
            ksk:              true,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Unbeschränkte Haftung mit Privatvermögen. EÜR bis Grenzwerte §141 AO.'
        },
        'Freiberufler': {
            label:      'Freiberufler / Selbstständiger',
            kurz:       'FB',
            gewinnermittlung: 'euer',
            bilanzPflicht:    false,
            bilanzOptional:   false,          // Freiberufler nie bilanzpflichtig
            gewerbesteuer:    false,           // KEINE Gewerbesteuer!
            gewStFreibetrag:  0,
            koerperschaftsteuer: false,
            ustPflicht:       true,
            kleinunternehmer: true,
            vorsteuer:        true,
            feststellung:     false,
            gesellschafter:   false,
            lohnsteuer:       false,
            ksk:              true,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Kein Gewerbe → keine Gewerbesteuer. §18 EStG Katalogberufe. Immer EÜR.'
        },
        'GbR': {
            label:      'GbR (Gesellschaft bürgerlichen Rechts)',
            kurz:       'GbR',
            gewinnermittlung: 'euer',
            bilanzPflicht:    false,
            bilanzOptional:   true,
            gewerbesteuer:    true,
            gewStFreibetrag:  24500,
            koerperschaftsteuer: false,
            ustPflicht:       true,
            kleinunternehmer: true,
            vorsteuer:        true,
            feststellung:     true,            // Gesonderte & einheitliche Feststellung
            gesellschafter:   true,
            lohnsteuer:       false,
            ksk:              true,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Personengesellschaft. Gesamthandsvermögen. Gesonderte Gewinnfeststellung (Anlage FE).'
        },
        'eGbR': {
            label:      'eGbR (eingetragene GbR)',
            kurz:       'eGbR',
            gewinnermittlung: 'euer',
            bilanzPflicht:    false,
            bilanzOptional:   true,
            gewerbesteuer:    true,
            gewStFreibetrag:  24500,
            koerperschaftsteuer: false,
            ustPflicht:       true,
            kleinunternehmer: true,
            vorsteuer:        true,
            feststellung:     true,
            gesellschafter:   true,
            lohnsteuer:       false,
            ksk:              true,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Seit 01.01.2024 im GesR. Eintragung im Gesellschaftsregister. Rechtsfähig.'
        },
        'OHG': {
            label:      'OHG (Offene Handelsgesellschaft)',
            kurz:       'OHG',
            gewinnermittlung: 'bilanz',       // HGB-Kaufleute → Bilanzpflicht
            bilanzPflicht:    true,
            bilanzOptional:   false,
            gewerbesteuer:    true,
            gewStFreibetrag:  24500,
            koerperschaftsteuer: false,
            ustPflicht:       true,
            kleinunternehmer: false,           // Kaufleute = keine §19-Befreiung (Praxis)
            vorsteuer:        true,
            feststellung:     true,
            gesellschafter:   true,
            lohnsteuer:       true,
            ksk:              false,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Handelsgesellschaft. §105 HGB. Alle Gesellschafter haften unbeschränkt. Bilanzpflicht.'
        },
        'KG': {
            label:      'KG (Kommanditgesellschaft)',
            kurz:       'KG',
            gewinnermittlung: 'bilanz',
            bilanzPflicht:    true,
            bilanzOptional:   false,
            gewerbesteuer:    true,
            gewStFreibetrag:  24500,
            koerperschaftsteuer: false,
            ustPflicht:       true,
            kleinunternehmer: false,
            vorsteuer:        true,
            feststellung:     true,
            gesellschafter:   true,            // Komplementär + Kommanditist
            lohnsteuer:       true,
            ksk:              false,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Komplementär = unbeschränkte Haftung. Kommanditist = Einlage. §161 HGB.'
        },
        'GmbH': {
            label:      'GmbH (Gesellschaft mit beschränkter Haftung)',
            kurz:       'GmbH',
            gewinnermittlung: 'bilanz',
            bilanzPflicht:    true,
            bilanzOptional:   false,
            gewerbesteuer:    true,
            gewStFreibetrag:  0,               // KEIN Freibetrag für Kapitalgesellschaften!
            koerperschaftsteuer: true,          // 15% + 5.5% SolZ
            ustPflicht:       true,
            kleinunternehmer: true,             // theoretisch möglich
            vorsteuer:        true,
            feststellung:     false,            // eigene Steuererklärung, keine Feststellung
            gesellschafter:   true,             // Gesellschafter mit Anteilen
            lohnsteuer:       true,             // GF = Angestellter
            ksk:              false,
            afa:              true,
            privatbuchungen:  false,            // Kapitalgesellschaft = keine Privatentnahmen
            fahrtenbuch:      true,
            hinweis:          'Juristische Person. Haftung auf Stammkapital (min. 25.000 €). KSt + GewSt + USt.'
        },
        'UG': {
            label:      'UG (haftungsbeschränkt)',
            kurz:       'UG',
            gewinnermittlung: 'bilanz',
            bilanzPflicht:    true,
            bilanzOptional:   false,
            gewerbesteuer:    true,
            gewStFreibetrag:  0,
            koerperschaftsteuer: true,
            ustPflicht:       true,
            kleinunternehmer: true,
            vorsteuer:        true,
            feststellung:     false,
            gesellschafter:   true,
            lohnsteuer:       true,
            ksk:              false,
            afa:              true,
            privatbuchungen:  false,
            fahrtenbuch:      true,
            hinweis:          'Mini-GmbH. Stammkapital ab 1 €. 25% Thesaurierungspflicht bis 25.000 € erreicht.'
        },
        'GmbH & Co. KG': {
            label:      'GmbH & Co. KG',
            kurz:       'GmbH&CoKG',
            gewinnermittlung: 'bilanz',
            bilanzPflicht:    true,
            bilanzOptional:   false,
            gewerbesteuer:    true,
            gewStFreibetrag:  24500,           // Personengesellschaft → Freibetrag
            koerperschaftsteuer: false,         // KG selbst nicht KSt-pflichtig (Komplementär-GmbH schon)
            ustPflicht:       true,
            kleinunternehmer: false,
            vorsteuer:        true,
            feststellung:     true,
            gesellschafter:   true,
            lohnsteuer:       true,
            ksk:              false,
            afa:              true,
            privatbuchungen:  true,
            fahrtenbuch:      true,
            hinweis:          'Komplementär = GmbH (beschränkte Haftung). KG-Struktur mit GmbH-Schutz. Komplex.'
        }
    },

    // Aktuelle Rechtsform auslesen
    get() {
        const einst = Store.get('gbr_einstellungen') || {};
        return einst.firmenform || 'Einzelunternehmen';
    },

    // Konfiguration der aktuellen Rechtsform
    getConfig(form) {
        form = form || this.get();
        return this.FORMEN[form] || this.FORMEN['Einzelunternehmen'];
    },

    // Rechtsform setzen
    set(form) {
        if (!this.FORMEN[form]) return false;
        const einst = Store.get('gbr_einstellungen') || {};
        einst.firmenform = form;
        Store.set('gbr_einstellungen', einst);
        return true;
    },

    // Prüfungen
    isPersonengesellschaft(form) {
        form = form || this.get();
        return ['GbR', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG'].includes(form);
    },

    isKapitalgesellschaft(form) {
        form = form || this.get();
        return ['GmbH', 'UG'].includes(form);
    },

    // Formen, bei denen Freiberuflich/Gewerblich nicht schon durch die Rechtsform selbst feststeht
    // (z.B. eine freiberufliche Ärzte-GbR vs. eine gewerbliche Handels-GbR)
    FORMEN_MIT_TAETIGKEITSART: ['Einzelunternehmen', 'GbR', 'eGbR'],

    getTaetigkeitsart() {
        const einst = Store.get('gbr_einstellungen') || {};
        return einst.taetigkeitsart || 'gewerblich'; // Default = bisheriges Verhalten (immer gewerblich)
    },

    // Ist die Firma gewerblich tätig? Relevant für die §141-AO-Schwellenprüfung.
    istGewerblich(form) {
        form = form || this.get();
        if (this.isKapitalgesellschaft(form) || ['OHG', 'KG', 'GmbH & Co. KG'].includes(form)) return true;
        if (form === 'Freiberufler') return false;
        if (this.FORMEN_MIT_TAETIGKEITSART.includes(form)) return this.getTaetigkeitsart() === 'gewerblich';
        return false;
    },

    // §141 AO (seit 1.1.2024): Umsatz > 800.000 € ODER Gewinn > 80.000 € → Bilanzierungspflicht
    // ab dem übernächsten Jahr für gewerbliche Einzelunternehmer/Personengesellschaften.
    AO141_UMSATZ_GRENZE: 800000,
    AO141_GEWINN_GRENZE: 80000,

    ueberschreitetAO141Schwelle(year) {
        if (typeof GbrModul === 'undefined' || !GbrModul._calcJahresgewinn) return false;
        const { einnahmen, gewinn } = GbrModul._calcJahresgewinn(year);
        return einnahmen > this.AO141_UMSATZ_GRENZE || gewinn > this.AO141_GEWINN_GRENZE;
    },

    // Zentrale Weiche für EÜR-Tab & Co.: braucht diese Firma jetzt eine Bilanz statt EÜR?
    brauchtBilanzStattEuer(year) {
        if (this.isKapitalgesellschaft()) return true;
        if (this.getConfig().bilanzPflicht) return true; // OHG/KG/GmbH & Co. KG: Kaufmannseigenschaft kraft HGB
        return this.istGewerblich() && this.ueberschreitetAO141Schwelle(year || new Date().getFullYear());
    },

    brauchtBilanz(form) {
        return this.getConfig(form).bilanzPflicht;
    },

    brauchtKSt(form) {
        return this.getConfig(form).koerperschaftsteuer;
    },

    brauchtGewSt(form) {
        form = form || this.get();
        if (this.FORMEN_MIT_TAETIGKEITSART.includes(form) && this.getTaetigkeitsart() === 'freiberuflich') return false;
        return this.getConfig(form).gewerbesteuer;
    },

    brauchtFeststellung(form) {
        return this.getConfig(form).feststellung;
    },

    hatGesellschafter(form) {
        return this.getConfig(form).gesellschafter;
    },

    kannKleinunternehmer(form) {
        return this.getConfig(form).kleinunternehmer;
    },

    // Alle verfügbaren Rechtsformen als Options-Array
    getAllOptions() {
        return Object.keys(this.FORMEN).map(key => ({
            value: key,
            label: this.FORMEN[key].label,
            kurz:  this.FORMEN[key].kurz
        }));
    },

    // Steuerliche Pflichten als Übersicht rendern (für Settings/Onboarding)
    renderPflichtenOverview(form) {
        const c = this.getConfig(form);
        const check = (v, label) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;">
            <span style="color:${v ? 'var(--success)' : 'var(--text-muted)'};">${v ? '✅' : '➖'}</span>
            <span style="${v ? '' : 'color:var(--text-muted);'}">${label}</span>
        </div>`;

        return `
        <div style="background:var(--bg-secondary);border-radius:8px;padding:14px 16px;border:1px solid var(--border);">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;">${c.label}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;line-height:1.5;">${c.hinweis}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px;">
                ${check(c.gewinnermittlung === 'euer', 'EÜR (§4 Abs. 3 EStG)')}
                ${check(c.bilanzPflicht, 'Bilanzpflicht (HGB)')}
                ${check(c.gewerbesteuer, 'Gewerbesteuer')}
                ${check(c.koerperschaftsteuer, 'Körperschaftsteuer')}
                ${check(c.ustPflicht, 'Umsatzsteuer')}
                ${check(c.kleinunternehmer, '§19 Kleinunternehmer möglich')}
                ${check(c.vorsteuer, 'Vorsteuerabzug')}
                ${check(c.feststellung, 'Gesonderte Feststellung')}
                ${check(c.gesellschafter, 'Gesellschafter-Verwaltung')}
                ${check(c.lohnsteuer, 'Lohnsteuer (bei AN)')}
                ${check(c.privatbuchungen, 'Privatentnahmen/-einlagen')}
                ${check(c.afa, 'AfA / Anlagevermögen')}
            </div>
            ${c.gewStFreibetrag > 0 ? `<div style="margin-top:8px;font-size:11px;color:var(--text-muted);">GewSt-Freibetrag: ${Utils.formatCurrency(c.gewStFreibetrag)}</div>` : ''}
        </div>`;
    },

    // Render-Modul: Rechtsform-Auswahl Seite
    render() {
        const current = this.get();
        const config  = this.getConfig();
        const options = this.getAllOptions();

        return `
        <div class="page-header">
            <h2><i class="ti ti-building" style="margin-right:6px;"></i> Rechtsform & Steuerpflichten</h2>
        </div>

        <!-- Aktuelle Rechtsform -->
        <div class="card" style="margin-bottom:16px;padding:20px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <div style="width:48px;height:48px;border-radius:12px;background:var(--accent-glow);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:22px;">
                    ${this.isKapitalgesellschaft() ? '🏢' : this.isPersonengesellschaft() ? '🤝' : '👤'}
                </div>
                <div>
                    <div style="font-weight:800;font-size:17px;">${config.label}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Gewinnermittlung: ${config.gewinnermittlung === 'euer' ? 'EÜR' : 'Bilanz (GuV)'}</div>
                </div>
            </div>
            ${this.renderPflichtenOverview(current)}
        </div>

        <!-- Rechtsform wählen -->
        <div class="card" style="padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;">Rechtsform ändern</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
                Beeinflusst welche Steuer-Module und Pflichten angezeigt werden.
                Bestehende Daten bleiben erhalten.
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;" id="rechtsformGrid">
                ${options.map(o => {
                    const c = this.FORMEN[o.value];
                    const active = o.value === current;
                    return `
                    <button class="rechtsform-option" data-form="${o.value}"
                        style="text-align:left;padding:14px 16px;border-radius:10px;cursor:pointer;
                        border:2px solid ${active ? 'var(--accent)' : 'var(--border)'};
                        background:${active ? 'rgba(99,102,241,.08)' : 'var(--bg-secondary)'};
                        transition:all .15s;">
                        <div style="font-weight:700;font-size:13px;color:${active ? 'var(--accent)' : 'var(--text-primary)'};">
                            ${active ? '◆ ' : ''}${o.label}
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.4;">
                            ${c.gewinnermittlung === 'euer' ? 'EÜR' : 'Bilanz'}
                            ${c.gewerbesteuer ? ' · GewSt' : ''}
                            ${c.koerperschaftsteuer ? ' · KSt' : ''}
                            ${c.feststellung ? ' · Feststellung' : ''}
                        </div>
                    </button>`;
                }).join('')}
            </div>

            <!-- Preview -->
            <div id="rechtsformPreview" style="margin-top:16px;"></div>
        </div>

        <!-- Steuerliche Hinweise -->
        <div class="card" style="margin-top:16px;padding:16px;">
            <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
                <strong>Hinweise:</strong><br>
                • Die Rechtsform beeinflusst welche Module (GewSt, KSt, Bilanz, Feststellung) angezeigt werden.<br>
                • <strong>Einzelunternehmen / Freiberufler</strong>: EÜR, optional Gewerbesteuer (nur EU).<br>
                • <strong>Personengesellschaften</strong> (GbR, OHG, KG): Gesonderte Feststellung, GewSt mit Freibetrag.<br>
                • <strong>Kapitalgesellschaften</strong> (GmbH, UG): KSt 15% + SolZ 5,5%, Bilanzpflicht, kein GewSt-Freibetrag.<br>
                • ⚠️ Keine Steuerberatung — Rechtsform-Wahl mit Steuerberater besprechen.
            </div>
        </div>`;
    },

    init() {
        const grid = document.getElementById('rechtsformGrid');
        if (!grid) return;

        grid.querySelectorAll('.rechtsform-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const form = btn.dataset.form;
                // Preview anzeigen
                const preview = document.getElementById('rechtsformPreview');
                if (preview) {
                    preview.innerHTML = this.renderPflichtenOverview(form) +
                        `<div style="margin-top:12px;display:flex;gap:8px;">
                            <button class="btn btn-primary" id="confirmRechtsform">
                                ${form === this.get() ? '✅ Bereits aktiv' : 'Rechtsform übernehmen'}
                            </button>
                        </div>`;

                    const confirmBtn = document.getElementById('confirmRechtsform');
                    if (confirmBtn && form !== this.get()) {
                        confirmBtn.addEventListener('click', () => {
                            this.set(form);
                            Utils.showToast('Rechtsform geändert: ' + this.FORMEN[form].label, 'success');
                            // Refresh page
                            App.navigate('rechtsform');
                            // Update GbR tab visibility
                            if (typeof App._updateGbrTabVisibility === 'function') {
                                App._updateGbrTabVisibility();
                            }
                        });
                    }
                }

                // Visual highlight
                grid.querySelectorAll('.rechtsform-option').forEach(b => {
                    b.style.borderColor = 'var(--border)';
                    b.style.background = 'var(--bg-secondary)';
                });
                btn.style.borderColor = 'var(--accent)';
                btn.style.background = 'rgba(99,102,241,.08)';
            });
        });
    }
};
