// Self-Test Webhooks:  node test/test-webhooks.js
//
// Fund C des Vollaudits (plan/01-AUFGABEN.md 1.8): js/webhooks.js wurde von keinem Harness
// geladen. Es rechnet nichts, aber es haengt an jedem Speichervorgang (Einnahme, Rechnung,
// Eigenbeleg) — ein Fehler hier bricht das Speichern ab oder laesst eine Automatisierung
// stumm ausfallen. Geprueft wird genau das:
//   A) erlaubt()  — nur https://*.make.com, passend zur CSP (vercel.json, connect-src)
//   B) fire()     — sendet richtig, und stoert den Aufrufer NIE
//   C) test()     — liefert lesbare Ergebnisse fuer den Test-Knopf
//   D) Quelltext  — jedes Event in EVENTS wird irgendwo auch gefeuert
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'webhooks.js'), 'utf8');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}

// Modul mit austauschbarem Store und fetch laden.
function lade(settings, fetchImpl) {
    const Store = { getSettings: typeof settings === 'function' ? settings : () => settings };
    return new Function('Store', 'fetch', 'AbortSignal', src + '; return Webhooks;')(
        Store, fetchImpl, { timeout: ms => ({ timeoutMs: ms }) });
}
const MAKE = 'https://hook.eu1.make.com/abc123def456';

(async () => {
    // ── A) erlaubt ──────────────────────────────────────────────────────────
    const W = lade({}, () => Promise.resolve());
    check('A1 Make.com-Hook (eu1) erlaubt', W.erlaubt(MAKE));
    check('A2 andere Make-Region (us1) erlaubt', W.erlaubt('https://hook.us1.make.com/x'));
    check('A3 http statt https abgelehnt', !W.erlaubt('http://hook.eu1.make.com/x'));
    check('A4 fremde Domain abgelehnt', !W.erlaubt('https://webhook.site/x'));
    check('A5 Nachahmer-Domain (make.com.evil.de) abgelehnt', !W.erlaubt('https://hook.make.com.evil.de/x'));
    check('A6 Suffix ohne Punkt (evilmake.com) abgelehnt', !W.erlaubt('https://evilmake.com/x'));
    check('A7 nackte make.com abgelehnt (CSP erlaubt nur *.make.com)', !W.erlaubt('https://make.com/x'));
    check('A8 Zugangsdaten in der URL abgelehnt', !W.erlaubt('https://a:b@hook.eu1.make.com/x'));
    check('A9 Unsinn/leer/undefined wirft nicht und ist abgelehnt',
        !W.erlaubt('kein url') && !W.erlaubt('') && !W.erlaubt(undefined) && !W.erlaubt(null));
    check('A10 javascript:-URL abgelehnt', !W.erlaubt('javascript:alert(1)'));

    // ── B) fire ─────────────────────────────────────────────────────────────
    {
        const calls = [];
        const Wf = lade({ webhookUrls: { einnahme: MAKE } }, (url, opt) => { calls.push({ url, opt }); return Promise.resolve(); });
        Wf.fire('einnahme', { id: 's1', betrag: 12.5 });
        const c = calls[0];
        const body = c && JSON.parse(c.opt.body);
        check('B1 sendet genau einen POST an die hinterlegte URL', calls.length === 1 && c.url === MAKE && c.opt.method === 'POST');
        check('B2 Content-Type JSON', c && c.opt.headers['Content-Type'] === 'application/json');
        check('B3 Body: event, ISO-Zeitstempel, data', body && body.event === 'einnahme'
            && /^\d{4}-\d\d-\d\dT/.test(body.ts) && body.data.id === 's1' && body.data.betrag === 12.5);
        check('B4 mit Timeout (8 s), damit nichts haengen bleibt', c && c.opt.signal && c.opt.signal.timeoutMs === 8000);

        Wf.fire('rechnung', { id: 'r1' });
        check('B5 Event ohne URL sendet nichts', calls.length === 1);
    }
    {
        const calls = [];
        const Wf = lade({ webhookUrls: { einnahme: 'https://webhook.site/x' } }, (u) => { calls.push(u); return Promise.resolve(); });
        Wf.fire('einnahme', {});
        check('B6 nicht erlaubte URL wird uebersprungen, nicht gesendet', calls.length === 0);
    }
    {
        let threw = false;
        try {
            lade({ webhookUrls: { einnahme: MAKE } }, () => { throw new Error('sync'); }).fire('einnahme', {});
            lade({ webhookUrls: { einnahme: MAKE } }, () => Promise.reject(new Error('offline'))).fire('einnahme', {});
            lade(() => { throw new Error('store kaputt'); }, () => Promise.resolve()).fire('einnahme', {});
            lade({}, () => Promise.resolve()).fire('einnahme', {});              // keine webhookUrls
            lade({ webhookUrls: { einnahme: MAKE } }, () => Promise.resolve()).fire('einnahme', { zyklus: null });
            const zyk = {}; zyk.selbst = zyk;                                      // JSON.stringify wirft
            lade({ webhookUrls: { einnahme: MAKE } }, () => Promise.resolve()).fire('einnahme', zyk);
        } catch (e) { threw = true; }
        check('B7 fire wirft nie: fetch wirft, fetch lehnt ab, Store wirft, zyklische Daten', !threw);
        // Abgelehnte Promise darf nicht als "unhandled rejection" hochkommen.
        let unhandled = false;
        process.once('unhandledRejection', () => { unhandled = true; });
        lade({ webhookUrls: { einnahme: MAKE } }, () => Promise.reject(new Error('offline'))).fire('einnahme', {});
        await new Promise(r => setTimeout(r, 20));
        check('B8 abgelehnter fetch erzeugt keine unhandled rejection', !unhandled);
    }

    // ── C) test ─────────────────────────────────────────────────────────────
    {
        const Wt = lade({ webhookUrls: {} }, () => Promise.resolve({ ok: true, status: 200 }));
        const r0 = await Wt.test('einnahme');
        check('C1 ohne URL: no_url', r0.ok === false && r0.error === 'no_url');
        const r1 = await Wt.test('einnahme', 'https://webhook.site/x');
        check('C2 fremde URL: not_allowed (statt stummem CSP-Block)', r1.ok === false && r1.error === 'not_allowed');
        const r2 = await Wt.test('einnahme', MAKE);
        check('C3 Erfolg: ok + Status', r2.ok === true && r2.status === 200);

        let gesendet;
        const Wb = lade({}, (u, o) => { gesendet = JSON.parse(o.body); return Promise.resolve({ ok: true, status: 200 }); });
        await Wb.test('rechnung', MAKE);
        check('C4 Test-Payload ist als Test erkennbar (data.test = true)', gesendet && gesendet.data.test === true && gesendet.event === 'rechnung');

        const r3 = await lade({}, () => Promise.resolve({ ok: false, status: 410 })).test('einnahme', MAKE);
        check('C5 HTTP-Fehler: ok=false mit Status (z. B. 410 = Szenario geloescht)', r3.ok === false && r3.status === 410);
        const r4 = await lade({}, () => Promise.reject(new TypeError('Failed to fetch'))).test('einnahme', MAKE);
        check('C6 Netzfehler: ok=false mit Meldung', r4.ok === false && r4.error === 'Failed to fetch');
        const r5 = await lade({ webhookUrls: { eigenbeleg: MAKE } }, () => Promise.resolve({ ok: true, status: 202 })).test('eigenbeleg');
        check('C7 ohne Override wird die gespeicherte URL genommen', r5.ok === true && r5.status === 202);
    }

    // ── D) Quelltext-Wachen ─────────────────────────────────────────────────
    // Ein Event in EVENTS erscheint als Eingabefeld in den Einstellungen. Feuert es nirgends,
    // traegt der Nutzer eine URL ein, und es passiert nie etwas. Das Eigenbeleg-Event feuert
    // ausserhalb von js/ (eigenbelege/js/app.js) — deshalb wird beides durchsucht.
    {
        const dateien = [];
        for (const dir of ['js', path.join('eigenbelege', 'js')]) {
            for (const f of fs.readdirSync(path.join(root, dir))) {
                if (f.endsWith('.js') && f !== 'webhooks.js') dateien.push(fs.readFileSync(path.join(root, dir, f), 'utf8'));
            }
        }
        const alle = dateien.join('\n');
        for (const ev of Object.keys(W.EVENTS)) {
            check('D1 Event "' + ev + '" wird irgendwo gefeuert',
                new RegExp("Webhooks\\.fire\\(\\s*'" + ev + "'").test(alle));
        }
        check('D2 Einstellungen warnen bei nicht erlaubter URL', /Webhooks\.erlaubt\(/.test(fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8')));
        const csp = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
        check('D3 CSP erlaubt https://*.make.com weiterhin (sonst blockt der Browser jeden Webhook)',
            /connect-src[^;"]*https:\/\/\*\.make\.com/.test(csp));
    }

    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    if (pass !== total) process.exit(1);
})();
