# F6 — Krypto-Worker: gebaut, Einbau steht aus (2026-08-18)

**Fertig und committet:** [`js/crypto-worker.js`](../js/crypto-worker.js) + 13 Prüfungen in
[`test/test-crypto-worker.js`](../test/test-crypto-worker.js).
**Offen:** die Verdrahtung in `js/cloud-sync.js` — die Datei wurde von einer parallelen Session
gehalten (Firmenumschalter-Fix, 91 uncommittete Zeilen). Deshalb liegt der Einbau hier statt im Code.

---

## Was die Messung ergeben hat — und warum das die Aufgabe ändert

Das Performance-Audit nimmt an, AES-GCM im Main-Thread sei der Hänger. **Gemessen stimmt das
nicht.** Edge/Chromium, Median aus 5 Läufen nach 2 Warmläufen, gegen die *echte* `_b64`-Funktion
aus `cloud-sync.js:209`:

| Artikel | Klartext | `JSON.stringify` | `TextEncoder` | AES-GCM | base64 | gesamt | Krypto-Anteil |
|---|---|---|---|---|---|---|---|
| 2.000 | 1,05 MB | 3,3 ms | 6,8 ms | 4,3 ms | 2,6 ms | 17 ms | 25 % |
| 8.000 | 4,21 MB | 13,6 ms | 23,3 ms | 8,9 ms | 3,0 ms | 49 ms | 18 % |
| 20.000 | 10,55 MB | 52,5 ms | 75,3 ms | 47,7 ms | 15,9 ms | 191 ms | 25 % |

**Wer nur `crypto.subtle` auslagert, verschiebt ein Viertel und lässt drei Viertel liegen.**
Der Worker nimmt deshalb `TextEncoder` + AES-GCM + base64 als Block; im Main-Thread bleibt nur
`JSON.stringify` — der String muss dort entstehen, wo die Daten liegen.

A/B, 20.000 Artikel: **143,8 ms blockiert → 54,3 ms, also 62 % weniger.**

> ⚠️ Diese Zahlen stammen von einem Desktop. Ein schwaches Android-Gerät liegt grob 3–5× darüber;
> der absolute Gewinn wächst also mit. Wer die Messung wiederholt: **Warmlauf nicht weglassen** —
> der erste Lauf war in unseren Messungen bis zu 5× langsamer als der eingeschwungene Zustand und
> hätte zu einer völlig anderen Empfehlung geführt.

## Was schon geprüft ist

Im Browser gegen einen echten `Worker` und in `test/test-crypto-worker.js`:

- Rundlauf encrypt → decrypt.
- **Byte-Kompatibilität:** Worker-Chiffrat lässt sich mit dem bisherigen Main-Thread-Pfad
  entschlüsseln und umgekehrt. Kein Datenbruch beim Umstieg, kein Migrationslauf nötig.
- **`CryptoKey` überlebt `postMessage` und bleibt nicht-extrahierbar** — das ist die Voraussetzung
  dafür, dass Fund R5 gewahrt bleibt. Der Worker sieht die Rohbytes nie.
- AAD-Bindung an (ownerId, scope) bleibt wirksam; falscher Scope und fremder Owner werden abgewiesen.
- Der AAD-Migrations-Fallback greift **nur** mit `allowNoAad`. Das Ablaufdatum (`AAD_FALLBACK_UNTIL`,
  Fund R7) bleibt bewusst im Aufrufer — der Worker kennt kein Datum.
- CSP: `worker-src` ist weder in `vercel.json` noch in den Meta-Tags gesetzt, es greift
  `default-src 'self'`. Ein gleichnamiger Worker von derselben Herkunft ist damit erlaubt,
  **keine CSP-Änderung nötig.**

## Einbau in `js/cloud-sync.js`

Vier Stellen, alle im Krypto-Block ab Zeile ~281:

1. **Worker lazy anlegen**, nicht beim Laden — die meisten Sitzungen synchronisieren nie.
   Ein Modul-Singleton mit `id`-basierter Zuordnung (mehrere Scopes laufen nacheinander).
2. **`_encrypt(obj, scope, ownerId)`** → `JSON.stringify` bleibt hier, der Rest geht an den Worker.
   Rückgabeformat `{ ct, iv }` ist unverändert.
3. **`_decryptCt(ct, ivB64, scope, ownerId, overrideBytes)`** → Worker liefert den **String**,
   `JSON.parse` bleibt im Aufrufer (sonst wandert ein großer Objektgraph durch den strukturierten
   Klon und kostet so viel wie das Parsen selbst). `allowNoAad: Date.now() <= AAD_FALLBACK_UNTIL`
   übergeben.
4. **`_encryptBytes` / `_decryptBytes`** (Blob-Anhänge) können vorerst bleiben — dort ist der
   Klartext bereits ein `Uint8Array`, `stringify` und `TextEncoder` entfallen also, und der
   Gewinn ist entsprechend klein.

**Fallback nicht vergessen:** schlägt `new Worker(...)` fehl (alte Browser, blockierende
Erweiterung), muss der bisherige Inline-Pfad greifen. Die Funktionen bleiben deshalb bestehen und
werden nur *umgangen*, nicht ersetzt.

**Fehlerklassifizierung erhalten:** `_classifyDecryptError` unterscheidet „Schlüssel passt nicht"
von „Chiffrat nicht ladbar". Der Worker gibt `{ ok:false, error }` zurück; der Aufrufer muss daraus
wieder einen `Error` mit derselben `message` machen, sonst landet ein Netzfehler wieder in der
Meldung „Code falsch" — genau der Bug, der einmal behoben wurde.

## Die zweite Hälfte von F6

Der Aufgabenpunkt verlangt neben dem Worker **sichtbare Rückmeldung**: heute sieht der Nutzer
nicht, dass überhaupt etwas läuft. Der Sync-Punkt in der Topnav existiert (`_setDot`), kennt aber
nur `sync` / `ok` / Fehler. Sinnvoll wäre bei mehreren MB ein Fortschritt pro Scope
(„Firma 2 von 3"). Das ist unabhängig vom Worker und kann auch vorher gebaut werden.
