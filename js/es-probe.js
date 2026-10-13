// Stackr — Sprachprobe für js/browser-check.js
// Diese Datei nutzt bewusst `?.` und `??` (ES2020), wie 19 Dateien in js/. Ein Browser, der
// das nicht kennt (Chrome/Edge < 80, Firefox < 74, Safari < 13.1), verwirft die ganze Datei mit
// einem SyntaxError — die Marke unten bleibt dann ungesetzt, und js/browser-check.js zeigt
// einen Hinweis statt einer halb geladenen App. Kein eval/new Function: die CSP verbietet es.
window.__stackrEs2020 = ({ a: 1 })?.a === 1 && (null ?? 2) === 2;
