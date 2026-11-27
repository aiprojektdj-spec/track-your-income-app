// ============================================
// PasswortDialog — maskierte Passwortabfrage statt window.prompt()
//
// prompt() zeigt die Eingabe im Klartext. Dieser Dialog nutzt ein natives <dialog> mit
// <input type="password">. Rueckgabe wie prompt(): Promise mit dem eingegebenen Text,
// bei Abbrechen/Escape null.
//
//   const pw = await PasswortDialog.frage('Passwort:', 'new-password');
// ============================================
const PasswortDialog = (function () {
    'use strict';

    function frage(text, autocomplete) {
        return new Promise(function (resolve) {
            var dlg = document.createElement('dialog');
            dlg.setAttribute('aria-label', 'Passwort eingeben');
            dlg.style.cssText = 'max-width:420px;width:calc(100% - 32px);padding:20px;border:1px solid var(--border);' +
                'border-radius:12px;background:var(--bg-card, #fff);color:var(--text-primary, inherit);';

            var form = document.createElement('form');
            form.method = 'dialog';
            form.style.cssText = 'display:flex;flex-direction:column;gap:14px;margin:0;';

            var label = document.createElement('label');
            label.style.cssText = 'display:flex;flex-direction:column;gap:8px;font-size:14px;';
            var span = document.createElement('span');
            span.textContent = text;
            var input = document.createElement('input');
            input.type = 'password';
            input.className = 'form-input';
            input.autocomplete = autocomplete || 'current-password';
            input.autofocus = true;
            label.appendChild(span);
            label.appendChild(input);

            var row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
            var abbr = document.createElement('button');
            abbr.type = 'button';
            abbr.className = 'btn';
            abbr.textContent = 'Abbrechen';
            var ok = document.createElement('button');
            ok.type = 'submit';
            ok.className = 'btn btn-primary';
            ok.textContent = 'OK';
            row.appendChild(abbr);
            row.appendChild(ok);

            form.appendChild(label);
            form.appendChild(row);
            dlg.appendChild(form);

            // Bestaetigt nur per Absenden (OK-Klick oder Enter); Escape/Abbrechen -> null
            var bestaetigt = false;
            form.addEventListener('submit', function () { bestaetigt = true; });
            abbr.addEventListener('click', function () { dlg.close(); });
            dlg.addEventListener('close', function () {
                var wert = bestaetigt ? input.value : null;
                input.value = '';
                dlg.remove();
                resolve(wert);
            });

            document.body.appendChild(dlg);
            dlg.showModal();
            input.focus();
        });
    }

    return { frage: frage };
})();

if (typeof window !== 'undefined') window.PasswortDialog = PasswortDialog;
