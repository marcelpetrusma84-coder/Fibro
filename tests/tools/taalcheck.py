# taalcheck.py - heeft elke Nederlandse tekst een Engelse vertaling? (v142, 11 oktober 2026)
# Zoekt alle sleutels: T('...'), vt('...') en vertaal('...') (v147: spellen) in de code, data-t / data-t-attr in de html (via Chromium, zonder
# scripts: DOMParser), plus de vaste lijstjes die met T(variabele) vertaald worden (widgettitels, steden).
# Vergelijkt met taal-en.js: ontbrekend = FOUT, overbodig = melding, invulplekken {..} en html-tags moeten
# gelijk zijn, en in attributen geen ". Elke T( moet met een enkele '...'-tekst beginnen.
# python3 -I taalcheck.py <map> <poort> <bestand> [bestand ...]
#   bv. python3 -I taalcheck.py ~/w/nieuw 8790 index.html login.html invite.html opslag.js beltoon.js
import sys, re, json, subprocess, asyncio, http.server, functools, threading, os
MAP, POORT, BESTANDEN = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
VAST = {  # met T(variabele) vertaald: deze moeten er ook in staan
 'index.html': ['Wereldklok', 'Datum', 'Online vrienden', 'Laatste bericht', 'Batterij', 'Activiteit', 'Poll', 'Afteltimer', 'Gastenboek', 'Mood',
                'Muziek player', 'Quote', 'Video', 'Foto grid 3×3', 'Foto grid 2×2', 'Grote foto', 'Foto strip', 'Portret strip', 'Uitgelicht + 4 klein',
                'Polaroid grid', 'Zwevende Polaroids', 'Opteltimer', 'Tic-Tac-Toe', 'Four in a Row', 'Flapper', 'Chess', 'Draughts', 'Neo Paddle',
                'Ghost Tag', 'Block It', 'The Swarm', 'Twin Snakes', 'Runner & Gunner',
                'Amsterdam', 'Londen', 'New York', 'Los Angeles', 'Tokio', 'Dubai', 'Sydney', 'Parijs', 'Berlijn', 'Moskou', 'Bangkok', 'Singapore',
                'Hong Kong', 'Mumbai', 'São Paulo', 'Kaapstad', 'Mexico-Stad', 'Chicago', 'Seoul', 'Istanbul'],
 'moderatie.html': ['Ongewenste berichten', 'Bedreiging of intimidatie', 'Ongepaste inhoud', 'Iets anders',  # T(r.reden)
                    'status|nieuw', 'status|behandeld', 'status|gewaarschuwd', 'status|geblokkeerd'],  # T('status|' + r.status)
 'chat.html': ['Ongewenste berichten', 'Bedreiging of intimidatie', 'Ongepaste inhoud', 'Iets anders',  # redenen om te melden
               'Pop', 'Klingel', 'Boing', 'Plop', 'Sparkle', 'Drum', 'Swoosh', 'Chime', 'Hartje', 'Ding'],  # geluiden voor stickers
}
def ontcijfer(s):
    uit, i = [], 0
    while i < len(s):
        c = s[i]
        if c != '\\': uit.append(c); i += 1; continue
        n = s[i + 1]
        if n == 'n': uit.append('\n'); i += 2
        elif n == 't': uit.append('\t'); i += 2
        elif n == 'u' and s[i + 2] == '{': j = s.index('}', i); uit.append(chr(int(s[i + 3:j], 16))); i = j + 1
        elif n == 'u': uit.append(chr(int(s[i + 2:i + 6], 16))); i += 6
        else: uit.append(n); i += 2
    return ''.join(uit).encode('utf-16', 'surrogatepass').decode('utf-16')
fout = 0
def meld(t):
    global fout; fout += 1; print('FOUT', t)
code = set()
TOEGESTAAN = ('w.titel', 'stad.naam', 's)', 'nl,', 's, v)', 'r)', 'g.naam', "'lettertype|'+f.stijl)", 'r.reden)')
for p in BESTANDEN:
    s = open(os.path.join(MAP, p), encoding='utf-8').read()
    if p == 'taal.js': continue
    for m in re.finditer(r"(?:(?<=window\.)|(?<![\w.$]))(T|vt|vertaal)\(", s):  # vertaal: in spellen die T zelf gebruiken
        rest = s[m.end():]
        if rest.startswith("'"):
            k = re.match(r"'((?:[^'\\\n]|\\.)*)'", rest)
            if k and rest[k.end():].lstrip().startswith('+') and k.group(1).endswith('|'): continue  # T('context|' + iets): zie VAST
            if not k or rest[k.end():k.end() + 1] not in (')', ','): meld('geen enkele tekst in %s: %s' % (p, rest[:70])); continue
            code.add(ontcijfer(k.group(1)))
        elif not rest.startswith(TOEGESTAAN): meld('T( zonder vaste tekst in %s: %s' % (p, rest[:60].replace('\n', ' ')))
    code.update(VAST.get('index.html' if p == 'vriend-profiel.html' else p, []))
    if p == 'profiel.html':  # lettertypen: T('lettertype|' + label), de labels staan in lettertypes.js
        code.update('lettertype|' + l for l in re.findall(r"label: '([^']+)'", open(os.path.join(MAP, 'lettertypes.js'), encoding='utf-8').read()))
# html via Chromium
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', POORT), functools.partial(H, directory=MAP))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""async (pg) => { const t = await (await fetch(pg)).text(); const d = new DOMParser().parseFromString(t, 'text/html');
 const norm = s => String(s).replace(/\s+/g, ' ').trim(); const uit = [];
 d.querySelectorAll('[data-t]').forEach(e => uit.push(norm(e.children.length ? e.innerHTML : e.textContent)));
 d.querySelectorAll('[data-t-attr]').forEach(e => e.getAttribute('data-t-attr').split(',').forEach(n => { const w = e.getAttribute(n.trim()); if (w != null) uit.push('ATTR:' + norm(w)) }));
 return uit }"""
async def html_sleutels():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); p = await b.new_page()
        await p.goto('http://127.0.0.1:%d/taal.js' % POORT)
        r = []
        for f in BESTANDEN:
            if f.endswith('.html'): r += await p.evaluate(JS, f)
        await b.close(); return r
ruw = asyncio.run(html_sleutels()); srv.shutdown()
attr = {k[5:] for k in ruw if k.startswith('ATTR:')}
html = {k for k in ruw if not k.startswith('ATTR:')} | attr
en = json.loads(subprocess.check_output(['node', '-e', "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.FIBRO_EN))", os.path.abspath(os.path.join(MAP, 'taal-en.js'))]))
nodig = code | html
for k in sorted(nodig - set(en)): meld('geen vertaling: %r' % k)
over = sorted(set(en) - nodig)
for k, v in en.items():
    a = sorted(set(re.findall(r'\{(\w+)\}', k)) - {'app'}); b = sorted(set(re.findall(r'\{(\w+)\}', v)) - {'app'})
    if a != b: meld('invulplekken anders: %r %s %s' % (k, a, b))
    if re.findall(r'<[^>]+>', k) != re.findall(r'<[^>]+>', v): meld('html anders: %r' % k)
    if k in attr and '"' in v: meld('aanhalingsteken in een attribuut: %r' % k)
print('nodig %d, in taal-en.js %d, niet (meer) gebruikt %d%s' % (len(nodig), len(en), len(over), (': ' + ', '.join(map(repr, over[:20]))) if over else ''))
print('taalcheck: ' + ('GOED' if not fout else '%d FOUT' % fout))
sys.exit(1 if fout else 0)
