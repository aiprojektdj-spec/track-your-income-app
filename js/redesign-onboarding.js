/* Zwei Einrichtungsschritte auf den vorhandenen Firmen- und Speicherpfaden. */
(function () {
    'use strict';
    if (typeof App === 'undefined') return;

    const saveOriginal = App._saveOnboardingStep;
    let state = null;
    const extraFields = ['adresse', 'plz', 'ort', 'telefon', 'email', 'steuernummer', 'ustId', 'bankname', 'iban', 'bic'];

    function current(app) {
        if (!app._onboardingData) app._onboardingData = {};
        if (!state || state.data !== app._onboardingData) {
            state = { data: app._onboardingData, choice: '', confirmed: false };
        }
        return state;
    }

    function fieldValue(name) {
        const field = document.getElementById('ob_' + name);
        return field ? field.value.trim() : '';
    }

    function clearErrors() {
        const form = document.getElementById('redesignOnboardingForm');
        if (!form) return;
        form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
        form.querySelectorAll('.redesign-field-error').forEach(error => { error.textContent = ''; });
        const summary = document.getElementById('obErrorSummary');
        if (summary) { summary.hidden = true; summary.innerHTML = ''; }
    }

    function showErrors(errors) {
        const summary = document.getElementById('obErrorSummary');
        if (!summary) return;
        errors.forEach(error => {
            const field = error.field && document.getElementById(error.field);
            const detail = error.field && document.getElementById(error.field + 'Error');
            if (field) field.setAttribute('aria-invalid', 'true');
            if (detail) detail.textContent = error.message;
        });
        summary.innerHTML = '<h3>Bitte prüfe deine Angaben</h3><ul>' + errors.map(error =>
            '<li>' + (error.field ? '<a href="#' + error.field + '">' + Utils.escapeHtml(error.message) + '</a>' : Utils.escapeHtml(error.message)) + '</li>'
        ).join('') + '</ul>';
        summary.hidden = false;
        summary.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
            event.preventDefault();
            const field = document.getElementById(link.getAttribute('href').slice(1));
            if (field) {
                const details = field.closest('details');
                if (details) details.open = true;
                field.focus();
            }
        }));
        summary.focus();
    }

    function input(data, name, label, options) {
        options = options || {};
        return '<div class="form-group"><label class="form-label" for="ob_' + name + '">' + label + '</label>' +
            '<input class="form-input" id="ob_' + name + '" name="' + name + '" type="' + (options.type || 'text') + '" maxlength="300"' +
            (options.required ? ' required' : '') + (options.autocomplete ? ' autocomplete="' + options.autocomplete + '"' : '') +
            ' aria-describedby="ob_' + name + 'Error" value="' + Utils.escapeHtml(data[name] || '') + '">' +
            '<p class="redesign-field-error" id="ob_' + name + 'Error"></p></div>';
    }

    function options(items, selected) {
        return '<option value="">Bitte auswählen</option>' + items.map(item =>
            '<option value="' + Utils.escapeHtml(item.value) + '"' + (selected === item.value ? ' selected' : '') + '>' + Utils.escapeHtml(item.label) + '</option>'
        ).join('');
    }

    App._renderOnboarding = function () {
        const local = current(this);
        const data = local.data;
        const step = this._onboardingStep === 1 ? 1 : 2;
        this._onboardingStep = step;
        let fields;

        if (step === 1) {
            const industries = CompanyManager.BRANCHEN.map(value => ({ value: value, label: value }));
            const forms = typeof Rechtsform !== 'undefined' && Rechtsform.getAllOptions
                ? Rechtsform.getAllOptions()
                : [{ value: 'Einzelunternehmen', label: 'Einzelunternehmen' }, { value: 'GbR', label: 'GbR (Gesellschaft bürgerlichen Rechts)' }];
            fields = input(data, 'firmenname', 'Firmenname (Pflichtfeld)', { required: true, autocomplete: 'organization' }) +
                input(data, 'name', 'Dein Name (Pflichtfeld)', { required: true, autocomplete: 'name' }) +
                '<div class="form-group"><label class="form-label" for="ob_branche">Branche (Pflichtfeld)</label>' +
                '<select class="form-select" id="ob_branche" name="branche" required aria-describedby="ob_brancheError">' + options(industries, data.branche) + '</select><p class="redesign-field-error" id="ob_brancheError"></p></div>' +
                '<div class="form-group"><label class="form-label" for="ob_rechtsform">Rechtsform (Pflichtfeld)</label>' +
                '<select class="form-select" id="ob_rechtsform" name="rechtsform" required aria-describedby="ob_rechtsformError">' + options(forms, data.rechtsform) + '</select><p class="redesign-field-error" id="ob_rechtsformError"></p></div>';
        } else {
            fields = '<dl class="redesign-metric-list"><div><dt>Firma</dt><dd>' + Utils.escapeHtml(data.firmenname || '') + '</dd></div><div><dt>Rechtsform</dt><dd>' + Utils.escapeHtml(data.rechtsform || '') + '</dd></div></dl>' +
                '<div class="form-group"><label class="form-label" for="ob_ustMode">Umsatzsteuerstatus (Pflichtfeld)</label>' +
                '<select class="form-select" id="ob_ustMode" name="ustMode" required aria-describedby="ob_ustModeHelp ob_ustModeError">' +
                options([{ value: 'klein', label: 'Kleinunternehmer' }, { value: 'regel', label: 'Regelbesteuerung' }, { value: 'unknown', label: 'Weiß ich noch nicht' }], local.choice) + '</select>' +
                '<p class="form-hint" id="ob_ustModeHelp">Wähle deinen tatsächlich geltenden Status. Stackr leitet ihn nicht aus deiner Branche oder Rechtsform ab.</p><p class="redesign-field-error" id="ob_ustModeError"></p></div>' +
                '<div id="obUnknownNotice" class="redesign-notice"' + (local.choice === 'unknown' ? '' : ' hidden') + '><h3>Steuerstatus noch offen</h3>' +
                '<p>Du kannst die Einrichtung erst abschließen, wenn dein Umsatzsteuerstatus geklärt ist. Prüfe deine Unterlagen oder kläre die Angabe mit deiner Steuerberatung.</p>' +
                '<p>Deine Eingaben bleiben in diesem geöffneten Formular erhalten. Es wird kein Steuerstatus für dich festgelegt.</p></div>' +
                '<div class="form-group" id="obKnownConfirmation"' + (['klein', 'regel'].includes(local.choice) ? '' : ' hidden') + '>' +
                '<label class="redesign-check-label" for="ob_ustConfirm"><input type="checkbox" id="ob_ustConfirm" aria-describedby="ob_ustConfirmError"' + (local.confirmed ? ' checked' : '') + '> Ich habe meinen Umsatzsteuerstatus geprüft und bestätige diese Auswahl.</label><p class="redesign-field-error" id="ob_ustConfirmError"></p></div>' +
                '<details class="redesign-details"><summary>Adresse und Kontakt ergänzen (optional)</summary><div class="redesign-detail-content">' +
                input(data, 'adresse', 'Straße und Hausnummer', { autocomplete: 'street-address' }) +
                input(data, 'plz', 'Postleitzahl', { autocomplete: 'postal-code' }) + input(data, 'ort', 'Ort', { autocomplete: 'address-level2' }) +
                input(data, 'telefon', 'Telefon', { type: 'tel', autocomplete: 'tel' }) + input(data, 'email', 'E-Mail', { type: 'email', autocomplete: 'email' }) + '</div></details>' +
                '<details class="redesign-details"><summary>Steuerkennungen ergänzen (optional)</summary><div class="redesign-detail-content">' +
                input(data, 'steuernummer', 'Steuernummer') + input(data, 'ustId', 'Umsatzsteuer-Identifikationsnummer') + '</div></details>' +
                '<details class="redesign-details"><summary>Bankverbindung ergänzen (optional)</summary><div class="redesign-detail-content">' +
                input(data, 'bankname', 'Bankname') + input(data, 'iban', 'IBAN') + input(data, 'bic', 'BIC') + '</div></details>' +
                '<p class="redesign-caption">Deine Buchhaltungsdaten werden lokal auf diesem Gerät gespeichert. Cloud-Sync ist optional; ein eigenes Backup bleibt zusätzlich sinnvoll. Weitere Angaben kannst du in den Einstellungen ergänzen.</p>';
        }

        const host = document.getElementById('onboarding');
        if (!host) return;
        host.innerHTML = '<div class="onboarding-overlay redesign-onboarding"><section class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="obHeading">' +
            '<p class="redesign-eyebrow">Schritt ' + step + ' von 2 · ' + (step === 1 ? 'Deine Firma' : 'Dein Steuerprofil') + '</p>' +
            '<h2 id="obHeading" tabindex="-1">' + (step === 1 ? 'Richte deine Firma ein.' : 'Bestätige dein Steuerprofil.') + '</h2>' +
            '<p class="subtitle">' + (step === 1 ? 'Zuerst die Angaben zu dir und deiner Firma.' : 'Eine bewusste Auswahl, bevor du mit deinen Buchungen beginnst.') + '</p>' +
            '<form id="redesignOnboardingForm" novalidate><div id="obErrorSummary" class="redesign-notice" role="alert" tabindex="-1" hidden></div>' + fields +
            '<div class="form-actions">' + (step === 2 ? '<button class="btn btn-outline" type="button" id="obPrev">Zurück</button>' : '') +
            '<button class="btn btn-primary" type="submit" id="' + (step === 1 ? 'obNext' : 'obFinish') + '">' + (step === 1 ? 'Weiter' : 'Einrichtung abschließen') + '</button></div></form>' +
            '<div class="redesign-link-row"><button class="redesign-text-link" type="button" id="obConnect">Mit bestehendem Sync verbinden</button></div></section></div>';

        const form = document.getElementById('redesignOnboardingForm');
        form.addEventListener('submit', event => {
            event.preventDefault();
            const submit = document.getElementById(step === 1 ? 'obNext' : 'obFinish');
            if (submit.disabled) return;
            submit.disabled = true;
            submit.setAttribute('aria-busy', 'true');
            try {
                if (this._saveOnboardingStep() === false) return;
                if (step === 1) {
                    this._onboardingStep = 2;
                    this._renderOnboarding();
                } else {
                    this._finishOnboarding();
                }
            } catch (error) {
                delete data.onboardingDone;
                showErrors([{ message: 'Die Einrichtung konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. ' + (error && error.message ? error.message : '') }]);
            } finally {
                if (submit.isConnected) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
            }
        });
        const previous = document.getElementById('obPrev');
        if (previous) previous.addEventListener('click', () => {
            this._saveOnboardingStep({ draftOnly: true });
            this._onboardingStep = 1;
            this._renderOnboarding();
        });
        document.getElementById('obConnect').addEventListener('click', () => {
            this._saveOnboardingStep({ draftOnly: true });
            this._openSyncConnect();
        });
        const mode = document.getElementById('ob_ustMode');
        if (mode) mode.addEventListener('change', () => {
            local.choice = mode.value;
            local.confirmed = false;
            document.getElementById('ob_ustConfirm').checked = false;
            document.getElementById('obUnknownNotice').hidden = mode.value !== 'unknown';
            document.getElementById('obKnownConfirmation').hidden = !['klein', 'regel'].includes(mode.value);
            clearErrors();
        });
        // Die Einrichtung ist eine eigenständige Aufgabe. Tab bleibt innerhalb ihres Dialogs.
        const card = host.querySelector('.onboarding-card');
        card.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const focusable = Array.from(card.querySelectorAll('button, input, select, summary, a[href], [tabindex="0"]')).filter(element => !element.disabled && element.getClientRects().length);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement.id === 'obHeading')) { event.preventDefault(); if (last) last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); if (first) first.focus(); }
        });
        document.getElementById('obHeading').focus();
    };

    App._saveOnboardingStep = function (settings) {
        settings = settings || {};
        const local = current(this);
        const data = local.data;
        clearErrors();
        if (this._onboardingStep === 1) {
            ['firmenname', 'name', 'branche', 'rechtsform'].forEach(name => { data[name] = fieldValue(name); });
            if (settings.draftOnly) return true;
            const labels = { firmenname: 'Gib einen Firmennamen ein.', name: 'Gib deinen Namen ein.', branche: 'Wähle deine Branche.', rechtsform: 'Wähle deine Rechtsform.' };
            const errors = Object.keys(labels).filter(name => !data[name]).map(name => ({ field: 'ob_' + name, message: labels[name] }));
            if (errors.length) { showErrors(errors); return false; }
            return saveOriginal.call(this);
        }

        extraFields.forEach(name => { data[name] = fieldValue(name); });
        local.choice = fieldValue('ustMode');
        local.confirmed = !!document.getElementById('ob_ustConfirm').checked;
        if (settings.draftOnly) return true;
        const errors = [];
        if (!['klein', 'regel'].includes(local.choice)) {
            errors.push({ field: 'ob_ustMode', message: local.choice === 'unknown' ? 'Klär deinen Umsatzsteuerstatus, bevor du die Einrichtung abschließt. Deine Eingaben bleiben im geöffneten Formular erhalten.' : 'Wähle deinen bestätigten Umsatzsteuerstatus.' });
        } else if (!local.confirmed) {
            errors.push({ field: 'ob_ustConfirm', message: 'Bestätige, dass du deinen Umsatzsteuerstatus geprüft hast.' });
        }
        const email = document.getElementById('ob_email');
        if (email && email.value && !email.validity.valid) errors.push({ field: 'ob_email', message: 'Prüfe das Format deiner E-Mail-Adresse.' });
        if (errors.length) { showErrors(errors); return false; }
        // Ausschließlich die bereits unterstützten Werte erreichen den unveränderten Abschluss.
        data.ustMode = local.choice;
        return true;
    };
})();
