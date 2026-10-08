# Session-Prompt: Offene Rechtsfragen F1–F13 zum Supabase-Umzug (2026-10-07)

> **Archiviert 2026-10-08:** F1–F13 sind beantwortet (PR #22 + Abschluss-PR). Offen bleiben nur
> 👤-Punkte im Entwurf (Supabase-TIA herunterladen, Subprocessor-Abo) und die Texte zu Ü1/Ü2/E,
> die erst beim Umschalten eingebaut werden.

**Auftrag des Users:** „Lass uns mit den F-Punkten in einer anderen Session starten.“

Diese Datei ist der Einstieg. Der Entwurf mit allen Texten und Fragen liegt in
[`rechtstexte-supabase-entwurf.md`](rechtstexte-supabase-entwurf.md), der Umzugsplan in
[`supabase-umzug-2026-10-06.md`](supabase-umzug-2026-10-06.md).

Lies zuerst `CLAUDE.md` und halte dich strikt daran: Deutsch, pfad-gescopte Commits
(`git commit -F <datei> -- <pfad>`), Commit-Messages ohne Umlaute, keine stillen Annahmen, Stand
gegen den Code prüfen statt gegen Plandateien. Erste Amtshandlung:
`git status --short && git log --oneline -8`.

## Worum es geht

Speicher-Umzug Upstash Redis + Vercel Blob → Supabase. Die Rechtstexte dafür sind Entwurf.
Abschnitt 3 des Entwurfs enthält die offenen Fragen F1–F13. Diese Session geht sie **gemeinsam
mit dem User** durch:

1. Frage kurz in Alltagssprache erklären.
2. Antwort des Users einholen. Was nur er wissen kann (Verträge, Dashboard-Einstellungen), wird
   gefragt, nicht geraten.
3. Antwort im Entwurf unter der F-Nummer mit Datum festhalten.
4. Wo der User einen Live-Text freigibt, ihn einbauen.

## Stand (2026-10-07, gegen `master` geprüft)

| | Stand |
|---|---|
| PR #15 | gemergt. Entwurf erstellt; **F6** erledigt (Migration `20261007000002_aufraeumen.sql` + täglicher Lauf in `api/blob-cleanup.js`, IP-Zähler in Supabase spätestens nach 24 h gelöscht); **F8** erledigt (DSE 4.1/5/7, `cookies.html`, Dialog in `js/cloud-sync.js` nennen Vercel Blob, Login-Sitzung und Login-Rate-Limit bei Upstash) |
| PR #19 | Recherche F1–F3 im Entwurf und diese Datei |
| Supabase-Projekt | **ein** Projekt `usrhhjwvoefjdgrwovkg` (Frankfurt), alle vier Migrationen ausgeführt (Commit `f3f987f`). **Free-Plan**; Pro ist laut Umzugsplan nötig, bevor eine Env-Variable gesetzt wird. Preview-Projekt fehlt noch |
| Umgeschaltet | nichts. Kein `STORAGE_MIRROR`, kein `STORAGE_BACKEND`, kein `BLOB_BACKEND` gesetzt |

## Zuerst klären (blockiert anderes)

- ~~**Vercel-Plan.**~~ ✅ Geklärt (User, 2026-10-07): Vercel läuft auf **Pro**, der Vercel-DPA
  (gilt für Pro/Enterprise, ohne Unterschrift) ist damit wirksam.
- **Supabase-Plan.** Free → Pro (siehe Umzugsplan, Schritt 0). Prüfen, ob der Supabase-DPA auch
  im Free-Plan gilt; das wurde noch nicht nachgesehen.

## Recherche-Stand F1–F3 (nicht neu recherchieren, nur bei Bedarf gegenprüfen)

- **F1 Supabase-DPA:** gilt laut Text mit Annahme der Terms („acceptance of the Agreement shall
  have the same effect as signing the SCCs“), SCC Modul 2 + 3, Version 1 vom 01.08.2026. Eine
  unterschriebene Fassung ist optional im Dashboard. Der User wollte F1 am 07.10. mittags erledigen
  → nachfragen, ob erledigt, mit Datum.
- **F2 Upstash/Vercel-DPA:** Der Upstash-DPA ist in die ToS eingebunden („incorporated into and forms
  a binding and effective part of the Agreement“) und gilt auch im Free-Plan. Vercel: Pro, DPA gilt.
  Erst wenn beide bestehen, darf DSE Ziffer 7 statt „vorgesehen bzw. abgedeckt“ sagen „besteht“.
- **F3 Drittlandtransfer:**

  | Anbieter | DPF | SCC im DPA | DSE-Formulierung |
  |---|---|---|---|
  | Upstash | ja | ja, als Rückfall | DPF, hilfsweise Standardvertragsklauseln |
  | Vercel | ja | ja, Modul 1–3 (Pro-DPA, gilt) | DPF, hilfsweise Standardvertragsklauseln |
  | Supabase | nicht gefunden | ja, Modul 2 + 3 | nur Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) |

  Der User soll auf https://www.dataprivacyframework.gov/list selbst nach „Supabase“ suchen (die
  Seite lässt sich nicht automatisch abfragen). Kurze TIA empfohlen, weil bei Supabase SCC die
  einzige Grundlage sind: Frankfurt, nur Chiffrat, Schlüssel nie beim Anbieter.

## Noch offen, mit dem User besprechen

- **F4** Unterauftragsverarbeiter (AWS bei Supabase): in der DSE nennen oder auf die Liste des
  Anbieters verweisen? Der Supabase-DPA kündigt Änderungen 30 Tage vorher an.
- **F5** Werden `STORAGE_BACKEND` (Sync) und `BLOB_BACKEND` (Belege) gleichzeitig umgeschaltet?
  Wenn nicht, braucht es eine zweite Übergangsvariante der Texte.
- **F7** Soll der Browser künftig automatisch Fehler an `/api/client-error` melden? Heute sendet
  kein Client. Wenn ja: DSE-Absatz (Entwurf 1.3) einbauen und klären, ob nach § 25 TDDDG eine
  Einwilligung nötig ist.
- **F9** Verfahrensdokumentation (`verfahrensdokumentation.html`): Änderungshistorie mit Datum
  oder nur neues Stand-Datum?
- **F10** Bestehende Sync-Nutzer über den Anbieterwechsel aktiv informieren (In-App/Whop-Mail),
  oder genügt die aktualisierte DSE?
- **F11** Wie wird die Löschung des Altbestands bei Upstash nach dem Umzug nachgewiesen?
- **F12** Bestätigen, dass in Preview **kein** `STORAGE_MIRROR` gesetzt wird: Preview und Prod
  teilen Redis, sonst landen Prod-Daten im Preview-Projekt. Hängt auch daran, ob ein eigenes
  Preview-Projekt kommt.
- **F13** Region des Vercel-Blob-Stores (Vercel → Storage → Blob-Store). Bei `fra1` kann die DSE
  „Frankfurt“ sagen; bei `iad1` muss sie die USA nennen.

## Regeln für diese Session

- Die Supabase-Fassungen der Texte (Ü = Übergang, E = Endstand) bleiben Entwurf, bis wirklich
  umgeschaltet wird. Live-Texte nur ändern, wenn sie den **heutigen** Zustand beschreiben und der
  User freigibt.
- Vor jedem Commit `git status --short` erneut prüfen. Tests:
  `for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`
- Am Ende committen, auf den eigenen Branch pushen, PR gegen `master` öffnen, **nicht** mergen,
  außer der User sagt es.
- Ist alles beantwortet, diese Datei nach `plan/archiv/` verschieben.
