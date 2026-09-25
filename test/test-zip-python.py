# Gegenprobe zum ZIP-Schreiber aus js/zip.js
#
# Ein selbstgebautes Archiv, das nur der eigene Code fuer gueltig haelt, ist wertlos.
# Dieses Skript oeffnet dasselbe Archiv mit Pythons zipfile — einer fremden, vollstaendigen
# Implementierung, die auch die CRC-Pruefsummen nachrechnet (testzip/read).
#
# Reihenfolge:
#   node test/test-zip.js        (schreibt die Probe)
#   python test/test-zip-python.py

import os
import sys
import zipfile

HIER = os.path.dirname(os.path.abspath(__file__))
PROBE = os.path.join(HIER, '..', 'node_modules', '.cache', 'test-zip-probe.zip')

if not os.path.exists(PROBE):
    print('FAIL  Probe fehlt — zuerst "node test/test-zip.js" laufen lassen.')
    sys.exit(1)

ok, schlecht = 0, 0


def check(name, bedingung, detail=''):
    global ok, schlecht
    if bedingung:
        ok += 1
        print('  OK   ' + name)
    else:
        schlecht += 1
        print('  FAIL ' + name + ('  -> ' + str(detail) if detail else ''))


with zipfile.ZipFile(PROBE) as z:
    # testzip() rechnet jede CRC-32 nach und gibt den Namen der ersten kaputten Datei
    # zurueck — das ist die eigentliche Aussage dieses Skripts.
    kaputt = z.testzip()
    check('Keine Datei mit falscher CRC-32', kaputt is None, kaputt)

    namen = z.namelist()
    check('Vier Eintraege', len(namen) == 4, namen)
    check('index.xml vorhanden', 'index.xml' in namen)
    check('Unterordner bleibt Unterordner', 'daten/einkaeufe.csv' in namen, namen)
    check('Umlaut und Kaufmanns-Und im Dateinamen ueberleben',
          'belege/Bon Müller & Co.jpg' in namen, namen)

    check('CSV-Inhalt unveraendert',
          z.read('daten/einkaeufe.csv').decode('utf-8') == 'id;datum;betrag\n1;05.01.2026;1234,56\n')
    check('Binaerdatei byte-identisch',
          z.read('belege/Bon Müller & Co.jpg') == bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]))
    check('Leere Datei ist leer und nicht kaputt', z.read('leer.txt') == b'')

    info = z.getinfo('index.xml')
    check('Methode ist "gespeichert" (store)', info.compress_type == zipfile.ZIP_STORED,
          info.compress_type)
    check('UTF-8-Flag gesetzt', bool(info.flag_bits & 0x800), hex(info.flag_bits))
    check('Groessen stimmen ueberein', info.compress_size == info.file_size)
    check('Zeitstempel ist plausibel (>= 2020)', info.date_time[0] >= 2020, info.date_time)

print('\n%d OK, %d FAIL' % (ok, schlecht))
sys.exit(1 if schlecht else 0)
