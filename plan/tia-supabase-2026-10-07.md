# Transfer-Folgenabschätzung (TIA) Supabase — ENTWURF

Stand 2026-10-07. Gehört zu F3 in [`rechtstexte-supabase-entwurf.md`](rechtstexte-supabase-entwurf.md).
**Entwurf, keine Rechtsberatung** — vor Ablage vom User (ggf. Anwalt) prüfen lassen.

Warum: Supabase, Inc. ist **nicht** unter dem EU-US Data Privacy Framework zertifiziert
(dataprivacyframework.gov/list, Suche „Supabase“ am 2026-10-07 ohne Treffer; Vercel und Upstash
sind gelistet). Einzige Transfergrundlage sind die SCC (Modul 2/3) im Supabase-DPA (Version 1,
01.08.2026). Für SCC verlangt der EuGH (Schrems II) eine Prüfung im Einzelfall.

## 1. Transfer

| | |
|---|---|
| Exporteur | Stackr (Verantwortlicher, Impressum) |
| Importeur | Supabase, Inc. (USA), Auftragsverarbeiter |
| Speicherort | AWS eu-central-1, Frankfurt; Projekt `usrhhjwvoefjdgrwovkg` |
| Möglicher Drittlandbezug | Fernzugriff durch Supabase-Personal (Betrieb/Support) und Unterauftragsverarbeiter; Herausgabeverlangen von US-Behörden an die US-Gesellschaft (FISA 702, CLOUD Act) |
| Grundlage | Art. 46 Abs. 2 lit. c DSGVO, SCC Modul 2 + 3 |

## 2. Daten (laut Code, siehe Entwurf Abschnitt 0)

- **Sync-Chiffrat, Belege, Anhänge:** Ende-zu-Ende mit AES-GCM verschlüsselt. Der Schlüssel
  entsteht im Browser und erreicht weder Stackr noch Supabase. Für den Importeur ist der Inhalt
  unlesbar.
- **Metadaten im Klartext:** Whop-`user_id`, Zeitstempel, Versionen, Geräte-Kennung, Größen,
  Public Keys und Freigaben (wer gibt wem frei).
- **IP-Adressen:** in Rate-Limit-Zählern, spätestens nach 24 h gelöscht (Migration
  `20261007000002_aufraeumen.sql`), und beim direkten Abruf signierter Beleg-URLs aus dem Browser.
- **Keine** Namen, keine E-Mail-Adressen, keine Buchhaltungsdaten im Klartext.

## 3. Bewertung

- **Inhalte:** Ein Zugriff aus den USA brächte nur Chiffrat. Die Verschlüsselung ist eine
  wirksame zusätzliche Maßnahme im Sinne der EDSA-Empfehlungen 01/2020 (Anwendungsfall 1:
  Speicherung verschlüsselter Daten, Schlüssel nur beim Exporteur bzw. hier beim Nutzer).
- **Metadaten:** Die `user_id` ist ein Pseudonym (Whop-Kennung). Zuordnen lässt sie sich nur mit
  den Daten bei Whop, nicht bei Supabase. Restrisiko: Nutzungsmuster (wann synct wer, wie viel).
  Gering, weil es keine Inhalte und keine Kategorien nach Art. 9 DSGVO sind.
- **IP-Adressen:** kurzlebig, keine Verknüpfung mit Inhalten. Restrisiko gering.
- **Rechtslage USA:** Für DPF-zertifizierte Empfänger hat die EU-Kommission die Garantien nach
  EO 14086 als angemessen anerkannt (Angemessenheitsbeschluss vom 10.07.2023). Diese Garantien
  gelten für US-Behördenzugriffe unabhängig von der DPF-Zertifizierung des Empfängers und stützen
  deshalb auch SCC-Transfers.

**Ergebnis (Vorschlag):** Der Transfer auf SCC-Basis ist mit den bestehenden technischen Maßnahmen
vertretbar. Weitere Maßnahmen sind nicht erforderlich.

Ergänzend: Supabase stellt im Dashboard (Organization → Legal Documents) eine eigene TIA bereit.
Sie gehört mit ins Archiv; diese Bewertung hier deckt die Stackr-spezifischen Maßnahmen ab.

## 4. Wiedervorlage

- Bei Änderung der Datenkategorien, z. B. wenn Klartext zu Supabase gelangt.
- Bei DPF-Zertifizierung von Supabase: Grundlage in DSE Ziffer 7 anpassen.
- Bei Wegfall oder Aufhebung des EU-US-Angemessenheitsbeschlusses.
- Sonst jährlich, nächste Prüfung 10/2027.
