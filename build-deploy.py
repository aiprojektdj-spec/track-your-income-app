"""Optionales Deployment-Verzeichnis aus den aktuellen oeffentlichen Quellen erzeugen.

Das normale Vercel-Deployment nutzt das Repository direkt, ohne Build-Schritt.
Auch diese lokale Exportvariante verwendet ausschliesslich index.html als Startseite.
"""

import base64
from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parent
DEPLOY = ROOT / 'deploy'

# App, Rechtstexte und Serverless-Funktionen bleiben auch beim Export erreichbar.
# Keine Arbeitsdateien, Umgebungsvariablen oder Vercel-Verknuepfung kopieren.
FILES = (
    'index.html', 'landing-v2.html', 'app.html', 'agb.html', 'barrierefreiheit.html', 'cookies.html',
    'datenschutz.html', 'impressum.html', 'refund.html',
    'verfahrensdokumentation.html', 'icon-stackr.svg', 'og-image.png',
    'manifest.json', 'robots.txt', 'sitemap.xml', 'vercel.json',
    'package.json', 'package-lock.json', '.vercelignore',
    'stackr-broschuere.html', 'stackr-onepager.html',
)
DIRECTORIES = ('api', 'assets', 'css', 'eigenbelege', 'fonts', 'js', 'lager', 'rechnungen')


def build():
    DEPLOY.mkdir(exist_ok=True)
    for name in FILES:
        shutil.copy2(ROOT / name, DEPLOY / name)
    for name in DIRECTORIES:
        shutil.copytree(
            ROOT / name, DEPLOY / name, dirs_exist_ok=True,
            ignore=shutil.ignore_patterns('*.md', 'ui-lab.*', '__pycache__'),
        )

    # Die bisherige eigenstaendige Onepager-Ausgabe als Referenz erhalten.
    onepager = (ROOT / 'stackr-onepager.html').read_text(encoding='utf-8')
    for font in ('inter-var-latin.woff2', 'fraunces-var-latin.woff2'):
        data = base64.b64encode((ROOT / 'fonts' / font).read_bytes()).decode('ascii')
        onepager = onepager.replace('fonts/' + font, 'data:font/woff2;base64,' + data)
    (DEPLOY / 'onepager.html').write_text(onepager, encoding='utf-8', newline='\n')

    print('deploy/index.html entspricht index.html; App, Rechtstexte, Assets und API kopiert.')
    print('Die lokale Vorschau fuehrt keine Serverless-Funktionen aus.')


if __name__ == '__main__':
    build()
