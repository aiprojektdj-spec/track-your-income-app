Prompt für neue Session (copy-paste):

---

Lies zuerst `plan/spec-offline-grace-stb-readonly.md` — das ist die vollständige Spec für zwei Features, die letzte Session geplant (nicht gebaut) wurden. Setz sie jetzt um, aber erst nachdem die zwei offenen Vorfragen geklärt sind:

**Vorfrage 1 (zuerst klären, blockiert Feature 2):** Lies `js/cloud-sync.js` und `js/backup-crypto.js`. Ist Cloud-Sync echtes E2E mit einem Schlüssel, der aus dem Passwort/Login des Haupt-Nutzers abgeleitet wird (also Server sieht nur Ciphertext), oder ist es nur Transport-verschlüsselt (Server könnte im Klartext lesen)? Sag mir das Ergebnis, bevor du an Feature 2 weiterbaust — das entscheidet, ob ein zweiter Whop-Account (Steuerberater) technisch überhaupt Zugriff auf dieselben Daten bekommen kann.

**Vorfrage 2:** Ich habe mit dem Kunden noch nicht final geklärt, wie genau der Steuerberater-Zugang aussehen soll. Falls ich dir bei Sessionstart noch kein Go dazu gegeben habe: nur Feature 1 (Offline-Grace) umsetzen, Feature 2 (StB-Zugriff) nur als Architektur-Vorschlag ausarbeiten, nicht bauen.

**Feature 1 — Offline-Grace-Modus:**
- Lies `js/whop-auth.js`, finde genau wo/wie oft der Whop-Server-Check aktuell greift.
- Bau einen 4-Stunden-Grace-Cache: einmal online eingeloggt, Access-Flag lokal mit Ablauf-Timestamp speichern, App läuft bis Ablauf ohne erneuten Server-Roundtrip weiter.
- Entscheide selbst (und begründe kurz) was nach Ablauf der 4h passiert, falls weiterhin offline — sinnvoller Default: klare Meldung + Re-Login-Aufforderung sobald wieder online, keine Datenverluste, kein Absturz.
- Prüfe die Konfliktlogik in `js/cloud-sync.js` beim Reconnect: Ich nutze Cloud-Sync auf 2 Geräten teils zeitgleich (Handy im Zug offline + Laptop parallel online). Simples "letzter Schreibvorgang gewinnt" ist NICHT ausreichend. Wenn noch keine Konflikterkennung existiert, bau eine (Zeitstempel-Vergleich pro Datensatz, bei Kollision Nutzer warnen statt still überschreiben).
- Verifiziere im Browser (preview_*-Tools): Login, Netz simulieren/trennen, App bleibt nutzbar, Reconnect synct sauber.

**Feature 2 — Steuerberater Read-Only (nur falls Vorfrage 1 technisch machbar UND Go vom User da ist):**
- Zweiter Whop-Account bekommt Read-Only-Rolle auf denselben Datenbestand, vollen Funktionsumfang sichtbar, alle Schreib-Aktionen/Buttons ausgeblendet.
- Kläre selbst den einfachsten Weg, StB-Account mit genau einem Mandanten zu verknüpfen (z. B. Einladungs-Flow) — halte es so schlank wie möglich, kein Overengineering für hypothetische Multi-Mandanten-Fälle.

Danach: Memory aktualisieren mit dem, was gebaut wurde und was (falls Feature 2 verschoben) noch offen ist.

---

**Modell-Empfehlung:** **Opus 4.8**, nicht Sonnet. Grund: Vorfrage 1 ist eine Architektur-/Security-Entscheidung (E2E-Krypto-Analyse an Finanzdaten eines Steuerberaters), die Konfliktlogik bei parallelem Multi-Device-Edit ist fehleranfällig wenn zu leichtfertig gebaut, und beide Features hängen an mehreren Dateien (whop-auth.js, cloud-sync.js, backup-crypto.js) gleichzeitig. Das ist die Art Aufgabe, bei der Opus' gründlicheres Reasoning den Unterschied macht — Sonnet 5 reicht danach locker für die Nacharbeiten/Politur in Folge-Sessions.
