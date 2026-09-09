# Was noch zu tun ist

**Stand: 2026-08-25**, jeder Punkt an diesem Tag gegen den Code verifiziert — nicht aus einer
Vorgängerliste übernommen.

Einstieg: [`00-STAND.md`](00-STAND.md) · Nicht-zu-Ändern: [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)
· Abgeschlossenes: [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md)

> **Diese Datei enthält nur noch Offenes.** Alles Erledigte ist am 2026-08-16 nach
> [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md) ausgelagert worden — mitsamt den Korrekturen, wo
> die Umsetzung von der ursprünglichen Aufgabenbeschreibung abwich. Wer wissen will, *wie* etwas
> gebaut wurde, schaut dort nach; wer etwas zu tun sucht, bleibt hier.
>
> Das ist bewusst **eine** Aufgabenliste geblieben, keine zweite daneben — die Doppelung
> `restliste-2026-08-14.md` ↔ dieser Datei hat am 2026-08-15 eine ganze Session gekostet, weil
> acht längst erledigte Funde weiter als offen geführt wurden. Siehe
> [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md), Abschnitt 2.

Getrennt nach **wer es machen kann**: Abschnitt 1 kann jede Session sofort greifen, Abschnitt 2
braucht dich, Abschnitt 3 wartet auf Dritte.

> ⚠️ **Vor dem Anfassen `git status` prüfen.** Mehrere der genannten Dateien werden regelmäßig
> von parallelen Sessions gehalten. Details in [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md).

> ⚠️ **Diese Liste veraltet binnen Stunden — dreimal belegt.** Am 2026-08-15 waren von sechs
> frisch eingetragenen „offenen" Punkten zwei Stunden später vier bereits gebaut. Am 2026-08-16
> wiederholte sich das: M1, M2, M4 und U7 standen hier als offen und waren binnen zwei Stunden
> von parallelen Sessions erledigt. **Immer erst gegen den Code prüfen, dann greifen** — auch bei
> einer Liste mit dem heutigen Datum, auch bei dieser hier.

---

## 1. Code — kann jede Session machen

**Dieser Abschnitt ist wieder leer** (Stand 2026-09-04). Alle drei Funde aus Live-Test 5 sind
gefixt und stehen unten als ✅ — jeweils mit dem, was sich beim Bauen gegenüber der
ursprünglichen Fundbeschreibung als falsch herausgestellt hat. Das ist bei zweien von dreien
passiert, also beim Lesen der Fundtexte einkalkulieren.

### 1.3 Doppelte Artikelnummer beim **Anlegen** · ✅ erledigt 2026-09-03 (`dddea9d`)

Von den vier Schreibwegen prüften zwei nicht:

| Weg | vorher | jetzt |
|---|---|---|
| Bearbeiten-Maske ([`js/lager.js:2681`](../js/lager.js)) | Toast + Abbruch — war schon richtig | unverändert |
| Neuer Artikel ([`lager/page.js`](../lager/page.js)) | **Dublette entstand** | Toast, Fokus zurück ins Feld, nichts geschrieben |
| Bulk-Einkauf ([`lager/page.js`](../lager/page.js)) | **Dublette entstand** | prüft gegen Bestand **und** die Zeilen gegeneinander |
| Excel-Import ([`lager/page.js`](../lager/page.js)) | Suffix `-2`/`-3` | unverändert — dort ist Umbenennen richtig |

`savePurchase` fängt Duplikate nur im Edit-Zweig ab; sein Neu-Zweig generiert eine Nummer **nur
bei leerem Feld** und ließ eine ausgefüllte, bereits vergebene durch. Die Prüfung sitzt jetzt in
der UI, vor dem Sperren des Speichern-Buttons — bei einem Treffer wird nichts geschrieben.

**Warum das nicht kosmetisch war:** der Verkäufe-Import ordnet über die Nummer zu und baut dafür
`artNrMap[nr] = p` — bei einer Dublette **gewinnt der zuletzt angelegte**. Der Verkauf hing dann
am falschen Einkaufspreis, was §25a-Marge und EÜR verfälscht.

Gegenprobe am 2026-09-03 auf Produktion, in der Firma „Test":

```
Duplikat SV-1042      -> 7 Artikel vorher, 7 nachher, Toast „bereits vergeben", Fokus im Feld
freie Nummer          -> 7 vorher, 8 nachher, Dialog schließt normal
```

`test/test-artikelnummer-eigene.js` von 23 auf 32 Checks erweitert (Abschnitt D), inklusive
Quelltext-Prüfung, damit ein späterer Umbau die Prüfstellen nicht still entfernt.

> **Korrektur an der ursprünglichen Fundmeldung vom 2026-09-01.** Dort stand,
> `isArtikelNrTaken()` werde „repo-weit an genau einer Stelle" aufgerufen und die
> Bearbeiten-Maske lehne **stumm** ab. Beides war falsch: die Suche hatte `js/lager.js` nicht
> erfasst. Der Bearbeiten-Dialog hat die Vorab-Prüfung mit Fehlermeldung seit je, und der
> Kommentar in [`js/store.js`](../js/store.js), der auf sie verweist, stimmt — er wurde
> **nicht** geändert. Der eigentliche Fund (die beiden Anlege-Wege) bestand unabhängig davon.

### 1.4 §25a: Retouren-Korrektur verpuffte in der Standardmethode · ✅ erledigt 2026-09-03 (`dddea9d`)

`margeEinzeldifferenz()` las nur `verkaufspreis`/`einkaufspreis`. Die `margeKorrektur`, die
[`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js) für Retoure und Gutschrift nach §17 UStG
erzeugt, trug damit `max(0, 0−0) = 0` bei und verschwand: nach einer vollen Retoure blieb die
ursprünglich versteuerte Marge in Kz. 81 stehen, obwohl der Kunde sein Geld zurück hatte —
**Übersteuerung**. Nur die Standardmethode war betroffen; die Gesamtdifferenz summiert flach und
rechnete richtig.

Die Korrektur wird jetzt über einen gemeinsamen Schlüssel — die verknüpften Lagerartikel — gegen
genau die Position verrechnet, zu der sie gehört, und zwar **vor** dem Floor. Der Floor bei 0
wirkt unverändert **pro Position**: eine überschießende Retoure drückt die Marge einer anderen
Position nicht, §25a Abs. 3 bleibt gewahrt.

Gegenprobe gegen die **ausgelieferte** Datei (`curl` auf Produktion, nicht der Working Tree):

```
nur Verkauf     : margeBrutto 50,00  ust 7,98
+ volle Retoure : margeBrutto  0,00  ust 0,00
+ halbe Retoure : margeBrutto 25,00  ust 3,99
```

**Zweiter Fehler in derselben Ecke, mitgefixt:** bei Gesamtdifferenz landete die Korrektur eines
Artikels über 750 € im Gesamttopf, in dem der Artikel selbst gar nicht steckt. Das senkte die
Gesamtdifferenz zu Unrecht **und** ließ den Artikel seine volle Marge behalten. Korrekturen
folgen jetzt ihrer Position in den richtigen Topf.

`test/test-25a-retoure-marge.js` ist neu (13 Checks) — es gab bis dahin keinen §25a-Harness.

> **Bleibende Grenze, kein Fehler:** findet eine Korrektur in der Periode keine passende Position
> (Verkauf in Q1, Retoure in Q2), läuft sie gegen 0 und bleibt wirkungslos. Die Einzeldifferenz
> kennt anders als die Gesamtdifferenz keinen Vortrag (§25a Abs. 4 UStG), in den ein
> Negativbetrag wandern könnte. Im Code kommentiert.

> **Zur Einordnung im Session-Prompt.** [`session-prompt-live-test-5-lager-2026-08-30.md`](session-prompt-live-test-5-lager-2026-08-30.md)
> führte den Punkt als „bekannte, bewusste Grenze — kein Fund" und verwies auf
> [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md). Der Verweis ging ins Leere: einen §25a-Eintrag
> gab es dort am 2026-09-01 nicht — der [heutige](02-ENTSCHEIDUNGEN.md) stammt aus einer anderen
> Session und behandelt den **Steuersatz**, nicht die Korrektur. Der Floor verbietet Verrechnung
> **zwischen** Positionen; hier wurde dieselbe Position nach §17 UStG zurückgenommen.

### 1.5 Abgebrochene Rechnung ließ Lagerartikel als „verkauft" zurück · ✅ erledigt 2026-09-04 (`69461b4`)

**Live gemessen am 2026-09-01** auf Produktion, Firma „Test", beim Durchklicken von Live-Test 5,
Punkt 2. Der eigentliche Prüfpunkt war dabei bestanden — der Fund lag daneben: verließ man die
Rechnung, **ohne** die Position zu entfernen und **ohne** zu speichern, blieb die Markierung
stehen. Der Artikel war aus Bestand und Lagerwert verschwunden, **ohne dass ihm ein Umsatz
gegenüberstand**.

> **Warum das kein Randfall war:** die §14-Sperre machte ihn wahrscheinlich. Ohne Steuernummer
> lässt sich die Rechnung gar nicht speichern — wer sie ausprobiert, bevor die Stammdaten stehen,
> lief zwangsläufig in genau diesen Pfad.

**Gebaut:** `RechApp` hat jetzt einen **Verlassen-Haken**. Die Rechnungsmaske hinterlegt in
`init()` ihr bereits vorhandenes `reconcileLagerOnCancel`; `navigate()` ruft es beim echten
Seitenwechsel — und zwar **nach** der Verwerfen-Rückfrage, damit nichts aufgeräumt wird, wenn der
Nutzer doch auf der Seite bleibt. `beforeunload` deckt Tab-schließen, Reload und den Sprung über
die Top-Nav ab, die ein echter Seitenwechsel ist und kein `navigate()`.

Abgemeldet wird der Haken an zwei Stellen: beim **Abbrechen** (dort lief `reconcile` schon von
Hand) und nach **erfolgreichem Speichern**, wo die Verknüpfungen zur Rechnung gehören. Beim
**gesperrten** Dokument bleibt er bewusst stehen — dort wurde nichts gespeichert, der Zustand
entspricht dem Abbrechen.

> **Verworfene Lösungsvariante.** Die ursprüngliche Fundnotiz schlug vor, beim Verknüpfen nur zu
> **reservieren** und erst beim Speichern festzuschreiben. Das hätte nichts gebracht: `reserviert`
> fällt an **allen** Zählstellen genauso aus dem Bestand wie `verkauft` — `js/lager.js` filtert
> durchgehend auf `status === 'verfuegbar'` (Kennzahlen, Lagerwert, Artikel-Picker), ebenso
> [`lager/page.js:97`](../lager/page.js). Der Artikel wäre weiterhin verschwunden, nur anders
> beschriftet. Wer den Status-Weg später doch will, muss zuerst diese Filter auf
> „alles außer verkauft" umstellen.

**Bleibender Rest:** ein harter Absturz (Prozess weg, kein `beforeunload`) kann die Markierung
weiterhin stehen lassen. Der Store schreibt synchron in Cache und localStorage-Spiegel, die
IndexedDB-Spiegelung kann dabei verloren gehen. Dagegen hülfe nur ein Reparaturlauf beim Laden
der Lager-Seite (verkauft ohne zugehörigen Verkauf und ohne Rechnungsposition) — bewusst nicht
gebaut, weil er eine ganze Klasse stiller Selbstheilung einführt.

`test/test-rechnung-lager-verlassen.js` ist neu, 14 Checks: Verdrahtung im Quelltext plus die
Semantik von `reconcileLagerOnCancel` in allen vier Richtungen (neu verknüpft, unverändert,
entfernt, getauscht).

### 1.6 Derselbe Fund im **eingebetteten** Modus · ✅ erledigt 2026-09-05 (`39df75a`)

Nachtrag zu 1.5 vom 2026-09-04, am Code belegt. Der Fix dort deckt drei Wege ab und nennt sie
auch so: `RechApp.navigate()` innerhalb der Rechnungs-App, sowie `beforeunload` für
Tab-schließen, Reload und die **Top-Nav** — letztere zu Recht, denn sie besteht aus echten
Links (`js/topnav.js:41` baut `<a href="app.html?page=…">`), also einem echten Seitenwechsel.

**Ein vierter Weg fehlt.** Die Rechnungs-App läuft nicht nur unter `/rechnungen/`, sondern auch
**eingebettet in `app.html`** als Finanzen-Sub-Tab ([`js/app.js:43`](../js/app.js):
`RechApp.mount()`). Dort steht neben dem Formular die **Sidebar** von `app.html` — und die
navigiert clientseitig:

| Weg | Mechanik | Haken läuft? |
|---|---|---|
| Sub-Nav der Rechnungs-App | `RechApp.navigate()` | ✅ |
| Top-Nav | echter Link → Unload → `beforeunload` | ✅ |
| Tab schließen / Reload | `beforeunload` | ✅ |
| **Sidebar in `app.html`** | `App.navigate()` — `replaceState`, kein Unload | ❌ |

`js/app.js:339` (`_activate` der `.sidebar-link`) ruft `this.navigate(page)`; die Funktion
tauscht `#content` aus und zieht per `replaceState` nur die Adresszeile nach — **kein Unload**.
Und `RechApp` wird dabei nichts mitgeteilt: `js/app.js` erwähnt `RechApp` an genau **einer**
Stelle, nämlich `mount()`. Der Aufräumhaken kann also gar nicht anspringen.

**Ergebnis:** Wer die Rechnung im Finanzen-Tab offen hat, einen Lagerartikel verknüpft und dann
in der Sidebar auf Dashboard, Statistiken oder Steuer & Soziales klickt, hinterlässt denselben
Zustand wie vor dem Fix — Artikel „verkauft", keine Rechnung, kein Umsatz. Die Verwerfen-Rückfrage
erscheint zwar (`App.navigate` hat ein eigenes `_formDirty`), sie räumt aber nichts auf.

**Gebaut.** `RechApp` exportiert jetzt einen öffentlichen Auslöser `runLeaveHook()` — bis dahin
war nur der Setter `onLeave` nach außen sichtbar, der Wirt konnte also gar nichts anstoßen.
`App.navigate()` ruft ihn beim Seitenwechsel, an derselben Stelle, an der es schon `_formDirty`
behandelt. Zwei Bedingungen an die Platzierung, beide durch Tests festgenagelt:

- **nach** der Verwerfen-Rückfrage — verneint der Nutzer sie, bricht `navigate()` ab, und dann
  darf nichts aufgeräumt worden sein; sonst wäre die Verknüpfung weg, obwohl er ausdrücklich
  auf der Seite geblieben ist;
- **vor** dem Austausch von `#content` — danach sind die `.pos-lager-id`-Felder weg, aus denen
  `reconcileLagerOnCancel` seine `currentIds` liest, und der Abgleich liefe ins Leere.

Der Aufruf ist für alle anderen Seitenwechsel unschädlich: ist kein Haken gesetzt, passiert
nichts, und der Haken löscht sich beim Laufen selbst. `EBApp` ist in derselben Schleife
mitgeführt, damit die Eigenbeleg-Sub-App später ohne erneuten Eingriff in `navigate()` opt-in
kann — sie setzt heute keinen Haken.

`test/test-rechnung-lager-verlassen.js` wuchs von 14 auf **23 Prüfungen**; die sechs neuen (D1–D6)
decken Export, Aufruf, beide Reihenfolgebedingungen und den `typeof`-Guard ab.

> **Nicht im Browser nachgestellt** — weder der Fund noch der Fix. Der Browser fiel während der
> Live-Tests wiederholt aus (Tabs starben, `Runtime.evaluate` lief in 45-s-Timeouts). Beides
> steht am Code, mit benannten Belegstellen; ein Durchklick im Finanzen-Tab wäre die noch
> fehlende Bestätigung.

### 1.7 StB-Nur-Lese-Modus griff im Rechnungsmodul gar nicht · ✅ gefixt 2026-09-05, Rest offen

Vorklärung zu Live-Test 3 (Steuerberater-Zugang), 2026-09-05, am Code gemessen. Der Test selbst
braucht zwei Accounts und wartet auf den Betreiber — **dieser Teil nicht.**

Die Sperre in [`js/stb-share.js`](../js/stb-share.js) entscheidet über den **Namen** der
`data-action`: `WRITE_RE` listet Verben (`save`, `add`, `delete`, `import`, `speichern`, …),
alles andere gilt als Lesezugriff. Eine Denylist über Bezeichner ist genau die Konstruktion, die
still Lücken hat — jede neue Aktion, deren Name kein gelistetes Verb enthält, ist automatisch
erlaubt, ohne dass jemand eine Entscheidung getroffen hätte.

**Gezählt:** 174 `data-action`-Namen im Repo, **57 gesperrt, 117 nicht.** Das meiste davon ist zu
Recht offen (Exporte, Tabs, Filter, Navigation, Kopieren). Fünf Kandidaten habe ich einzeln
nachgeschlagen statt vom Namen zu schließen — **zwei davon schreiben wirklich in den Store:**

| Aktion | Handler | Schreibt |
|---|---|---|
| `uva-mark` | `UstVoranmeldung._markEingereicht()` | `Store.saveUstPeriode(…)` **und** `Store.setDifferenzVortrag(…)` |
| `app-ust-switch-regel` | `App._ustSwitchToRegel(key)` | `Store.saveSettings({ustMode:'regel'})` |

Beide rutschen durch, weil `WRITE_RE` weder `mark` noch `switch` kennt. Beide sind steuerlich
relevant: das eine markiert eine **USt-Voranmeldung als eingereicht** und fixiert dabei den
§25a-Vortrag für die Folgeperiode, das andere stellt die **Besteuerungsform** des Mandanten von
Kleinunternehmer auf Regelbesteuerung um.

Die anderen drei geprüften (`lgp-bulk-mwst`, `lgp-bulk-dup`, `eb-clear-lager`) schreiben **nur ins
Formular**, kein `Store.save*`. Die restlichen 112 sind **nicht** einzeln geprüft.

**Tragweite, eingegrenzt:** Der Schaden bleibt im Browser des Steuerberaters. Der Push lässt
`_readonly`-Firmen ausdrücklich aus ([`js/cloud-sync.js:795`](../js/cloud-sync.js)), und
serverseitig gilt der Grant-Check — die Bücher des Mandanten sind also **nicht** gefährdet. Aber
der Zweck des Modus ist, dass der Berater den Stand nicht verändern *kann*; hier verändert er
seine eigene Sicht darauf, ohne es zu merken, und entscheidet danach womöglich auf einem Stand,
den er selbst erzeugt hat. Eine Periode, die als eingereicht dasteht, ohne es zu sein, ist genau
die Sorte Irrtum, die niemand nachprüft.

**Nachtrag vom 2026-09-05, und er ändert die Bewertung: die zwei Namen sind nicht das Problem.**
Beim Versuch, die Denylist zur Allowlist umzubauen, kamen zwei größere Löcher heraus. Die Sperre
hat drei Schichten, und **keine davon greift im Rechnungsmodul**:

| Schicht | Mechanik | Reichweite |
|---|---|---|
| CSS ([`css/style.css:3004`](../css/style.css)) | `[data-action$="-save"]` u. ä., **8 Suffixe** | nur Aktionen, die genau so enden |
| JS-Chokepoint ([`js/actions.js:26`](../js/actions.js)) | `WRITE_RE` über den Namen | 57 von 174 — **und nur der zentrale Router** |
| `eb-*`- und `rech-*`-Router | — | **gar nicht** |

1. **Die eigenen Router umgehen die Sperre vollständig.** Der Kopfkommentar von
   [`js/actions.js`](../js/actions.js) sagt es selbst: „Namespaces `eb-*` / `rech-*` haben eigene
   Router … und laufen an dieser Registry vorbei." Gegengeprüft: `StbShare` kommt in
   `eigenbelege/js/app.js` und in **keiner** Datei unter `rechnungen/js/` vor. Damit ist jede
   Aktion dieser beiden Module ungeprüft — auch `eb-delete` und `eb-alle-loeschen`.

2. **Im Rechnungsmodul greift die Sperre strukturell nicht.** Dort gibt es **18**
   `data-action`-Attribute, aber **89 direkte `addEventListener('click', …)`-Bindungen**. Der
   Speichern-Knopf der Rechnung ist eine davon:
   `document.getElementById('invSave').addEventListener('click', saveInvoice)`
   ([`rechnungen/js/rechnung.js:792`](../rechnungen/js/rechnung.js)) — **ohne `data-action`**.
   Er ist damit für den Chokepoint unsichtbar *und* für die CSS-Regel, die ein
   `data-action`-Attribut zum Matchen braucht. Eine Navigationssperre gibt es nicht; der
   Berater bewegt sich normal durch die Mandantenfirma. **Er kann dort eine Rechnung
   speichern.**

**Zu tun — und die Allowlist ist es nicht.** Ich habe den Umbau versucht und wieder verworfen:
eine maschinelle Einordnung der 174 Namen lieferte 92 „schreibend" / 76 „lesend", darunter
`close-modal`, `navigate`, `reload`, `print-page` und `uva-export` als angeblich schreibend. Eine
falsch als lesend eingestufte Aktion ließe einen Schreibvorgang durch, eine falsch als schreibend
eingestufte zerschösse dem Berater die Ansicht — **eine unsauber erzeugte Allowlist ist
gefährlicher als die heutige Denylist.** Und selbst eine perfekte Allowlist hülfe im
Rechnungsmodul nicht, weil dort 89 Schreibwege gar kein `data-action` tragen.

**Gebaut am 2026-09-05: der Guard sitzt jetzt eine Schicht tiefer, im Store.** Ist die aktive
Firma `_readonly`, verweigert `Store` die schreibenden Methoden — das deckt Namensregex, direkte
Bindung und Konsole gleichermaßen ab, und es ist **eine** Stelle statt 174 Aktionsnamen.

Abgesichert sind die **drei** Nutzer-Schreibwege: `set()`, `setAsync()` und `_rechSet()`. Der
dritte war der wichtige — über ihn läuft das Rechnungsbuch, das die Oberflächensperre nie
erreichte. Dazu eine ausdrückliche frühe Abweisung in `saveRechInvoice()`, die `null`
zurückgibt: der Aufrufer wertet den Rückgabewert aus und hätte sonst „Dokument gespeichert!"
gemeldet, obwohl nichts geschrieben wurde. **Eine lügende Bestätigung ist schlimmer als eine
Fehlermeldung.**

> **Der befürchtete Haken war keiner.** Die Sorge war, ein Store-Guard bräche das Befüllen der
> Nur-Lese-Firma durch den Sync. Am Code nachgesehen: der Sync schreibt **nie** über die
> öffentliche API. Er nutzt `Store.syncApplyKeys()` und direktes `localStorage.setItem`
> ([`js/cloud-sync.js`](../js/cloud-sync.js), `_applyMerged`) — beides läuft an
> `set()`/`_rechSet()` vorbei. Die Trennung war also schon da; sie musste nur genutzt werden.
> Ein Flag brauchte es nicht. **Wer diese Trennung aufhebt, bricht den Guard** — deshalb steht
> sie als eigene Prüfung im Harness.
>
> Ebenfalls geprüft, weil es den Berater einsperren würde: `setCompany()` schreibt nur eine
> Variable im Speicher und ist damit nicht gesperrt. Der Firmenwechsel bleibt möglich.
>
> Und gemessen statt vermutet: die Registry-Prüfung kostet **3,3 µs pro `set()`** — bei einem
> Import mit 527 Datensätzen rund **1,7 ms**. Kein Caching nötig.

`test/test-stb-store-guard.js` ist neu, 14 Prüfungen: die Entscheidungsfunktion, die Verdrahtung
an allen drei Wegen, die Gegenprobe zum Sync, der Firmenwechsel und die Drosselung des Toasts.
`test/test-store-gobd-fixes.js` brauchte zwei Stub-Methoden mehr — es schneidet `saveRechInvoice`
aus der Quelle und führt sie gegen ein Mock-Objekt aus.

**Die Oberfläche ist am 2026-09-09 nachgezogen worden.** Der Store fing die Klicks zwar ab, aber
ein Knopf, der sich drücken lässt und dann nichts tut, ist die zweitbeste Lösung. Zwei gezielte
Ergänzungen statt des großen Umbaus:

- **`WRITE_RE` kennt jetzt `mark` und `switch`** — damit sind die beiden belegten Schreibwege
  `uva-mark` und `app-ust-switch-regel` auch an der Oberfläche gesperrt. Ausgezählt, bevor es
  hineinkam: `mark` trifft repo-weit **nur** `uva-mark`; `switch` trifft zusätzlich `co-switch`,
  den Firmenwechsel — der steht deshalb in `ALLOW_SET`, sonst käme der Berater aus der
  Mandantenansicht nicht mehr heraus. **`pick` ist bewusst draußen geblieben:**
  `app-pick-ust` und `lg-pick-swatch` fassen nur das DOM an, sie wären ohne Not gesperrt worden.
- **Das Rechnungsmodul über IDs statt `data-action`.** Dort greifen die Suffix-Regeln nicht, weil
  die Knöpfe kein `data-action` tragen. `#invSave` und die vier Einstiege
  (`#dashNewInvoice`, `#dashNewOffer`, `#emptyNewInvoice`, `#emptyNewOffer`) sind jetzt in
  `body.stb-readonly` ausgeblendet. **`#invPreview` und `#invCancel` ausdrücklich nicht** —
  Vorschau ist lesend, und Abbrechen muss erst recht möglich bleiben.

`test/test-stb-readonly-sperre.js` ist von 13 auf **19 Prüfungen** gewachsen. Die vier
C-Prüfungen, die vorher die *offenen* Lücken festhielten, sind in positive umgeschrieben — sie
sind beim Fix erwartungsgemäß fehlgeschlagen und haben damit genau das getan, wofür sie da waren.

**Nachtrag 2026-09-09: der Store-Guard war selbst unvollständig.** Beim Nachprüfen kamen zwei
Umgehungen heraus, beide derselben Bauart — Methoden, die **nicht** über `set()` schreiben,
sondern direkt in `_cache` und `_idbPut`:

1. **Das GoBD-Protokoll.** `_addAuditEntry` schreibt direkt, und `savePurchase()` ruft es **vor**
   `this.set()`. In der Mandantenansicht wäre also der Protokolleintrag entstanden und der
   eigentliche Schreibvorgang danach abgewiesen worden — **ein Protokoll, das eine Änderung
   verzeichnet, die es nie gab.** Das ist schlimmer als gar keines, weil es glaubwürdig aussieht.
2. **16 weitere Schreibmethoden**, ausgezählt statt geschätzt: Fahrtenbuch, **Kassenbuch**,
   Retouren, Materialwirtschaft, Steuertermine, Plattformgebühren. Von 58 Schreibmethoden liefen
   42 über `set()`/`_rechSet()` und **16 daran vorbei**. Die Retouren wiegen dabei besonders, weil
   sie über `margeKorrektur` in die USt-Voranmeldung fließen: eine gelöschte Retoure verändert
   still die Bemessungsgrundlage einer womöglich schon eingereichten Periode.

Alle 18 sind jetzt abgesichert; `null` als Rückgabe ist sicher, weil repo-weit kein Aufrufer den
Rückgabewert auswertet (nachgesehen, nicht angenommen). **Die eigentliche Absicherung ist aber
Prüfung G2** in `test/test-stb-store-guard.js`: sie zählt die Schreibmethoden selbst aus und
schlägt fehl, sobald **eine neue** direkt schreibt, ohne den Guard zu tragen. Gegen den Stand vor
dem Fix gehalten meldet sie 16, gegen den heutigen 0 — sie hat also Zähne.

> **Was dabei ausdrücklich kein Fund war:** `deleteFahrt` und `deleteKassenEintrag` löschen trotz
> ihres Namens **nicht** physisch, sondern stornieren (GoBD §146 AO) — und `saveSaleMulti` legt
> nur neu an, es gibt dort keinen festgeschriebenen Satz zu schützen. Alle drei sahen nach
> Asymmetrie aus und waren beim Nachsehen korrekt.

**Offen bleibt der Umbau der Denylist zur Allowlist.** Er ist aber **kein Sicherheitsthema mehr**:
der Store fängt jeden Weg ab, und die beiden namentlich bekannten Löcher sind zu. Was bliebe, wäre
Gründlichkeit — ein neuer Aktionsname ist weiterhin standardmäßig erlaubt, und die 112 nicht
einzeln geprüften Namen sind nicht einzeln geprüft.

> **Nicht im Browser nachgestellt** — dafür bräuchte es den zweiten Account, auf den Live-Test 3
> ohnehin wartet. Belegt sind Zählung, Handler-Zuordnung, Bindungsart und die Verdrahtung am
> Quelltext.

### 1.0 OCR-Belegerkennung · ✅ erledigt 2026-08-27

Gebaut nach [`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md) und
[`session-prompt-ocr-2026-08-27.md`](session-prompt-ocr-2026-08-27.md). Ergebnis, Abweichungen
und Messwerte in [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md).

Kurzfassung: `tesseract.js` 7.0.0 + `tesseract.js-core` **7.0.0** in `js/vendor/` (SHA-256 in
[`VERSIONS.md`](../js/vendor/VERSIONS.md)), Extraktionsheuristik in
[`js/beleg-ocr.js`](../js/beleg-ocr.js) mit 35 Prüfungen in
[`test/test-beleg-ocr.js`](../test/test-beleg-ocr.js), UI im Eigenbeleg-Formular.

**Drei Abweichungen von der Spezifikation, jede am Build gemessen:**

| | |
|---|---|
| **Keine CSP gelockert** | `'wasm-unsafe-eval'` war freigegeben, wird aber **nicht gebraucht**: der WASM-Kern kompiliert im Worker, dessen Antwort keine CSP trägt. Hängt an `workerBlobURL: false` — ein `blob:`-Worker erbt die Dokument-CSP. `vercel.json` und die `<meta>`-Tags sind unverändert |
| **Kern-Version 7.0.0, nicht 6.1.2** | `tesseract.js@7.0.0` verlangt `tesseract.js-core@^7.0.0`. Der `latest`-Tag von `tesseract.js-core` zeigt irreführend auf 6.1.2 |
| **Fünf Dateien statt vier** | `tesseract.min.js` (die Bibliothek selbst) fehlte in der Liste der Spezifikation, die nur die drei zur Laufzeit nachgeladenen Teile nannte |

> ⛔ **OCR wird auf der Landingpage nicht beworben** (2026-08-27) — `index.html` ist unberührt
> geblieben. Erst wenn an echten Belegen eine Trefferquote gemessen ist, die man hinschreiben
> kann. Begründung in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).

> ⚠️ **Offen: an echten Belegen messen.** Geprüft wurde bisher nur an synthetischen Bonbildern
> (sauber und absichtlich verschlechtert), dort je 3 von 3 Feldern korrekt. Ein echtes Bonfoto —
> Thermopapier, geknickt, verblasst — ist damit **nicht** abgedeckt. Genau diese Messung ist die
> Bedingung dafür, das Feature überhaupt bewerben zu dürfen.

### 1.0b Landing-Demo ausbauen · ✅ erledigt 2026-08-25 (`69361f1`, `b6be27c`, `cb95d40`)

Entschieden 2026-08-23 als der Weg, die Einstiegshürde zu senken — statt Kartenpflicht
abzuschaffen oder einen Read-only-Tier zu bauen. **Alle drei Ausbaurichtungen sind umgesetzt:**

| Ziel | Umsetzung |
|---|---|
| mehr Bereiche zeigen | fünf Reiter statt drei — Dashboard · Buchungen · **Rechnung** · EÜR · GoBD-Protokoll |
| eigene Zahlen eingebbar | `.demo-custom` mit Bezeichnung, Betrag, Typ und Kategorie → `window.demoAddCustom()` |
| Sprung in den Checkout dort, wo der Wert sichtbar wird | `#demoCtaDash` und `#demoCtaEuer` |

Gate-Logik und Rechtstexte blieben unberührt, wie es die Entscheidung verlangt.

> **Am 2026-08-25 auf Port 4324 durchgeklickt** (frischer Port, Cache-Falle umgangen), Konsole
> fehlerfrei. Die ganze Kette trägt: eigene Ausgabe „249,90 €" erscheint oben in der Liste,
> `demoCat` wechselt beim Umschalten auf *Ausgabe* korrekt auf Wareneinkauf/Porto/Bürobedarf,
> der **Wareneinsatz in der EÜR steigt auf 3.389,90 €**, der Gewinn wird neu gerechnet, und das
> GoBD-Protokoll schreibt `B-2026-90 erstellt (Wareneinkauf) · CREATE` mit. `aria-selected` ist
> beim Reiterwechsel sauber exklusiv.
>
> Das überzählige `</div>` aus `cb95d40` ist wirklich weg — `#demoList` liegt wieder innerhalb
> von `#demo`.

### 1.1 F6 — Krypto-Worker · ✅ erledigt 2026-08-21

Gebaut in `185b354` (Worker + 13 Prüfungen), **verdrahtet in `39cf8b1`**. `_encrypt` und
`_decryptCt` in [`js/cloud-sync.js`](../js/cloud-sync.js) laufen über
[`js/crypto-worker.js`](../js/crypto-worker.js), mit Inline-Fallback wenn kein `Worker` verfügbar ist.

> **Die Erfolgsprognose war zu optimistisch.** Angekündigt waren 62 % weniger Blockade, gemessen
> durch die fertige Funktion sind es **rund 38 %** (150 ms → 92,5 ms bei 10,27 MB Klartext). Die
> alte Zahl mass die Krypto-Kette allein; `JSON.stringify` (35,9 ms) und der Klon zum Worker
> (4,3 ms) bleiben zwangsläufig im Main-Thread. Vollständige Herleitung inkl. der nicht sauber
> zugeordneten Restzeit: [`f6-worker-einbau-2026-08-18.md`](f6-worker-einbau-2026-08-18.md).
>
> Der Gewinn liegt weniger in der Summe als darin, **dass der Thread überhaupt wieder
> zwischendurch drankommt** — 7 statt 1 Herzschlag. Ein Dauerfreeze von 150 ms ist für den
> Nutzer etwas anderes als zwei kürzere Blöcke.

### 1.2 F6, zweite Hälfte — Sync-Rückmeldung · ✅ erledigt 2026-08-21 (`617bfc3`)

Die Ursache war enger als die Aufgabe vermuten ließ: `_setDot` benutzte für `sync` und `ok`
**dasselbe Icon in derselben Farbe** — der einzige Unterschied stand im `title`-Attribut und war
damit nur beim Hovern zu sehen. Es fehlte also kein Detail, sondern überhaupt ein sichtbarer
Unterschied.

Jetzt: eigenes Icon (`ti-refresh`) plus Drehung während des Laufs, und der Tooltip führt den
Fortschritt mit — erst `(Stammdaten)`, dann pro Firma `(Muster GmbH, 2 von 3)`.
Read-only-Mandanten der Steuerberater-Ansicht zählen nicht mit.

> **Warum der Icon-Wechsel und nicht nur die Animation:** `css/style.css` hat eine globale
> `prefers-reduced-motion`-Regel, die jede Animation stillstellt. Der Icon-Wechsel trägt deshalb
> die Information, die Drehung ist nur die Zugabe.

Zwei neue Prüfungen in `test/test-cloud-sync.js` (jetzt 12) nageln die **Eigenschaft** fest —
`sync` und `ok` dürfen nicht dasselbe Icon benutzen; *welches* Icon es ist, darf sich ändern.
Bewusst anders gebaut als der alte R7-Test, der einen Wortlaut festhielt und beim nächsten Umbau
falsch alarmiert hat. Gegenprobe gemacht: mit dem alten Icon schlägt der Test an.

**Damit war Abschnitt 1 am 2026-08-25 leer** — OCR kam am 2026-08-27 noch einmal hinein und
ist am selben Tag fertig geworden (1.0 oben). Alles andere bleibt zu; was offen ist, steht in
Abschnitt 2 und 3 und braucht dich oder Dritte.

---

## 2. Braucht dich — keine Session kann das allein

### 2.1 ~~Owner-ENV-Variablen~~ · ✅ erledigt 2026-08-23

**Fund R3 ist geschlossen.** In Vercel gesetzt (Production + Preview, Typ Config):

| Name | Wert |
|---|---|
| `SYNC_OWNER_IDS` | `user_ljp5xcrqojylg` |
| `WHOP_OWNER_IDS` | `user_ljp5xcrqojylg` |

Redeploy ausgeführt, `/api/whop-access` antwortet danach sauber. Anleitung und Rückweg:
[`r3-owner-ids-anleitung.md`](r3-owner-ids-anleitung.md).

> **Zwei Dinge, die diese Aufgabenbeschreibung falsch hatte:**
> 1. Es waren **keine** `*_OWNER_USERNAMES` in Vercel gesetzt — der Owner-Check lief
>    vollständig über den hart kodierten Namen. Der Schritt „alte Namensvariablen löschen"
>    entfiel deshalb ersatzlos.
> 2. Das Löschen der Namensvariablen hätte die Lücke **nicht** geschlossen: der Default
>    stand im Quelltext, nicht in der Variablen. Ohne Variable griff er erst recht.

**Der Default ist mit `c413228` entfernt** (`|| ''` statt `|| 'secondlifevintage41'` in allen
drei Endpunkten), `CLOUD-SYNC.md` nachgezogen — sie dokumentierte nur den Altweg und hätte ein
Neuaufsetzen dorthin zurückgeführt.

> ⚠️ **Folge, die man kennen muss:** Der Namensweg fällt jetzt auf eine leere Liste zurück.
> Ein neues Projekt oder eine neue Umgebung ohne diese Variablen hat **keinen Owner-Bypass**.
> Das ist die Absicht — fällt aber erst beim Anmelden auf.

**Noch offen:** der funktionale Beweis. Nach dem nächsten Login muss `/api/whop-access` mit
`"owner": true` antworten. Kommt stattdessen der „Stackr Pro aktivieren"-Bildschirm, stimmt
die ID nicht — sie steht dort unten als Freigabe-Code zum Kopieren.

---
### 2.2 Zwei Whop-Mails konfigurieren (N4)

**Beide Texte sind fertig entworfen: [`whop-mails-entwuerfe.md`](whop-mails-entwuerfe.md)** —
inklusive Auslöser, Platzhaltern und dem Grund, warum in der Winback-Mail bewusst **kein Rabatt**
steht (§7 Abs. 3 UWG). Einfügen musst du sie selbst, reine Backend-Konfiguration, ~1 h:

- **3 Tage vor der Jahresverlängerung** — 135 € ohne Vorwarnung ist die Buchung, die zu
  Rückfragen und Rückbuchungen führt.
- **7 Tage nach der Kündigung**, mit dem Hinweis dass die Daten erhalten bleiben. Der
  Winback-Screen in der App ist gut gemacht, erreicht aber nur Rückkehrer.

### 2.3 Live-Tests — brauchen echte Logins

**Als durchklickbare Checkliste für eine Sitzung aufbereitet:
[`live-tests-checkliste.md`](live-tests-checkliste.md)** — mit Reihenfolge, erwartetem Ergebnis je
Schritt und dem, was sich in derselben Sitzung miterledigen lässt.

Gebaut und committet, aber nie unter echten Bedingungen gelaufen:

- **Cloud-Sync mit zwei echten Profilen** (Mock-Test bestanden, echter E2E-Test offen)
- **StB-Zugang mit zwei Accounts** inkl. Fingerabdruck-Abgleich
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen
- **Excel-Import mit einer echten Datei** (Buchungen + Lager)
- **Edge-Tastaturtest der Gate-Overlays** — die Logik ist geprüft, die Wahrnehmung nicht
- **Lager-Feature-Batch Punkt 10** — Live-Durchklick

> **Wichtig:** Claude loggt sich **nicht** selbst bei Whop ein. Wenn ein Test einen Login
> braucht, meldest du dich einmal im Browser-Pane an; die Session bleibt danach erhalten. Ein
> Dev-Bypass im Code ist ausdrücklich nicht gewünscht.

### 2.5 Zwei Produktfragen zur Cloud-Löschung (2026-09-07)

Beide fielen beim Vorklären von Live-Test 2 an. Der eigentliche Fehler ist behoben (`75b2b95`,
siehe [`live-tests-checkliste.md`](live-tests-checkliste.md) Punkt 2) — was bleibt, sind zwei
Entscheidungen, die keine Session allein treffen sollte.

**a) Anhänge ohne Schlüssel.** Sind Schlüssel **und** Snapshot weg, lassen sich die ausgelagerten
Anhänge (Logos, Belegfotos, PDFs) nicht mehr aufzählen — ihre URLs standen nur im Chiffrat.
`deleteRemote()` meldet in dem Fall ehrlich einen Teil-Erfolg, aber die Blob-Objekte bleiben
liegen. Für Art. 17 DSGVO ist das unbefriedigend: es sind fremde personenbezogene Daten in einem
Store, den niemand mehr adressieren kann.

**b) `reset_all` ist die Löschung, heißt aber „Reset".** Ein vollständiger, serverseitiger Weg
existiert bereits und braucht **keinen** Schlüssel: der Knopf „Cloud-Daten verwerfen & neu
aufsetzen" ruft `action: 'reset_all'` und räumt zusätzlich per `BlobAttachments.purgeAll()` die
Anhänge weg. Er ist nur als Reparaturweg präsentiert und im Sync-Panel versteckt — also genau
dort, wo ein Nutzer nach dem Deaktivieren nicht mehr hinschaut.

**Zu entscheiden:** ob „Alle Daten löschen" bei fehlendem Schlüssel automatisch auf `reset_all`
zurückfallen soll (löscht dann **alle** Firmen dieses Kontos, nicht nur die eine — das ist der
Haken), oder ob es dafür einen eigenen, klar benannten Knopf „Cloud-Daten endgültig löschen"
gibt. Die Frage ist nicht technisch, sondern eine Abwägung zwischen Vollständigkeit und dem
Risiko, dass jemand mehr löscht als gewollt.

### 2.4 Produktentscheidungen · ✅ alle getroffen (2026-08-23)

**Hier steht nichts mehr offen.** Alle sieben Fragen sind entschieden und in
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) mit Begründung festgehalten:

| Frage | Entscheidung | Folge |
|---|---|---|
| Modulzahl | **29 Bereiche** | an allen vier Stellen der Landing (`7635b2f`); loest zugleich die Verwechslung mit den 9 Akademie-Modulen |
| Preisstaffel | **ein Preis, keine Staffel** | — |
| Zielgruppe | **EÜR-Rechtsformen vorn** (Einzelunternehmen, Freiberufler, GbR, eGbR) | — |
| Zeiterfassung | **wird nicht gebaut** | eigenes Produktfeld |
| Top-of-Funnel | **Demo ausbauen**, Kartenpflicht bleibt | → Aufgabe 1.0b |
| Steuerberater-Modell | **bleibt kostenlos**, als Vertriebskanal | nichts zu bauen — der R4-Deckel ist längst drin (`MAX_GRANTS`, [`api/sync.js:499`](../api/sync.js)) |
| OCR | **gebaut** als Browser-OCR, 2026-08-27. Nicht beworben, bis eine Trefferquote an echten Belegen gemessen ist | → Aufgabe 1.0, erledigt |

---

## 3. Wartet auf Dritte

- **Anwalts-Freigabe** — AGB §11 (Empfehlungsprogramm) und die §356a-Trial-Klausel. Der
  AGB-Text weist auf Letzteres **selbst** hin; das ist ehrlich, sollte vor dem Launch aber durch
  die echte Prüfung ersetzt werden. Eine Widerrufsklausel, die nicht trägt, ist bei einem
  Trial-Modell der teuerste Fehler.
- **AV-Verträge nach Art. 28 DSGVO** — Whop ist bekannt offen. **Zusätzlich prüfen: Upstash und
  Vercel**, beide sind in `datenschutz.html` als Auftragsverarbeiter benannt.
- **§25a, ermäßigter Satz von 7 % — ERLEDIGT am 2026-09-03, es gibt die Frage nicht.**
  §25a Abs. 5 Satz 1 UStG schreibt für die Marge den **allgemeinen** Steuersatz vor; die 7 % auf
  Kunst und Sammlungsstücke gelten nur in der Regelbesteuerung. Die festen 19 im Code sind
  richtig. Die Recherche vom 2026-08-16 hatte Abs. 5 **Satz 2** zitiert, der Steuerbefreiungen
  regelt — hätte man sie umgesetzt, wäre daraus eine systematische **Unterzahlung** geworden.
  Begründung und die zwei Restpunkte (Pauschalmarge 30 %, Rechnungs-Pflichtangabe) stehen in
  [`25a-ermaessigter-satz-recherche.md`](25a-ermaessigter-satz-recherche.md), die Entscheidung in
  [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md). **Nicht erneut als Fund melden.**

---

## Reihenfolge, wenn du wenig Zeit hast

| Rang | Aufgabe | Warum | Aufwand |
|---|---|---|---|
| 1 | **2.2 Whop-Mails** | Verhindert Rückbuchungen bei der 135-€-Verlängerung; beide Texte liegen fertig entworfen | 1 h |
| 2 | **2.5 Cloud-Löschung entscheiden** | Zwei Produktfragen, keine Technik. Solange sie offen sind, bleibt die Art.-17-Löschung unvollständig | Entscheidung |
| 3 | **2.3 Live-Tests** | Drei der sieben Punkte sind noch nie unter echten Bedingungen gelaufen | mehrere Sitzungen |

> **Korrigiert am 2026-09-09.** Auf Rang 1 stand bis dahin „2.1 ENV-Variablen in Vercel — einzige
> offene Sicherheitslücke". Das war seit dem 2026-08-23 erledigt und am 2026-09-01 auf Produktion
> gegengemessen: `/api/whop-access` antwortet mit `has_access: true`, **`owner: true`** und einem
> Grace-Token. Die Zeile schickte also auf etwas längst Erledigtes — genau die Sorte Veralten, vor
> der diese Datei oben selbst warnt.

**Abschnitt 1 ist leer** — keine Code-Aufgabe, die eine Session greifen könnte. Die Funde 1.3 bis
1.7 aus den Live-Tests sind alle gefixt; die OCR-Messung an echten Belegen ist am 2026-08-30
gelaufen (**2 von 3**, siehe [`live-tests-checkliste.md`](live-tests-checkliste.md) Punkt 7).

Der einzige Rest dort ist der Umbau der StB-Schreibsperre von einer Denylist auf eine Allowlist
(1.7). Er ist **kein Sicherheitsthema mehr** — der Store-Guard fängt seit dem 2026-09-05 jeden
Schreibweg ab —, sondern Gründlichkeit: ein neuer Aktionsname ist an der Oberfläche weiterhin
standardmäßig erlaubt.

**Rang 1–3 hängen ausschließlich an dir.** Was sich ohne dich vorklären ließ, ist vorgeklärt: bei
den Live-Tests 2, 3 und 4 sind je zwei bis drei Unterpunkte am Code beantwortet, mit
Erwartungswert und Fundstelle — nachzulesen jeweils im Kasten über der Checkliste des Punkts.
