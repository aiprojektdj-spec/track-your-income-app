# Prompt für neue Session (copy-paste) — Kassenbuch in Finanzen-Tab integrieren + Audit-Restpunkte

---

Kontext: Steuer-Audit vom 2026-07-23 (s. `plan/session-prompt-steuer-audit-fixes-2026-07-23.md`,
Fund 1-4 bereits gefixt+committet). Dabei aufgefallen: **Kassenbuch hat keinen Menüpunkt in der
Haupt-App.** Die Seite existiert und funktioniert voll (`js/kassenbuch.js`, in `App.pages`
registriert), ist aber nur erreichbar über die direkte URL `app.html?page=kassenbuch` oder den
Sidebar-Link im Lager-Modul (`lager/index.html:124`). Aus `app.html` selbst gibt es keinen
klickbaren Weg dahin.

Vor dem Start immer `git status --short` + `git log --oneline -10` frisch prüfen — Repo hatte in
der Vergangenheit mehrere parallele Sessions im selben Ordner.

## 🎯 Hauptaufgabe — Kassenbuch ins Finanzen-Sub-Nav aufnehmen

**1. `js/app.js:10` — `FINANZ_PAGES`-Array erweitern**

```js
FINANZ_PAGES: ['rechnungen', 'eigenbelege', 'buchungen', 'ausgaben', 'bankimport', 'fahrtenbuch', 'afa'],
```

`'kassenbuch'` fehlt hier — ohne Eintrag rendert `_renderModuleSubnav()` (app.js:644) die Sub-Nav
gar nicht erst, wenn man auf der Kassenbuch-Seite ist (Zeile 663: `if (!App.FINANZ_PAGES.includes(page))
{ el.innerHTML = ''; return; }`).

**2. `js/app.js` `_renderModuleSubnav()` Z. 653-661 — `SUBTABS`-Array erweitern**

```js
const SUBTABS = [
    { page: 'rechnungen',  icon: 'ti-file-invoice',    label: 'Rechnungen'   },
    { page: 'eigenbelege', icon: 'ti-receipt',         label: 'Eigenbelege'  },
    { page: 'buchungen',   icon: 'ti-arrows-exchange', label: 'Buchungen'    },
    { page: 'ausgaben',    icon: 'ti-cash',            label: 'Ausgaben'     },
    { page: 'bankimport',  icon: 'ti-building-bank',   label: 'Bank-Import'  },
    { page: 'fahrtenbuch', icon: 'ti-car',             label: 'Fahrtenbuch'  },
    { page: 'afa',         icon: 'ti-trending-down',   label: 'AfA'          },
];
```

Neuen Eintrag `{ page: 'kassenbuch', icon: '...', label: 'Kassenbuch' }` ergänzen. Icon
`ti-cash` ist an Ausgaben vergeben — Tabler-Icons-Set nach passendem Alternativ-Icon durchsuchen
(Kandidaten: `ti-cash-banknote`, `ti-briefcase`, `ti-notebook` — `ti-notebook` ist an GoBD-Protokoll
vergeben, also eher vermeiden). Reihenfolge im Array = Reihenfolge der Tabs (Kommentar Z. 9) —
sinnvoll direkt hinter `fahrtenbuch` oder `ausgaben` einsortieren, da inhaltlich verwandt.

**3. Sub-Nav-Breite/Overflow prüfen**

Aktuell 7 Tabs, danach 8. Im Browser (Desktop + Mobile-Breite via `resize_window`) checken, ob
`.msub-tab`-Leiste umbricht/scrollt oder Tabs abschneidet. CSS-Klasse `moduleSubnav` in `css/`
suchen falls Nachbesserung nötig (z.B. horizontales Scrollen statt Umbruch).

**4. Bestehenden Lager-Link nicht kaputt machen**

`lager/index.html:124` verlinkt weiterhin `../app.html?page=kassenbuch` — nach der Nav-Integration
sollte das identisch weiterfunktionieren (Page-Routing ändert sich nicht, nur die Sub-Nav-Anzeige
kommt jetzt zusätzlich). Kurz gegenprüfen, nicht doppelt verlinken/verwirren.

**5. i18n-Lücke (nicht blockierend, nur Hinweis)**

`js/i18n.js` hat bereits `'sidebar.cashbook'` (DE: "Kassenbuch", EN: "Cash Book") und `'cash.title'`
— beide Keys werden aktuell **nirgendwo referenziert** (toter Code oder für später vorbereitet).
Die bestehenden `SUBTABS`-Labels sind alle hartkodiertes Deutsch, nicht i18n-gebunden — für
Konsistenz reicht ein hartkodiertes `'Kassenbuch'`, kein eigener i18n-Umbau nötig (wäre Scope-Creep
über die anderen SUBTABS hinaus).

**6. Browser-Verifikation**

Whop-Gate blockt echten Login in Dev-Sessions (bekannte Einschränkung, s. andere Session-Prompts).
Falls trotzdem ein Preview aufgeht: Sub-Nav-Klick auf "Kassenbuch" testen, aktiver Tab-Zustand
(`.msub-tab.active`) prüfen, sowie dass Navigation von/zu anderen Finanzen-Unterseiten (Ausgaben,
Fahrtenbuch) weiterhin korrekt den aktiven Tab markiert.

## 🟡 Ebenfalls offen aus dem Steuer-Audit (opportunistisch, kein Zeitdruck)

**Fund 5 — EÜR Z64-Sammelposten** (`js/euer.js`)

Anlage EÜR hat mehr amtliche Zeilen (Personal, Raumkosten, Kfz-Kosten etc.) als abgebildet; alles
außer Wareneinkauf/AfA/Fahrt landet pauschal in Z64 "Sonstige Betriebsausgaben". Für reine
Reseller/Freelancer ausreichend, bei Mitarbeitern/Büromiete Steuerberater-Rücksprache nötig. Kein
akuter Fix-Zwang, ggf. bei Zielgruppen-Erweiterung (Mitarbeiter) aufgreifen.

**Niedrig — GWG-800€-Grenze** (`js/afa.js:202`)

Nur Hinweistext, keine automatische Sofortabschreibungs-Logik/Checkbox bei AK≤800€ netto.

**Niedrig — `canEdit()`/`canDelete()`-Konsistenz**

High-Level-API nur in `lager.js` genutzt, andere Module rufen `Store.isLocked()`/`isPeriodLocked()`
direkt — funktional identisch, nur Wartbarkeit/Konsistenz. Reiner Refactor, kein Bugfix.

**Niedrig — Kassenbuch ohne Tages-Gruppierung/-Summe**

Nur fortlaufende Liste + Jahresfilter, keine Tagesgruppen mit Tagessumme. Da diese Session ohnehin
in `js/kassenbuch.js` unterwegs ist (Nav-Integration), bietet sich das als kleines Zusatz-Item an,
falls Zeit bleibt — separat von der Hauptaufgabe zu sehen, kein Abhängigkeits-Zwang.

## Reihenfolge-Empfehlung

1. Kassenbuch-Nav-Integration (Hauptaufgabe, klar umrissen, kleiner Diff)
2. Browser/Resize-Check der Sub-Nav mit 8 statt 7 Tabs
3. Kassenbuch-Tagesgruppierung, falls Zeit (gleiche Datei, geringer Zusatzaufwand)
4. Fund 5 + restliche Niedrig-Punkte nur falls explizit gewünscht — kein eigenständiger
   Rechts-/Bußgeldrisiko-Treiber, rein opportunistisch
