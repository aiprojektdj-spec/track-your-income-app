// Lädt Browser-Module (js/*.js) unverändert in einen eigenen vm-Kontext.
// Kein Test für sich (Unterstrich-Präfix) — wird von den Audit-2026-10-13-Tests benutzt,
// damit sie den ECHTEN Produktpfad ausführen statt Methoden aus dem Quelltext zu schneiden.
//
//   const ctx = ladeModule(['js/steuer-berechnung.js', 'js/euer.js'], { Store, Utils });
//   ctx.Euer._berechne(2026, 0, 'jahr')
//
// Top-level `const X =` wird zu `var X =`, sonst hinge X nicht am Kontextobjekt.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function ladeModule(dateien, globals) {
    const ctx = vm.createContext(Object.assign({
        console, Math, Date, JSON, Intl, Set, Map, Promise, setTimeout, clearTimeout,
        window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
    }, globals || {}));
    // window zeigt auf den Kontext selbst, wie im Browser
    ctx.window = ctx;
    for (const datei of dateien) {
        // STACKR_ROOT: anderer Stand (z. B. git show HEAD~1) — zum Nachweis, dass ein Test vorher rot war
        const root = process.env.STACKR_ROOT && fs.existsSync(path.join(process.env.STACKR_ROOT, datei))
            ? process.env.STACKR_ROOT : path.join(__dirname, '..');
        const src = fs.readFileSync(path.join(root, datei), 'utf8')
            .replace(/^(?:const|let) ([A-Za-z_$][\w$]*)\s*=/gm, 'var $1 =');
        vm.runInContext(src, ctx, { filename: datei });
    }
    return ctx;
}

module.exports = { ladeModule };
