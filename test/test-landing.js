// Landing-Regressionsschutz: node test/test-landing.js
// Führt das echte Skript gegen eine kleine, aus index.html gelesene DOM-Fixture aus.
// Kein Login-Bypass, kein Netzwerk und keine App-Daten; Browserlayout wird separat geprüft.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const source = read('js/landing.js');
const MONTH = 'https://whop.com/checkout/plan_iR6YIKLcychSZ';
const YEAR = 'https://whop.com/checkout/plan_b5IBQ1lecggOT';

function eventTarget(target = {}) {
    const listeners = new Map();
    target.addEventListener = (type, listener) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
    };
    target.dispatch = (type, values = {}) => {
        const event = Object.assign({ target, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; } }, values);
        (listeners.get(type) || []).forEach(listener => listener(event));
        return event;
    };
    return target;
}

function createDocument() {
    const document = eventTarget({ activeElement: null });
    function element(tag, attributes = {}) {
        const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
        const node = eventTarget({ tag, attributes, dataset: {}, children: [], parent: null, _text: '' });
        Object.keys(attributes).filter(name => name.startsWith('data-')).forEach(name => {
            node.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attributes[name];
        });
        node.getAttribute = name => Object.hasOwn(attributes, name) ? attributes[name] : null;
        node.setAttribute = (name, value) => { attributes[name] = String(value); };
        node.hasAttribute = name => Object.hasOwn(attributes, name);
        node.classList = {
            add: name => classes.add(name),
            contains: name => classes.has(name),
            toggle(name, force) {
                const on = force === undefined ? !classes.has(name) : Boolean(force);
                if (on) classes.add(name); else classes.delete(name);
                return on;
            }
        };
        Object.defineProperties(node, {
            href: { get: () => attributes.href || '', set: value => { attributes.href = value; } },
            hidden: { get: () => Object.hasOwn(attributes, 'hidden'), set: value => {
                if (value) attributes.hidden = ''; else delete attributes.hidden;
            } },
            textContent: { get: () => node._text + node.children.map(child => child.textContent).join(''),
                set: value => { node._text = String(value); node.children = []; } }
        });
        node.matches = selector => {
            if (selector.startsWith('#')) return attributes.id === selector.slice(1);
            if (selector.startsWith('[')) return node.hasAttribute(selector.slice(1, -1));
            const [name, className] = selector.split('.');
            return (!name || tag === name) && (!className || classes.has(className));
        };
        node.querySelectorAll = selector => node.children.flatMap(child =>
            (child.matches(selector) ? [child] : []).concat(child.querySelectorAll(selector)));
        node.querySelector = selector => node.querySelectorAll(selector)[0] || null;
        node.closest = selector => node.matches(selector) ? node : node.parent && node.parent.closest(selector);
        node.contains = child => child === node || node.children.some(item => item.contains(child));
        node.focus = options => { document.activeElement = node; node.focusOptions = options; };
        return node;
    }
    // Nur die im Dokument verwendeten einfachen Tags/Attribute sind nötig. Skriptinhalt ist
    // kein DOM-Text für diese Tests; das Verhalten stammt unverändert aus js/landing.js.
    const container = element('document');
    const stack = [container];
    const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/g, '$1$2');
    const voidTags = new Set(['meta', 'link', 'br', 'img', 'input', 'hr', 'source']);
    for (const token of markup.match(/<[^>]+>|[^<]+/g)) {
        if (/^<!/.test(token)) continue;
        if (/^<\//.test(token)) { stack.pop(); continue; }
        if (token.startsWith('<')) {
            const tag = token.match(/^<([\w-]+)/)[1];
            const attributes = {};
            const attrs = token.slice(tag.length + 1).replace(/\/?\s*>$/, '');
            for (const match of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
                attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
            }
            const node = element(tag, attributes);
            node.parent = stack[stack.length - 1];
            node.parent.children.push(node);
            if (!voidTags.has(tag) && !token.endsWith('/>')) stack.push(node);
        } else {
            stack[stack.length - 1]._text += token;
        }
    }
    document.querySelector = selector => container.querySelector(selector);
    document.querySelectorAll = selector => container.querySelectorAll(selector);
    return document;
}

function load(options = {}) {
    const document = createDocument();
    const storage = new Map(options.token ? [['whop_access_token', options.token]] : []);
    let blocked = Boolean(options.blocked), resets = 0, reads = 0, writes = 0;
    const localStorage = {
        getItem(key) { reads++; if (blocked) throw new Error('Speicher gesperrt'); return storage.get(key) || null; },
        setItem() { writes++; throw new Error('Die Landing darf keine App-Daten schreiben'); },
        removeItem() { writes++; throw new Error('Die Landing darf keine App-Daten löschen'); }
    };
    const media = eventTarget({ matches: true });
    const window = eventTarget({ matchMedia: () => media });
    if (options.cookieApi !== false) window.CookieBanner = { reset: () => { resets++; } };
    const context = { document, window, localStorage };
    if (options.otherPage) document.querySelector = () => null;
    vm.runInNewContext(source, context, { filename: 'js/landing.js' });
    const get = selector => document.querySelector(selector);
    return { document, window, storage, media, get,
        month: () => get('.billing-toggle').children.find(node => node.dataset.period === 'month'),
        year: () => get('.billing-toggle').children.find(node => node.dataset.period === 'year'),
        setBlocked(value) { blocked = value; },
        stats: () => ({ resets, reads, writes }) };
}

let passed = 0;
function test(name, run) {
    run();
    passed++;
    console.log('✓ ' + name);
}
function assertCheckout(page, url, label = '7 Tage kostenlos testen') {
    assert.strictEqual(page.get('[data-checkout]').href, url);
    assert.strictEqual(page.get('[data-checkout]').textContent, label);
}
function assertMenu(page, open) {
    assert.strictEqual(page.get('.menu-toggle').getAttribute('aria-expanded'), String(open));
    assert.strictEqual(page.get('.menu-toggle').getAttribute('aria-label'), open ? 'Navigation schließen' : 'Navigation öffnen');
    assert.strictEqual(page.get('#navigation').classList.contains('is-open'), open);
}

test('Ohne JavaScript bleiben Inhalt, Anmeldung und korrekt beschrifteter Monatscheckout erreichbar', () => {
    const document = createDocument();
    const get = selector => document.querySelector(selector);
    assert.match(get('h1').textContent, /Deine Buchhaltung\.[\s\S]*Ein klarer Überblick\./);
    assert.strictEqual(get('[data-checkout]').href, MONTH);
    assert.strictEqual(get('[data-price]').textContent, '15');
    assert.strictEqual(get('[data-billing-note]').textContent, '15 € monatlich abgerechnet');
    assert.match(get('[data-renewal]').textContent, /15 € monatlich/);
    assert.match(get('[data-renewal]').textContent, /automatisch/);
    assert.match(get('.trial-note').textContent, /7 Tage[\s\S]*Zahlungsmittel/);
    assert.match(get('.tax-note').textContent, /Steuern/);
    assert.strictEqual(get('[data-login]').href, 'app.html');
    assert.strictEqual(get('[data-session-link]').href, '#preise');
    assert.strictEqual(get('[data-consent-settings]').href, 'cookies.html');
    assert.strictEqual(get('.menu-toggle').hidden, true);
    assert.strictEqual(get('.billing-toggle').hidden, true);
    assert.strictEqual(get('.faq-list').querySelectorAll('details').length, 5);
    assert.strictEqual(get('.skip-link').href, '#inhalt');
    assert.strictEqual(get('#inhalt').getAttribute('tabindex'), '-1');
});

test('Startzustand ist monatlich; Rechnung, Bedingungen und Checkout passen zusammen', () => {
    const page = load();
    assertCheckout(page, MONTH);
    assert.strictEqual(page.get('.billing-toggle').hidden, false);
    assert.strictEqual(page.get('[data-price]').textContent, '15');
    assert.strictEqual(page.month().getAttribute('aria-pressed'), 'true');
    assert.strictEqual(page.year().getAttribute('aria-pressed'), 'false');
    assert.strictEqual(page.get('[data-login]').textContent, 'Anmelden');
    assert.strictEqual(page.stats().writes, 0);
});

test('Jahr und zurück auf Monat ändern Betrag, Abrechnung, Verlängerung und Checkout gemeinsam', () => {
    const page = load();
    page.year().dispatch('click');
    assertCheckout(page, YEAR);
    assert.strictEqual(page.get('[data-price]').textContent, '11,25');
    assert.strictEqual(page.get('[data-billing-note]').textContent, '135 € jährlich abgerechnet');
    assert.match(page.get('[data-renewal]').textContent, /135 € jährlich[\s\S]*ein Jahr/);
    assert.strictEqual(page.month().getAttribute('aria-pressed'), 'false');
    assert.strictEqual(page.year().getAttribute('aria-pressed'), 'true');
    page.month().dispatch('click');
    assertCheckout(page, MONTH);
    assert.strictEqual(page.get('[data-price]').textContent, '15');
    assert.strictEqual(page.get('[data-billing-note]').textContent, '15 € monatlich abgerechnet');
    assert.match(page.get('[data-renewal]').textContent, /15 € monatlich[\s\S]*einen Monat/);
});

test('Vorhandene Session bleibt nach beiden Abrechnungswechseln beim App-Einstieg', () => {
    const page = load({ token: 'nur-ein-testmarker' });
    for (const change of [() => {}, page.year, page.month]) {
        const button = change();
        if (button) button.dispatch('click');
        assertCheckout(page, 'app.html', 'Zur App');
        page.document.querySelectorAll('[data-session-link]').forEach(link => {
            assert.strictEqual(link.href, 'app.html');
            assert.strictEqual(link.dataset.session, '1');
        });
        assert.strictEqual(page.get('[data-login]').textContent, 'Zur App');
    }
});

test('Anmeldung/Abmeldung in anderem Tab aktualisiert App-Link und erhält Jahresauswahl', () => {
    const page = load();
    page.year().dispatch('click');
    page.storage.set('whop_access_token', 'nur-ein-testmarker');
    page.window.dispatch('storage', { key: 'whop_access_token' });
    assertCheckout(page, 'app.html', 'Zur App');
    page.storage.delete('whop_access_token');
    page.window.dispatch('storage', { key: 'whop_access_token' });
    assertCheckout(page, YEAR);
    assert.strictEqual(page.get('[data-session-link]').href, '#preise');
    assert.strictEqual(page.get('[data-login]').textContent, 'Anmelden');
    page.document.querySelectorAll('[data-session-link]').forEach(link => assert.strictEqual(link.dataset.session, undefined));
});

test('Leeren des Speichers aktualisiert Session; fremde Storage-Änderungen lesen keinen Token', () => {
    const page = load({ token: 'nur-ein-testmarker' });
    const reads = page.stats().reads;
    page.window.dispatch('storage', { key: 'oyi_cookie_consent_v2' });
    assert.strictEqual(page.stats().reads, reads);
    page.storage.clear();
    page.window.dispatch('storage', { key: null });
    assertCheckout(page, MONTH);
});

test('pageshow stellt nach Rückkehr aktuelle Session und gewählten Checkout wieder her', () => {
    const page = load();
    page.year().dispatch('click');
    page.storage.set('whop_access_token', 'nur-ein-testmarker');
    page.window.dispatch('pageshow', { persisted: true });
    assertCheckout(page, 'app.html', 'Zur App');
    page.storage.clear();
    page.window.dispatch('pageshow', { persisted: true });
    assertCheckout(page, YEAR);
});

test('Gesperrter localStorage lässt Preiswahl und Navigation funktionieren', () => {
    const page = load({ blocked: true });
    assertCheckout(page, MONTH);
    page.year().dispatch('click');
    assertCheckout(page, YEAR);
    page.get('.menu-toggle').dispatch('click');
    assertMenu(page, true);
    const previousSession = load({ token: 'nur-ein-testmarker' });
    previousSession.setBlocked(true);
    previousSession.window.dispatch('pageshow');
    assertCheckout(previousSession, MONTH);
});

test('Mobiles Menü schaltet ARIA-Zustand; Escape schließt und gibt Fokus zurück', () => {
    const page = load();
    const menu = page.get('.menu-toggle');
    assert.strictEqual(menu.hidden, false);
    assert.strictEqual(menu.getAttribute('aria-controls'), page.get('#navigation').getAttribute('id'));
    assertMenu(page, false);
    menu.dispatch('click');
    assertMenu(page, true);
    page.document.dispatch('keydown', { key: 'Escape' });
    assertMenu(page, false);
    assert.strictEqual(page.document.activeElement, menu);
    menu.dispatch('click');
    menu.dispatch('click');
    assertMenu(page, false);
});

test('Navigationsanker schließt Menü und fokussiert sein erreichbares Abschnittsziel', () => {
    const page = load();
    page.get('.menu-toggle').dispatch('click');
    const link = page.get('#navigation').querySelectorAll('a').find(node => node.href === '#preise');
    page.get('#navigation').dispatch('click', { target: link });
    assertMenu(page, false);
    assert.strictEqual(page.document.activeElement, page.get('#preise'));
    assert.strictEqual(page.get('#preise').getAttribute('tabindex'), '-1');
    assert.strictEqual(page.get('#preise').focusOptions.preventScroll, true);
});

test('Menü schließt beim Verlassen, Außenklick und Wechsel der Bildschirmbreite', () => {
    const page = load();
    const menu = page.get('.menu-toggle');
    menu.dispatch('click');
    page.get('.header').dispatch('focusout', { relatedTarget: page.get('[data-login]') });
    assertMenu(page, true);
    page.get('.header').dispatch('focusout', { relatedTarget: page.get('[data-checkout]') });
    assertMenu(page, false);
    menu.dispatch('click');
    page.document.dispatch('click', { target: menu });
    assertMenu(page, true);
    page.document.dispatch('click', { target: page.get('#inhalt') });
    assertMenu(page, false);
    menu.dispatch('click');
    page.media.dispatch('change', { matches: false });
    assertMenu(page, false);
});

test('Cookie-Einstellungen rufen bestehende Reset-API genau einmal auf', () => {
    const page = load();
    const event = page.get('[data-consent-settings]').dispatch('click');
    assert.strictEqual(event.defaultPrevented, true);
    assert.strictEqual(page.stats().resets, 1);
});

test('Ohne Cookie-API bleibt Cookie-Rechtslink als Fallback navigierbar', () => {
    const page = load({ cookieApi: false });
    const event = page.get('[data-consent-settings]').dispatch('click');
    assert.strictEqual(event.defaultPrevented, false);
    assert.strictEqual(page.stats().resets, 0);
    const destination = page.get('[data-consent-settings]').href;
    assert.strictEqual(destination, 'cookies.html');
    assert.ok(fs.statSync(path.join(__dirname, '..', destination)).isFile(), 'Cookie-Fallback zeigt auf eine vorhandene Seite');
});

test('Skript bleibt auf anderen Seiten inaktiv und liest keinen App-Speicher', () => {
    const page = load({ otherPage: true });
    assert.strictEqual(page.stats().reads, 0);
    assert.strictEqual(page.stats().writes, 0);
});

console.log('\n' + passed + '/' + passed + ' Landing-Regressionsfälle bestanden');
