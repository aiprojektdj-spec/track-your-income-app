# Session-Prompt: Umbau auf serverführende Datenhaltung (Start 2026-10-22)

In eine neue Session kopieren. Stand gegen den Code prüfen, nicht gegen diese Datei.

---

Wir bauen Stackr von local-first auf serverführende Datenhaltung mit **lesbaren** Daten in Supabase um
(Entscheidung vom 2026-10-21, oben in `plan/02-ENTSCHEIDUNGEN.md`). Zuerst `CLAUDE.md` lesen und
`git status --short && git log --oneline -8` ausführen.

**Ausgangslage**
- Supabase-Projekt `usrhhjwvoefjdgrwovkg`, Frankfurt, **Pro aktiv**. Der Phase-1-Stand liegt in
  `plan/stackr-plan-rest-2026-10-07.md` und `plan/supabase-umzug-2026-10-06.md`. Er ist noch auf
  „E2E bleibt“ ausgelegt; das ist überholt. Den tatsächlichen Stand aus den Migrationen und `api/` ablesen.
- Auth und Zahlung bleiben bei Whop.
- [js/store.js](../js/store.js) liest und schreibt heute synchron im Browser (localStorage/OPFS).
- Die Shopify-Buchungslogik ist fertig und transportunabhängig: `js/shopify-buchung.js`
  (986a594, auf 0c87b11/43bc636) und `api/_shopify.js` (HMAC, state, Pflicht-Webhooks).
  Shopify kommt danach als OAuth-App (Weg b). Weg a entfällt.

**Auftrag dieser Session: nur den Umbauplan, noch kein Umbau.** Als `plan/server-umbau-2026-10-22.md`:
1. Datenmodell in Postgres mit RLS je Whop-User und Firma; welche Store-Schlüssel wohin.
2. Wie `store.js` schrittweise umgestellt wird (synchron → asynchron, lokaler Cache für offline?),
   Modul für Modul. Kein Big-Bang.
3. Migration der Bestandskunden: im Browser entschlüsseln, mit Einwilligung hochladen; was mit
   Kunden passiert, die sich nie wieder einloggen.
4. GoBD auf dem Server: Festschreibung, Protokoll, Unveränderbarkeit, Aufbewahrung.
5. Recht: AVV Supabase, Datenschutzerklärung, AGB, Verfahrensdokumentation, Art. 30/32/35 DSGVO,
   Landing-Aussagen zu „Daten bei dir“ und E2E (index.html, datenschutz.html, agb.html).
6. Was aus Cloud-Sync, Backup-Krypto, Offline-Grace und StB-Read-only wird.
7. Reihenfolge mit Abhängigkeiten. Shopify (b) als letzter Block.

Mehrdeutige Punkte vorher fragen, Annahmen ausweisen. Antworten knapp.

**Vom User parallel:** Shopify-Partner-Account plus Development Store anlegen, aber noch **keine App**
(die Vertriebsart ist nach der Wahl nicht mehr änderbar).
