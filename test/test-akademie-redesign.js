// Regressionen fuer den Akademie-Lernstand: bestehende Daten erhalten,
// Lesebestaetigungen sicher speichern und Navigation mit der Modulreihenfolge verbinden.
// Geladen wird der vollstaendige Produktivcode; Store und Browser-Speicher sind Testgrenzen.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'akademie.js'), 'utf8');
const progressKey = 'akademie_progress';
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0;
let total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log('PASS ' + name);
    } catch (error) {
        process.exitCode = 1;
        console.error('FAIL ' + name + '\n  ' + error.stack);
    }
}

function load(options = {}) {
    const storage = new Map();
    if (Object.hasOwn(options, 'raw')) storage.set(progressKey, options.raw);
    else if (Object.hasOwn(options, 'progress')) storage.set(progressKey, JSON.stringify(options.progress));
    const calls = { writes: [], toasts: [] };
    const state = {
        purchases: [], sales: [], invoices: [], audit: [], branche: 'Reselling',
        readFailure: false, writeFailure: false, purchasesFailure: false, auditFailure: false,
        ...options.state
    };
    const localStorage = {
        getItem(key) {
            if (state.readFailure) throw new Error('Storage unavailable');
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            calls.writes.push({ key, value });
            if (state.writeFailure) throw new Error('Storage quota exceeded');
            storage.set(key, String(value));
        }
    };
    const Store = {
        getPurchases() {
            if (state.purchasesFailure) throw new Error('Purchases unavailable');
            return state.purchases;
        },
        getSales: () => state.sales,
        getRechInvoices: () => state.invoices,
        getAuditLog() {
            if (state.auditFailure) throw new Error('Audit unavailable');
            return state.audit;
        },
        getSettings: () => ({ branche: state.branche })
    };
    const context = vm.createContext({
        Store, localStorage,
        console: { warn() {}, error() {}, log() {} },
        Utils: {
            escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[char]),
            showToast: (...args) => calls.toasts.push(args)
        },
        document: { getElementById: () => null, querySelectorAll: () => [] },
        window: { scrollTo() {} },
        App: { navigate() {} }
    });
    const A = vm.runInContext(source + '\nAkademie;', context);
    return {
        A, calls, state, storage,
        saved: () => JSON.parse(storage.get(progressKey))
    };
}

function lessons(A) {
    return Array.from(A.MODULES, module => Array.from(module.lessons, lesson => lesson.id)).flat();
}

test('Ein fehlender Speicherstand ist ein verfuegbarer Einstieg ohne automatische Speicherung', () => {
    const { A, calls } = load();
    const progress = A._getProgress();
    assert.notEqual(progress.available, false);
    assert.deepEqual(plain(progress.completedLessons), []);
    assert.deepEqual(plain(progress.unlockedAchievements), []);
    assert.equal(calls.writes.length, 0);
    assert.equal(A._naechsteLektion(progress).lektion.id, A.MODULES[0].lessons[0].id);
});

test('Bestehende gueltige IDs werden dedupliziert; fremde IDs zaehlen nicht als Fortschritt', () => {
    const { A, calls } = load({ progress: {
        completedLessons: ['g1', 'g1', 'g2', 'unknown', null, 7],
        unlockedAchievements: ['first_sale', 'first_sale', 'unknown', null],
        lastOpenedLesson: 'g2'
    } });
    const progress = A._getProgress();
    assert.notEqual(progress.available, false);
    assert.deepEqual(plain(progress.completedLessons), ['g1', 'g2']);
    assert.deepEqual(plain(progress.unlockedAchievements), ['first_sale']);
    assert.equal(progress.lastOpenedLesson, 'g2');
    assert.equal(calls.writes.length, 0, 'Reines Lesen soll keine Datenmigration ausloesen');
});

const brokenValues = [
    '', '{broken', 'null', '[]', '"text"', '{}',
    '{"completedLessons":null,"unlockedAchievements":[]}',
    '{"completedLessons":[],"unlockedAchievements":{}}'
];
for (const raw of brokenValues) {
    test('Beschaedigter Lernstand wird nicht als null Fortschritt gespeichert: ' + JSON.stringify(raw), () => {
        const { A, calls, storage } = load({ raw });
        assert.equal(A._getProgress().available, false);
        assert.equal(A.markLessonComplete('g1'), false);
        assert.deepEqual(plain(A.checkNewAchievements()), []);
        assert.equal(calls.writes.length, 0);
        assert.equal(storage.get(progressKey), raw);
    });
}

test('Nicht lesbarer Storage wird als unbekannt gemeldet und niemals ueberschrieben', () => {
    const { A, calls } = load({ state: { readFailure: true } });
    const progress = A._getProgress();
    assert.equal(progress.available, false);
    assert.equal(A._naechsteLektion(progress), null);
    assert.equal(A.markLessonComplete('g1'), false);
    assert.deepEqual(plain(A.checkNewAchievements()), []);
    assert.equal(calls.writes.length, 0);
});

test('Explizit nicht verfuegbarer Lernstand kann nicht gespeichert werden', () => {
    const { A, calls } = load();
    assert.equal(A._saveProgress({ available: false, completedLessons: [], unlockedAchievements: [] }), false);
    assert.equal(calls.writes.length, 0);
});

test('Neue Lesebestaetigung erhaelt bestehende Lektionen, Meilensteine und Zusatzfelder', () => {
    const { A, saved, calls } = load({ progress: {
        completedLessons: ['g1'], unlockedAchievements: ['first_sale'],
        lastOpenedLesson: 'g2', existingMetadata: { version: 1 }
    } });
    assert.equal(A.markLessonComplete('g2'), true);
    const progress = saved();
    assert.deepEqual(progress.completedLessons, ['g1', 'g2']);
    assert.ok(progress.unlockedAchievements.includes('first_sale'));
    assert.ok(progress.unlockedAchievements.includes('lesson_first'));
    assert.equal(progress.lastOpenedLesson, 'g2');
    assert.deepEqual(progress.existingMetadata, { version: 1 });
    assert.equal(calls.toasts.length, 0, 'Meilensteine duerfen keine Pop-ups ausloesen');
});

test('Doppelte Lesebestaetigung ist idempotent und schreibt nicht erneut', () => {
    const { A, saved, calls } = load();
    assert.equal(A.markLessonComplete('g1'), true);
    const writeCount = calls.writes.length;
    assert.equal(A.markLessonComplete('g1'), true);
    assert.equal(calls.writes.length, writeCount);
    assert.deepEqual(saved().completedLessons, ['g1']);
});

test('Ungueltige Lektions-IDs erzeugen weder Fortschritt noch Schreiboperationen', () => {
    const { A, calls } = load();
    for (const id of ['unknown', null, undefined, '', 'first_sale']) {
        assert.equal(A.markLessonComplete(id), false);
    }
    assert.equal(calls.writes.length, 0);
});

test('Fehlgeschlagene Speicherung meldet keinen Erfolg und erhaelt den bisherigen Lernstand', () => {
    const { A, saved, calls } = load({
        progress: { completedLessons: ['g1'], unlockedAchievements: ['first_sale'] },
        state: { writeFailure: true }
    });
    assert.equal(A.markLessonComplete('g2'), false);
    assert.deepEqual(saved().completedLessons, ['g1']);
    assert.deepEqual(saved().unlockedAchievements, ['first_sale']);
    assert.equal(calls.toasts.length, 0);
});

test('Wiederaufnahme bevorzugt eine zuletzt geoeffnete ungelesene Lektion', () => {
    const { A } = load({ progress: {
        completedLessons: [], unlockedAchievements: [], lastOpenedLesson: 'e2'
    } });
    const next = A._naechsteLektion(A._getProgress());
    assert.equal(next.modul.id, 'einkauf');
    assert.equal(next.lektion.id, 'e2');
});

test('Gelesene oder ungueltige Wiederaufnahme faellt auf die erste offene Lektion zurueck', () => {
    for (const lastOpenedLesson of ['e2', 'unknown']) {
        const { A } = load({ progress: {
            completedLessons: ['e2'], unlockedAchievements: [], lastOpenedLesson
        } });
        assert.equal(A._naechsteLektion(A._getProgress()).lektion.id, 'g1');
    }
});

test('Branchenreihenfolge bleibt vollstaendig, stabil und veraendert die Quelldaten nicht', () => {
    const { A, state } = load();
    const original = Array.from(A.MODULES, module => module.id);
    for (const branche of ['', 'Reselling', 'E-Commerce']) {
        state.branche = branche;
        assert.deepEqual(Array.from(A._modulesInOrder(), module => module.id), original);
    }
    state.branche = 'Dienstleistung';
    const ordered = Array.from(A._modulesInOrder(), module => module.id);
    const trading = ['grundlagen', 'einkauf', 'listing', 'skalierung', 'kundenservice', 'social'];
    assert.deepEqual(ordered, original.filter(id => !trading.includes(id)).concat(original.filter(id => trading.includes(id))));
    assert.deepEqual(Array.from(A.MODULES, module => module.id), original);
    assert.equal(new Set(ordered).size, original.length);
    assert.equal(A._naechsteLektion(A._getProgress()).modul.id, ordered[0]);
});

test('Lektionsfolge ueber Modulgrenzen stimmt fuer Handels- und Dienstleistungsbranchen', () => {
    for (const branche of ['Reselling', 'Dienstleistung']) {
        const { A } = load({ state: { branche } });
        const ordered = Array.from(A._modulesInOrder());
        const firstModule = ordered[0];
        const first = A._followingLesson(firstModule.id, firstModule.lessons[0].id);
        assert.equal(first.modul.id, firstModule.id);
        assert.equal(first.lektion.id, firstModule.lessons[1].id);
        for (let i = 0; i < ordered.length - 1; i++) {
            const module = ordered[i];
            const next = A._followingLesson(module.id, module.lessons[module.lessons.length - 1].id);
            assert.equal(next.modul.id, ordered[i + 1].id);
            assert.equal(next.lektion.id, ordered[i + 1].lessons[0].id);
        }
        const lastModule = ordered[ordered.length - 1];
        assert.equal(A._followingLesson(lastModule.id, lastModule.lessons[lastModule.lessons.length - 1].id), null);
        assert.equal(A._followingLesson('unknown', 'g1'), null);
        assert.equal(A._followingLesson('grundlagen', 'unknown'), null);
    }
});

test('Am Ende des Lernpfads bleiben frueher ausgelassene Lektionen auffindbar', () => {
    const { A, storage } = load();
    const ids = lessons(A);
    storage.set(progressKey, JSON.stringify({
        completedLessons: ids.filter(id => id !== 'g2'), unlockedAchievements: [],
        lastOpenedLesson: ids[ids.length - 1]
    }));
    assert.equal(A._naechsteLektion(A._getProgress()).lektion.id, 'g2');
    assert.equal(A._analyzeData().modulesComplete, A.MODULES.length - 1);
});

test('Alle Lektionen schliessen die Akademie ab, auch wenn Geschaeftsmeilensteine offen bleiben', () => {
    const { A, storage, saved } = load();
    const ids = lessons(A);
    storage.set(progressKey, JSON.stringify({ completedLessons: ids, unlockedAchievements: [] }));
    assert.equal(A._naechsteLektion(A._getProgress()), null);
    assert.equal(A._analyzeData().lessonsRead, ids.length);
    assert.equal(A._analyzeData().modulesComplete, A.MODULES.length);
    const unlocked = Array.from(A.checkNewAchievements(), achievement => achievement.id);
    assert.ok(unlocked.includes('all_modules'));
    assert.ok(saved().unlockedAchievements.includes('all_modules'));
    assert.ok(!saved().unlockedAchievements.includes('first_sale'));
    assert.ok(saved().unlockedAchievements.length < A.ACHIEVEMENTS.length);
});

test('Geschaeftsmeilensteine koennen ohne gelesene Lektionen erreicht werden', () => {
    const { A, saved, calls } = load({ state: {
        sales: [{ id: 'sale-1', datum: '2026-01-03', verkaufspreis: 30 }]
    } });
    const unlocked = Array.from(A.checkNewAchievements(), achievement => achievement.id);
    assert.ok(unlocked.includes('first_sale'));
    assert.deepEqual(saved().completedLessons, []);
    assert.ok(!saved().unlockedAchievements.includes('lesson_first'));
    assert.equal(calls.toasts.length, 0);
});

test('Erreichte Geschaeftsmeilensteine bleiben ohne aktuelle Verkaufseintraege erhalten', () => {
    const { A, saved, calls } = load({ progress: {
        completedLessons: [], unlockedAchievements: ['first_sale']
    } });
    assert.deepEqual(plain(A.checkNewAchievements()), []);
    assert.deepEqual(saved().unlockedAchievements, ['first_sale']);
    assert.equal(calls.writes.length, 0);
});

test('Eine fehlgeschlagene Meilenstein-Speicherung meldet keine neue Freischaltung', () => {
    const { A, saved, calls } = load({
        progress: { completedLessons: [], unlockedAchievements: [] },
        state: { writeFailure: true, sales: [{ id: 'sale-1', verkaufspreis: 30 }] }
    });
    assert.deepEqual(plain(A.checkNewAchievements()), []);
    assert.deepEqual(saved().unlockedAchievements, []);
    assert.equal(calls.toasts.length, 0);
});

test('Fehlende Geschaeftsdaten sind unbekannt und erzeugen keine Meilensteine', () => {
    const { A, calls } = load({ state: { purchasesFailure: true } });
    assert.equal(A._analyzeData().available, false);
    assert.deepEqual(plain(A.checkNewAchievements()), []);
    assert.equal(calls.writes.length, 0);
});

test('Lesebestaetigung bleibt bei nicht verfuegbaren Geschaeftsdaten moeglich', () => {
    const { A, saved } = load({ state: { purchasesFailure: true } });
    assert.equal(A.markLessonComplete('g1'), true);
    assert.deepEqual(saved().completedLessons, ['g1']);
    assert.ok(!saved().unlockedAchievements.includes('first_sale'));
});

test('Ein fehlendes Audit-Protokoll darf nicht als null Eintraege ausgegeben werden', () => {
    const { A } = load({ state: { auditFailure: true } });
    assert.equal(A._analyzeData().available, false);
});

test('Beschaedigter Lernstand wird auch in der Datenanalyse nicht als ungelesen ausgegeben', () => {
    const { A } = load({ raw: '{broken' });
    assert.equal(A._analyzeData().available, false);
});

test('Ohne Geschaeftsdaten entsteht keine unbegruendete Leseempfehlung', () => {
    const { A } = load();
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()), null);
});

test('Verkaeufe empfehlen eine offene Steuerlektion; gelesene Lektionen werden uebersprungen', () => {
    const { A, storage } = load({ state: { sales: [{ id: 'sale-1', verkaufspreis: 30 }] } });
    const recommendation = A._getRecommendation(A._getProgress(), A._analyzeData());
    assert.equal(recommendation.modul.id, 'steuer');
    assert.equal(recommendation.lektion.id, 's2');
    assert.ok(recommendation.reason.length > 0);
    storage.set(progressKey, JSON.stringify({ completedLessons: ['s2'], unlockedAchievements: [] }));
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()), null);
});

test('Lagerempfehlung ergaenzt die Hauptaktion statt dieselbe Lektion erneut anzubieten', () => {
    const { A, storage } = load({ state: { purchases: [{ id: 'purchase-1', status: 'verfuegbar' }] } });
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()).lektion.id, 'e1');
    storage.set(progressKey, JSON.stringify({ completedLessons: [], unlockedAchievements: [], lastOpenedLesson: 'e1' }));
    const recommendation = A._getRecommendation(A._getProgress(), A._analyzeData());
    assert.equal(recommendation.lektion.id, 'l1');
    assert.notEqual(recommendation.lektion.id, A._naechsteLektion(A._getProgress()).lektion.id);
});

test('Verkaufs- und Lagerempfehlungen behalten ihre Prioritaet und zeigen keine gelesenen Ziele', () => {
    const { A, storage } = load({ state: {
        sales: [{ id: 'sale-1', verkaufspreis: 30 }],
        purchases: [{ id: 'purchase-1', status: 'verfuegbar' }]
    } });
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()).lektion.id, 's2');
    storage.set(progressKey, JSON.stringify({ completedLessons: ['s2', 'e1'], unlockedAchievements: [] }));
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()).lektion.id, 'l1');
    storage.set(progressKey, JSON.stringify({ completedLessons: lessons(A), unlockedAchievements: [] }));
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()), null);
});

test('Dienstleistungsbranchen erhalten keine Warenhandels-Empfehlung allein wegen Lagerbestand', () => {
    const { A } = load({ state: {
        branche: 'Dienstleistung', purchases: [{ id: 'purchase-1', status: 'verfuegbar' }]
    } });
    assert.equal(A._getRecommendation(A._getProgress(), A._analyzeData()), null);
});

test('Unbekannter Lernstand oder unbekannte Geschaeftsdaten unterdruecken Empfehlungen', () => {
    const first = load({ raw: '{broken', state: { sales: [{ id: 'sale-1', verkaufspreis: 30 }] } });
    assert.equal(first.A._getRecommendation(first.A._getProgress(), first.A._analyzeData()), null);
    const second = load({ state: { purchasesFailure: true } });
    assert.equal(second.A._getRecommendation(second.A._getProgress(), second.A._analyzeData()), null);
});

test('Jeder Screen hat in Einstieg, Teilfortschritt und Abschluss genau eine Hauptaktion', () => {
    for (const completed of ['none', 'some', 'all']) {
        const { A, storage } = load();
        storage.set(progressKey, JSON.stringify({
            completedLessons: completed === 'all' ? lessons(A) : completed === 'some' ? ['g1'] : [],
            unlockedAchievements: []
        }));
        A._activeModule = 'grundlagen';
        A._activeLesson = 'g1';
        const screens = {
            overview: A._renderOverview(),
            module: A._renderModuleDetail('grundlagen'),
            lesson: A._renderLesson()
        };
        for (const [screen, html] of Object.entries(screens)) {
            const actions = html.match(/class="[^"]*\bacademy-primary\b[^"]*"/g) || [];
            assert.equal(actions.length, 1, screen + ' / ' + completed);
        }
    }
});

test('Ein unbekannter Lernstand wird in keinem Screen als leer oder abgeschlossen dargestellt', () => {
    const { A, calls } = load({ raw: '{broken' });
    A._activeModule = 'grundlagen';
    A._activeLesson = 'g1';
    for (const html of [A._renderOverview(), A._renderModuleDetail('grundlagen'), A._renderLesson()]) {
        assert.ok(html.includes('Dein Lernstand ist gerade nicht verfügbar.'));
        assert.ok(!html.includes('Alles gelesen'));
        assert.ok(!html.includes('0 von 3 Lektionen gelesen'));
        assert.ok(!html.includes('0/43'));
    }
    assert.equal(calls.writes.length, 0);
});

test('Monochrome Beispiele erhalten ihre Aussage ohne Unterrichtsvorlagen zu veraendern', () => {
    const { A } = load();
    const original = A.MODULES.find(mod => mod.id === 'mindset').lessons.find(lesson => lesson.id === 'm2').content;
    A._activeModule = 'mindset';
    A._activeLesson = 'm2';
    const html = A._renderLesson();
    assert.equal((html.match(/>Geeignet: /g) || []).length, 3);
    assert.equal((html.match(/>Ungeeignet: /g) || []).length, 3);
    assert.equal(A.MODULES.find(mod => mod.id === 'mindset').lessons.find(lesson => lesson.id === 'm2').content, original);
    A._activeModule = 'listing';
    A._activeLesson = 'l2';
    assert.ok(!/Geeignet: Gut|Ungeeignet: Schlecht/.test(A._renderLesson()));
});

console.log('\n' + passed + '/' + total + ' Akademie-Regressionstests bestanden.');
