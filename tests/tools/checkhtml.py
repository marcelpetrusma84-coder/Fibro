import re, sys, subprocess, os, tempfile
uit = sys.argv[1]; fout = 0
for p in sys.argv[2:]:
    t = open(p, encoding='utf-8').read()
    for i, m in enumerate(re.finditer(r'<script([^>]*)>(.*?)</script>', t, re.S)):
        attrs, body = m.group(1), m.group(2)
        if 'src=' in attrs or not body.strip(): continue
        ext = '.mjs' if 'module' in attrs else '.js'
        f = os.path.join(uit, os.path.basename(p) + '-' + str(i) + ext)
        open(f, 'w', encoding='utf-8').write(body)
        r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
        if r.returncode: fout += 1; print('FOUT', p, i, r.stderr[:500])
print('scripts gecontroleerd, fouten:', fout)
