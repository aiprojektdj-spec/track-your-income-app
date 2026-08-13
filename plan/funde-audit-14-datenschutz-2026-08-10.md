# Audit 14 — Datenschutz (DSGVO-Code-Scan)

**Gelaufen:** 2026-08-12 · **Skill:** `/datenschutz` · **Masterplan-Prio:** Niedrig
**Fund-Präfix:** `D` — `R`/`T`/`P`/`M`/`L`/`F`/`A`/`Z` sind belegt.

Kennzeichnung: **[geprüft]** = an Code verifiziert · **[Dritte]** = wartet auf externe Partei.

> **Masterplan und `funde-gesamt-2026-08-10.md` nicht angefasst** — beide hält die laufende Session
> „Audit 2026-08-10 Masterplan". Status-Zeile bitte dort nachtragen:
> `| 14 | Datenschutz | /datenschutz | ✅ 2026-08-12 | 10 Funde (3 🟠, 1 🟡, 6 ✅) |`

---

## Abgrenzung zu Audit 11

Audit 11 (Compliance) hat heute die **Texte** geprüft und für gut befunden: Vollständigkeit der
Datenschutzerklärung (alle vier Auftragsverarbeiter namentlich, Art. 4/6/13/15–21/28/46),
Impressum nach §5 DDG, und die §25-TDDDG-Lage des Consent-Banners (nur „Verstanden" ist hier
**richtig**, weil ausschließlich technisch notwendige Speicherung stattfindet).

Audit 14 prüft deshalb bewusst **nicht die Texte, sondern das Verhalten des Codes** — und findet
dort drei Abweichungen zwischen dem, was die Erklärung zusagt, und dem, was die App tut.
Whop-DPA (L5) wird nicht doppelt gezählt.

---

## 🟠 D1 — Ein Webfont und vier Bibliotheken laden bei jedem App-Start von einem Dritten [geprüft]

Vier **App-Seiten** (nicht nur die Landing) laden zur Laufzeit von `cdn.jsdelivr.net`:

| Datei | Was |
|---|---|
| [app.html:36-38](../app.html), [:250-253](../app.html) | `@tabler/icons-webfont` **(Schriftart)**, `notyf`, `flatpickr`-Theme + `gsap`, `notyf`, `flatpickr`, `flatpickr/l10n/de` |
| [eigenbelege/index.html:17](../eigenbelege/index.html) | dieselbe Icon-Schriftart |
| [lager/index.html](../lager/index.html), [rechnungen/index.html](../rechnungen/index.html) | dito, je 8 Referenzen |

Dazu `preconnect` und `dns-prefetch` auf denselben Host (`app.html:11`, `:13`) — die verbinden
**vor** jeder Nutzerinteraktion.

**Offengelegt ist das korrekt.** `datenschutz.html:60-63` nennt jsDelivr, den Betreiber
(ProspectOne Sp. z o.o., Kraków, Polen), den Weg über Cloudflare, die IP-Übertragung und als
Rechtsgrundlage Art. 6 Abs. 1 lit. f. Kein Verstoß gegen Art. 13.

**Der wunde Punkt ist die Abwägung, nicht die Transparenz.** Ein berechtigtes Interesse setzt
voraus, dass die Übermittlung erforderlich ist. Genau das ist hier schwer zu halten:

- Das Projekt **hostet Schriften bereits selbst** — `fonts/inter-var-latin.woff2`,
  `fonts/fraunces-var-latin.woff2`, `@font-face` in `css/legal.css:2-3`. Google Fonts kommt
  nirgends vor.
- Es **vendort Bibliotheken bereits lokal** — `js/vendor/chart.min.js`, `js/vendor/xlsx.full.min.js`.

Die Fähigkeit ist also vorhanden und wird für andere Abhängigkeiten genutzt. Damit greift die
Argumentation aus **LG München I, 3 O 17493/20** (Google Fonts): wenn dieselbe Ressource
selbst ausgeliefert werden kann, ist die IP-Übermittlung an einen Dritten nicht erforderlich —
und ohne Einwilligung angreifbar. Dass jsDelivr in der EU sitzt, entschärft das Drittland-Thema,
aber nicht die Erforderlichkeitsfrage; „über Cloudflare CDN" heißt zudem, dass der ausliefernde
Edge-Server nicht zwingend in der EU steht.

Verschärfend: **die betroffene Ressource ist eine Schriftart** — dieselbe Konstellation wie im
Münchner Fall, nicht bloß ein Skript.

**Nebenbefund:** In Local 1.7 war genau diese Icon-Schrift schon auf self-hosted umgestellt
(Memory `icon-onboarding-silent-fail-fix`, dort war der CDN-Font sogar unsichtbar). Web hat den
Schritt nie mitgemacht, und mit der Einstellung von Local existiert der Fix jetzt **nirgends mehr
in einer gepflegten Fassung**.

**Maßnahme:** vier Dateien plus eine Locale nach `js/vendor/` bzw. `fonts/` holen, `preconnect`/
`dns-prefetch` entfernen, `cdn.jsdelivr.net` aus den CSP-Direktiven der vier Seiten und aus
`vercel.json` streichen. SRI-Hashes entfallen dabei ersatzlos (lokale Dateien brauchen keine, s.
Memory `security-audit-fixes-2026-08-10`). Aufwand ~2 h. Danach ist der Abschnitt in
`datenschutz.html:60-63` zu entfernen — nicht vorher.

## 🟠 D2 — Die Erklärung verspricht „alle Daten", der Server behält bewusst einen Rest [geprüft]

`datenschutz.html:250` sagt zu: **„Löschung deines Kontos und aller Daten"**.

Der Server tut das nicht vollständig, und zwar mit Absicht. [api/sync.js:354-365](../api/sync.js):
`delete` entfernt den verschlüsselten Snapshot (`DEL key`) und gibt den Scope-Platz frei, **die
Anker-Liste bleibt liegen** — Hash, ID und Timestamp je Buchung. Die Begründung im Code ist
sachlich stark: würde sie mitgelöscht, könnte ein Nutzer, der Buchungen manipuliert hat, die
eigene GoBD-Tamper-Evidence-Kette gleich mit entfernen.

**Das Ergebnis ist richtig, die Begründung im Kommentar ist es nicht.** Dort steht, die Liste
„enthält keine personenbezogenen Klardaten, Art. 17 betrifft sie nicht direkt". Hash + ID +
Timestamp, geschlüsselt auf `userId` und Scope, sind **pseudonyme** Daten — und die sind nach
Art. 4 Nr. 1 i. V. m. Erwägungsgrund 26 personenbezogen. Art. 17 gilt also grundsätzlich; er wird
hier lediglich durch **Art. 17 Abs. 3 lit. b** verdrängt (Verarbeitung zur Erfüllung einer
rechtlichen Verpflichtung — §147 AO / GoBD).

Das ist kein akademischer Unterschied. Auf ein echtes Löschverlangen mit „das ist nicht
personenbezogen" zu antworten, ist gegenüber einer Aufsichtsbehörde eine Verliererposition; mit
„Art. 17 Abs. 3 lit. b i. V. m. §147 AO" ist es eine gewinnbare.

Es sind also **zwei Defekte in einem**, beide reine Textarbeit:

1. **Transparenzlücke (Art. 13/Art. 12):** dass nach der Löschung eine Anker-Liste mit Hashes und
   Zeitstempeln bestehen bleibt, steht nirgends — `datenschutz.html` enthält null Treffer für
   Anker, Hash oder Prüfsumme. Die Zusage „aller Daten" ist damit unrichtig.
2. **Falsche Begründung im Code-Kommentar** (`api/sync.js:355-357`), die bei der nächsten
   Rechtsauskunft übernommen würde.

## 🟠 D3 — Nach dem Logout bleibt eine personenbezogene Kennung auf dem Gerät [geprüft]

[js/whop-auth.js:532-538](../js/whop-auth.js) räumt beim Logout `whop_access_token`, `whop_user`
und das Grace-Token ab — **nicht** `oyi_device_owner_uid`. Dort steht die Whop-User-ID
(gesetzt in `:405`, gelesen in `:399`).

Wer sich abmeldet, hinterlässt also weiter eine eindeutige Kennung seines Kontos im Browser.
Für den Nutzer sieht „Abmelden" nach Trennung aus; technisch bleibt die Verknüpfung.
Art. 5 Abs. 1 lit. c (Datenminimierung), und im Kontext eines Löschverlangens auch Art. 17.

**Nicht blind wegräumen.** Die Kennung hat einen legitimen Zweck: sie erkennt, ob das Gerät einem
anderen Konto gehörte, und hängt am Geräte-Reset-Pfad (`_startDeviceReset`/`_confirmDeviceReset`).
Wird sie beim Logout gelöscht, greift dieser Schutz beim nächsten Login mit einem Fremdkonto
womöglich nicht mehr — dann liegen zwei Datensätze übereinander. Zwei sachgerechte Wege:

- **A** — beim Logout löschen und den Fremdkonto-Schutz stattdessen serverseitig aus
  `whop-access` ableiten. Sauberer, mehr Aufwand.
- **B** — behalten, aber in `datenschutz.html` benennen (Zweck, Speicherdauer, wie man sie über
  „Gerät zurücksetzen" entfernt). Billig und ehrlich.

Der Zweck ist bisher **nirgends dokumentiert** — das ist der eigentliche Mangel, unabhängig vom
gewählten Weg.

## 🟡 D4 — `whop_user` speichert die komplette Userinfo-Antwort ungefiltert [geprüft]

`js/whop-auth.js:336`: `localStorage.setItem(LS_USER, JSON.stringify(me))` — das ganze Objekt aus
`api.whop.com/oauth/userinfo`, nicht die benötigten Felder. Genutzt werden im Code
Benutzername und ID (Anzeige im Gate, StB-Freigabe-Code); alles darüber hinaus liegt ohne Zweck
im `localStorage` und ist bei einer XSS-Lücke mit ausleitbar.

Art. 5 Abs. 1 lit. c. **Maßnahme:** beim Speichern auf die tatsächlich verwendeten Felder
reduzieren (`{ id, username }`, E-Mail nur falls wirklich gebraucht). Aufwand ~30 min, kein
Verhaltensbruch.

## ✅ Was geprüft wurde und stimmt

- **D5 — PKCE korrekt kurzlebig.** `codeVerifier`, `state` und `nonce` liegen in
  `sessionStorage` und werden direkt nach dem Token-Tausch entfernt
  (`whop-auth.js:258` / `:280`) — kein Rückstand im `localStorage`.
- **D6 — Schriften vollständig self-hosted.** Kein Treffer für `fonts.googleapis` oder
  `fonts.gstatic` im gesamten Projekt; `@font-face` verweist auf lokale `woff2`-Dateien.
  *(Ausnahme ist die Icon-Schrift aus D1.)*
- **D7 — keine personenbezogenen Daten in URLs.** Kein `checkout[email]=`, kein `email=`-Parameter
  in `js/`. Die Whop-Links tragen nur die Plan-ID, der Referral-Link den Whop-Usernamen des
  Werbenden — nicht die Daten des Geworbenen. Damit kein Personenbezug in Server-Logs.
- **D8 — Art.-17-Cloud-Löschung ist bestätigt, nicht optimistisch.** `js/cloud-sync.js:1363`
  hält ausdrücklich fest, dass ein HTTP-Fehler beim Löschen **nie** als Erfolg gelten darf;
  `:1394-1403` erfasst auch ausgelagerte Anhänge (`BlobAttachments.purgeAll()`), und der Server
  gibt den Scope-Platz frei (`SREM`). Das ist mehr, als die meisten Implementierungen leisten.
- **D9 — Notausgang `reset_all` korrekt begründet.** `api/sync.js:368-377`: verwirft nur
  unlesbares Chiffrat für den Fall, dass kein Gerät den Schlüssel mehr hat; Klardaten liegen
  lokal. Kein Datenverlust im Rechtssinn, im Code dokumentiert.
- **Lokal-First-Prinzip nicht angetastet.** Keine der Maßnahmen oben verlagert Daten in die Cloud
  oder verlangt eine Server-Verarbeitung, die es heute nicht gibt.

## ⚠️ Offen, nicht durch Coden lösbar [Dritte]

- **Whop-DPA / AV-Vertrag nach Art. 28** — identisch mit **L5** aus Audit 11, hier nicht doppelt
  gezählt. Wartet auf Whop.
- **Upstash-DPA** — in Audit 11 ist Upstash als Auftragsverarbeiter *benannt* (Region fra1/EU),
  ein abgeschlossener AV-Vertrag ist im Repo aber nirgends belegt. Sollte zusammen mit dem
  Whop-DPA abgehakt werden, sonst bleibt Art. 28 für zwei von vier Verarbeitern ungedeckt.
- **Datenschutzbeauftragter:** nicht erforderlich. Die Schwelle des §38 Abs. 1 BDSG (20 Personen
  ständig mit automatisierter Verarbeitung befasst) ist bei einem Einzelunternehmen nicht erreicht.

## Priorisierung

```
🟠 VOR LAUNCH
   D1  jsDelivr self-hosten (~2 h)   — angreifbarste Position, betrifft jeden App-Start
   D2  Anker-Rest offenlegen + Begruendung auf Art. 17 Abs. 3 lit. b umstellen (~1 h, Text)
   D3  Zweck von oyi_device_owner_uid dokumentieren, Weg A oder B entscheiden

🟡 DANACH
   D4  whop_user auf { id, username } reduzieren (~30 min)
```

## Hinweis zur Skill-Definition

`~/.claude/skills/datenschutz/SKILL.md` nennt als Prüfbereich „Basis: Web 1.7 (Spiegel:
`Local 1.7`)". Local 1.7 ist seit 2026-08-11 eingestellt (Memory `local17-eingestellt-2026-08-11`)
— der Spiegel-Hinweis sollte raus, sonst prüft der nächste Lauf eine tote Fassung mit.
Ebenfalls veraltet: „Supabase und LemonSqueezy/Paddle existieren nicht mehr" stimmt für Web,
Paddle war bis `244520c` aber noch in Local — für künftige Läufe irrelevant, da Local entfällt.
