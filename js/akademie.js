// ============================================
// Akademie Module - Lernplattform & Achievements
// ============================================
const Akademie = {
    _activeModule: null,
    _activeLesson: null,

    // ── Lerninhalte (Module + Lektionen) ──────────────────────────────────
    MODULES: [
        {
            id: 'grundlagen',
            icon: '🚀',
            title: 'Grundlagen Reselling',
            description: 'Verstehe das Geschäftsmodell und die rechtlichen Basics.',
            level: 'Einsteiger',
            lessons: [
                {
                    id: 'g1',
                    title: 'Was ist Reselling überhaupt?',
                    duration: '4 min',
                    content: `
                        <p><strong>Reselling</strong> bedeutet: Du kaufst Waren günstig ein (Flohmarkt, Großhändler, Auktion, Privatperson) und verkaufst sie mit Aufschlag weiter. Klassische Plattformen sind Vinted, eBay, Mercari, Depop oder Etsy.</p>
                        <p>Der Unterschied zum Einzelhandel: Du sourcest deine Ware selbst und nutzt deine Kenntnis von Marken, Größen, Modellen oder Trends als Wettbewerbsvorteil.</p>

                        <h4>Drei häufige Modelle</h4>
                        <ul>
                            <li><strong>Thrifting / Vintage</strong> — Secondhand-Kleidung im Flohmarkt/Kilo-Lager kaufen, kuratiert online verkaufen.</li>
                            <li><strong>Sneaker / Limited Drops</strong> — Hyped Releases zum Retailpreis kaufen und mit Aufschlag verkaufen.</li>
                            <li><strong>Großhandels-Reselling</strong> — Bulk-Einkauf bei B2B-Händlern, einzeln verkaufen.</li>
                        </ul>

                        <h4>Was du als Reseller brauchst</h4>
                        <ol>
                            <li>Ein <strong>Auge</strong> für Margen (was lässt sich verkaufen?)</li>
                            <li>Etwas <strong>Startkapital</strong> für Wareneinkauf + Versand</li>
                            <li>Einen <strong>Workflow</strong> für Listing, Versand, Buchhaltung</li>
                            <li>Geduld — Verkäufe brauchen Zeit, Lager bindet Kapital</li>
                        </ol>

                        <div class="akademie-tip">💡 <strong>Realität:</strong> Reselling ist <em>kein</em> passives Einkommen. Du arbeitest für jeden Verkauf — Foto, Listing, Versand, Kundenkommunikation. Aber der Stundenlohn skaliert mit Erfahrung.</div>
                    `
                },
                {
                    id: 'g2',
                    title: 'Hobby oder Gewerbe? Die wichtigste Entscheidung',
                    duration: '6 min',
                    content: `
                        <p>In Deutschland ist <strong>jede regelmäßige Verkaufstätigkeit mit Gewinnerzielungsabsicht</strong> ein Gewerbe — egal ob Vinted-Hobby oder Vollzeit-eBay-Shop.</p>

                        <h4>Indizien für „Gewerbe statt Hobby"</h4>
                        <ul>
                            <li>Regelmäßige Verkäufe (nicht nur einmalige Haushaltsauflösung)</li>
                            <li>Gewinnerzielungsabsicht (du kalkulierst Margen)</li>
                            <li>Einkauf <em>zum Wiederverkauf</em> (nicht nur eigene gebrauchte Sachen)</li>
                            <li>Mehrere gleichartige Artikel (10x dieselbe Jacke = klares Gewerbe)</li>
                        </ul>

                        <h4>Was du tun musst</h4>
                        <ol>
                            <li><strong>Gewerbe anmelden</strong> beim örtlichen Gewerbeamt (Kosten: 20–60€)</li>
                            <li>Steuerlicher Erfassungsbogen vom Finanzamt ausfüllen</li>
                            <li>Entscheidung: <strong>Kleinunternehmer</strong> (§19 UStG) oder <strong>Regelbesteuerung</strong></li>
                            <li>EÜR jährlich abgeben (oder Bilanzierung bei höheren Umsätzen)</li>
                        </ol>

                        <h4>Plattform-Meldepflicht (PStTG / DAC7)</h4>
                        <p>Seit 2023 melden alle Plattformen (Vinted, eBay, etc.) deine Verkaufsdaten ans Finanzamt, wenn du <strong>30+ Verkäufe</strong> oder <strong>2.000€+ Umsatz</strong> pro Jahr erreichst. Das Finanzamt weiß also Bescheid — auch ohne dass du etwas meldest.</p>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Fauler Trick FAIL:</strong> „Ich verkauf einfach unter falschem Namen" — Plattformen melden anhand von IBAN/Adresse. Das wird gefunden. Lieber sauber anmelden + Kleinunternehmer = quasi keine Mehrarbeit.</div>

                        <p style="margin-top:14px;"><strong>→ Nächste Aktion:</strong> Falls noch nicht angemeldet → Gewerbeanmeldung googlen. Falls angemeldet → die nächste Lektion: EÜR-Grundlagen.</p>
                    `
                },
                {
                    id: 'g3',
                    title: 'Plattformen im Vergleich',
                    duration: '5 min',
                    content: `
                        <p>Welche Plattform passt zu dir? Hier die wichtigsten im Vergleich:</p>

                        <h4>Vinted</h4>
                        <ul>
                            <li>Kleidung, Schuhe, Accessoires</li>
                            <li>Käufer zahlt „Käuferschutzgebühr" — du bekommst praktisch den vollen Preis</li>
                            <li>Massenmarkt, viele Suchende, Preise eher niedrig</li>
                            <li>Ideal für Volumen-Vertrieb von Vintage/Markenkleidung</li>
                        </ul>

                        <h4>eBay</h4>
                        <ul>
                            <li>Alles verkaufbar — Auktion oder Festpreis</li>
                            <li>~10–13% Verkaufsprovision + PayPal-Gebühr</li>
                            <li>Internationale Reichweite, Sammler-Markt</li>
                            <li>Ideal für seltene Stücke, Sammlerartikel, Elektronik</li>
                        </ul>

                        <h4>Mercari / Depop / Grailed</h4>
                        <ul>
                            <li><strong>Mercari</strong>: Massenmarkt USA, in DE schwächer</li>
                            <li><strong>Depop</strong>: junges Publikum, Streetwear/Y2K</li>
                            <li><strong>Grailed</strong>: Premium-Streetwear/Designer, höhere Preise</li>
                        </ul>

                        <h4>Etsy</h4>
                        <ul>
                            <li>Vintage (20+ Jahre alt) und Handgemachtes</li>
                            <li>Premium-Preise, kuratierter Markt</li>
                        </ul>

                        <h4>Whatnot</h4>
                        <ul>
                            <li>Live-Auctions per Video-Stream</li>
                            <li>Stark wachsend, hohes Engagement-Potenzial</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>Strategie für Anfänger:</strong> Starte mit <strong>einer</strong> Plattform und beherrsche sie, bevor du crosslisten anfängst. Vinted ist der einfachste Einstieg für Kleidung.</div>
                    `
                }
            ]
        },
        {
            id: 'einkauf',
            icon: '🛒',
            title: 'Einkauf & Kalkulation',
            description: 'Was darfst du zahlen? Wie findest du Ware? Margen verstehen.',
            level: 'Einsteiger',
            lessons: [
                {
                    id: 'e1',
                    title: 'Die 3x-Regel: Wie kalkuliere ich Einkaufspreise?',
                    duration: '5 min',
                    content: `
                        <p>Eine bewährte Faustformel im Reselling: <strong>Verkaufspreis = 3× Einkaufspreis</strong>.</p>

                        <h4>Warum das Sinn macht</h4>
                        <p>Von deinem Verkaufspreis gehen ab:</p>
                        <ul>
                            <li>Plattform-Gebühr: ~5–13%</li>
                            <li>Versandkosten (selbst getragen): teilweise</li>
                            <li>Verpackung: 0,30–1€ pro Paket</li>
                            <li>Steuer (bei Regelbesteuerung): 19% MwSt oder Differenzbesteuerung</li>
                            <li>Deine Arbeitszeit: Foto, Listing, Versand, Antworten</li>
                        </ul>

                        <p>Beispiel mit 3×-Regel:</p>
                        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:10px 0;">
                            <tr><td>Einkaufspreis</td><td style="text-align:right;">10,00 €</td></tr>
                            <tr><td>Verkaufspreis (3×)</td><td style="text-align:right;">30,00 €</td></tr>
                            <tr style="color:var(--text-muted);"><td>− Plattform-Gebühr (5%)</td><td style="text-align:right;">−1,50 €</td></tr>
                            <tr style="color:var(--text-muted);"><td>− Versand-Anteil (geschätzt)</td><td style="text-align:right;">−2,00 €</td></tr>
                            <tr style="color:var(--text-muted);"><td>− Verpackung</td><td style="text-align:right;">−0,50 €</td></tr>
                            <tr style="color:var(--text-muted);"><td>− Einkauf</td><td style="text-align:right;">−10,00 €</td></tr>
                            <tr style="font-weight:700;border-top:2px solid var(--border);"><td>Gewinn netto</td><td style="text-align:right;color:var(--success);">≈ 16,00 €</td></tr>
                        </table>

                        <h4>Wann die Regel <em>nicht</em> stimmt</h4>
                        <ul>
                            <li><strong>Bei niedrigen Stückpreisen</strong> (z.B. 2€ EK) → fix-Kosten dominieren, brauchst eher 5×</li>
                            <li><strong>Bei Hype-Items</strong> (Sneaker-Drops) → 1,5–2× ist oft schon profitabel</li>
                            <li><strong>Bei Premium-Marken</strong> (Designer) → mehr als 3× möglich</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>Praxis-Tipp:</strong> Trag dein Bauchgefühl <em>vor</em> dem Einkauf in einen Rechner ein. Diese App zeigt dir live die Marge — nutze die Gewinn-Vorschau im Buchungen-Tab!</div>

                        <p style="margin-top:14px;">→ <strong>Probier es jetzt:</strong> Lege einen Test-Artikel im Lager an, erstelle einen Probe-Verkauf und schau dir die Gewinn-Vorschau an.</p>
                    `
                },
                {
                    id: 'e2',
                    title: 'Wo finde ich profitable Ware?',
                    duration: '7 min',
                    content: `
                        <p>Das Sourcing entscheidet alles. Hier die wichtigsten Quellen:</p>

                        <h4>Online-Quellen</h4>
                        <ul>
                            <li><strong>Vinted Schnäppchen-Suche</strong> — Filter „Sortiert nach Datum", schnell zuschlagen</li>
                            <li><strong>eBay Kleinanzeigen / Kleinanzeigen.de</strong> — lokal abholen, oft Schnäppchen</li>
                            <li><strong>Auktionsseiten</strong> — Aktionhaus.de, Catawiki</li>
                            <li><strong>Restposten-Großhändler</strong> — restposten.de, B-Stock</li>
                        </ul>

                        <h4>Offline-Quellen</h4>
                        <ul>
                            <li><strong>Flohmärkte</strong> — am frühen Samstag-Morgen, vor 8 Uhr</li>
                            <li><strong>Sozialkaufhaus / Kilo-Lager</strong> — z.B. Rotes Kreuz, Caritas, FairKauf</li>
                            <li><strong>Haushaltsauflösungen</strong> — über Bestattungsunternehmen oder Anzeigen</li>
                            <li><strong>Kleiderkammer / Tauschmärkte</strong></li>
                        </ul>

                        <h4>Bewertung vor dem Kauf — die Pre-Check-Routine</h4>
                        <ol>
                            <li><strong>Marken-Check</strong>: Schnell auf Vinted/eBay den Verkaufspreis recherchieren</li>
                            <li><strong>Zustand</strong>: Flecken, Risse, Geruch — kompromisslos prüfen</li>
                            <li><strong>Größe</strong>: gängige Größen (M, L, 38–42) verkaufen sich besser</li>
                            <li><strong>Saisonalität</strong>: Daunenjacke im Sommer kaufen → Winter verkaufen</li>
                        </ol>

                        <h4>Was du <em>nicht</em> kaufen solltest</h4>
                        <ul>
                            <li>Pilling, kaputte Reißverschlüsse, fehlende Knöpfe (Reparaturkosten frisst Marge)</li>
                            <li>No-Name-Marken (kein Suchvolumen)</li>
                            <li>Untypische Größen (XS, XXXL) — schwer zu drehen</li>
                            <li>Saisonal-Falsche Sachen wenn dein Lager voll ist</li>
                        </ul>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Steuer-Hinweis:</strong> Jeder Einkauf ist ein <strong>Wareneinkauf</strong> für deine EÜR. Belege oder Quittungen sammeln! Bei Privatkäufen ohne Beleg → Eigenbeleg erstellen (in dieser App: Tab „Eigenbelege").</div>
                    `
                }
            ]
        },
        {
            id: 'steuer',
            icon: '📊',
            title: 'Buchhaltung & Steuer (DE)',
            description: 'EÜR, Kleinunternehmer, GoBD — die deutschen Steuerregeln verstehen.',
            level: 'Fortgeschritten',
            lessons: [
                {
                    id: 's1',
                    title: 'Kleinunternehmer (§19 UStG) — Vor- und Nachteile',
                    duration: '6 min',
                    content: `
                        <p>Die <strong>Kleinunternehmer-Regelung</strong> ist die einfachste Form der Selbstständigkeit für Reseller. Du musst <em>keine</em> Umsatzsteuer auf deinen Rechnungen ausweisen, aber kannst auch keine Vorsteuer ziehen.</p>

                        <h4>Voraussetzungen (Stand 2026)</h4>
                        <ul>
                            <li>Vorjahresumsatz unter <strong>25.000 €</strong></li>
                            <li>Erwarteter Umsatz im laufenden Jahr unter <strong>100.000 €</strong></li>
                        </ul>

                        <h4>Vorteile</h4>
                        <ul>
                            <li>Keine USt-Voranmeldungen</li>
                            <li>Einfachere Buchhaltung</li>
                            <li>Endkunden bezahlen nicht 19% MwSt extra</li>
                            <li>EÜR statt Bilanzierung</li>
                        </ul>

                        <h4>Nachteile</h4>
                        <ul>
                            <li>Keine Vorsteuer-Erstattung (Wareneinkauf, Verpackung etc.)</li>
                            <li>Bei Geschäftskunden wirkt es „klein" — manche bevorzugen MwSt-Rechnungen</li>
                            <li>Bei Wachstum musst du irgendwann wechseln</li>
                        </ul>

                        <h4>Wann lohnt sich die Regelbesteuerung?</h4>
                        <p>Wenn dein <strong>Vorsteuer-Volumen hoch</strong> ist (viel Wareneinkauf mit MwSt-Belegen, viele Plattformgebühren mit MwSt) UND deine Kunden Geschäftskunden sind, kann Regelbesteuerung lukrativer sein.</p>
                        <p>Für 95% der Reseller im Hobby-/Nebenberuflich-Modus = Kleinunternehmer ist optimal.</p>

                        <div class="akademie-tip">💡 <strong>App-Tipp:</strong> Du kannst in den App-Einstellungen zwischen Kleinunternehmer und Regelbesteuerung umschalten. Die EÜR passt sich automatisch an.</div>

                        <h4>Wichtig: Differenzbesteuerung (§25a UStG)</h4>
                        <p>Bei <strong>Regelbesteuerung</strong> kannst du als Wiederverkäufer die Differenzbesteuerung anwenden: USt nur auf die <em>Marge</em> (Verkauf − Einkauf), nicht auf den Brutto-Verkaufspreis. Das spart bares Geld!</p>
                    `
                },
                {
                    id: 's2',
                    title: 'EÜR — Einnahmen-Überschuss-Rechnung verstehen',
                    duration: '6 min',
                    content: `
                        <p>Die EÜR ist deine Gewinnermittlung. Vereinfacht: <strong>Einnahmen − Ausgaben = Gewinn</strong>.</p>

                        <h4>Was zählt als Einnahme?</h4>
                        <ul>
                            <li>Bruttoerlöse aus Verkäufen (Verkaufspreis + Versand vom Käufer)</li>
                            <li>Privatentnahmen aus Warenbestand</li>
                            <li>Erstattungen, Storno-Erstattungen</li>
                        </ul>

                        <h4>Was zählt als Ausgabe?</h4>
                        <ul>
                            <li><strong>Wareneinkauf</strong> (auch nicht-verkaufte Ware!)</li>
                            <li><strong>Versandkosten</strong> die du selbst trägst</li>
                            <li><strong>Plattform-Gebühren</strong></li>
                            <li><strong>Verpackungsmaterial</strong></li>
                            <li><strong>Büromaterial / Drucker</strong></li>
                            <li><strong>Anteilige Telefon-/Internetkosten</strong></li>
                            <li><strong>Fahrtkosten</strong> (zu Flohmärkten, Post — über Fahrtenbuch)</li>
                            <li>Software-Lizenzen, Bürozimmer (anteilig), etc.</li>
                        </ul>

                        <h4>Wichtig: Wareneinkauf ≠ verkaufte Ware</h4>
                        <p>Auch Ware die <em>noch im Lager liegt</em> ist Wareneinkauf in dem Jahr in dem du sie gekauft hast! Das senkt deinen Gewinn — aber bedeutet auch: Beim Verkauf später hast du den Einkaufspreis schon abgeschrieben.</p>
                        <p>Im EÜR-Modus dieser App wird das automatisch korrekt behandelt: Einkauf wirkt sofort als Ausgabe, Verkauf wirkt als Einnahme.</p>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>GoBD-Pflicht:</strong> Du musst <strong>jeden</strong> Einkauf und Verkauf belegen können. Plattform-Auszüge, Banktransaktionen, Quittungen, Eigenbelege bei Privatkäufen sind Buchungsbelege — nach § 147 AO 8 Jahre aufheben.</div>

                        <p style="margin-top:14px;">→ <strong>Probier's aus:</strong> Öffne den EÜR-Tab und schau dir an wie sich deine bisherigen Einkäufe + Verkäufe automatisch zur EÜR aggregieren.</p>
                    `
                }
            ]
        },

        // ── MODUL 4: Listing & Verkauf optimieren ─────────────────────
        {
            id: 'listing',
            icon: '📸',
            title: 'Listing & Verkauf optimieren',
            description: 'Fotos, Titel, Preise — wie deine Listings sich von der Masse abheben.',
            level: 'Fortgeschritten',
            lessons: [
                {
                    id: 'l1',
                    title: 'Fotos die wirklich verkaufen',
                    duration: '5 min',
                    content: `
                        <p>Das <strong>Foto entscheidet ob jemand klickt</strong> — alles andere kommt danach. 80% der Käufer scrollen erst durch die Bilder, bevor sie den Titel lesen.</p>

                        <h4>Die 5 Pflicht-Aufnahmen</h4>
                        <ol>
                            <li><strong>Hauptbild</strong>: Vorderseite, mittig, voll im Frame</li>
                            <li><strong>Rückseite</strong>: ja, immer — Käufer schauen genau hin</li>
                            <li><strong>Detail</strong>: Verschluss, Knopf, Stickerei, Material-Nahaufnahme</li>
                            <li><strong>Label</strong>: Marke, Größe, Pflegehinweise — beweist Echtheit</li>
                            <li><strong>Mängel</strong> (falls vorhanden): ehrliche Nahaufnahme</li>
                        </ol>

                        <h4>Setup-Empfehlung</h4>
                        <ul>
                            <li><strong>Tageslicht</strong> > Studiolampe — Fenster mit Vorhang als Diffusor</li>
                            <li><strong>Hintergrund</strong>: weiße Wand, Bügelbrett, Holzboden — neutral & sauber</li>
                            <li><strong>Smartphone reicht</strong> — die Kamera ist nicht der Engpass, das Licht ist es</li>
                            <li><strong>Tisch oder Bügel</strong>: Kleidung flach legen oder aufhängen — nie zerknittert</li>
                        </ul>

                        <h4>Häufige Fehler</h4>
                        <ul>
                            <li>Schwacher Kontrast (graue Kleidung auf grauer Decke)</li>
                            <li>Schatten quer übers Stück</li>
                            <li>Selfie-Spiegel-Foto (wirkt unprofessionell)</li>
                            <li>Filter / starke Bearbeitung — Käufer fühlen sich getäuscht</li>
                            <li>Fehlende Größenreferenz bei Hosen/Jacken</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>Profi-Trick:</strong> Mach 1× ein perfektes Foto-Setup (Bügelbrett ans Fenster, gleicher Winkel) und nutze es immer wieder. Spart dir 80% der Foto-Zeit pro Artikel.</div>

                        <p style="margin-top:14px;">→ Im Lager-Tab kannst du zu jedem Artikel ein Foto hochladen. Wird automatisch auf 800px komprimiert.</p>
                    `
                },
                {
                    id: 'l2',
                    title: 'Titel mit Suchmaschinen-Logik',
                    duration: '4 min',
                    content: `
                        <p>Der Titel ist <strong>SEO für Plattformen</strong>. Käufer suchen mit konkreten Wörtern — wenn dein Titel die nicht enthält, wirst du nie gefunden.</p>

                        <h4>Die richtige Reihenfolge</h4>
                        <p><strong>Marke → Modell/Linie → Geschlecht → Typ → Farbe → Größe → Eigenschaften</strong></p>

                        <h4>Beispiele</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <tr style="background:rgba(239,68,68,.08);"><td style="padding:6px 10px;">❌ Schlecht</td><td style="padding:6px 10px;">„Schöne Jeans bequem"</td></tr>
                            <tr style="background:rgba(34,197,94,.08);"><td style="padding:6px 10px;">✅ Gut</td><td style="padding:6px 10px;">„Levi's 501 Herren Bootcut Jeans dunkelblau W32 L34"</td></tr>
                            <tr style="background:rgba(239,68,68,.08);"><td style="padding:6px 10px;">❌ Schlecht</td><td style="padding:6px 10px;">„Süßes Top 🌸✨"</td></tr>
                            <tr style="background:rgba(34,197,94,.08);"><td style="padding:6px 10px;">✅ Gut</td><td style="padding:6px 10px;">„Zara Crop Top Damen weiß S Y2K Vintage"</td></tr>
                        </table>

                        <h4>Käufer-Vokabular nutzen</h4>
                        <p>Denke wie der Käufer: Was würde <em>er</em> in die Suchleiste tippen? Trends als Keywords einbauen:</p>
                        <ul>
                            <li>„Y2K" / „Vintage" / „Streetwear" / „Cottagecore" / „Oversize"</li>
                            <li>„Casual" / „Business" / „Retro" / „Boho"</li>
                            <li>Material wenn relevant: „Leinen", „Kaschmir", „Echtleder"</li>
                        </ul>

                        <h4>Anti-Pattern (verbrennt Suchplätze)</h4>
                        <ul>
                            <li>Emojis statt Keywords</li>
                            <li>"NEU NEU NEU" / "MUSS WEG" / Großbuchstaben</li>
                            <li>Zu generische Worte ("schön", "süß", "cool")</li>
                            <li>Marken-Erfindungen (verbietet die Plattform meist)</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>Test:</strong> Gib deinen Titel selbst in die Vinted-Suche ein. Findest du dein Listing in den ersten 20 Treffern? Wenn nein → Titel überarbeiten.</div>
                    `
                },
                {
                    id: 'l3',
                    title: 'Beschreibungen die Vertrauen aufbauen',
                    duration: '4 min',
                    content: `
                        <p>Wer eine gute Beschreibung schreibt, verkauft zu höheren Preisen — weil <strong>Käufer keine Angst</strong> vor Überraschungen haben.</p>

                        <h4>Die Pflicht-Felder</h4>
                        <ul>
                            <li><strong>Maße</strong> — Brustweite (Achsel zu Achsel), Länge, Schulterbreite, Bundweite, Schrittlänge. Direkte Nachfragen vermeiden.</li>
                            <li><strong>Material</strong> — laut Etikett, oder „lt. Etikett 100% Baumwolle"</li>
                            <li><strong>Zustand</strong> — präzise: „Neu mit Etikett" / „Sehr guter Zustand, einmal getragen" / „Getragen, kleine Pillings am Saum"</li>
                            <li><strong>Mängel</strong> — IMMER ehrlich nennen, mit Foto-Verweis</li>
                            <li><strong>Trage- / Pflegehinweise</strong> — „bei 30° waschen" / „nicht trockenergeeignet"</li>
                        </ul>

                        <h4>Vertrauens-Booster</h4>
                        <ul>
                            <li>„Aus rauchfreiem Haushalt" / „Tierfrei"</li>
                            <li>„Versand am gleichen Tag wenn vor 14 Uhr bezahlt"</li>
                            <li>„Bei Fragen gerne PN" — signalisiert Verfügbarkeit</li>
                            <li>Ehrliche Hinweise wie „Knopf hat minimalen Kratzer (siehe Foto 4)"</li>
                        </ul>

                        <h4>Struktur-Vorlage</h4>
                        <pre style="background:var(--bg-secondary);padding:10px;border-radius:6px;font-size:12px;line-height:1.5;white-space:pre-wrap;">
✨ [Kurzer Aufhänger / USP, z.B. „Klassische Levi's 501 in seltenem Washing"]

📏 Maße:
- Bundweite: XX cm
- Schrittlänge: XX cm
- Gesamtlänge: XX cm

🧵 Material: 100% Baumwolle (lt. Etikett)
🧺 Zustand: Sehr gut — einmal getragen, gewaschen
⚠️ Hinweise: [falls relevant]

📦 Versand am Werktag nach Zahlungseingang.
🚭 Aus rauchfreiem & tierfreiem Haushalt.
💬 Bei Fragen gerne anschreiben!</pre>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Achtung:</strong> Ungenaue oder geschönte Beschreibungen führen zu Retouren — und Retouren kosten mehr als ein paar zusätzliche Sätze.</div>
                    `
                },
                {
                    id: 'l4',
                    title: 'Preisstrategien für Reseller',
                    duration: '5 min',
                    content: `
                        <p>Der Preis bestimmt, wie schnell du verkaufst — aber auch, wieviel du verdienst. Hier die wichtigsten Strategien.</p>

                        <h4>1. Der „Sweet Spot"</h4>
                        <p>Recherchiere bei <strong>aktiven Listings</strong> (nicht bei verkauften!), zu welchen Preisen ähnliche Stücke aktuell stehen. Setze dich <strong>5–10% unter</strong> dem Median. Beispiel: Vergleichbare Jeans bei 25€, 28€, 30€, 32€ → dein Preis: ~24,90€.</p>

                        <h4>2. Anchor Pricing (psychologisch)</h4>
                        <ul>
                            <li>Nicht <strong>20€</strong> sondern <strong>19,50€</strong> oder <strong>19€</strong></li>
                            <li>Bei „Verhandelbar"-Plattformen: 10–15% Puffer einrechnen</li>
                            <li>Hochpreisig: Round-Numbers (199€, 249€) wirken seriöser als 198,99€</li>
                        </ul>

                        <h4>3. Bundle-Strategie</h4>
                        <p>Käufer der bereits <em>ein</em> Stück gekauft hat = warmer Lead. Biete proaktiv Pakete an:</p>
                        <ul>
                            <li>„3 für 2" auf Basics (Shirts, Tops)</li>
                            <li>„−15% bei 3+ Artikeln aus meinem Shop"</li>
                            <li>In Vinted: Paket-Verkauf-Funktion nutzen — du sparst Versand</li>
                        </ul>

                        <h4>4. Wann Preis senken?</h4>
                        <ul>
                            <li><strong>Nach 14 Tagen</strong> ohne „Gefällt mir": Listing aktualisieren (Foto, Titel) UND Preis −10%</li>
                            <li><strong>Nach 30 Tagen</strong>: weitere −10% oder Bundle</li>
                            <li><strong>Nach 60 Tagen</strong>: Aggressiv runter (−25%) oder Lager neu fotografieren</li>
                            <li><strong>Saisonende</strong>: Winter-Sachen im Frühling −30%, Sommerware im Herbst</li>
                        </ul>

                        <h4>5. Sale-Events nutzen</h4>
                        <p>Vinted/eBay haben oft eigene Aktionen — **piggyback** drauf:</p>
                        <ul>
                            <li>Black Friday / Cyber Monday</li>
                            <li>Vinted „Hot Days"</li>
                            <li>Saisonwechsel (Februar, August)</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>App-Tipp:</strong> Im Lager filtere nach „Verfügbar" + Sortierung „Älteste zuerst" → sofort siehst du welche Artikel preisreduziert werden sollten.</div>
                    `
                }
            ]
        },

        // ── MODUL 5: Mindset & Unternehmertum ────────────────────────
        {
            id: 'mindset',
            icon: '🧠',
            title: 'Mindset & Unternehmertum',
            description: 'Vom Hobby zum Business. Routinen, Ziele und langfristiges Denken.',
            level: 'Einsteiger',
            lessons: [
                {
                    id: 'm1',
                    title: 'Vom Hobby zum Business — der mentale Switch',
                    duration: '4 min',
                    content: `
                        <p>Reselling als Hobby = du verkaufst sporadisch, schaust nicht so genau auf die Zahlen, machst es „nebenher". Reselling als Business = du <strong>denkst wie ein Unternehmer</strong>, auch wenn du nur 10 Stunden pro Woche reinsteckst.</p>

                        <h4>Was sich konkret ändert</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:6px;">Hobby</th><th style="text-align:left;padding:6px;">Business</th></tr></thead>
                            <tr><td style="padding:6px;">„Hat Spaß gemacht"</td><td style="padding:6px;">„Marge war nur 22% — zu wenig"</td></tr>
                            <tr><td style="padding:6px;">Quittungen verlegt</td><td style="padding:6px;">Belege digital archiviert</td></tr>
                            <tr><td style="padding:6px;">Privat-Konto vermischt</td><td style="padding:6px;">Eigenes Geschäftskonto</td></tr>
                            <tr><td style="padding:6px;">„Ich verkauf mal wenn Zeit ist"</td><td style="padding:6px;">Festgesetzte Listing-Tage</td></tr>
                            <tr><td style="padding:6px;">Bauchgefühl-Pricing</td><td style="padding:6px;">Datenbasierte Preise</td></tr>
                        </table>

                        <h4>Drei Prinzipien für den Switch</h4>
                        <ol>
                            <li><strong>Trennung</strong> — eigenes Konto, eigene Adresse für Pakete, eigene Lager-Ecke. Nichts vermischt sich mit „privat".</li>
                            <li><strong>Konsistenz statt Sprints</strong> — 5 Listings/Tag täglich schlägt 50 Listings einmal/Woche. Auch wenn du müde bist.</li>
                            <li><strong>Lange Sicht</strong> — Reseller-Reputation, Lagerwert, Steuerhistorie wachsen über Jahre. Eile bringt nichts.</li>
                        </ol>

                        <div class="akademie-tip">💡 <strong>Realität:</strong> Die meisten geben nach 3–6 Monaten auf. Wer durchhält und konsequent dokumentiert, baut nach 12 Monaten ein echtes Nebeneinkommen auf.</div>
                    `
                },
                {
                    id: 'm2',
                    title: 'Ziele setzen wie ein Unternehmer',
                    duration: '5 min',
                    content: `
                        <p>Ohne Ziele drehst du im Kreis. Mit Zielen weißt du, ob ein Monat „gut" oder „schlecht" war — und kannst gezielt reagieren.</p>

                        <h4>Die SMART-Methode für Reseller</h4>
                        <p>Jedes Ziel sollte sein: <strong>S</strong>pezifisch, <strong>M</strong>essbar, <strong>A</strong>ttraktiv, <strong>R</strong>ealistisch, <strong>T</strong>erminiert.</p>

                        <h4>Beispiele</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <tr style="background:rgba(239,68,68,.08);"><td style="padding:6px;">❌ „Mehr verkaufen"</td></tr>
                            <tr style="background:rgba(34,197,94,.08);"><td style="padding:6px;">✅ „30 Verkäufe + 600€ Umsatz im Mai"</td></tr>
                            <tr style="background:rgba(239,68,68,.08);"><td style="padding:6px;">❌ „Lager aufräumen"</td></tr>
                            <tr style="background:rgba(34,197,94,.08);"><td style="padding:6px;">✅ „Bis 31.5. alle Artikel >90 Tage neu fotografieren oder ausmustern"</td></tr>
                            <tr style="background:rgba(239,68,68,.08);"><td style="padding:6px;">❌ „Weniger Steuer-Stress"</td></tr>
                            <tr style="background:rgba(34,197,94,.08);"><td style="padding:6px;">✅ „Bis 30.6. EÜR fürs Vorjahr ans Finanzamt"</td></tr>
                        </table>

                        <h4>Drei Ziel-Ebenen</h4>
                        <ol>
                            <li><strong>Jahresziel</strong> (1×): „2026 = 8.000€ Umsatz, 30% Marge, 1× Gewerbeanmeldung erweitert"</li>
                            <li><strong>Quartalsziele</strong> (4×): konkrete Meilensteine</li>
                            <li><strong>Wochenziele</strong> (52×): „Diese Woche: 15 neue Listings, 3 Bulk-Einkauf-Bewertungen"</li>
                        </ol>

                        <h4>Reflexion-Routine (10 Min/Woche)</h4>
                        <ul>
                            <li>Sonntag-Abend: Zahlen vom Wochenende checken</li>
                            <li>Was lief gut? Was hakt?</li>
                            <li>1 konkrete Anpassung für nächste Woche</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>App-Tipp:</strong> Das Achievement-System der Akademie spiegelt Meilensteine — nutze es als Motivations-Anker. Die Statistiken-Seite zeigt deine Trends.</div>
                    `
                },
                {
                    id: 'm3',
                    title: 'Routinen, die dich konsistent halten',
                    duration: '4 min',
                    content: `
                        <p>Die meisten Reseller arbeiten in Sprints — und brennen aus. Die erfolgreichen haben <strong>feste Routinen</strong>, die auch laufen wenn die Motivation gerade niedrig ist.</p>

                        <h4>Die Wochen-Routine eines Vollzeit-Resellers</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <tr><td style="padding:6px;font-weight:700;">Montag</td><td style="padding:6px;">Nachrichten beantworten · Versand vorbereiten</td></tr>
                            <tr><td style="padding:6px;font-weight:700;">Dienstag</td><td style="padding:6px;">Fotografieren · Listings vorbereiten</td></tr>
                            <tr><td style="padding:6px;font-weight:700;">Mittwoch</td><td style="padding:6px;">Listing-Day: alle vorbereiteten Stücke einstellen</td></tr>
                            <tr><td style="padding:6px;font-weight:700;">Donnerstag</td><td style="padding:6px;">Lagerpflege · alte Listings refreshen</td></tr>
                            <tr><td style="padding:6px;font-weight:700;">Freitag</td><td style="padding:6px;">Sourcing-Recherche · Bulk-Anbieter checken</td></tr>
                            <tr><td style="padding:6px;font-weight:700;">Samstag</td><td style="padding:6px;">Sourcing in der Stadt (Flohmarkt früh!)</td></tr>
                            <tr><td style="padding:6px;font-weight:700;">Sonntag</td><td style="padding:6px;">Buchhaltung · Wochen-Review · Pause</td></tr>
                        </table>

                        <h4>Der Nebenberufs-Tagesplan (1–2h/Tag)</h4>
                        <ul>
                            <li><strong>Morgens (15 Min)</strong>: Bestellungen prüfen, Nachrichten beantworten</li>
                            <li><strong>Mittagspause (15 Min)</strong>: 1–2 Listings refreshen / Preise anpassen</li>
                            <li><strong>Abends (45–60 Min)</strong>: Fotografieren ODER Listings einstellen ODER Versand</li>
                        </ul>

                        <h4>Das Versand-Ritual</h4>
                        <p>Pakete <strong>nicht</strong> einzeln zur Post. Sammle 3–7 Stück und mach es 1–2× pro Woche zur festen Zeit. Spart Stunden.</p>

                        <h4>Die Nicht-Verhandelbaren</h4>
                        <ol>
                            <li><strong>Buchhaltung wöchentlich</strong>, nicht monatlich (sonst wird's Berg)</li>
                            <li><strong>Backup wöchentlich</strong> — Lager-Daten sind Gold wert</li>
                            <li><strong>1× pro Quartal</strong>: Ladenhüter-Aktion (alles >90 Tage durchgehen)</li>
                        </ol>

                        <div class="akademie-tip">💡 <strong>Profi:</strong> Schreib deine Routine auf einen Zettel und häng ihn ans Lager. Auch nach 12 Monaten brauchst du den Reminder.</div>
                    `
                },
                {
                    id: 'm4',
                    title: 'Mit Verlust-Monaten umgehen',
                    duration: '5 min',
                    content: `
                        <p>Du wirst Verlust-Monate haben. <em>Jeder</em> Reseller hat sie. Die Frage ist: wie gehst du damit um?</p>

                        <h4>Saisonalität ist normal</h4>
                        <ul>
                            <li><strong>Januar–Februar</strong>: schwach (Käufer haben kein Geld nach Weihnachten)</li>
                            <li><strong>März–Juni</strong>: stabil bis stark</li>
                            <li><strong>Juli–August</strong>: Sommerloch, vor allem für Wintersachen</li>
                            <li><strong>September–Oktober</strong>: stark (Schulanfang, Herbstmode)</li>
                            <li><strong>November–Dezember</strong>: Peak (Black Friday + Geschenke)</li>
                        </ul>

                        <h4>Was du NICHT tun solltest im Verlust-Monat</h4>
                        <ul>
                            <li>❌ Panikartig alle Preise senken — frisst die Marge auch in besseren Monaten</li>
                            <li>❌ Aufhören zu listen — stoppt deinen Algorithmus-Score</li>
                            <li>❌ Privates Geld nachschießen — Cash-Reserve ist da, nutze sie nüchtern</li>
                            <li>❌ Aufgeben — die meisten Erfolgreichen haben einen Verlust-Monat <em>überstanden</em></li>
                        </ul>

                        <h4>Was du tun solltest</h4>
                        <ol>
                            <li><strong>Daten analysieren</strong> — ist es wirklich saisonal? Vergleiche mit Vorjahr.</li>
                            <li><strong>Bestand bewerten</strong> — Ladenhüter identifizieren, ggf. Bundle-Aktion</li>
                            <li><strong>Reinvestieren in Sourcing</strong> — guter Zeitpunkt für günstige Wintersachen im Sommer</li>
                            <li><strong>Listings optimieren</strong> — neue Fotos, bessere Titel</li>
                            <li><strong>Cash-Reserve schützen</strong> — 2–3 Monate fixe Kosten als Polster</li>
                        </ol>

                        <h4>Die psychologische Komponente</h4>
                        <p>Jeder Unternehmer kennt das Tal. Wichtig: <strong>nicht emotional handeln</strong>. Schreib deine Strategie für schwache Monate VOR dem ersten Verlust auf. Wenn der Moment kommt, hast du einen Plan, statt panisch zu reagieren.</p>

                        <div class="akademie-tip">💡 <strong>Resilience-Hack:</strong> Führe eine „Wins"-Liste — schreib jede Woche 3 kleine Erfolge auf. In schwachen Monaten lesen = Realitäts-Check, dass es nicht alles schlecht läuft.</div>
                    `
                }
            ]
        },

        // ── MODUL 6: Steuer für Profis (DE) ──────────────────────────
        {
            id: 'steuerprofi',
            icon: '💼',
            title: 'Steuer für Profis (DE)',
            description: 'Differenzbesteuerung, PStTG/DAC7, Wechsel zur Regelbesteuerung — fortgeschrittene Themen.',
            level: 'Profi',
            lessons: [
                {
                    id: 'sp1',
                    title: 'Differenzbesteuerung §25a UStG — die Geheimwaffe',
                    duration: '7 min',
                    content: `
                        <p>Wenn du <strong>regelbesteuert</strong> bist und <strong>von Privatpersonen einkaufst</strong> (Vinted, Flohmarkt, Kleinanzeigen) ist die Differenzbesteuerung dein Profit-Booster.</p>

                        <h4>Was ist das?</h4>
                        <p>Statt Umsatzsteuer auf den <em>vollen Verkaufspreis</em> zahlst du USt nur auf die <strong>Marge</strong> (Verkauf − Einkauf).</p>

                        <h4>Beispiel-Rechnung</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <thead><tr style="border-bottom:1px solid var(--border);"><th style="padding:6px;text-align:left;"></th><th style="text-align:right;padding:6px;">Regelbest.</th><th style="text-align:right;padding:6px;">Differenzbest.</th></tr></thead>
                            <tr><td style="padding:6px;">Einkauf von Privat</td><td style="text-align:right;padding:6px;">10 €</td><td style="text-align:right;padding:6px;">10 €</td></tr>
                            <tr><td style="padding:6px;">Verkauf brutto</td><td style="text-align:right;padding:6px;">30 €</td><td style="text-align:right;padding:6px;">30 €</td></tr>
                            <tr><td style="padding:6px;">USt-Bemessungsgrundlage</td><td style="text-align:right;padding:6px;">25,21 € (30/1,19)</td><td style="text-align:right;padding:6px;">16,81 € (Marge 20€/1,19)</td></tr>
                            <tr><td style="padding:6px;">USt 19%</td><td style="text-align:right;padding:6px;color:var(--danger);">−4,79 €</td><td style="text-align:right;padding:6px;color:var(--danger);">−3,19 €</td></tr>
                            <tr style="font-weight:700;border-top:2px solid var(--border);"><td style="padding:6px;">Vorteil</td><td style="text-align:right;padding:6px;">—</td><td style="text-align:right;padding:6px;color:var(--success);">+1,60 €</td></tr>
                        </table>
                        <p style="font-size:12px;color:var(--text-muted);">Bei 200 Verkäufen mit 20€ Marge: <strong>320€ pro Jahr Steuerersparnis</strong>.</p>

                        <h4>Voraussetzungen</h4>
                        <ul>
                            <li>Du bist <strong>Wiederverkäufer</strong> (Gewerbeanmeldung mit Tätigkeit „Einzelhandel mit gebrauchten Waren" o.ä.)</li>
                            <li>Du kaufst von <strong>Privatpersonen</strong> (oder Kleinunternehmern, oder anderen Differenzbesteuerern) — also Quellen ohne Vorsteuerabzug</li>
                            <li>Es darf <strong>keine USt</strong> beim Einkauf ausgewiesen sein</li>
                        </ul>

                        <h4>Pflichten / Gegenleistung</h4>
                        <ul>
                            <li>Auf Rechnung: <strong>„Differenzbesteuerung – Gebrauchtgegenstände/Sonderregelung"</strong></li>
                            <li><strong>Kein</strong> USt-Ausweis auf der Rechnung (Käufer kann keine Vorsteuer ziehen)</li>
                            <li>Eigene Aufzeichnungen: Einkaufspreis je Artikel — diese App macht das automatisch</li>
                            <li>Kein Vorsteuerabzug für die betroffene Ware (logisch — du hast keine bezahlt)</li>
                        </ul>

                        <h4>Wann lohnt sich's NICHT?</h4>
                        <ul>
                            <li>Bei Kleinunternehmer-Status — du zahlst sowieso keine USt</li>
                            <li>Wenn du fast nur von Großhändlern (mit USt-Rechnung) kaufst → normaler Vorsteuerabzug ist günstiger</li>
                            <li>Wenn deine Margen sowieso sehr niedrig sind</li>
                        </ul>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Achtung:</strong> Du kannst pro Verkauf <em>entweder</em> Differenz- oder Regelbesteuerung anwenden — nicht mischen. Bei Großhandels-Einkauf mit USt → normale Regelbesteuerung. Sauber dokumentieren!</div>
                    `
                },
                {
                    id: 'sp2',
                    title: 'Wann von Klein- auf Regelbesteuerung wechseln?',
                    duration: '6 min',
                    content: `
                        <p>Eine der wichtigsten strategischen Steuer-Entscheidungen.</p>

                        <h4>Zwingender Wechsel</h4>
                        <p>Wenn dein Vorjahres-Umsatz <strong>25.000 €</strong> überschritten hat ODER der laufende Umsatz <strong>100.000 €</strong> übersteigt, <em>musst</em> du wechseln.</p>

                        <h4>Freiwilliger Wechsel — wann lohnt's?</h4>
                        <p>Rechne durch: <strong>Vorsteuer-Volumen vs. USt-Last</strong>.</p>
                        <ul>
                            <li><strong>Pro Regelbesteuerung</strong>: Hohe Vorsteuer-Beträge (Großhändler, Verpackung, Plattform-Gebühren mit USt-Rechnung, Equipment)</li>
                            <li><strong>Pro Kleinunternehmer</strong>: Du verkaufst hauptsächlich an Privatpersonen, die die 19% nicht zurückholen können — du müsstest sie aufschlagen, wirst dann teurer</li>
                        </ul>

                        <h4>Faustformel</h4>
                        <p>Wenn deine <strong>Vorsteuer-fähigen Ausgaben</strong> deutlich (≥30%) deines Umsatzes sind UND deine Käufer <strong>keine</strong> Privatpersonen sind → Regelbesteuerung lohnt.<br>
                        Bei reinem Verkauf an Endkunden auf Vinted etc. → Kleinunternehmer fast immer besser.</p>

                        <h4>Differenzbesteuerung als Mittelweg</h4>
                        <p>Wenn du regelbesteuert <em>und</em> Wiederverkäufer bist: Differenzbesteuerung kombiniert die Vorteile (siehe vorherige Lektion).</p>

                        <h4>Bindungsfrist</h4>
                        <ul>
                            <li>Wechselst du <em>freiwillig</em> zur Regelbesteuerung → <strong>5 Jahre Bindung</strong></li>
                            <li>Erst danach kannst du wieder zur Kleinunternehmerregelung zurück</li>
                            <li>Beim zwingenden Wechsel (Umsatzgrenze) keine Bindung — sobald du wieder unter die Grenze fällst, kannst du im Folgejahr zurückwechseln</li>
                        </ul>

                        <h4>Praktischer Übergang</h4>
                        <ol>
                            <li>Schriftliche Mitteilung ans Finanzamt (formlos, vor Beginn des neuen Jahres)</li>
                            <li>USt-Voranmeldung jetzt monatlich/quartalsweise</li>
                            <li>Rechnungen mit USt-Ausweis</li>
                            <li>Vorsteuer aus laufenden Eingangsrechnungen ziehen</li>
                            <li>Software-Umstellung in dieser App: Einstellungen → USt-Modus auf „Regel"</li>
                        </ol>

                        <div class="akademie-tip">💡 <strong>Realitäts-Check:</strong> Die Mehrarbeit der Regelbesteuerung (USt-Voranmeldungen alle 1–3 Monate) sollte sich rechnen. Bei <22k Umsatz fast nie — Kleinunternehmer ist King.</div>
                    `
                },
                {
                    id: 'sp3',
                    title: 'PStTG / DAC7 — was die Plattform meldet',
                    duration: '5 min',
                    content: `
                        <p>Seit 2023 sind Plattformen wie <strong>Vinted, eBay, Etsy, Mercari</strong> verpflichtet, Verkaufsdaten ihrer Nutzer ans Bundeszentralamt für Steuern (BZSt) zu melden — die Daten gehen direkt zu deinem Finanzamt.</p>

                        <h4>Wann meldet die Plattform?</h4>
                        <p>Wenn du in einem Jahr <strong>≥30 Verkäufe</strong> ODER <strong>≥2.000 € Umsatz</strong> machst (eine der beiden Schwellen reicht).</p>

                        <h4>Was wird gemeldet?</h4>
                        <ul>
                            <li>Vor- und Nachname</li>
                            <li>Adresse</li>
                            <li>Steueridentifikationsnummer / IBAN</li>
                            <li><strong>Anzahl Verkäufe</strong></li>
                            <li><strong>Bruttoumsatz</strong></li>
                            <li><strong>Plattform-Gebühren</strong></li>
                        </ul>
                        <p>Stichtag jedes Jahr: <strong>31. Januar</strong> für das Vorjahr.</p>

                        <h4>Konsequenzen</h4>
                        <ol>
                            <li>Das Finanzamt <strong>weiß</strong> über deine Verkäufe Bescheid</li>
                            <li>Wenn du <em>nicht</em> als Gewerbe angemeldet bist, aber die Schwelle reißt → Brief vom Finanzamt</li>
                            <li>Wenn deine Steuererklärung nicht zu den gemeldeten Daten passt → Prüfung</li>
                            <li>Bei Verheimlichung: Steuerhinterziehung (kann teuer werden)</li>
                        </ol>

                        <h4>Was du tun solltest</h4>
                        <ul>
                            <li><strong>Plattform-Daten exportieren</strong> (jährlich)</li>
                            <li><strong>Mit deinen Aufzeichnungen abgleichen</strong> — Diskrepanz < 1% akzeptabel</li>
                            <li>Plattform-Gebühren = Betriebsausgabe (in der EÜR absetzen)</li>
                            <li>Ggf. Zugriff auf das Plattform-Portal als „PStTG-Bescheinigung" sichern</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>App-Workflow:</strong> Lade die Vinted-/eBay-CSV in den Verkäufe-Import — die App matcht automatisch mit deinem Lager. So sicherst du die Datenkonsistenz für die PStTG-Meldung.</div>

                        <p style="margin-top:14px;color:var(--text-muted);font-size:12px;">Hinweis: PStTG ist die deutsche Umsetzung der EU-Richtlinie DAC7. Gilt EU-weit ähnlich.</p>
                    `
                },
                {
                    id: 'sp4',
                    title: 'GoBD-Audit überleben',
                    duration: '5 min',
                    content: `
                        <p>Wenn das Finanzamt prüft, geht's um <strong>GoBD</strong> — die „Grundsätze ordnungsgemäßer Buchführung". Hier erfährst du, was geprüft wird und wie du sicher durchkommst.</p>

                        <h4>Die 5 Pflicht-Prinzipien</h4>
                        <ol>
                            <li><strong>Nachvollziehbarkeit</strong> — Dritter muss in vertretbarer Zeit verstehen, was passiert ist</li>
                            <li><strong>Vollständigkeit</strong> — alle Geschäftsvorfälle erfasst, nichts ausgelassen</li>
                            <li><strong>Richtigkeit</strong> — keine Erfindungen, alles belegbar</li>
                            <li><strong>Zeitgerechtigkeit</strong> — kontinuierliche Erfassung, nicht erst zum Jahresende</li>
                            <li><strong>Unveränderbarkeit</strong> — einmal gebucht, später Änderungen nur mit Audit-Trail</li>
                        </ol>

                        <h4>Was geprüft wird</h4>
                        <ul>
                            <li><strong>Belege</strong> für alle Einnahmen UND Ausgaben (auch private Käufe → Eigenbeleg)</li>
                            <li><strong>Plausibilität</strong> der Margen — extreme Ausreißer fallen auf</li>
                            <li><strong>Kassenführung</strong> wenn du bar einkaufst (Kassenbuch!)</li>
                            <li><strong>Privatentnahmen</strong> — wenn du Ware selbst behältst, ist das Privatentnahme</li>
                            <li><strong>Bestandsveränderungen</strong> — Lagerwert zum Jahresende</li>
                        </ul>

                        <h4>Diese App ist GoBD-konform — nutze die Vorteile</h4>
                        <ul>
                            <li>✅ <strong>Audit-Log</strong> protokolliert alle Änderungen unveränderbar</li>
                            <li>✅ <strong>Stornierungen</strong> mit Pflicht-Grund (kein Löschen)</li>
                            <li>✅ <strong>Zeitstempel</strong> auf jedem Datensatz</li>
                            <li>✅ <strong>Eigenbelege-Modul</strong> für Privatkäufe</li>
                            <li>✅ <strong>Backup-System</strong> für 10-Jahres-Aufbewahrung</li>
                        </ul>

                        <h4>Audit-Vorbereitung (Checkliste)</h4>
                        <ol>
                            <li>Backup aller Daten exportieren (auch verschlüsselt)</li>
                            <li>Audit-Log als PDF/Excel exportieren</li>
                            <li>Belege geordnet nach Datum (digital ok wenn lesbar)</li>
                            <li>EÜR finalisiert + signiert</li>
                            <li>Plattform-Bestätigungen (PStTG-Daten)</li>
                            <li>Bei Bar-Einkäufen: Kassenbuch lückenlos</li>
                        </ol>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Aufbewahrungsfrist (§ 147 AO):</strong> Rechnungen und Buchungsbelege 8 Jahre, Bücher/Aufzeichnungen/Jahresabschlüsse 10 Jahre. Lege jährlich ein Backup-Archiv weg (verschlüsselt + offline kopiert auf USB-Stick = robust).</div>
                    `
                }
            ]
        },

        // ── MODUL 7: Skalierung & Operations ─────────────────────────
        {
            id: 'skalierung',
            icon: '⚙️',
            title: 'Skalierung & Operations',
            description: 'Workflow, Lager, Versand — wie du von 5 auf 50 Verkäufe pro Woche kommst.',
            level: 'Profi',
            lessons: [
                {
                    id: 'sk1',
                    title: 'Workflow optimieren — von 5 zu 50 Verkäufen pro Woche',
                    duration: '6 min',
                    content: `
                        <p>Beim Skalieren ist <strong>nicht der Markt</strong> der Engpass — sondern <em>du</em>. Konkret: dein Workflow.</p>

                        <h4>Die 5 Engpässe im Reseller-Workflow</h4>
                        <ol>
                            <li><strong>Sourcing</strong> — wenig Ware = wenig Verkäufe</li>
                            <li><strong>Foto-Setup</strong> — wenn jedes Foto 5 Minuten dauert, wird's nichts</li>
                            <li><strong>Listing-Erstellung</strong> — Tippen statt Templates ist der Killer</li>
                            <li><strong>Versand</strong> — einzeln zur Post = 30 Min pro Paket weg</li>
                            <li><strong>Buchhaltung</strong> — wenn du's aufschiebst, wirst du irgendwann von der EÜR-Frist erschlagen</li>
                        </ol>

                        <h4>Schritt 1: Engpass identifizieren</h4>
                        <p>Stoppe eine Woche lang die Zeit pro Aktivität. Wo gehen 50% deiner Zeit hin? Da ist dein Hebel.</p>

                        <h4>Schritt 2: Batch-Processing</h4>
                        <ul>
                            <li>📸 <strong>Foto-Tag</strong>: alle 20 Stücke gleichzeitig fotografieren</li>
                            <li>📝 <strong>Listing-Tag</strong>: alle Fotos hintereinander in Listings umwandeln</li>
                            <li>📦 <strong>Versand-Tag</strong>: gesammelt zur Post</li>
                        </ul>
                        <p>Kontextwechsel kostet ~15 Min pro Wechsel. Batchen spart Stunden.</p>

                        <h4>Schritt 3: Templates für Listings</h4>
                        <p>Für jede Kategorie ein Beschreibungs-Template (siehe Lektion „Beschreibungen") und nur die Variablen (Maße, Material, Farbe) anpassen. <strong>3 Min pro Listing statt 15 Min</strong>.</p>

                        <h4>Schritt 4: Lager-Disziplin</h4>
                        <p>Jeder Artikel bekommt sofort beim Einkauf:</p>
                        <ul>
                            <li>Eine <strong>Artikelnummer</strong> (passiert automatisch in dieser App)</li>
                            <li>Einen <strong>Lagerort</strong> (Bereich/Regal/Fach)</li>
                            <li>Einen <strong>EK-Preis</strong></li>
                        </ul>
                        <p>Sonst irrlichst du beim Verkauf durchs Lager.</p>

                        <h4>Schritt 5: Bulk-Tools nutzen</h4>
                        <p>Die App hat Bulk-Einkauf, Excel-Import und CSV-Verkäufe-Import. Wenn du das nicht nutzt, verschenkst du Stunden.</p>

                        <div class="akademie-tip">🎯 <strong>Skalierungs-Faustformel:</strong> Wenn eine Aktivität >5× pro Woche vorkommt → muss optimiert werden. Wenn sie 1× pro Monat vorkommt → manuell ist okay.</div>
                    `
                },
                {
                    id: 'sk2',
                    title: 'Lager organisieren wie ein Profi',
                    duration: '5 min',
                    content: `
                        <p>Bei 100+ Artikeln entscheidet das Lager-System über deine Effizienz. Suche 5 Minuten pro Artikel = 8 Stunden pro Monat verschwendet.</p>

                        <h4>Das Bereich/Regal/Fach-System</h4>
                        <ul>
                            <li><strong>Bereich</strong> = Raum oder Schrank (A, B, C oder „Wohnzimmer", „Keller")</li>
                            <li><strong>Regal</strong> = Brett im Bereich (R1, R2, R3 von oben nach unten)</li>
                            <li><strong>Fach</strong> = Box im Regal (F1, F2, F3 von links nach rechts)</li>
                        </ul>
                        <p>Beispiel: <strong>A › R2 › F3</strong> = Wohnzimmer, mittleres Regal, dritte Box rechts. Im App-Lager-Tab kannst du das pro Artikel hinterlegen.</p>

                        <h4>Sortier-Strategien</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:6px;">Strategie</th><th style="text-align:left;padding:6px;">Wann</th></tr></thead>
                            <tr><td style="padding:6px;">Nach Kategorie (Hosen / Tops / Schuhe)</td><td style="padding:6px;">Bei breitem Sortiment</td></tr>
                            <tr><td style="padding:6px;">Nach Marke</td><td style="padding:6px;">Bei wenigen Marken mit viel Volumen</td></tr>
                            <tr><td style="padding:6px;">Nach Saison</td><td style="padding:6px;">Bei Mode/Kleidung — saisonal aus dem aktiven Lager raus</td></tr>
                            <tr><td style="padding:6px;">Nach Größe</td><td style="padding:6px;">Bei einheitlicher Kategorie (z.B. nur Sneaker)</td></tr>
                        </table>

                        <h4>QR-Codes auf Boxen (Bonus-Tipp)</h4>
                        <p>Drucke einen QR-Code mit der Box-ID (z.B. „A-R2-F3") und klebe ihn auf die Box. Beim Suchen in der App nach Lagerort filtern → Box-ID merken → finden.</p>

                        <h4>FIFO bei Mode</h4>
                        <p>First-In-First-Out: ältere Stücke zuerst rausspielen. Trick: <strong>frisch eingestellte Listings</strong> haben mehr Algorithmus-Boost. Refresh ein altes Listing → wieder „neu".</p>

                        <h4>Inventur 1× pro Quartal</h4>
                        <ul>
                            <li>App-Lager <strong>vs. echtes Lager</strong> abgleichen</li>
                            <li>Verlorene Stücke → Status „Beschädigt" oder „Storno mit Grund"</li>
                            <li>Ladenhüter > 90 Tage → Plan: Preisaktion oder Spende</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>App-Tipp:</strong> Im Lager-Tab kannst du nach Status „Beschädigt", „Reinigung", „Reparatur" filtern — perfekt für die Quartals-Inventur.</div>
                    `
                },
                {
                    id: 'sk3',
                    title: 'Versand-Workflow & Kosten optimieren',
                    duration: '5 min',
                    content: `
                        <p>Versand ist eine der größten Kosten-/Zeitfressen im Reselling. Hier die Optimierungs-Hebel.</p>

                        <h4>Verpackungsmaterial in Bulk kaufen</h4>
                        <ul>
                            <li><strong>Polybeutel</strong> für Kleidung: 100er-Pack ≈ 0,15€/Stk vs. 0,80€ einzeln im Drogerie</li>
                            <li><strong>Versandtaschen DHL/Hermes</strong>: gibts gratis bei der Post — nutze sie</li>
                            <li><strong>Recycling</strong>: alte Pakete wiederverwerten (transparent kommunizieren = grün)</li>
                            <li><strong>Klebeband + Etikettenpapier</strong> in 500er-Rollen</li>
                        </ul>

                        <h4>Versand-Etikett online erstellen</h4>
                        <p>Spart 5–10 Min pro Paket gegenüber Filiale. DHL Online, Hermes ProfiPaketShop, GLS, DPD — meist 5–15% Rabatt gegenüber Filialpreis.</p>

                        <h4>Versand-Routine</h4>
                        <ol>
                            <li><strong>Sammelversand</strong> 2× pro Woche (z.B. Di + Fr)</li>
                            <li>Etiketten <strong>am Vortag</strong> drucken</li>
                            <li>Pakete in Reihenfolge der Käufer-Adresse stapeln</li>
                            <li>Filiale oder PaketShop in Tagesablauf einbauen (z.B. nach Sport)</li>
                            <li>Sendungsnummer <strong>sofort an Käufer</strong> mailen</li>
                        </ol>

                        <h4>Versandkosten an Käufer</h4>
                        <p>Drei Modelle:</p>
                        <ul>
                            <li><strong>Käufer trägt voll</strong>: höchste Marge, kann aber abschreckend wirken</li>
                            <li><strong>Käufer trägt teilweise</strong>: Standard auf eBay/Vinted (z.B. 4,50€ bei 5,49€ Versandkosten)</li>
                            <li><strong>Versandkostenfrei</strong>: in Listing-Preis eingerechnet, psychologisch attraktiv</li>
                        </ul>

                        <h4>Internationaler Versand?</h4>
                        <p>EU: möglich, aber <strong>Vorsicht bei Reklamationen</strong> (Distanz erschwert Rücksendung). USA/UK: nur bei hohem Stückwert, Zoll-Klärung wird zur Pflicht.</p>

                        <div class="akademie-tip">💡 <strong>Pro-Tipp:</strong> Eine kleine Versandstation einrichten (Tisch + Drucker + Material) — du sparst pro Paket 3–5 Min, das ist bei 100 Paketen/Monat schon 5+ Stunden.</div>
                    `
                }
            ]
        },

        // ── MODUL 8: Kundenservice & Reputation ──────────────────────
        {
            id: 'kundenservice',
            icon: '⭐',
            title: 'Kundenservice & Reputation',
            description: 'Bewertungen, schwierige Käufer, Retouren — wie du eine 5-Sterne-Reputation baust.',
            level: 'Fortgeschritten',
            lessons: [
                {
                    id: 'k1',
                    title: 'Bewertungen — dein wichtigster KPI',
                    duration: '4 min',
                    content: `
                        <p>Auf jeder Plattform: <strong>Sterne-Rating + Käufer-Anzahl</strong> sind das Erste was potenzielle Käufer sehen. Eine schlechte Bewertung kostet dich 10× mehr als ein einzelner verlorener Verkauf.</p>

                        <h4>Die Mathe der Bewertungen</h4>
                        <p>Eine 1-Stern-Bewertung neben 9 Fünf-Sterne-Bewertungen → Durchschnitt 4,6. Wirkt mittelmäßig. Käufer scrollen erst zu Konkurrenten mit 4,9+.</p>
                        <p>→ <strong>Fokus auf 5-Sterne-Quote</strong>, nicht auf Anzahl. Lieber 30 5-Sterne als 100 mit Mix.</p>

                        <h4>Wie du 5-Sterne maximierst</h4>
                        <ol>
                            <li><strong>Realistische Beschreibung</strong> — lieber unter-versprechen, dann übertreffen</li>
                            <li><strong>Schnelle Lieferung</strong> — am Werktag versenden = +30% Bewertungs-Wahrscheinlichkeit</li>
                            <li><strong>Gute Verpackung</strong> — Polybeutel reicht, aber sauber gefaltet, nicht reingestopft</li>
                            <li><strong>Persönliche Note</strong> — handgeschriebener „Danke!" oder Sticker = günstig, wirkt</li>
                            <li><strong>Nach Lieferung freundlich anschreiben</strong>: „Hoffe alles passt — bei Fragen melde dich gerne!"</li>
                        </ol>

                        <h4>Wie du um Bewertungen bittest</h4>
                        <p>Nach Lieferung 3–5 Tage warten, dann freundlich:</p>
                        <blockquote style="border-left:3px solid var(--accent);padding:8px 14px;margin:10px 0;color:var(--text-secondary);font-style:italic;font-size:13px;">
                            „Hi {Name}! Hoffe das Stück hat gut angekommen und passt :) Falls du zufrieden bist, würdest du dir 30 Sekunden für eine Bewertung nehmen? Hilft mir mega weiter. Falls was nicht stimmt — schreib mir vorher gerne, ich find immer eine Lösung 🙏"
                        </blockquote>
                        <p>Wichtig: <strong>nicht aufdringlich</strong>, nicht mehrfach nachfragen.</p>

                        <h4>Schlechte Bewertung erhalten?</h4>
                        <ol>
                            <li><strong>Nicht emotional reagieren</strong> — 24h warten</li>
                            <li>Käufer freundlich anschreiben: „Was kann ich tun damit du zufrieden bist?"</li>
                            <li>Bei berechtigter Kritik: anbieten teilweise zu erstatten + Bewertung zu überdenken</li>
                            <li>Bei unfairer Kritik: ruhig öffentlich antworten („Wir konnten es leider nicht klären — bedaure die Erfahrung")</li>
                            <li>Plattform-Konfliktlösung erst als letzter Schritt</li>
                        </ol>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Niemals:</strong> Käufer mit Geld oder Rabatten <em>im Gegenzug</em> für eine Bewertung „bestechen" — gegen Plattform-AGB, kann zu Account-Sperrung führen.</div>
                    `
                },
                {
                    id: 'k2',
                    title: 'Schwierige Käufer professionell handhaben',
                    duration: '5 min',
                    content: `
                        <p>Manche Käufer sind anstrengend — einige davon mit Recht, andere ohne. Hier wie du beides professionell löst.</p>

                        <h4>Die 4 häufigsten schwierigen Anfragen</h4>

                        <h4>1. „Ist das echt?"</h4>
                        <p>→ Authentizitäts-Beweise: Detail-Fotos vom Etikett, Quittung wenn vorhanden, Marken-spezifische Echtheits-Merkmale. Höflich erklären.</p>
                        <blockquote style="border-left:3px solid var(--info);padding:8px 14px;margin:10px 0;color:var(--text-secondary);font-style:italic;font-size:13px;">
                            „Verstehe deine Frage — viele Marken werden gefälscht. Anbei 3 Detail-Fotos vom Innen-Etikett, der Naht und dem Knopf. Ich habe das Stück 2023 bei einer Vinted-Verkäuferin gekauft, die es offiziell aus dem Store hatte. Falls du nach Erhalt nicht überzeugt bist, kein Stress — ich nehme zurück."
                        </blockquote>

                        <h4>2. „Kann ich für 50% deines Preises?"</h4>
                        <p>→ Niedrige Angebote nicht persönlich nehmen. Faustformel: Akzeptiere bis 15–20% Rabatt, sonst freundlich ablehnen.</p>
                        <blockquote style="border-left:3px solid var(--info);padding:8px 14px;margin:10px 0;color:var(--text-secondary);font-style:italic;font-size:13px;">
                            „Danke für dein Interesse! Auf den Preis gehe ich aktuell leider nicht runter, kann dir aber X € anbieten. Bei einem Bundle aus mehreren Artikeln können wir auch nochmal schauen :)"
                        </blockquote>

                        <h4>3. „Es kam beschädigt an"</h4>
                        <p>→ Sofort um Foto bitten. Wenn berechtigt: Teilrückerstattung anbieten ODER Rücksendung mit voller Erstattung. Nicht streiten — dein Reputations-Verlust ist teurer als 15€ Erstattung.</p>

                        <h4>4. „Ich will zurückschicken weil's nicht passt"</h4>
                        <p>→ Auf Vinted: Käufer hat <em>kein</em> automatisches Widerrufsrecht (B2C-Schutz greift nur bei Gewerbe). Auf eBay als Gewerbe: <strong>14 Tage Widerruf</strong> ist Pflicht.</p>

                        <h4>Eskalations-Leiter</h4>
                        <ol>
                            <li><strong>Stufe 1</strong>: Freundlich antworten, Lösung anbieten</li>
                            <li><strong>Stufe 2</strong>: Kompromiss vorschlagen (Teilrückerstattung)</li>
                            <li><strong>Stufe 3</strong>: Plattform-Konfliktlösung einschalten</li>
                            <li><strong>Stufe 4</strong> (rar): Rechtsbeistand bei Betrugsversuchen über 200€</li>
                        </ol>

                        <h4>Anti-Drama-Regel</h4>
                        <p>Bei jedem Konflikt frag dich: <em>Was kostet mich der Konflikt vs. was kostet mich die Lösung?</em> 90% der Zeit ist die Lösung günstiger.</p>

                        <div class="akademie-tip">💡 <strong>Profi-Trick:</strong> Schreib dir 5–10 Standard-Antworten als Textbausteine in eine Notiz. Spart Zeit und sorgt für gleichbleibend professionelle Kommunikation auch wenn du genervt bist.</div>
                    `
                },
                {
                    id: 'k3',
                    title: 'Retouren ohne Verlust',
                    duration: '5 min',
                    content: `
                        <p>Retouren passieren — auch bei guter Beschreibung. Wichtig ist, wie du sie abwickelst.</p>

                        <h4>Rechtliche Pflicht: Wer hat Widerrufsrecht?</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;">
                            <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:6px;">Status Verkäufer</th><th style="text-align:left;padding:6px;">Käufer ist</th><th style="text-align:left;padding:6px;">Widerruf?</th></tr></thead>
                            <tr><td style="padding:6px;">Privat (kein Gewerbe)</td><td style="padding:6px;">Egal</td><td style="padding:6px;color:var(--success);">Nein (außer Vinted-Käuferschutz)</td></tr>
                            <tr><td style="padding:6px;">Gewerbe / Reseller</td><td style="padding:6px;">Privatperson</td><td style="padding:6px;color:var(--danger);">JA, 14 Tage Widerruf</td></tr>
                            <tr><td style="padding:6px;">Gewerbe / Reseller</td><td style="padding:6px;">anderes Gewerbe</td><td style="padding:6px;color:var(--success);">Nein (B2B)</td></tr>
                        </table>
                        <p>Das heißt: <strong>Sobald du Gewerbe bist und an Privatpersonen verkaufst, sind Retouren Pflicht</strong>. Du kannst sie nicht ausschließen.</p>

                        <h4>Widerrufsbelehrung</h4>
                        <p>Bei eBay/Etsy mit Gewerbe-Account → Widerrufsbelehrung MUSS in jedes Listing. Verstöße werden abgemahnt. Vorlagen findest du beim BMJ.</p>

                        <h4>Versandkosten-Regel</h4>
                        <ul>
                            <li>Käufer trägt die Versandkosten der <strong>Rücksendung</strong> (wenn du das in den Bedingungen geregelt hast)</li>
                            <li>Du erstattest Verkaufspreis + ursprüngliche Versandkosten</li>
                            <li>Wenn Ware beschädigt geliefert wurde → DU trägst Rücksendung</li>
                        </ul>

                        <h4>Wertersatz-Trick</h4>
                        <p>Wenn der Käufer die Ware <strong>über die Prüfung hinaus benutzt</strong> hat (z.B. mehrere Tage getragen, Schminkflecken auf Bluse), darfst du <strong>Wertersatz</strong> abziehen. Voraussetzung: Käufer wurde im Listing über diese Möglichkeit informiert.</p>

                        <h4>Retouren-Workflow</h4>
                        <ol>
                            <li><strong>Käufer kündigt an</strong> → bestätigen, Rücksendeadresse senden</li>
                            <li><strong>Pakete-Eingang prüfen</strong> sobald da</li>
                            <li><strong>Ware bewerten</strong>: wieder einstellbar? Wertersatz nötig?</li>
                            <li><strong>Erstattung</strong> innerhalb 14 Tagen ab Widerruf</li>
                            <li>In dieser App: Tab „Retouren" → Verkauf rückbuchen, Artikel zurück auf Status „Verfügbar"</li>
                        </ol>

                        <h4>Wieder einstellen — was beachten</h4>
                        <ul>
                            <li>Foto neu machen (alte Fotos zeigen Zustand vor Versand)</li>
                            <li>In Beschreibung erwähnen falls relevant: „1× retourniert, daher leicht reduziert"</li>
                            <li>Preis ggf. um 5–10% senken</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>App-Workflow:</strong> Im Tab „Retouren" kannst du Verkäufe sauber rückbuchen — die EÜR wird automatisch korrigiert (Einnahme entfernt). Das ist GoBD-konform und findet sich auch im Audit-Log wieder.</div>
                    `
                }
            ]
        },

        // ── MODUL 9: Krankenversicherung ──────────────────────────────────
        {
            id: 'krankenversicherung',
            icon: '🏥',
            title: 'Krankenversicherung',
            description: 'GKV oder PKV? Was gilt für Schüler, Azubis, Arbeitslose und Arbeitnehmer — alle Fälle erklärt.',
            level: 'Einsteiger',
            lessons: [
                {
                    id: 'kv0',
                    title: 'GKV vs. PKV — der Unterschied auf einen Blick',
                    duration: '5 min',
                    content: `
                        <p>In Deutschland gilt <strong>Versicherungspflicht</strong>: Du musst krankenversichert sein. Die Wahl liegt zwischen <strong>gesetzlicher (GKV)</strong> und <strong>privater (PKV)</strong> Krankenversicherung.</p>

                        <h4>Gesetzliche Krankenversicherung (GKV)</h4>
                        <ul>
                            <li>Beitrag abhängig vom <strong>Einkommen</strong> (nicht vom Gesundheitszustand)</li>
                            <li>Allgemeiner Beitragssatz 2025: <strong>14,6 %</strong> + kassenindividueller Zusatzbeitrag (Ø ~1,7 %)</li>
                            <li>Beitrag wird zwischen Arbeitnehmer und Arbeitgeber geteilt (<strong>je ~8,2 %</strong>)</li>
                            <li>Familienversicherung: Kinder + Ehepartner ohne eigenes Einkommen kostenlos mitversichert</li>
                            <li>Beitragsbemessungsgrenze 2025: <strong>5.512,50 € / Monat</strong> — darüber wird kein höherer Beitrag fällig</li>
                        </ul>

                        <h4>Private Krankenversicherung (PKV)</h4>
                        <ul>
                            <li>Beitrag abhängig vom <strong>Eintrittsalter, Gesundheit und gewähltem Tarif</strong></li>
                            <li>Jede versicherte Person zahlt eigenen Beitrag (keine Familienversicherung)</li>
                            <li>Zugang: Arbeitnehmer erst ab Jahreseinkommen > Versicherungspflichtgrenze (<strong>73.800 € / Jahr in 2025</strong>), oder Selbstständige / Beamte</li>
                            <li>Kann günstiger starten, steigt aber im Alter stark an</li>
                        </ul>

                        <h4>Pflegeversicherung (PV)</h4>
                        <p>Immer zusammen mit KV: Beitrag 2025 = <strong>3,4 %</strong> (Kinderlose zahlen <strong>4,0 %</strong>). Auch hier je 50 % AG/AN.</p>

                        <div class="akademie-tip">💡 <strong>Faustregel:</strong> Als Angestellter mit Standardgehalt → GKV. Als Selbstständiger, Beamter oder gut verdienender Arbeitnehmer → PKV-Vergleich lohnt sich. Im Zweifel: unabhängigen Versicherungsberater konsultieren (kein Makler!).</div>
                    `
                },
                {
                    id: 'kv1',
                    title: 'Schüler — Familienversicherung & erste eigene Versicherung',
                    duration: '6 min',
                    content: `
                        <p>Für Schüler gilt: solange die Eltern GKV-Mitglieder sind, können Kinder <strong>kostenlos familienversichert</strong> werden — ohne eigenen Beitrag.</p>

                        <h4>Wann greift die Familienversicherung?</h4>
                        <ul>
                            <li>Kinder bis <strong>18 Jahre</strong>: immer (egal ob und wie viel sie jobben)</li>
                            <li>Ab 18 bis maximal <strong>25 Jahre</strong>: wenn kein regelmäßiges Einkommen über <strong>505 € / Monat</strong></li>
                            <li>Ausnahme Minijob: bis zur Geringfügigkeitsgrenze <strong>538 € / Monat</strong> ist Familienversicherung trotzdem möglich (Sonderregelung für geringfügige Beschäftigung)</li>
                            <li>Wehr-/Zivildienst/FSJ: Familienschutz verlängert sich um die Dauer des Dienstes</li>
                        </ul>

                        <h4>Was passiert wenn das Einkommen die Grenze überschreitet?</h4>
                        <p>Wird die 505-€-Grenze <strong>dauerhaft</strong> überschritten (z. B. durch einen Werkstudentenjob), fällt die Familienversicherung weg. Ab dann:</p>
                        <ol>
                            <li>Eigene freiwillige GKV-Mitgliedschaft (für Schüler/Studenten günstiger Tarif)</li>
                            <li>Oder: eigene Pflichtmitgliedschaft wenn regulär beschäftigt</li>
                        </ol>

                        <h4>Praktische Fälle</h4>
                        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:10px 0;">
                            <tr style="background:var(--bg-secondary);"><th style="text-align:left;padding:6px;">Situation</th><th style="text-align:left;padding:6px;">KV-Status</th><th style="text-align:left;padding:6px;">Kosten</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Schüler, 16 Jahre, kein Job</td><td style="padding:6px;">Familienversicherung</td><td style="padding:6px;">0 €</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Schüler, 20 Jahre, Minijob 500 €</td><td style="padding:6px;">Familienversicherung (Minijob-Ausnahme)</td><td style="padding:6px;">0 €</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Schüler, 20 Jahre, Werkstudent 800 €</td><td style="padding:6px;">Eigene GKV-Pflichtmitgliedschaft</td><td style="padding:6px;">~131 €/Monat (AN-Anteil)</td></tr>
                            <tr><td style="padding:6px;">Schüler, 26 Jahre (Studium verlängert)</td><td style="padding:6px;">Freiwillige GKV (Studententarif)</td><td style="padding:6px;">~130–160 €/Monat</td></tr>
                        </table>

                        <h4>Wichtige Fristen</h4>
                        <ul>
                            <li>Nach Ende der Schulzeit: <strong>3 Monate</strong> um sich bei einer Krankenkasse anzumelden (oder Ausbildung/Studium beginnt)</li>
                            <li>Ohne Anmeldung: Krankenkasse fordert rückwirkend Beiträge — teuer!</li>
                        </ul>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Achtung Reselling + Familienversicherung:</strong> Wenn du als Schüler Reselling gewerblich betreibst und regelmäßig mehr als 505 € Gewinn erzielst, fällt die Familienversicherung weg. Gewerbegewinn zählt als Einkommen. Unter 505 € Gewinn/Monat im Jahresdurchschnitt: kein Problem.</div>
                    `
                },
                {
                    id: 'kv2',
                    title: 'Azubi — Pflichtversicherung & Beitragsteilung',
                    duration: '5 min',
                    content: `
                        <p>Als Auszubildende/r bist du <strong>automatisch GKV-pflichtversichert</strong> — genauso wie reguläre Arbeitnehmer. Die Krankenkasse kannst du frei wählen.</p>

                        <h4>Wie berechnet sich der Beitrag?</h4>
                        <p>Beitrag = Ausbildungsvergütung × Beitragssatz. Beitragssatz 2025:</p>
                        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:10px 0;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Posten</th><th style="padding:6px;text-align:right;">Satz</th><th style="padding:6px;text-align:right;">Beispiel bei 800 €</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">KV allgemein (Gesamt)</td><td style="padding:6px;text-align:right;">14,6 %</td><td style="padding:6px;text-align:right;">116,80 €</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">KV Zusatzbeitrag Ø (Gesamt)</td><td style="padding:6px;text-align:right;">~1,7 %</td><td style="padding:6px;text-align:right;">13,60 €</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Pflegeversicherung (Gesamt)</td><td style="padding:6px;text-align:right;">3,4 %</td><td style="padding:6px;text-align:right;">27,20 €</td></tr>
                            <tr style="border-bottom:1px solid var(--border);font-weight:600;"><td style="padding:6px;">Gesamt</td><td style="padding:6px;text-align:right;">~19,7 %</td><td style="padding:6px;text-align:right;">157,60 €</td></tr>
                            <tr style="color:var(--success);"><td style="padding:6px;">Dein Anteil (ca. 50 %)</td><td style="padding:6px;text-align:right;">~9,85 %</td><td style="padding:6px;text-align:right;">~78,80 €</td></tr>
                            <tr style="color:var(--text-muted);"><td style="padding:6px;">Arbeitgeber zahlt (ca. 50 %)</td><td style="padding:6px;text-align:right;">~9,85 %</td><td style="padding:6px;text-align:right;">~78,80 €</td></tr>
                        </table>

                        <h4>Sonderfall: Azubi-Vergütung unter 325 € / Monat</h4>
                        <p>Bei sehr geringer Vergütung (z. B. bestimmte Berufsfelder oder Teilzeit-Ausbildung): <strong>Arbeitgeber trägt den gesamten Beitrag allein</strong> — du zahlst nichts. Seit 2020 gibt es außerdem eine Sonderregel: Arbeitgeber zahlt gesamten Beitrag wenn das Ausbildungsentgelt unterhalb eines bestimmten Schwellenwerts liegt.</p>

                        <h4>Welche Krankenkasse wählen?</h4>
                        <p>Du kannst zum Ausbildungsstart frei wählen. Wichtige Kriterien:</p>
                        <ul>
                            <li><strong>Zusatzbeitrag</strong>: unterscheidet sich je nach Kasse (0,9 % – 2,5 % in 2025)</li>
                            <li><strong>Bonusprogramme</strong>: Fitness, Vorsorge, Zahn (lohnt sich im jungen Alter)</li>
                            <li><strong>App + Service</strong>: digitale Gesundheitskarte, Online-Arzttermin</li>
                            <li><strong>Regionale Präsenz</strong> (falls du persönliche Beratung schätzt)</li>
                        </ul>

                        <h4>Was ist mit dem Job nach der Ausbildung?</h4>
                        <p>Nach Abschluss der Ausbildung: automatisch Pflichtmitglied als Arbeitnehmer. Kasse bleibt die gleiche sofern du nicht aktiv wechselst (Kassenwahlrecht jederzeit nach 12 Monaten Mitgliedschaft).</p>

                        <div class="akademie-tip">💡 <strong>Tipp für Azubi-Reseller:</strong> Wenn du nebenher Reselling betreibst und Gewinn machst: dieser zählt als selbstständiges Einkommen. Liegt der Gesamtgewinn unter der Geringfügigkeitsgrenze und überschreitest du keine 20 Wochenstunden, ändert sich an der Pflichtversicherung als Azubi nichts. Bei höherem Gewinn → Kasse informieren.</div>
                    `
                },
                {
                    id: 'kv3',
                    title: 'Arbeitslos — ALG I, Bürgergeld & Beitragspflicht',
                    duration: '6 min',
                    content: `
                        <p>Wer seinen Job verliert, muss nicht automatisch die Krankenversicherung verlieren. Das System schützt dich — aber du musst rechtzeitig handeln.</p>

                        <h4>Fall 1: Arbeitslosengeld I (ALG I)</h4>
                        <p>Du beziehst ALG I von der <strong>Bundesagentur für Arbeit (BA)</strong>:</p>
                        <ul>
                            <li>Die BA meldet dich automatisch bei deiner bisherigen Krankenkasse als Pflichtmitglied an</li>
                            <li>Die BA zahlt die GKV-Beiträge <strong>direkt an die Kasse</strong> — du zahlst nichts selbst</li>
                            <li>Bemessungsgrundlage: 80 % des letzten Bruttoentgelts (gedeckelt auf Beitragsbemessungsgrenze)</li>
                            <li>Pflegeversicherung läuft parallel — ebenfalls von der BA getragen</li>
                        </ul>

                        <h4>Fall 2: Bürgergeld (ehem. ALG II)</h4>
                        <p>Du beziehst Bürgergeld vom <strong>Jobcenter</strong>:</p>
                        <ul>
                            <li>Jobcenter übernimmt GKV-Beiträge vollständig</li>
                            <li>Du bleibst <strong>Pflichtmitglied</strong> in der GKV — voller Leistungsanspruch</li>
                            <li>Kassenwahlrecht: du kannst die Kasse wechseln</li>
                            <li>Nicht möglich: in die PKV wechseln (kein Zuschuss vom Jobcenter für PKV)</li>
                        </ul>

                        <h4>Fall 3: Keine Leistungen (selbst gekündigt / Sperrzeit)</h4>
                        <p>Beziehst du weder ALG I noch Bürgergeld und bist nicht anderweitig versichert:</p>
                        <ul>
                            <li>Du musst dich <strong>freiwillig in der GKV versichern</strong></li>
                            <li>Frist: binnen <strong>14 Tagen</strong> nach Ende der Pflichtversicherung (z. B. Beschäftigungsende)</li>
                            <li>Mindestbeitrag 2025: ca. <strong>207 € / Monat</strong> (auf Basis Mindest-Einnahme 1.178,33 €)</li>
                            <li>Nachweis geringes Einkommen möglich → reduzierter Beitrag auf Antrag</li>
                        </ul>

                        <h4>Fall 4: Wenn du vorher PKV hattest</h4>
                        <p>Wer als Selbstständiger oder Arbeitnehmer in der PKV war und nun arbeitslos wird:</p>
                        <ul>
                            <li>PKV-Beitrag läuft weiter — Jobcenter zahlt <strong>keinen Zuschuss</strong> für PKV</li>
                            <li>Bei ALG I: Zuschuss des Jobcenters zu PKV bis zur Hälfte des Mindestbeitrags der GKV</li>
                            <li>Option: Wechsel in den <strong>Notlagentarif</strong> der PKV (stark reduzierte Leistungen, sehr günstiger Beitrag)</li>
                            <li>Rückkehr in GKV: nur möglich wenn Beschäftigung unter Pflichtversicherungsgrenze aufgenommen wird</li>
                        </ul>

                        <h4>Wichtige Fristen</h4>
                        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:10px 0;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Situation</th><th style="padding:6px;text-align:left;">Frist</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Arbeitsverhältnis endet</td><td style="padding:6px;">Innerhalb 14 Tage KV-Anschluss sichern</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">ALG-I-Antrag</td><td style="padding:6px;">Spätestens am 1. Tag der Arbeitslosigkeit anmelden</td></tr>
                            <tr><td style="padding:6px;">Lücke in Versicherung</td><td style="padding:6px;">Kasse berechnet rückwirkend Beiträge — unvermeidlich</td></tr>
                        </table>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Reselling während Arbeitslosigkeit:</strong> Betreibst du während des Bürgergeld-Bezugs Reselling als Gewerbe, musst du Einnahmen dem Jobcenter melden. Gewinn wird auf das Bürgergeld angerechnet. Freibetrag 2025: erste 100 € des Einkommens anrechnungsfrei, danach 20 % Freibetrag bis 1.000 € monatlicher Einnahmen.</div>
                    `
                },
                {
                    id: 'kv4',
                    title: 'Arbeitnehmer — Pflichtversicherung, Wahltarife & PKV-Option',
                    duration: '7 min',
                    content: `
                        <p>Als sozialversicherungspflichtig Beschäftigter bist du automatisch GKV-Mitglied — sofern dein Jahresgehalt die <strong>Versicherungspflichtgrenze</strong> nicht überschreitet.</p>

                        <h4>Pflichtversicherungsgrenze 2025</h4>
                        <ul>
                            <li>Jahresarbeitsentgeltgrenze (JAEG): <strong>73.800 € brutto / Jahr</strong> = 6.150 € / Monat</li>
                            <li>Liegt dein Jahresgehalt darunter: <strong>GKV-Pflicht</strong>, kein Wechsel in PKV möglich</li>
                            <li>Liegt dein Jahresgehalt darüber: <strong>Wahlfreiheit</strong> — GKV freiwillig oder PKV</li>
                        </ul>

                        <h4>Beitragsberechnung 2025 (Beispiel 3.500 € Brutto)</h4>
                        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:10px 0;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Posten</th><th style="padding:6px;text-align:right;">Dein Anteil</th><th style="padding:6px;text-align:right;">AG-Anteil</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">KV (14,6 % + Ø 1,7 %)</td><td style="padding:6px;text-align:right;">~284 €</td><td style="padding:6px;text-align:right;">~284 €</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Pflegeversicherung (3,4 %)</td><td style="padding:6px;text-align:right;">~60 €</td><td style="padding:6px;text-align:right;">~60 €</td></tr>
                            <tr style="font-weight:600;"><td style="padding:6px;">Gesamt KV+PV</td><td style="padding:6px;text-align:right;">~344 €</td><td style="padding:6px;text-align:right;">~344 €</td></tr>
                        </table>
                        <p style="font-size:12px;color:var(--text-muted);">Kinderlose zahlen 0,6 % Pflegeversicherungs-Zuschlag zusätzlich (seit 2023).</p>

                        <h4>Kassenwahlrecht</h4>
                        <p>Du kannst die GKV frei wählen. Wechsel möglich:</p>
                        <ul>
                            <li>Nach mindestens <strong>12 Monaten</strong> Mitgliedschaft in der aktuellen Kasse</li>
                            <li>Mit <strong>2 Monaten Kündigungsfrist</strong> zum Monatsende</li>
                            <li>Ausnahme: Kasse erhöht Zusatzbeitrag → sofortiges Sonderkündigungsrecht</li>
                        </ul>

                        <h4>PKV als Arbeitnehmer — wann lohnt es sich?</h4>
                        <p>Wenn dein Bruttogehalt die JAEG <strong>3 Jahre in Folge</strong> überschreitet (oder im 1. Jahr bei Neueinstellung):</p>
                        <ul>
                            <li>PKV kann im jungen Alter günstiger sein als GKV</li>
                            <li>Kein Familienschutz: Kinder/Partner müssen separat versichert werden → Kostenfaktor</li>
                            <li>Beiträge steigen im Alter stark — <strong>Langzeit-Vergleich</strong> entscheidend</li>
                            <li>Rückkehr in GKV schwierig (nur unter bestimmten Bedingungen)</li>
                        </ul>

                        <h4>Sonderfall: Nebentätigkeit als Reseller / Selbstständiger</h4>
                        <p>Du bist Arbeitnehmer und betreibst <strong>nebenberuflich</strong> Reselling als Gewerbe:</p>
                        <ul>
                            <li>Bleibt in der GKV-Pflichtversicherung (Hauptbeschäftigung als AN dominiert)</li>
                            <li>Nebenberuflich = wöchentliche Selbstständigen-Arbeitszeit <strong>unter 18 Stunden</strong> UND Gewinn unter Arbeitnehmereinkommen</li>
                            <li>Gewinn aus Reselling wird <strong>nicht für GKV-Beitrag herangezogen</strong> (Beitrag nur aus AN-Einkommen)</li>
                            <li>Übersteigt Reselling-Einkommen das AN-Einkommen: Status wechselt → höhere Beiträge möglich</li>
                        </ul>

                        <h4>Besonderheit: Mini- und Midijob (Nebenjob neben Hauptbeschäftigung)</h4>
                        <ul>
                            <li>Minijob bis 538 €/Monat: KV-frei (kein Beitrag des Minijobbers), AG zahlt Pauschale</li>
                            <li>Midijob 538–2.000 €/Monat (Übergangsbereich): reduzierter AN-Anteil, AG zahlt vollen AG-Anteil</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>Praxis-Tipp Kassenvergleich:</strong> Der Zusatzbeitrag ist der größte Unterschied zwischen Kassen (0,9 % bis 2,5 % in 2025). Bei 3.500 € Brutto sind das 31 € bis 87 € pro Monat Unterschied — also bis zu 672 € / Jahr. Krankenkassen-Vergleich auf krankenkassen.de oder GKV-Spitzenverband jährlich prüfen!</div>
                    `
                },
                {
                    id: 'kv5',
                    title: 'Selbstständige & Freelancer — freiwillige GKV oder PKV?',
                    duration: '6 min',
                    content: `
                        <p>Wer sich selbstständig macht, verliert automatisch die Pflichtversicherung als Arbeitnehmer. Innerhalb von <strong>3 Monaten</strong> muss eine neue Lösung gefunden werden.</p>

                        <h4>Option 1: Freiwillige GKV</h4>
                        <p>Selbstständige können freiwillig in der GKV bleiben:</p>
                        <ul>
                            <li>Beitrag: 14,6 % + Zusatzbeitrag + PV auf das <strong>gesamte Einkommen</strong> (keine AG-Beteiligung!)</li>
                            <li>Mindesteinkommen-Bemessungsgrundlage: <strong>1.178,33 € / Monat</strong> (auch wenn du weniger verdienst)</li>
                            <li>Mindestbeitrag 2025: ca. <strong>207 € / Monat</strong> (KV) + ca. 50 € (PV) = ~257 €/Monat</li>
                            <li>Bei Nachweis geringeren Einkommens: Antrag auf reduzierten Beitrag möglich</li>
                            <li>Familienschutz: Kinder + Ehepartner weiterhin beitragsfrei mitversichert</li>
                        </ul>

                        <h4>Option 2: Private Krankenversicherung (PKV)</h4>
                        <ul>
                            <li>Selbstständige haben jederzeit Zugang zur PKV (keine Einkommensgrenze)</li>
                            <li>Günstiger Einstiegsbeitrag im jungen Alter (z. B. 25–35 Jahre)</li>
                            <li>Kein Beitrag auf Einkommen — fester Tarif, unabhängig vom Gewinn</li>
                            <li>Nachteil: Beitrag steigt mit dem Alter stark, keine Familienversicherung</li>
                        </ul>

                        <h4>Typischer Vergleich: Reseller mit 2.000 € Gewinn / Monat</h4>
                        <table style="width:100%;font-size:13px;border-collapse:collapse;margin:10px 0;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Option</th><th style="padding:6px;text-align:right;">Monatsbeitrag</th><th style="padding:6px;text-align:left;">Besonderheit</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Freiwillige GKV</td><td style="padding:6px;text-align:right;">~332 € KV+PV</td><td style="padding:6px;">Kinder mitversichert</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">PKV (30 J., gesund)</td><td style="padding:6px;text-align:right;">~250–350 €</td><td style="padding:6px;">Tarif-abhängig</td></tr>
                            <tr><td style="padding:6px;">PKV (50 J., normal)</td><td style="padding:6px;text-align:right;">~450–700 €</td><td style="padding:6px;">Steigt mit Alter</td></tr>
                        </table>

                        <h4>Wenn der Gewinn im ersten Jahr gering ist</h4>
                        <p>Neu-Selbstständige können in den <strong>ersten 3 Jahren</strong> beantragen, den GKV-Beitrag auf Basis des tatsächlichen (niedrigeren) Einkommens zu berechnen, anstatt des Mindestbeitrags. Voraussetzung: Nachweis via Einkommensteuerbescheid oder Prognose-Erklärung.</p>

                        <h4>Praxis: Was muss ich tun wenn ich mich selbstständig mache?</h4>
                        <ol>
                            <li>Ende der Pflichtversicherung feststellen (letzter AN-Tag)</li>
                            <li>Innerhalb <strong>14 Tagen</strong>: bisherige Kasse über Statusänderung informieren</li>
                            <li>Antrag auf freiwillige Mitgliedschaft stellen (oder PKV-Antrag)</li>
                            <li>Wenn Gewinn noch nicht bekannt: Beitragsanpassung jährlich möglich</li>
                        </ol>

                        <div class="akademie-tip akademie-tip-warn">⚠️ <strong>Häufiger Fehler:</strong> Selbstständige vergessen die Krankenversicherung anzumelden und erhalten rückwirkend Beiträge seit Beginn der Selbstständigkeit. Die Kasse rechnet das konsequent ab — inklusive Säumniszuschlägen. Sofort anmelden spart bares Geld!</div>
                    `
                }
            ]
        },

        // ── MODUL 10: Internationaler Handel ─────────────────────────
        {
            id: 'international',
            icon: '🌍',
            title: 'Internationaler Handel',
            description: 'EU-Ausland, OSS-Verfahren, Zoll & Import — grenzenlos verkaufen.',
            level: 'Profi',
            lessons: [
                {
                    id: 'int1',
                    title: 'EU-Ausland verkaufen — OSS & Lieferschwellen',
                    duration: '6 min',
                    content: `
                        <p>Sobald du als Reseller regelmäßig an Käufer in anderen EU-Ländern verkaufst, kommt die <strong>Umsatzsteuer-Thematik</strong> ins Spiel — auch als Kleinunternehmer ist Wissen hier wichtig.</p>

                        <h4>Die EU-Lieferschwelle</h4>
                        <p>Seit 1. Juli 2021 gilt EU-weit eine einheitliche Lieferschwelle von <strong>10.000 €</strong> Jahresumsatz an Privatkunden in anderen EU-Staaten. Überschreitest du diese Grenze, musst du im Land des Käufers USt abführen — oder das <strong>OSS-Verfahren</strong> nutzen.</p>

                        <h4>One-Stop-Shop (OSS)</h4>
                        <ul>
                            <li>Registrierung einmalig beim Bundeszentralamt für Steuern (BZSt)</li>
                            <li>Anmeldung über <em>elster.de</em> → Bereich "OSS"</li>
                            <li>Quartalsweise Meldung aller EU-Auslands-Umsätze in einer einzigen Erklärung</li>
                            <li>BZSt leitet Beträge an die jeweiligen Länder weiter</li>
                        </ul>

                        <h4>Kleinunternehmer im EU-Ausland</h4>
                        <p>Die §19 UStG Kleinunternehmerregelung gilt <strong>nur in Deutschland</strong>. Wenn du z.B. auf Vinted.fr verkaufst, gelten die französischen USt-Regeln — bis zur 10.000€-Grenze kannst du aber die deutsche Regelung anwenden. Dahinter: OSS pflicht.</p>

                        <h4>Plattformen und Marketplace-Haftung</h4>
                        <p>eBay, Vinted und Amazon sind in der EU als <strong>deemed supplier</strong> registriert: Ab bestimmten Umsätzen führen sie die USt direkt ab. Das entlastet dich — aber prüfe in deinem Seller-Account, ob du als "privat" oder "gewerblich" eingestuft bist. Nur gewerbliche Accounts fallen darunter.</p>

                        <div class="akademie-tip">💡 <strong>Praxis-Tipp:</strong> Unter 10.000 € EU-Auslands-Umsatz pro Jahr brauchst du nichts extra zu tun. Tracke deine Auslands-VKs separat — Stackr ermöglicht das über das Plattform-Feld in jedem Verkauf.</div>
                    `
                },
                {
                    id: 'int2',
                    title: 'UK & USA — Plattformen und Steuerregeln',
                    duration: '5 min',
                    content: `
                        <p>Nach dem Brexit 2021 ist das Vereinigte Königreich ein <strong>Drittland</strong>. Ähnliches gilt für die USA. Was bedeutet das für Reseller?</p>

                        <h4>Verkäufe nach Großbritannien</h4>
                        <ul>
                            <li><strong>Unter 135 GBP</strong>: Plattformen wie eBay UK führen die UK-VAT direkt ab (Marketplace Facilitator). Du musst nichts tun.</li>
                            <li><strong>Über 135 GBP</strong>: Du bräuchtest UK VAT-Registrierung. Für die meisten deutschen Reseller unrelevant.</li>
                            <li>Versand: Zollformular CN22/CN23 ausfüllen, Warenwert angeben.</li>
                        </ul>

                        <h4>Verkäufe in die USA</h4>
                        <ul>
                            <li>US Sales Tax ist Staatssache — jeder der 50 Bundesstaaten hat eigene Regeln.</li>
                            <li>Plattformen wie eBay.com und Etsy sammeln die Sales Tax für dich (Marketplace Facilitator Laws).</li>
                            <li>Als ausländischer Anbieter mit keiner US-Betriebsstätte hast du in der Regel <strong>keine eigene Steuerpflicht</strong> in den USA.</li>
                        </ul>

                        <h4>Einfuhrgebühren für den Käufer</h4>
                        <p>Käufer im UK/USA zahlen Importzölle und Steuern für Pakete über einem Freibetrag. Das ist ihre Verantwortung — stelle es klar in dein Listing: <em>"Import duties/taxes not included"</em>. Andernfalls werden Pakete abgewiesen oder du wirst nach Erstattungen gefragt.</p>

                        <h4>Währungsrisiko</h4>
                        <p>Bei eBay.com in USD verkaufen heißt: Kurs-Schwankungen können Marge fressen. PayPal und Wise bieten günstigere Umrechnungen als eBay selbst. Kalkuliere immer mit einem Kurs-Puffer von 3–5%.</p>

                        <div class="akademie-tip">💡 Für die meisten deutschen Reseller gilt: UK und USA über Marktplätze abwickeln → Plattform übernimmt Steuern. Nur bei Direktverkäufen (eigener Shop) wird's komplizierter.</div>
                    `
                },
                {
                    id: 'int3',
                    title: 'Import & Zoll — Ware aus Asien einkaufen',
                    duration: '6 min',
                    content: `
                        <p>Viele Reseller erkunden irgendwann den Import aus China, Bangladesch oder der Türkei. Hier lauern versteckte Kosten, wenn man die Regeln nicht kennt.</p>

                        <h4>Einfuhrabgaben aus Drittländern</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Abgabe</th><th style="padding:6px;text-align:left;">Höhe</th><th style="padding:6px;text-align:left;">Grundlage</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Zoll</td><td style="padding:6px;">0–12% je Warengruppe</td><td style="padding:6px;">Zolltarifnummer (HS Code)</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Einfuhrumsatzsteuer</td><td style="padding:6px;">19% (7% für best. Waren)</td><td style="padding:6px;">Warenwert + Zoll + Versand</td></tr>
                            <tr><td style="padding:6px;">ggf. Antidumping-Zoll</td><td style="padding:6px;">0–85%</td><td style="padding:6px;">Bestimmte Produktkategorien aus China</td></tr>
                        </table>

                        <h4>Freibetrag ab 150 €</h4>
                        <p>Seit 1. Juli 2021 gibt es <strong>keinen Freigrenze mehr</strong> für Sendungen aus Drittstaaten. Bereits ab 1 € Warenwert fällt Einfuhrumsatzsteuer an. Zoll entfällt noch bis 150 € Warenwert pro Sendung.</p>

                        <h4>Wichtige Begriffe</h4>
                        <ul>
                            <li><strong>DDP (Delivered Duty Paid)</strong>: Lieferant übernimmt Zoll und Steuern → du zahlst alles im Kaufpreis inkl.</li>
                            <li><strong>DAP (Delivered at Place)</strong>: Du zahlst Zoll und Steuern beim Empfang → Überraschung möglich!</li>
                            <li><strong>EXW (Ex Works)</strong>: Du organisierst alles selbst ab Fabrik.</li>
                        </ul>

                        <h4>Produktkonformität</h4>
                        <p>Für den gewerblichen Verkauf in der EU muss Ware <strong>CE-gekennzeichnet</strong> sein (Elektronik, Spielzeug, Kleidung für Kinder etc.). Fehlende CE-Kennzeichnung → Abmahnung oder Rückruf. Sichere dir Konformitätserklärungen vom Lieferanten.</p>

                        <div class="akademie-tip">💡 <strong>Kalkulations-Formel:</strong> Gesamtkosten = Warenwert + Versand + Zoll (% auf Warenwert) + EUSt (19% auf Warenwert+Versand+Zoll). Plane mindestens +25–35% auf den Netto-Einkaufspreis ein.</div>
                    `
                }
            ]
        },

        // ── MODUL 11: Verkaufspsychologie ─────────────────────────────
        {
            id: 'psychologie',
            icon: '🧩',
            title: 'Verkaufspsychologie',
            description: 'Preisanker, Verhandlungsführung und Bundle-Strategien für höhere Margen.',
            level: 'Fortgeschritten',
            lessons: [
                {
                    id: 'psy1',
                    title: 'Preisanker & Verankern — mehr Geld für dieselbe Ware',
                    duration: '5 min',
                    content: `
                        <p>Der <strong>Preisanker-Effekt</strong> ist eines der mächtigsten Werkzeuge im Verkauf: Der erste Preis, den ein Käufer sieht, beeinflusst unbewusst seine gesamte Preis-Wahrnehmung.</p>

                        <h4>Wie Preisanker funktionieren</h4>
                        <p>Wenn du ein Listing mit "UVP 299 € — Dein Preis: 89 €" aufbaust, wirken 89 € plötzlich sehr günstig. Selbst wenn der tatsächliche UVP 120 € war — solange du die Zahl ehrlich angibst, ist es legitim und effektiv.</p>

                        <h4>Preis-Anker-Strategien für Reseller</h4>
                        <ol>
                            <li><strong>UVP-Referenz</strong>: Originalpreis im Listing nennen (wenn bekannt und real). "Originalpreis 180 €" → dein 65 € wirkt wie Schnäppchen.</li>
                            <li><strong>Preis-Staffelung</strong>: "Verhandelbar, Mindest-VB: 45 €" setzt 45 als Anker — manche zahlen mehr.</li>
                            <li><strong>Bundle-Anker</strong>: Drei Teile einzeln "à 30 €" anbieten — Bundle für 70 € wirkt als Ersparnis.</li>
                            <li><strong>Runde vs. nicht-runde Preise</strong>: 49 € läuft oft besser als 50 € (Schwellen-Effekt). Bei Premiumprodukten gilt das Gegenteil: 120 € wirkt "seriöser" als 119 €.</li>
                        </ol>

                        <h4>Psychological Pricing in der Praxis</h4>
                        <ul>
                            <li>Sneaker-Drop-Reselling: Verweise auf aktuellen Marktpreis auf StockX/Kicks Crew als Anker</li>
                            <li>Kleidung: UVP-Label im Foto sichtbar lassen (wenn original-Preisschild noch dran)</li>
                            <li>Elektronik: Vergleich mit "ähnliche Artikel auf eBay: 150–200 €" im Listing-Text</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>A/B testen:</strong> Probiere für zwei gleiche Artikel unterschiedliche Preisrahmen. Track über Stackr welcher schneller und zu welchem Preis verkauft. Daten schlagen Bauchgefühl.</div>
                    `
                },
                {
                    id: 'psy2',
                    title: 'Verhandlungsführung — Preise durchsetzen ohne Käufer zu verlieren',
                    duration: '4 min',
                    content: `
                        <p>Auf Plattformen wie Vinted oder eBay kommen täglich Preisanfragen. Wer die richtigen Techniken kennt, verliert weniger Marge.</p>

                        <h4>Die 3 häufigsten Käufer-Typen bei Preisverhandlungen</h4>
                        <ol>
                            <li><strong>Der Taktiker</strong>: Bietet absurd wenig (50% vom Preis) um einen neuen Anker zu setzen. Strategie: Ignorieren oder kurz ablehnen ohne Gegenwert.</li>
                            <li><strong>Der Echte</strong>: Budget ist wirklich begrenzt. Bereit zu zahlen wenn du einen Weg bietest (Bundle, leicht reduziert).</li>
                            <li><strong>Der Sammler</strong>: Will mehrere Stücke — hier lohnt Rabatt für Volumen.</li>
                        </ol>

                        <h4>Verhandlungs-Techniken</h4>
                        <ul>
                            <li><strong>ZOPA kennen</strong>: Zone of Possible Agreement — unter welchen Preis gehst du nie? Definiere das vorher.</li>
                            <li><strong>Gegenwert fordern</strong>: "Für 55 € ja — wenn du sofort zahlst und ich 5 Sterne bekomme."</li>
                            <li><strong>Silence is golden</strong>: Angebot machen, nicht weiter reden. Wer zuerst spricht, verliert.</li>
                            <li><strong>Höflich ablehnen</strong>: "Danke für dein Interesse, der Preis ist festgesetzt" — dann nichts mehr dazu.</li>
                        </ul>

                        <h4>Automatischer Preisabfall statt manueller Verhandlung</h4>
                        <p>Auf eBay kannst du die <em>Automatische Annahme</em> aktivieren: Biete automatisch bei Angeboten ab X% Rabatt an. Spart Zeit und zieht Käufer an ohne dein Zutun. Empfehlung: 5–10% Auto-Rabatt ab 10 Tagen Laufzeit.</p>

                        <div class="akademie-tip">💡 <strong>Goldene Regel:</strong> Der beste Schutz vor schlechten Verhandlungen ist ein gutes Erstangebot. Kalkuliere deinen Mindestpreis ein und liste mit 15–20% Puffer. Dann kannst du Rabatte geben ohne Verlust zu machen.</div>
                    `
                },
                {
                    id: 'psy3',
                    title: 'Bundle & Cross-Selling — den Warenkorb erhöhen',
                    duration: '5 min',
                    content: `
                        <p>Die billigste Art mehr Umsatz zu machen: <strong>dem gleichen Käufer mehr verkaufen</strong>. Bundling ist im Reselling massiv unterschätzt.</p>

                        <h4>Bundle-Strategien für Reseller</h4>
                        <ul>
                            <li><strong>Outfit-Bundle</strong>: Hose + Shirt + Gürtel = "Komplettes Outfit, 45 €". Dreimal schneller abverkauft als einzeln.</li>
                            <li><strong>Größen-Bundle</strong>: "Paket M: 5 T-Shirts, 35 €" — gut für Floh-Fund Massen-Einkäufe.</li>
                            <li><strong>Marken-Bundle</strong>: "3× Nike Laufschuhe, versch. Größen, 65 €"</li>
                            <li><strong>Saison-Bundle</strong>: Winterjacke + Schal + Handschuhe — thematisch zusammenfassen.</li>
                        </ul>

                        <h4>Cross-Selling in Listings</h4>
                        <p>Auf Vinted und eBay: In der Beschreibung auf andere Artikel hinweisen. "Passende Hose dazu findest du in meinem Shop" + Link. Conversion-Rate: 3–8% — jede 30. Person klickt und kauft oft beides.</p>

                        <h4>Bundle-Kalkulation</h4>
                        <p>Bundle-Preis sollte <strong>10–20% günstiger</strong> als Summe der Einzelpreise sein — aber immer noch über deinen Mindestpreisen. Käufer fühlen sich als "Gewinner". Du verkaufst schneller und sparst Listings.</p>

                        <h4>Was nicht gebündelt werden sollte</h4>
                        <ul>
                            <li>Verschiedene Größen (Käufer passen nicht in alles)</li>
                            <li>Hochpreisartikel mit Ladenhütern (verteuert den Ladenhüter künstlich)</li>
                            <li>Artikel mit sehr unterschiedlichen Margen (du verlierst den Überblick)</li>
                        </ul>

                        <div class="akademie-tip">💡 In Stackr kannst du Bundle-Verkäufe über den Paketverkauf im Lager anlegen — mehrere Artikel werden einem Verkauf zugeordnet. So bleibt die EÜR sauber.</div>
                    `
                }
            ]
        },

        // ── MODUL 12: Social Media & Werbung ─────────────────────────
        {
            id: 'social',
            icon: '📱',
            title: 'Social Media & Werbung',
            description: 'Instagram, TikTok & Co. als Verkaufskanal für dein Reselling-Business.',
            level: 'Einsteiger',
            lessons: [
                {
                    id: 'sm1',
                    title: 'Instagram & TikTok für Reseller — Sichtbarkeit aufbauen',
                    duration: '5 min',
                    content: `
                        <p>Social Media ist für Reseller ein <strong>Multiplikator</strong> — nicht das Fundament. Wer ohne solides Lager-/Listing-Management anfängt "Content zu machen", verliert Zeit ohne Ergebnis.</p>

                        <h4>Wann lohnt Social Media?</h4>
                        <p>Erst wenn du:</p>
                        <ul>
                            <li>Einen konsistenten Lager-Workflow hast (50+ Artikel verfügbar)</li>
                            <li>Fotos machst die du ohne Scham zeigen kannst</li>
                            <li>Eine Nische hast (Vintage Adidas, Y2K, Luxus-Second-Hand, Sneaker etc.)</li>
                        </ul>

                        <h4>Instagram-Strategie für Reseller</h4>
                        <ol>
                            <li><strong>Grid als Schaufenster</strong>: Konsistenter Stil (Hintergrundfarbe, Lichtsetzung). Käufer scrollen durch deinen Feed — mach ihn einladend.</li>
                            <li><strong>Stories für Neuzugänge</strong>: "Neue Ware" Stories mit Swipe-Up zum Listing.</li>
                            <li><strong>Bio-Link</strong>: Linktree mit deinen Shops (Vinted, eBay, Etsy) als direkter Kaufkanal.</li>
                            <li><strong>Hashtags</strong>: 5–15 relevante (z.B. #vintagefashion #thriftedfinds #reseller_de) + 1–2 Nischen-spezifische.</li>
                        </ol>

                        <h4>TikTok für Reseller</h4>
                        <p>TikTok bevorzugt <strong>Unterhaltungswert über Qualität</strong>. Formate die funktionieren:</p>
                        <ul>
                            <li>"Was ich für X€ auf dem Flohmarkt gefunden habe" — Sourcing-Vlogs</li>
                            <li>"Ich liste 30 Artikel in 30 Minuten" — Zeitraffer-Listing-Videos</li>
                            <li>"Vorher/Nachher" — gereinigt, restauriert, neu fotografiert</li>
                            <li>"Preis-Check" — Ich bewerte Random-Kleidungsstücke live</li>
                        </ul>

                        <div class="akademie-tip">💡 <strong>Zeitaufwand realistisch einschätzen:</strong> 2–3 Posts pro Woche = ~3 Stunden Aufwand. Erst wenn Social Media messbaren Mehrumsatz bringt, lohnt mehr Invest. Track Links aus Bio vs. organische Suche.</div>
                    `
                },
                {
                    id: 'sm2',
                    title: 'Content-Strategie ohne Aufwand',
                    duration: '4 min',
                    content: `
                        <p>Der häufigste Fehler: Stundenlang Content produzieren ohne System. Mit dem richtigen Framework reichen 45 Minuten pro Woche.</p>

                        <h4>Der Reseller Content-Kalender (Wochenplan)</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Tag</th><th style="padding:6px;text-align:left;">Inhalt</th><th style="padding:6px;text-align:left;">Aufwand</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Mo</td><td style="padding:6px;">Neue Artikel Story (3–5 Fotos)</td><td style="padding:6px;">10 min</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Mi</td><td style="padding:6px;">Highlight-Stück Post (1 Artikel mit Geschichte)</td><td style="padding:6px;">15 min</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Fr</td><td style="padding:6px;">Behind-the-Scenes (Sourcing, Verpacken)</td><td style="padding:6px;">10 min</td></tr>
                            <tr><td style="padding:6px;">So</td><td style="padding:6px;">Sold-Posts / Wochenrückblick</td><td style="padding:6px;">10 min</td></tr>
                        </table>

                        <h4>Batch-Produktion</h4>
                        <p>Fotografiere beim Listing-Session gleich Social-Media-Content mit. Extra Kamerawinkel, kurzer Clip mit Handy = kein zusätzlicher Aufwand, doppelter Content.</p>

                        <h4>Caption-Vorlage</h4>
                        <p>Eine einfache Formel: <em>[Artikel] | [Marke] | [Größe] | [Zustand] | [Preis] | Mehr in Bio 🔗</em><br>
                        Beispiel: "Vintage Levis 501 | Größe W32 L32 | Top Zustand | 55€ | Shop-Link in Bio 🔗 #vintagedenim #levis501"</p>

                        <div class="akademie-tip">💡 Nutze <strong>Canva</strong> für einen einheitlichen visuellen Stil mit Templates. Einmal erstellen, immer wieder nutzen. Eure Brand kostet 2 Stunden Setup und spart dauerhaft Zeit.</div>
                    `
                },
                {
                    id: 'sm3',
                    title: 'Bezahlte Werbung — wann lohnt es sich?',
                    duration: '4 min',
                    content: `
                        <p>Paid Ads für Reseller: In den meisten Fällen <strong>nicht sinnvoll</strong> — aber es gibt Ausnahmen. Hier eine ehrliche Analyse.</p>

                        <h4>Wann Paid Ads NICHT funktionieren</h4>
                        <ul>
                            <li>Einzelne Unikate (du kannst sie nur einmal verkaufen — Ads-Kosten amortisieren sich nicht)</li>
                            <li>Niedrig-Preis-Ware unter 30 € (Marge reicht nach Ads-Kosten oft nicht)</li>
                            <li>Ohne eigenen Shop (auf Vinted/eBay sind externe Ads oft gegen AGB)</li>
                        </ul>

                        <h4>Wann Paid Ads Sinn machen</h4>
                        <ul>
                            <li><strong>Eigenmarke / Curated Shop</strong>: Wenn du einen eigenen Shopify/WooCommerce betreibst mit konsistentem Sortiment</li>
                            <li><strong>Reproduzierbare Artikel</strong>: Mehrere Einheiten (z.B. 20 gleiche Sneakers aus Bulk)</li>
                            <li><strong>Hochwertige Einzelstücke 200€+</strong>: Marge lässt 5–15 € Ad-Spend je Verkauf zu</li>
                        </ul>

                        <h4>eBay Promoted Listings</h4>
                        <p>eBay's eigenes Werbesystem ist für Reseller oft interessanter als Meta/Google Ads. Du zahlst nur bei erfolgreicher Transaktion (meist 2–5% des Verkaufspreises extra). Aktiviere es für Artikel die lange stehen.</p>

                        <h4>ROAS-Kalkulation</h4>
                        <p><strong>Return on Ad Spend</strong> = Umsatz aus Werbung ÷ Werbekosten. Für Reselling rechne mit Margen von 30–60% → ROAS muss mindestens 2–3 sein damit es sich lohnt. Teste mit kleinem Budget (10–20 €), miss exakt, dann skaliere.</p>

                        <div class="akademie-tip">💡 Für die meisten Reseller gilt: Die Zeit in bessere Fotos und mehr Listings zu investieren bringt mehr ROI als Paid Ads. Erst wenn organisch läuft, über Ads nachdenken.</div>
                    `
                }
            ]
        },

        // ── MODUL 13: AfA & Anlagenverzeichnis ───────────────────────
        {
            id: 'afa_recht',
            icon: '📉',
            title: 'AfA & Anlagenverzeichnis',
            description: 'Abschreibungen, GWG-Grenze und das Anlagenverzeichnis korrekt führen.',
            level: 'Fortgeschritten',
            lessons: [
                {
                    id: 'afa1',
                    title: 'Was ist AfA? — Abschreibungen für Reseller erklärt',
                    duration: '5 min',
                    content: `
                        <p><strong>AfA</strong> (Absetzung für Abnutzung, §7 EStG) erlaubt dir, teure betriebliche Anschaffungen nicht sofort voll als Ausgabe abzusetzen, sondern <em>über die Nutzungsdauer zu verteilen</em>.</p>

                        <h4>Wann ist AfA relevant für Reseller?</h4>
                        <p>Wenn du Gegenstände kaufst, die länger als 1 Jahr genutzt werden und über 800 € (netto) kosten:</p>
                        <ul>
                            <li>Hochwertige Kamera / Studioblitz-Set</li>
                            <li>Laptop oder PC (rein betrieblich)</li>
                            <li>Professionelle Lager-Regale oder Schrank-System</li>
                            <li>Fahrzeug (anteilig betrieblich genutzt)</li>
                        </ul>

                        <h4>Lineare AfA — die Standardmethode</h4>
                        <p>Jährliche Abschreibung = Anschaffungskosten ÷ Nutzungsdauer (in Jahren). Die amtliche AfA-Tabelle des BMF gibt Nutzungsdauern vor:</p>
                        <ul>
                            <li>Laptop/PC: 3 Jahre</li>
                            <li>Kamera (professionell): 7 Jahre</li>
                            <li>PKW: 6 Jahre</li>
                            <li>Büromöbel: 13 Jahre</li>
                        </ul>

                        <h4>Beispiel-Berechnung</h4>
                        <p>Kamera für 1.400 € (netto) gekauft. Nutzungsdauer laut AfA-Tabelle: 7 Jahre.<br>
                        Jährliche AfA: 1.400 € ÷ 7 = <strong>200 € pro Jahr</strong> als Betriebsausgabe absetzbar.</p>

                        <div class="akademie-tip">💡 In Stackr gibt es das Anlagenverzeichnis unter EÜR → AfA. Dort trägst du Anschaffung und Nutzungsdauer ein — die AfA wird automatisch in die EÜR eingerechnet.</div>
                    `
                },
                {
                    id: 'afa2',
                    title: 'GWG-Grenze 800 € — sofort abschreiben statt verteilen',
                    duration: '4 min',
                    content: `
                        <p>Gegenstände bis <strong>800 € netto</strong> (952 € brutto bei 19% USt) sind <em>Geringwertige Wirtschaftsgüter (GWG)</em> und können <strong>sofort im Kaufjahr voll abgeschrieben</strong> werden — keine Verteilung auf Jahre nötig.</p>

                        <h4>GWG-Regelungen im Überblick</h4>
                        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
                            <tr style="background:var(--bg-secondary);"><th style="padding:6px;text-align:left;">Wert (netto)</th><th style="padding:6px;text-align:left;">Behandlung</th></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">Bis 250 €</td><td style="padding:6px;">Sofortabschreibung, kein Verzeichnis nötig</td></tr>
                            <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px;">251 € – 800 €</td><td style="padding:6px;">GWG-Sofortabschreibung, muss im Verzeichnis stehen</td></tr>
                            <tr><td style="padding:6px;">Über 800 €</td><td style="padding:6px;">Reguläre AfA über Nutzungsdauer</td></tr>
                        </table>

                        <h4>Was kann als GWG sofort abgeschrieben werden?</h4>
                        <ul>
                            <li>Smartphone (betrieblich genutzt) unter 800 € netto</li>
                            <li>Einfache Kamera oder Ringlicht</li>
                            <li>Drucker, Scanner</li>
                            <li>Bürostuhl, Schreibtisch (muss selbstständig nutzbar sein)</li>
                        </ul>

                        <h4>Sammelposten-Methode (Alternative)</h4>
                        <p>Statt GWG-Sofortabschreibung kann man alle Anschaffungen über 250 € bis 1.000 € in einem <em>Sammelposten</em> zusammenfassen und gleichmäßig über 5 Jahre abschreiben. Für die meisten Reseller empfiehlt sich die einfachere GWG-Sofortabschreibung.</p>

                        <div class="akademie-tip">💡 <strong>Praxis-Tipp:</strong> Wenn du planst eine Kamera für 850 € zu kaufen — Kleinunternehmer achtet auf den Bruttobetrag (unter 952 € brutto = GWG). Bei Regelbesteuerung gilt der Nettobetrag.</div>
                    `
                },
                {
                    id: 'afa3',
                    title: 'Das Anlagenverzeichnis korrekt führen',
                    duration: '4 min',
                    content: `
                        <p>Das Anlagenverzeichnis ist die <strong>Pflicht-Dokumentation</strong> aller abzuschreibenden Wirtschaftsgüter. Ohne Verzeichnis lässt das Finanzamt die AfA im Zweifelsfall nicht gelten.</p>

                        <h4>Pflichtangaben im Anlagenverzeichnis</h4>
                        <ol>
                            <li>Bezeichnung des Wirtschaftsguts</li>
                            <li>Anschaffungsdatum</li>
                            <li>Anschaffungskosten (netto)</li>
                            <li>Nutzungsdauer (Jahre)</li>
                            <li>Jährlicher AfA-Betrag</li>
                            <li>Kumulierte AfA bisher</li>
                            <li>Restbuchwert (= AK minus kumul. AfA)</li>
                        </ol>

                        <h4>Anlagenverzeichnis in Stackr</h4>
                        <p>Im Bereich <strong>EÜR → AfA</strong> kannst du Anlagen anlegen. Stackr berechnet automatisch:</p>
                        <ul>
                            <li>Lineare Jahres-AfA</li>
                            <li>Zeitanteilige AfA bei Halbjahres-Regel (im Kaufjahr 1/2-AfA)</li>
                            <li>Restbuchwert in Echtzeit</li>
                            <li>Automatische Übernahme in die EÜR-Ausgaben</li>
                        </ul>

                        <h4>Halbjahres-Regel (§7 Abs. 1 EStG)</h4>
                        <p>Im Jahr der Anschaffung wird grundsätzlich nur die <strong>halbe Jahres-AfA</strong> angesetzt, unabhängig vom tatsächlichen Kaufmonat. Ausnahme: GWG-Sofortabschreibung — dort volle AfA im Kaufjahr.</p>

                        <h4>Veräußerung und Ausbuchung</h4>
                        <p>Wenn du ein Wirtschaftsgut verkaufst oder entsorgst, muss es aus dem Verzeichnis ausgebucht werden. Verkaufspreis über Restbuchwert = steuerpflichtiger Gewinn. Unter Restbuchwert = Verlust (absetzbar).</p>

                        <div class="akademie-tip">💡 <strong>GoBD-Hinweis:</strong> Das Anlagenverzeichnis ist eine GoBD-Pflicht. Es muss für 10 Jahre aufbewahrt werden. Stackr exportiert das Verzeichnis als PDF/CSV für deine Archivierung.</div>
                    `
                }
            ]
        }
    ],

    // ── Achievements ──────────────────────────────────────────────────────
    ACHIEVEMENTS: [
        { id: 'first_purchase',  icon: '🛒', title: 'Erster Einkauf',          desc: 'Du hast deinen ersten Artikel ins Lager gelegt.',         tier: 'bronze', check: d => d.purchases.length >= 1 },
        { id: 'first_sale',      icon: '💰', title: 'Erster Verkauf!',         desc: 'Dein erster Verkauf ist verbucht — Glückwunsch!',         tier: 'bronze', check: d => d.sales.length >= 1 },
        { id: 'first_profit',    icon: '🎯', title: 'Erster Gewinn',           desc: 'Mindestens ein Verkauf mit positivem Netto-Gewinn.',     tier: 'bronze', check: d => d.sales.some(s => (s.verkaufspreis||0) > 0) },
        { id: 'sammler_50',      icon: '📦', title: 'Sammler (50 Artikel)',    desc: '50 Artikel gleichzeitig im Lager.',                       tier: 'silver', check: d => d.activeStock >= 50 },
        { id: 'sammler_500',     icon: '🏬', title: 'Lager-Profi (500)',       desc: 'Beachtlich! 500 Artikel im aktiven Lagerbestand.',       tier: 'gold',   check: d => d.activeStock >= 500 },
        { id: 'umsatz_1k',       icon: '💵', title: '1.000 € Umsatz',          desc: 'Der erste Vier-Stellige-Umsatz ist da.',                  tier: 'silver', check: d => d.totalRevenue >= 1000 },
        { id: 'umsatz_5k',       icon: '💸', title: '5.000 € Umsatz',          desc: 'Du machst ernst. 5.000 € Umsatz erreicht.',              tier: 'gold',   check: d => d.totalRevenue >= 5000 },
        { id: 'umsatz_25k',      icon: '👑', title: 'Kleinunternehmer-Limit',  desc: 'Achtung: Du kratzt an der 25.000-€-Grenze (§19 UStG).', tier: 'gold',   check: d => d.totalRevenue >= 25000 },
        { id: 'invoice_first',   icon: '🧾', title: 'Erste Rechnung',          desc: 'Du hast eine Rechnung im Rechnungsbuch erstellt.',       tier: 'bronze', check: d => d.invoices >= 1 },
        { id: 'eur_export',      icon: '📋', title: 'Steuer-Bewusst',          desc: 'Du hast deine erste EÜR exportiert / gedruckt.',         tier: 'silver', check: d => d.flags.eurExported },
        { id: 'backup_hero',     icon: '💾', title: 'Backup-Held',             desc: 'Dein erstes Backup ist gespeichert. Schlauer Move!',     tier: 'bronze', check: d => d.flags.hasBackup },
        { id: 'bulk_purchase',   icon: '📥', title: 'Bulk-Macher',             desc: 'Du hast eine Bulk-Session mit ≥10 Artikeln angelegt.',   tier: 'silver', check: d => d.maxSessionSize >= 10 },
        { id: 'bulk_500',        icon: '🚚', title: 'Großhändler-Move',        desc: 'Eine Bulk-Session mit ≥500 Artikeln. Beeindruckend!',    tier: 'gold',   check: d => d.maxSessionSize >= 500 },
        { id: 'profitable_month',icon: '🌱', title: 'Profitabler Monat',       desc: 'In einem Monat mehr Einnahmen als Ausgaben.',            tier: 'silver', check: d => d.profitableMonths >= 1 },
        { id: 'lesson_first',    icon: '🎓', title: 'Lerneifer',               desc: 'Erste Akademie-Lektion abgeschlossen.',                  tier: 'bronze', check: d => d.lessonsRead >= 1 },
        { id: 'module_complete', icon: '🏆', title: 'Modul gemeistert',        desc: 'Ein komplettes Akademie-Modul durchgearbeitet.',         tier: 'silver', check: d => d.modulesComplete >= 1 },

        // ── Erweiterte Achievements (Unternehmer-Pfad) ────────────────
        { id: 'streak_active',   icon: '🔥', title: 'Aktive Phase',            desc: 'An 7 verschiedenen Tagen in 30 Tagen einen Verkauf.',    tier: 'silver', check: d => d.activeDays7in30 >= 7 },
        { id: 'diversify',       icon: '🌐', title: 'Diversifiziert',          desc: 'Verkäufe auf 3+ verschiedenen Plattformen.',             tier: 'silver', check: d => d.uniquePlatforms >= 3 },
        { id: 'fast_flip',       icon: '⚡', title: 'Schneller Dreher',        desc: 'Artikel innerhalb 7 Tagen nach Einkauf verkauft.',       tier: 'silver', check: d => d.fastFlips >= 1 },
        { id: 'high_margin',     icon: '🏅', title: 'Margen-Profi',            desc: 'Einzelverkauf mit ≥200% Marge erzielt.',                 tier: 'gold',   check: d => d.maxMarginPct >= 200 },
        { id: 'year_active',     icon: '📅', title: 'Ein Jahr dabei',          desc: '365 Tage seit deinem ersten Einkauf.',                   tier: 'silver', check: d => d.daysSinceFirstPurchase >= 365 },
        { id: 'stock_value_5k',  icon: '🏛️', title: 'Lager-Magnat',            desc: 'Lagerwert (verfügbar) ≥ 5.000 €.',                       tier: 'gold',   check: d => d.activeStockValue >= 5000 },
        { id: 'comeback',        icon: '🌱', title: 'Comeback',                desc: 'Profitabler Monat nach mindestens einem Verlustmonat.',  tier: 'silver', check: d => d.hadComeback },
        { id: 'listing_master',  icon: '📷', title: 'Listing-Master',          desc: '100 Artikel mit Foto UND Beschreibung.',                 tier: 'gold',   check: d => d.fullyListedCount >= 100 },
        { id: 'all_modules',     icon: '🎖️', title: 'Wissens-Champion',        desc: 'ALLE Akademie-Module komplett durchgearbeitet.',         tier: 'gold',   check: d => d.modulesComplete >= 13 },
        { id: 'audit_clean',     icon: '🛡️', title: 'Audit-Saubermann',        desc: 'GoBD-konform: 100+ dokumentierte Änderungen im Protokoll.', tier: 'silver', check: d => d.auditEntries >= 100 },
        { id: 'bulk_master',     icon: '📦', title: 'Bulk-Master',             desc: '5+ Bulk-Sessions im Lager angelegt.',                    tier: 'silver', check: d => d.bulkSessions >= 5 }
    ],

    TIER_COLORS: {
        bronze: { bg: 'rgba(180,120,60,.15)',  color: '#b87333', border: '#b87333' },
        silver: { bg: 'rgba(192,192,192,.15)', color: '#9ca3af', border: '#9ca3af' },
        gold:   { bg: 'rgba(251,191,36,.18)',  color: '#fbbf24', border: '#fbbf24' }
    },

    // ── Datenanalyse für Achievements ─────────────────────────────────────
    _analyzeData() {
        try {
        const purchases = Store.getPurchases();
        const sales     = Store.getSales();
        const invoices  = Store.getRechInvoices ? Store.getRechInvoices() : [];

        const activeStock = purchases.filter(p => p.status === 'verfuegbar').length;
        const totalRevenue = sales.reduce((s, x) => s + (parseFloat(x.verkaufspreis)||0) + (parseFloat(x.versandkostenKaeufer)||0), 0);

        // Größte Bulk-Session
        const sessionCounts = {};
        purchases.forEach(p => {
            if (p.sessionId) sessionCounts[p.sessionId] = (sessionCounts[p.sessionId]||0) + 1;
        });
        const maxSessionSize = Math.max(0, ...Object.values(sessionCounts));

        // Profitable Monate
        const monthly = {};
        sales.forEach(s => {
            const m = (s.datum||'').slice(0,7);
            if (!m) return;
            monthly[m] = (monthly[m]||0) + (parseFloat(s.verkaufspreis)||0);
        });
        const monthlyExpenses = {};
        purchases.forEach(p => {
            const m = (p.datum||'').slice(0,7);
            if (!m) return;
            monthlyExpenses[m] = (monthlyExpenses[m]||0) + (parseFloat(p.einkaufspreis)||0);
        });
        let profitableMonths = 0;
        Object.keys(monthly).forEach(m => {
            if (monthly[m] > (monthlyExpenses[m] || 0)) profitableMonths++;
        });

        const flags = {
            eurExported: localStorage.getItem('akademie_flag_eur_exported') === '1',
            hasBackup:   !!localStorage.getItem('_fs_backup_last') || !!localStorage.getItem('last_backup_date')
        };

        const progress = this._getProgress();
        const lessonsRead = progress.completedLessons.length;
        const modulesComplete = this.MODULES.filter(m =>
            m.lessons.every(l => progress.completedLessons.includes(l.id))
        ).length;

        // ── Erweiterte Metriken für neue Achievements ──────────────
        // Aktive Tage in den letzten 30 Tagen
        const now = Date.now();
        const last30 = now - 30 * 86400000;
        const activeDaysSet = new Set();
        sales.forEach(s => {
            const t = new Date(s.datum || 0).getTime();
            if (t >= last30) activeDaysSet.add((s.datum || '').slice(0, 10));
        });
        const activeDays7in30 = activeDaysSet.size;

        // Unique Plattformen
        const platforms = new Set(sales.map(s => s.verkaufsplattform).filter(Boolean));
        const uniquePlatforms = platforms.size;

        // Fast Flips (Artikel verkauft innerhalb 7 Tagen nach Einkauf)
        const purchaseMap = {};
        Store.getPurchases(true).forEach(p => { purchaseMap[p.id] = p; });
        let fastFlips = 0;
        sales.forEach(s => {
            const p = s.purchaseId ? purchaseMap[s.purchaseId] : null;
            if (p && p.datum && s.datum) {
                const days = (new Date(s.datum) - new Date(p.datum)) / 86400000;
                if (days >= 0 && days <= 7) fastFlips++;
            }
        });

        // Maximale Marge (in %)
        let maxMarginPct = 0;
        sales.forEach(s => {
            const p = s.purchaseId ? purchaseMap[s.purchaseId] : null;
            const ek = p ? parseFloat(p.einkaufspreis) || 0 : 0;
            const vk = parseFloat(s.verkaufspreis) || 0;
            if (ek > 0 && vk > 0) {
                const margin = ((vk - ek) / ek) * 100;
                if (margin > maxMarginPct) maxMarginPct = margin;
            }
        });

        // Tage seit erstem Einkauf
        let daysSinceFirstPurchase = 0;
        if (purchases.length > 0) {
            const dates = purchases.map(p => new Date(p.datum || 0).getTime()).filter(t => t > 0);
            if (dates.length > 0) {
                const first = Math.min(...dates);
                daysSinceFirstPurchase = Math.floor((now - first) / 86400000);
            }
        }

        // Lagerwert verfügbar
        const activeStockValue = purchases
            .filter(p => p.status === 'verfuegbar')
            .reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0);

        // Comeback: profitabler Monat nach Verlustmonat
        const monthsKeys = Object.keys(monthly).sort();
        let hadComeback = false;
        for (let i = 1; i < monthsKeys.length; i++) {
            const prevKey = monthsKeys[i - 1];
            const curKey  = monthsKeys[i];
            const prevProfit = (monthly[prevKey] || 0) - (monthlyExpenses[prevKey] || 0);
            const curProfit  = (monthly[curKey]  || 0) - (monthlyExpenses[curKey]  || 0);
            if (prevProfit < 0 && curProfit > 0) { hadComeback = true; break; }
        }

        // Vollständig gelistete Artikel (Foto + Beschreibung)
        const fullyListedCount = purchases.filter(p => p.foto && p.beschreibung && p.beschreibung.trim().length > 0).length;

        // Audit-Log-Einträge
        let auditEntries = 0;
        try {
            const audits = Store.get('audits') || [];
            auditEntries = audits.length;
        } catch (e) {}

        // Anzahl unique Bulk-Sessions
        const bulkSessions = Object.keys(sessionCounts).filter(sid => sessionCounts[sid] > 1).length;

        return {
            purchases, sales,
            activeStock, totalRevenue,
            invoices: invoices.length,
            maxSessionSize, profitableMonths,
            flags, lessonsRead, modulesComplete,
            // Erweiterte Felder
            activeDays7in30, uniquePlatforms, fastFlips, maxMarginPct,
            daysSinceFirstPurchase, activeStockValue, hadComeback,
            fullyListedCount, auditEntries, bulkSessions
        };
        } catch (e) {
            console.warn('[Akademie] _analyzeData Fehler:', e);
            return {
                purchases: [], sales: [], activeStock: 0, totalRevenue: 0,
                invoices: 0, maxSessionSize: 0, profitableMonths: 0,
                flags: {}, lessonsRead: 0, modulesComplete: 0,
                activeDays7in30: 0, uniquePlatforms: 0, fastFlips: 0, maxMarginPct: 0,
                daysSinceFirstPurchase: 0, activeStockValue: 0, hadComeback: false,
                fullyListedCount: 0, auditEntries: 0, bulkSessions: 0
            };
        }
    },

    // ── Progress Storage ──────────────────────────────────────────────────
    _getProgress() {
        try {
            return JSON.parse(localStorage.getItem('akademie_progress') || '{"completedLessons":[],"unlockedAchievements":[]}');
        } catch { return { completedLessons: [], unlockedAchievements: [] }; }
    },

    _saveProgress(p) {
        localStorage.setItem('akademie_progress', JSON.stringify(p));
    },

    markLessonComplete(lessonId) {
        const p = this._getProgress();
        if (!p.completedLessons.includes(lessonId)) {
            p.completedLessons.push(lessonId);
            this._saveProgress(p);
            this.checkNewAchievements();
        }
    },

    // Prüft ob neue Achievements freigeschaltet wurden — gibt Liste der NEUEN zurück
    checkNewAchievements() {
        const data = this._analyzeData();
        const progress = this._getProgress();
        const newOnes = [];
        this.ACHIEVEMENTS.forEach(a => {
            try {
                if (!progress.unlockedAchievements.includes(a.id) && a.check(data)) {
                    progress.unlockedAchievements.push(a.id);
                    newOnes.push(a);
                }
            } catch(e) { console.warn('[Akademie] Check-Fehler:', a.id, e); }
        });
        if (newOnes.length > 0) {
            this._saveProgress(progress);
            // Toast für neue Achievements
            newOnes.forEach(a => {
                Utils.showToast(`${a.icon} Achievement freigeschaltet: ${a.title}`, 'success');
            });
        }
        return newOnes;
    },

    // ── Render ────────────────────────────────────────────────────────────
    render() {
        // Falls Lektion offen
        if (this._activeLesson) {
            return this._renderLesson();
        }

        const progress  = this._getProgress();
        const data      = this._analyzeData();
        const totalLessons = this.MODULES.reduce((s, m) => s + m.lessons.length, 0);
        const readPercent  = totalLessons > 0 ? Math.round(progress.completedLessons.length / totalLessons * 100) : 0;
        const unlockedCount    = progress.unlockedAchievements.length;
        const totalAchievements = this.ACHIEVEMENTS.length;

        // ── Icon lookup + level colours ──────────────────────────────────
        const MOD_ICONS = {
            grundlagen:'ti-rocket', einkauf:'ti-shopping-cart', steuer:'ti-chart-bar',
            listing:'ti-camera', mindset:'ti-brain', steuerprofi:'ti-file-certificate',
            skalierung:'ti-settings-cog', kundenservice:'ti-star',
            krankenversicherung:'ti-heart-rate-monitor', international:'ti-world',
            psychologie:'ti-user-star', social:'ti-brand-instagram', afa_recht:'ti-trending-down',
        };
        const LEVEL_COLORS = { 'Einsteiger':'#22c55e', 'Fortgeschritten':'#3b82f6', 'Profi':'#8b93f8' };

        // ── SVG progress ring ────────────────────────────────────────────
        const RADIUS = 16, CIRC = 2 * Math.PI * RADIUS;
        const ringFor = (pct, accent) => {
            const offset = (CIRC - (pct / 100) * CIRC).toFixed(1);
            return `<svg width="40" height="40" viewBox="0 0 40 40" style="transform:rotate(-90deg);flex-shrink:0;">
                <circle cx="20" cy="20" r="${RADIUS}" fill="none" stroke="var(--bg-secondary)" stroke-width="3.5"/>
                <circle cx="20" cy="20" r="${RADIUS}" fill="none" stroke="${accent}" stroke-width="3.5"
                    stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${offset}"
                    stroke-linecap="round" style="transition:stroke-dashoffset .4s ease;"/>
            </svg>`;
        };

        // ── "Weiter lernen" banner ───────────────────────────────────────
        let nextLesson = null, nextModule = null;
        for (const m of this.MODULES) {
            for (const l of m.lessons) {
                if (!progress.completedLessons.includes(l.id)) { nextLesson = l; nextModule = m; break; }
            }
            if (nextLesson) break;
        }
        const continueBanner = nextLesson ? `
        <div id="akademieContinueBanner" class="card hover-dim" style="display:flex;align-items:center;gap:16px;padding:14px 18px;margin-bottom:18px;border-left:3px solid var(--accent);cursor:pointer;transition:opacity .15s;">
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(16,185,129,.13);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="ti ti-player-play-filled" style="color:var(--accent);font-size:18px;"></i>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;font-weight:600;">Weiter lernen</div>
                <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(nextLesson.title)}</div>
                <div style="font-size:11px;color:var(--text-secondary);">${Utils.escapeHtml(nextModule.title)} · ${Utils.escapeHtml(nextLesson.duration)}</div>
            </div>
            <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:20px;flex-shrink:0;"></i>
        </div>` : '';

        // ── KPI cards ────────────────────────────────────────────────────
        const kpiCards = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
            <div class="card stat-card info">
                <div class="card-label"><i class="ti ti-book" style="margin-right:4px;vertical-align:middle;font-size:12px;"></i>Lern-Fortschritt</div>
                <div class="card-value">${readPercent}%</div>
                <div class="card-subtitle">${progress.completedLessons.length} / ${totalLessons} Lektionen</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label"><i class="ti ti-trophy" style="margin-right:4px;vertical-align:middle;font-size:12px;"></i>Achievements</div>
                <div class="card-value">${unlockedCount} / ${totalAchievements}</div>
                <div class="card-subtitle">${totalAchievements > 0 ? Math.round(unlockedCount/totalAchievements*100) : 0}% freigeschaltet</div>
            </div>
            <div class="card stat-card">
                <div class="card-label"><i class="ti ti-package" style="margin-right:4px;vertical-align:middle;font-size:12px;"></i>Aktiver Lagerbestand</div>
                <div class="card-value">${data.activeStock ?? 0}</div>
                <div class="card-subtitle">verfügbare Artikel</div>
            </div>
            <div class="card stat-card warning">
                <div class="card-label"><i class="ti ti-cash" style="margin-right:4px;vertical-align:middle;font-size:12px;"></i>Gesamt-Umsatz</div>
                <div class="card-value">${Utils.formatCurrency(data.totalRevenue)}</div>
                <div class="card-subtitle">${(data.sales || []).length} Verkäufe</div>
            </div>
        </div>`;

        // ── Module cards ─────────────────────────────────────────────────
        const moduleCards = this.MODULES.map(m => {
            const done = m.lessons.filter(l => progress.completedLessons.includes(l.id)).length;
            const pct  = m.lessons.length > 0 ? Math.round(done / m.lessons.length * 100) : 0;
            const isComplete   = done === m.lessons.length;
            const lvlColor     = LEVEL_COLORS[m.level] || 'var(--accent)';
            const iconKey      = MOD_ICONS[m.id] || 'ti-book';
            const ring         = ringFor(pct, isComplete ? '#22c55e' : lvlColor);
            const lvlBadge     = `<span style="display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;background:${lvlColor}22;color:${lvlColor};border:1px solid ${lvlColor}44;text-transform:uppercase;">${m.level}</span>`;
            return `
            <div class="card akademie-mod-card" data-mod-id="${m.id}" style="cursor:pointer;padding:16px 18px;border-left:3px solid ${isComplete ? '#22c55e' : lvlColor};transition:border-color .2s,box-shadow .2s;">
                <div style="display:flex;align-items:flex-start;gap:12px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:${lvlColor}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                        <i class="ti ${iconKey}" style="color:${lvlColor};font-size:20px;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;flex-wrap:wrap;">
                            <span style="font-weight:700;font-size:14px;">${Utils.escapeHtml(m.title)}</span>
                            ${lvlBadge}
                        </div>
                        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.4;">${Utils.escapeHtml(m.description)}</div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="flex:1;background:var(--bg-secondary);border-radius:6px;height:5px;overflow:hidden;">
                                <div style="height:100%;background:${isComplete ? '#22c55e' : lvlColor};width:${pct}%;transition:width .35s;"></div>
                            </div>
                            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${done}/${m.lessons.length}</span>
                        </div>
                    </div>
                    <div style="position:relative;flex-shrink:0;margin-top:2px;" title="${pct}% abgeschlossen">
                        ${ring}
                        <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:9px;font-weight:700;color:${isComplete ? '#22c55e' : 'var(--text-muted)'};">${isComplete ? '✓' : pct+'%'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        // ── Tier pills ───────────────────────────────────────────────────
        const TIER_LABELS = { bronze:'Bronze', silver:'Silber', gold:'Gold' };
        const achBadges = this.ACHIEVEMENTS.map(a => {
            const isUnlocked = progress.unlockedAchievements.includes(a.id);
            const colors = this.TIER_COLORS[a.tier];
            const tierPill = `<span style="display:inline-block;padding:1px 6px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:.4px;background:${colors.bg};color:${colors.color};border:1px solid ${colors.border}40;text-transform:uppercase;">${TIER_LABELS[a.tier]||a.tier}</span>`;
            return `
            <div class="akademie-ach" style="border:1px solid ${isUnlocked ? colors.border+'80' : 'var(--border)'};background:${isUnlocked ? colors.bg : 'transparent'};border-radius:10px;padding:12px 14px;display:flex;gap:12px;align-items:center;${isUnlocked ? `box-shadow:0 0 12px ${colors.border}25;` : 'opacity:.45;'}">
                <span style="font-size:28px;flex-shrink:0;${isUnlocked ? '' : 'filter:grayscale(1);'}">${a.icon}</span>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
                        <span style="font-weight:700;font-size:13px;color:${isUnlocked ? colors.color : 'var(--text-secondary)'};">${Utils.escapeHtml(a.title)}</span>
                        ${tierPill}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);line-height:1.35;">${Utils.escapeHtml(a.desc)}</div>
                </div>
                ${isUnlocked
                    ? '<span style="font-size:18px;color:var(--success);flex-shrink:0;"><i class="ti ti-circle-check-filled"></i></span>'
                    : '<span style="font-size:14px;opacity:.35;flex-shrink:0;"><i class="ti ti-lock"></i></span>'}
            </div>`;
        }).join('');

        return `
            <div class="page-header">
                <h2><i class="ti ti-school"></i> Akademie</h2>
            </div>

            ${continueBanner}
            ${kpiCards}

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                <i class="ti ti-books" style="color:var(--accent);font-size:18px;"></i>
                <h3 style="margin:0;font-size:17px;font-weight:700;">Lernpfad</h3>
                <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${this.MODULES.length} Module</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:26px;">
                ${moduleCards}
            </div>

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                <i class="ti ti-trophy" style="color:#fbbf24;font-size:18px;"></i>
                <h3 style="margin:0;font-size:17px;font-weight:700;">Achievements</h3>
                <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${unlockedCount} / ${totalAchievements} freigeschaltet</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">
                ${achBadges}
            </div>
        `;
    },

    _renderLesson() {
        const mod = this.MODULES.find(m => m.id === this._activeModule);
        const lesson = mod && mod.lessons.find(l => l.id === this._activeLesson);
        if (!lesson) {
            this._activeLesson = null;
            return this.render();
        }
        const progress = this._getProgress();
        const isComplete = progress.completedLessons.includes(lesson.id);
        const idx = mod.lessons.findIndex(l => l.id === lesson.id);
        const prev = idx > 0 ? mod.lessons[idx-1] : null;
        const next = idx < mod.lessons.length - 1 ? mod.lessons[idx+1] : null;

        return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
                <button class="btn btn-small" id="lessonBackBtn" style="opacity:.7;">← Akademie</button>
                <div>
                    <div style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(mod.icon)} ${Utils.escapeHtml(mod.title)} · Lektion ${idx+1}/${mod.lessons.length} · ${Utils.escapeHtml(lesson.duration)}</div>
                    <h2 style="margin:2px 0 0;">${Utils.escapeHtml(lesson.title)}</h2>
                </div>
            </div>

            <div class="card akademie-lesson-content" style="padding:24px 28px;line-height:1.6;font-size:14px;max-width:780px;">
                ${lesson.content}
            </div>

            <div style="display:flex;align-items:center;gap:12px;margin-top:20px;flex-wrap:wrap;max-width:780px;">
                ${prev ? `<button class="btn" id="lessonPrevBtn" style="opacity:.8;">← ${Utils.escapeHtml(prev.title)}</button>` : '<span></span>'}
                <div style="flex:1;"></div>
                ${isComplete
                    ? `<span style="color:var(--success);font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px;"><i class="ti ti-circle-check-filled"></i> Abgeschlossen</span>`
                    : `<button class="btn btn-primary" id="lessonCompleteBtn"><i class="ti ti-check"></i> Als gelesen markieren</button>`
                }
                ${next ? `<button class="btn btn-primary" id="lessonNextBtn">${Utils.escapeHtml(next.title)} →</button>` : ''}
            </div>
        `;
    },

    _renderModuleDetail(modId) {
        const mod = this.MODULES.find(m => m.id === modId);
        if (!mod) return this.render();
        const progress = this._getProgress();

        const lessonList = mod.lessons.map((l, i) => {
            const done = progress.completedLessons.includes(l.id);
            return `
            <div class="card akademie-lesson-row" data-lesson-id="${l.id}" data-mod-id="${mod.id}" style="cursor:pointer;padding:14px 16px;display:flex;align-items:center;gap:14px;${done ? 'opacity:.85;' : ''}">
                <span style="font-size:20px;width:32px;text-align:center;color:${done ? 'var(--success)' : 'var(--text-muted)'};">${done ? '<i class="ti ti-circle-check-filled"></i>' : (i === 0 || progress.completedLessons.includes(mod.lessons[i-1]?.id)) ? '<i class="ti ti-book-open"></i>' : '<i class="ti ti-lock" style="opacity:.4;"></i>'}</span>
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:14px;">${Utils.escapeHtml(l.title)}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(l.duration)}</div>
                </div>
                <span style="font-size:18px;color:var(--text-muted);">›</span>
            </div>
            `;
        }).join('');

        return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
                <button class="btn btn-small" id="modBackBtn" style="opacity:.7;">← Akademie</button>
                <div>
                    <h2 style="margin:0;">${Utils.escapeHtml(mod.icon)} ${Utils.escapeHtml(mod.title)}</h2>
                    <div style="font-size:13px;color:var(--text-secondary);">${Utils.escapeHtml(mod.description)}</div>
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;max-width:680px;">
                ${lessonList}
            </div>
        `;
    },

    init() {
        // GSAP KPI animation
        if (typeof gsap !== 'undefined') {
            const cards = document.querySelectorAll('.stats-grid .stat-card');
            if (cards.length) {
                gsap.from(cards, { y: 16, opacity: 0, stagger: 0.07, duration: 0.4, ease: 'power2.out', clearProps: 'all' });
                cards.forEach(card => {
                    const valEl = card.querySelector('.card-value');
                    if (!valEl) return;
                    const raw = valEl.textContent.trim();
                    // Skip ratio values like "10 / 27" — don't try to count them up
                    if (raw.includes('/') || (raw.match(/\d/) && raw.match(/[a-zA-Z]/) && !raw.includes('€') && !raw.includes('%'))) return;
                    const num = parseFloat(raw.replace(/\./g,'').replace(',','.').replace(/[^\d.%€-]/g,''));
                    if (isNaN(num) || num === 0) return;
                    const hasCurrency = raw.includes('€'), hasPct = raw.includes('%');
                    const obj = { val: 0 };
                    gsap.to(obj, { val: num, duration: 0.9, ease: 'power2.out',
                        onUpdate() {
                            if (hasCurrency) valEl.textContent = obj.val.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
                            else if (hasPct) valEl.textContent = Math.round(obj.val) + '%';
                            else valEl.textContent = Math.round(obj.val).toLocaleString('de-DE');
                        },
                        onComplete() { valEl.textContent = raw; }
                    });
                });
                // Module cards stagger
                const modCards = document.querySelectorAll('.akademie-mod-card');
                if (modCards.length) gsap.from(modCards, { y: 20, opacity: 0, stagger: 0.06, duration: 0.45, ease: 'power2.out', delay: 0.25, clearProps: 'all' });
            }
        }

        // Lektion offen
        if (this._activeLesson) {
            const back = document.getElementById('lessonBackBtn');
            if (back) back.addEventListener('click', () => { this._activeLesson = null; this._activeModule = null; App.navigate('akademie'); });

            const complete = document.getElementById('lessonCompleteBtn');
            if (complete) complete.addEventListener('click', () => {
                this.markLessonComplete(this._activeLesson);
                App.navigate('akademie');
            });

            const mod = this.MODULES.find(m => m.id === this._activeModule);
            const idx = mod ? mod.lessons.findIndex(l => l.id === this._activeLesson) : -1;
            const prev = mod && idx > 0 ? mod.lessons[idx-1] : null;
            const next = mod && idx < (mod.lessons.length - 1) ? mod.lessons[idx+1] : null;

            const prevBtn = document.getElementById('lessonPrevBtn');
            if (prevBtn && prev) prevBtn.addEventListener('click', () => { this._activeLesson = prev.id; App.navigate('akademie'); });

            const nextBtn = document.getElementById('lessonNextBtn');
            if (nextBtn && next) nextBtn.addEventListener('click', () => { this._activeLesson = next.id; App.navigate('akademie'); });

            return;
        }

        // Modul-Detail offen
        if (this._activeModule) {
            const back = document.getElementById('modBackBtn');
            if (back) back.addEventListener('click', () => { this._activeModule = null; App.navigate('akademie'); });

            document.querySelectorAll('.akademie-lesson-row').forEach(row => {
                row.addEventListener('click', () => {
                    this._activeModule = row.dataset.modId;
                    this._activeLesson = row.dataset.lessonId;
                    App.navigate('akademie');
                });
            });
            return;
        }

        // "Weiter lernen" Banner
        const continueBannerEl = document.getElementById('akademieContinueBanner');
        if (continueBannerEl) {
            continueBannerEl.addEventListener('click', () => {
                const progress = this._getProgress();
                for (const m of this.MODULES) {
                    for (const l of m.lessons) {
                        if (!progress.completedLessons.includes(l.id)) {
                            this._activeModule = m.id;
                            this._activeLesson = l.id;
                            App.navigate('akademie');
                            return;
                        }
                    }
                }
            });
        }

        // Übersichts-Seite
        document.querySelectorAll('.akademie-mod-card').forEach(card => {
            card.addEventListener('click', () => {
                this._activeModule = card.dataset.modId;
                this._activeLesson = null;
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this._renderModuleDetail(this._activeModule);
                this.init();
            });
        });

        // Bei Öffnen der Akademie: neue Achievements prüfen
        this.checkNewAchievements();
    }
};
