import base64, os

root = os.path.dirname(os.path.abspath(__file__))

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

inter = b64(os.path.join(root, 'fonts', 'inter-var-latin.woff2'))
fraun = b64(os.path.join(root, 'fonts', 'fraunces-var-latin.woff2'))

os.makedirs(os.path.join(root, 'deploy'), exist_ok=True)

def build(src, dst, fix_legal=False):
    with open(src, 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('fonts/inter-var-latin.woff2', 'data:font/woff2;base64,' + inter)
    html = html.replace('fonts/fraunces-var-latin.woff2', 'data:font/woff2;base64,' + fraun)
    if fix_legal:
        for p in ('datenschutz.html', 'impressum.html', 'agb.html'):
            html = html.replace('href="%s"' % p, 'href="https://track-your-income-app.vercel.app/%s"' % p)
    # sanity: no relative font/legal refs left
    assert 'fonts/inter-var-latin.woff2' not in html
    assert 'fonts/fraunces-var-latin.woff2' not in html
    with open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('wrote', os.path.relpath(dst, root), round(len(html.encode('utf-8'))/1024), 'KB')

build(os.path.join(root, 'stackr-broschuere.html'), os.path.join(root, 'deploy', 'index.html'), True)
build(os.path.join(root, 'stackr-onepager.html'), os.path.join(root, 'deploy', 'onepager.html'), False)
print('done')
