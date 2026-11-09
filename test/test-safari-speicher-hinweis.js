// Safari-Speicher-Hinweis (js/safari-speicher-hinweis.js): wer sieht die Warnung vor der
// 7-Tage-Loeschfrist von WebKit? Nur Safari/iOS, nur mit Firma, nur ohne gesunden Sync.
const H = require('../js/safari-speicher-hinweis.js');

let fails = 0;
function check(name, ok) {
    console.log((ok ? 'OK   ' : 'FAIL ') + name);
    if (!ok) fails++;
}

const UA = {
    safariMac:  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    chromeMac:  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    edgeMac:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
    iphone:     'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    chromeIos:  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
    chromeWin:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
};

check('W1 Safari Mac -> WebKit-Frist', H.istWebKitMitLoeschfrist(UA.safariMac, 0));
check('W2 Chrome Mac -> nein', !H.istWebKitMitLoeschfrist(UA.chromeMac, 0));
check('W3 Edge Mac -> nein', !H.istWebKitMitLoeschfrist(UA.edgeMac, 0));
check('W4 Firefox Mac -> nein', !H.istWebKitMitLoeschfrist(UA.firefoxMac, 0));
check('W5 iPhone Safari -> ja', H.istWebKitMitLoeschfrist(UA.iphone, 5));
check('W6 Chrome auf iPhone -> ja (auch WebKit)', H.istWebKitMitLoeschfrist(UA.chromeIos, 5));
check('W7 iPad als Mac getarnt -> ja', H.istWebKitMitLoeschfrist(UA.safariMac, 5));
check('W8 Chrome Windows -> nein', !H.istWebKitMitLoeschfrist(UA.chromeWin, 0));

const basis = { ua: UA.safariMac, maxTouchPoints: 0, standalone: false, hatFirma: true, syncGesund: false, verstecktBis: 0, jetzt: 1000 };
const mit = (o) => Object.assign({}, basis, o);

check('S1 Safari, Firma, kein Sync -> zeigen', H.sollZeigen(basis));
check('S2 Sync gesund -> nicht zeigen', !H.sollZeigen(mit({ syncGesund: true })));
check('S3 ohne Firma -> nicht zeigen', !H.sollZeigen(mit({ hatFirma: false })));
check('S4 installierte Web-App -> nicht zeigen', !H.sollZeigen(mit({ standalone: true })));
check('S5 ausgeblendet bis spaeter -> nicht zeigen', !H.sollZeigen(mit({ verstecktBis: 2000 })));
check('S6 Ausblendung abgelaufen -> wieder zeigen', H.sollZeigen(mit({ verstecktBis: 500 })));
check('S7 Chrome -> nie zeigen', !H.sollZeigen(mit({ ua: UA.chromeMac })));

if (fails) { console.log(fails + ' Fehler'); process.exit(1); }
console.log('Alle Tests bestanden');
