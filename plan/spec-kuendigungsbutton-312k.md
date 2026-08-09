# Spec: Kündigungsbutton (§ 312k BGB)

**Status:** nicht implementiert, nur Spezifikation. Code-Entwurf wurde probehalber gebaut und auf Nutzerwunsch wieder entfernt — diese Datei ist die Grundlage für die spätere Umsetzung.

## Ausgangslage

`agb.html` §4 verweist bisher nur pauschal auf „dein Whop-Konto" ohne konkreten Weg. Laut Sanierungs-Audit (`plan/sanierung-2026-08-09-abschlussbericht.md`, Phase 6) reicht das nicht als vollständige Erfüllung von §312k BGB (Kündigungsschaltfläche für Dauerschuldverhältnisse).

**Offene Rechtsfrage (Anwalt klären):** Der Abo-Vertrag läuft mit **Whop** als Merchant of Record, nicht mit TrackYourIncome — unklar, ob §312k überhaupt TrackYourIncome trifft oder nur Whop selbst. Trotzdem sinnvoll, weil Nutzer den Kündigungsweg typischerweise beim Anbieter erwarten, bei dem sie sich registriert haben.

## Verifizierter Ziel-Link

```
https://whop.com/@me/settings/orders/
```

Offiziell dokumentierter Whop-Self-Service-Weg für Kunden zum Verwalten/Kündigen der eigenen Mitgliedschaft (Quelle: [docs.whop.com — Cancel a subscription](https://docs.whop.com/memberships-and-access/cancellations-and-refunds/cancel-a-subscription), per WebFetch verifiziert, nicht geraten).

**Wichtig:** NICHT `https://whop.com/stackr-3244/` (Company-Hub) verlinken — siehe Kommentar in `js/whop-auth.js:19-23`, das hat schon mal einen echten Kunden verwirrt.

Ablauf für den Kunden auf der Zielseite: Mitgliedschaft „Stackr Pro" auswählen → „Cancel membership" klicken → Bestätigung per E-Mail von Whop.

## Geplante Umsetzung (2 Stellen)

### 1. In-App-Button — `js/whop-auth.js`

- Neue Konstante bei den anderen `WHOP_*_URL`-Konstanten (ca. Zeile 30):
  ```js
  var WHOP_MANAGE_URL = 'https://whop.com/@me/settings/orders/';
  ```
- Neuer Menüpunkt in `openUserMenu()` (Konto-Dropdown, vor „Abmelden"), gleiches Button-Markup wie die anderen Menü-Items dort:
  ```
  🧾 Abo verwalten / kündigen
  ```
- Neue Funktion **innerhalb der `AuthUI`-IIFE** (Falle: eine Konstante/Funktion außerhalb der IIFE zu referenzieren wirft `ReferenceError`, weil `Actions.register(...)` außerhalb des Closures steht):
  ```js
  function _openManageMembership() { window.open(WHOP_MANAGE_URL, '_blank', 'noopener'); }
  ```
  In den Return-Block aufnehmen: `return { ..., _openManageMembership };`
- Action-Registrierung (CSP-konform, kein Inline-Handler), analog zu `wa-logout`:
  ```js
  'wa-manage-membership': function () { AuthUI._openManageMembership(); },
  ```
- `data-action="wa-manage-membership"` am Button im Menü-HTML.

Erreichbar von jeder Seite der App aus (Konto-Menü ist global via `.topnav-controls` eingebunden) — erfüllt „leicht zugänglich, ständig verfügbar".

### 2. AGB-Text — `agb.html` §4 „Pro-Plan"

Aktueller Satz (unverändert, Stand nach Revert):
> „Die Kündigung ist jederzeit über dein Whop-Konto möglich und wirkt zum Ende der laufenden Abrechnungsperiode."

Ersetzen/ergänzen durch konkreten Weg + Verweis auf den In-App-Button:
```html
<p>
    <strong style="color:var(--text);">So kündigst du:</strong> Innerhalb der App über den
    Button „🧾 Abo verwalten / kündigen" im Konto-Menü, oder jederzeit direkt über
    <a href="https://whop.com/@me/settings/orders/" target="_blank" rel="noopener">whop.com/@me/settings/orders</a>
    — dort Mitgliedschaft „Stackr Pro" auswählen und „Cancel membership" klicken.
</p>
```

## Verifikation vor Merge

- `node --check js/whop-auth.js`
- Menü-Button manuell im Browser klicken (braucht echten Whop-Login — Claude loggt sich in diesem Projekt nie selbst ein, das macht der Nutzer im Browser-Pane, siehe Projektregel)
- Prüfen: öffnet neuer Tab wirklich `whop.com/@me/settings/orders/` und nicht versehentlich den Company-Hub

## Offene Punkte für Anwalt/Nutzer

1. Trifft §312k TrackYourIncome trotz Whop-als-Vertragspartner-Konstruktion, oder ist der In-App-Button nur freiwilliger Komfort?
2. Reicht ein Deep-Link zu Whops Kündigungsseite, oder braucht §312k eine eigene Bestätigungsseite mit Vertragsbezeichnung/Kündigungstermin, die nur Whop selbst liefern kann?
