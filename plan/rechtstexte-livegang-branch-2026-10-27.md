# Branch `claude/rechtstexte-livegang` — Rechtstexte für den Supabase-Livegang

**Vorlage für den Anwalt. Nicht mergen, bevor alle ⟦…⟧ gefüllt und freigegeben sind.**
Die Texte werden erst richtig, wenn die Daten tatsächlich im Klartext bei Supabase liegen —
sie gehen im selben Deploy live wie das Umschalten (Reihenfolge: `plan/entwurf-livegang-rechtstexte-2026-10-27.md` Abschn. 8).

Grundlage: `plan/analyse-compliance-server-2026-10-26.md` (P1–P12), Entwürfe aus
`plan/rechtsaudit-2026-10-24.md` (B2, B4, B5) und `plan/entwurf-livegang-rechtstexte-2026-10-27.md`.

## Geänderte Dateien

| Datei | Was |
|---|---|
| `datenschutz.html` | Kurzfassung; 2.1/2.3 (Server statt lokal, Auftragsverarbeitung); 3 (IndexedDB = Offline-Lesekopie, Sync-Schlüssel gestrichen); 4 neu (Speicherort, Zugriff, Sicherung, Altbestand Cloud-Sync); 4.2 Klartext-Bezug; 4.3 Steuerberater liest Klartext; 4.5 Shopify neu; 5 Sitzungen nur Supabase; 6.1 Prüfliste; 7 AV-Liste (Make neu, Upstash auslaufend, Region Frankfurt) + Nutzer-AVV; 8 Löschung 30 Tage nach Vertragsende |
| `agb.html` | §2 Änderungsmitteilung + § 203 StGB Variante A; §7 neu (Server, Export, 30 Tage, Aufbewahrung beim Nutzer, AVV); §8 Haftung Datenverlust; **Anlage AVV** (Art. 28) |
| `cookies.html` | IndexedDB-Absatz |
| `verfahrensdokumentation.html` | Abschnitte 1, 5, 6 + Änderungshistorie |
| `index.html`, `landing-v2.html` | Werbeaussagen „lokal / Ende-zu-Ende“ ersetzt (§ 5 UWG) |

Seit 2026-10-27 laufen die Vercel-Funktionen nachweislich in `fra1` (Commit 7fa10bd, gemessen per `X-Vercel-Id`) — D1 ist erledigt, die Texte nennen Frankfurt.

## Offene Platzhalter (⟦…⟧, teils als HTML-Kommentar)

- ~~**D2** Backup-Aufbewahrung~~ — erledigt 2026-10-29: Pro-Plan = taegliche Backups, 7 Tage (supabase.com/docs/guides/platform/backups)
- **Neu:** Supabase-Backups enthalten **keine Storage-Objekte** (Belege) — nur die Datenbank. Texte sagen bewusst "Datenbank"; Produktentscheidung, ob Belege eigens gesichert werden (sonst AVV Ziff. 6 praezisieren)
- **Neu:** Postgres-SSL-Erzwingung ist bei Supabase standardmaessig aus (Dashboard → Database → Settings → SSL enforcement) — vor Livegang einschalten, sonst stimmt "TLS beim Transport" nur fuer die HTTP-APIs
- ~~**D4** Make.com: DPA + Region~~ — erledigt 2026-10-28: DPA ist Teil der Make-Vertragsbedingungen (make.com/en/terms-and-conditions), Zone eu1, Vertragspartner Celonis SE (Muenchen)
- ~~**D6** at rest~~ — erledigt 2026-10-29: "All customer data is encrypted at rest with AES-256" (supabase.com/security)
- Frist Altbestand-Löschung (30 Tage?) — DSE 4.1
- AVV: Ankündigungsfrist Unterauftragsverarbeiter, Prüfrecht
- AGB §7 Abs. 3 erst live, wenn Löschung, Lesezugang und Vorwarn-Mail gebaut sind
- Technik nach Umbau prüfen: Offline-Kopie beim Abmelden gelöscht? Sitzungen/Zähler nur Supabase? Fehlerprotokolle weiter Upstash? localStorage-Tabelle in `cookies.html`
- Verfahrensdoku Abschnitt 4 (Hash-Kette) erst mit dem live geschalteten Server-Datenmodell umschreiben; Datum Livegang

## Für den Anwalt ⚖️

AVV-Anlage insgesamt; § 203 StGB (Variante A Ausschluss in §2 ist eingebaut, Variante B wäre AVV Ziff. 11);
Steuerberater als eigener Verantwortlicher (DSE 4.3); Haftung §8 (§ 309 Nr. 7 BGB); AGB-Änderung über §9
(Widerspruchsfrist, wesentliche Leistungsänderung); Aufbewahrungs-Klausel §7 Abs. 4.

## Nicht in diesem Branch

Umzugsdialog und Alt-Sync-Texte in `js/cloud-sync.js`; `compliance/*` (VVT, TIA Supabase/Whop, DSFA,
GoBD-Doku); Bestandskunden-Mail. Entwürfe dazu: `plan/entwurf-livegang-rechtstexte-2026-10-27.md` Abschn. 3–6.
