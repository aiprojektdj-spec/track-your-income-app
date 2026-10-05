"""Tabler Icons auf die im Projekt genutzten Icons verkleinern.

Die volle Schrift hat ~5.000 Icons (447 KB woff2, 209 KB CSS). Stackr nutzt davon ~190.
Quelle bleibt unveraendert in scripts/vendor-src/ (nicht im Deployment, .vercelignore).
Erzeugt css/vendor/tabler-icons.min.css und css/vendor/fonts/tabler-icons.woff2 neu.

Nach jedem neuen Icon (ti-...) im Code erneut ausfuehren:
    pip install fonttools brotli
    python scripts/subset-icons.py
test/test-icon-subset.js schlaegt fehl, solange ein genutztes Icon in der Teilmenge fehlt.
"""
import hashlib
import io
import os
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "vendor-src")
OUT_CSS = os.path.join(ROOT, "css", "vendor", "tabler-icons.min.css")
OUT_FONT = os.path.join(ROOT, "css", "vendor", "fonts", "tabler-icons.woff2")

# Muss zu test/test-icon-subset.js passen.
SKIP_DIRS = {"node_modules", "plan", "test", "docs", "scripts", "compliance", ".git", ".vercel",
             "graphify-out", "kosit-proben", "vendor"}
EXTS = (".html", ".js", ".css")
ICON_RE = re.compile(r"ti-[a-z0-9]+(?:-[a-z0-9]+)*")
RULE_RE = re.compile(r'([^{}]+)\{content:"\\([0-9a-f]+)"\}')


def used_icons():
    names = set()
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith(EXTS):
                with open(os.path.join(base, f), encoding="utf-8", errors="ignore") as fh:
                    names.update(ICON_RE.findall(fh.read()))
    return names


def main():
    with open(os.path.join(SRC, "tabler-icons.min.css"), encoding="utf-8") as fh:
        css = fh.read()

    head_end = css.index(".ti-")  # Lizenz-Kommentar, @font-face und .ti-Grundregel
    head = css[:head_end]

    names = used_icons()
    rules, codepoints = [], set()
    for selectors, code in RULE_RE.findall(css[head_end:]):
        keep = [s for s in selectors.split(",") if s.strip()[1:].split(":")[0] in names]
        if keep:
            rules.append(",".join(keep) + '{content:"\\' + code + '"}')
            codepoints.add(int(code, 16))

    font = TTFont(os.path.join(SRC, "tabler-icons.woff2"))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = []
    opts.name_IDs = ["*"]  # Lizenz-/Namenseintraege behalten
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=codepoints)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    data = buf.getvalue()
    with open(OUT_FONT, "wb") as fh:
        fh.write(data)

    # Neuer Query-String je Inhalt, damit kein Browser die alte Schrift weiterverwendet.
    version = "v3.44.0-" + hashlib.sha256(data).hexdigest()[:8]
    head = re.sub(r"tabler-icons\.woff2\?[^\")]+", "tabler-icons.woff2?" + version, head)
    with open(OUT_CSS, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(head + "".join(rules) + "\n")

    print(f"{len(rules)} Icons, Schrift {len(data) // 1024} KB, CSS {os.path.getsize(OUT_CSS) // 1024} KB")


if __name__ == "__main__":
    main()
