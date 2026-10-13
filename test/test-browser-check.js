// Hinweis für zu alte Browser:  node test/test-browser-check.js
// =============================================================================
// js/es-probe.js setzt window.__stackrEs2020 nur, wenn der Browser `?.`/`??` versteht;
// js/browser-check.js (ES5) legt sonst einen Hinweis über die Seite. Geprüft wird:
//   1. Probe in einem modernen Parser → Marke true
//   2. Check ohne Marke → Hinweis erscheint, genau einmal; mit Marke → nichts
//   3. browser-check.js nutzt nichts jenseits von ES5 (sonst scheitert er selbst im alten Browser)
//   4. app.html lädt beide Dateien als ERSTE Skripte, synchron
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');

const ROOT  = path.join(__dirname, '..');
const PROBE = fs.readFileSync(path.join(ROOT, 'js', 'es-probe.js'), 'utf8');
const CHECK = fs.readFileSync(path.join(ROOT, 'js', 'browser-check.js'), 'utf8');
const APP   = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');

let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };

// Minimaler DOM: genug für createElement/appendChild/getElementById/style/Textknoten
function fakeDom(readyState) {
    const byId = {}, listeners = {};
    function el(tag) {
        const e = { tagName: tag, style: {}, children: [], attrs: {}, text: '' };
        e.appendChild = (c) => { e.children.push(c); if (c.id) byId[c.id] = c; return c; };
        e.setAttribute = (k, v) => { e.attrs[k] = v; };
        Object.defineProperty(e, 'id', { set(v) { e._id = v; }, get() { return e._id; } });
        return e;
    }
    const body = el('body');
    const document = {
        readyState, body,
        createElement: el,
        createTextNode: (t) => ({ text: t }),
        getElementById: (id) => byId[id] || null,
        addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); }
    };
    return { document, body, fire: (ev) => (listeners[ev] || []).forEach(f => f()) };
}
function textOf(n) { return (n.text || '') + (n.children || []).map(textOf).join(''); }

// 1. Moderner Parser setzt die Marke
const w1 = {};
vm.runInNewContext(PROBE, { window: w1 });
assert.strictEqual(w1.__stackrEs2020, true);
ok('es-probe.js setzt die Marke in einem ES2020-fähigen Parser');

// 2a. Ohne Marke (alter Browser, Probe verworfen) → Hinweis, nach DOMContentLoaded
let d = fakeDom('loading');
vm.runInNewContext(CHECK, { window: {}, document: d.document });
assert.strictEqual(d.body.children.length, 0, 'vor DOMContentLoaded noch nichts');
d.fire('DOMContentLoaded');
assert.strictEqual(d.body.children.length, 1, 'Hinweis eingefügt');
const box = d.body.children[0];
assert.strictEqual(box.id, 'stackrBrowserAlt');
assert.strictEqual(box.attrs.role, 'alert');
assert.strictEqual(box.style.position, 'fixed');
assert.ok(/zu alt für Stackr/.test(textOf(box)) && /aktualisiere/.test(textOf(box)), textOf(box));
d.fire('DOMContentLoaded');
assert.strictEqual(d.body.children.length, 1, 'kein zweiter Hinweis');
ok('ohne Marke: Hinweis über der Seite, genau einmal');

// 2b. Seite schon geladen → sofort; 2c. mit Marke → nichts
d = fakeDom('complete');
vm.runInNewContext(CHECK, { window: {}, document: d.document });
assert.strictEqual(d.body.children.length, 1);
d = fakeDom('loading');
vm.runInNewContext(CHECK, { window: { __stackrEs2020: true }, document: d.document });
d.fire('DOMContentLoaded');
assert.strictEqual(d.body.children.length, 0, 'moderner Browser sieht nichts');
ok('ohne Marke auch nach dem Laden; mit Marke kein Hinweis');

// 3. browser-check.js ist ES5 (Kommentare und Strings ausgenommen)
const code = CHECK.replace(/\/\/[^\n]*/g, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
for (const [name, re] of [['?.', /\?\./], ['??', /\?\?/], ['=>', /=>/], ['let/const', /\b(?:let|const)\s/],
                          ['Template-String', /`/], ['class', /\bclass\s/], ['Spread', /\.\.\./]]) {
    assert.ok(!re.test(code), 'browser-check.js nutzt ' + name);
}
assert.ok(!/\beval\b|new Function/.test(code + PROBE.replace(/\/\/[^\n]*/g, '')), 'kein eval — die CSP verbietet es');
ok('browser-check.js ist ES5, kein eval');

// 4. app.html: beide zuerst, synchron, in dieser Reihenfolge
const srcs = [...APP.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"/g)].map(m => ({ attrs: m[1], src: m[2] }));
assert.strictEqual(srcs[0].src, 'js/es-probe.js', 'erstes Skript: ' + srcs[0].src);
assert.strictEqual(srcs[1].src, 'js/browser-check.js', 'zweites Skript: ' + srcs[1].src);
assert.ok(!/\b(defer|async|type=)/.test(srcs[0].attrs + srcs[1].attrs), 'synchron, klassisches Skript');
ok('app.html lädt Probe und Check als erste Skripte, synchron');

console.log('\n' + pass + '/5 Browser-Check-Tests bestanden ✅');
