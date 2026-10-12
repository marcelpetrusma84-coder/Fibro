import subprocess, sys, time, json, os, random, re
from playwright.sync_api import sync_playwright
# proef44: de spellen in twee talen (v147; v148: Block It krijgt rijen van de vriend). Elk spel wordt echt gespeeld, met een vaste klok en een vaste
# Math.random, zodat oud en nieuw precies hetzelfde spel spelen. Tekst = zichtbare tekst + title/aria-label
# + alles wat met fillText/strokeText op een canvas getekend wordt, verzameld over het hele spel.
#  - Nederlands: precies dezelfde teksten als de oude code. Geen nieuwe fouten.
#  - Engels: geen '[taal] nog geen vertaling', geen Nederlandse woorden, geen fouten.
# Alleen spelen gaat via spel.html (met de computerspeler); samen spelen via een proefpagina met een
# nagemaakt spelkanaal (spelproef.html, wordt hier gemaakt), waarin we berichten van de 'vriend' nadoen.
# python3 -I proef44.py <scratch met tools/server.py> <nieuwe map> <poort> [oude map|-] [filter]
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); OUD = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
FILTER = sys.argv[5] if len(sys.argv) > 5 else ''
HARNAS = r"""<!doctype html><html lang="nl" data-taal><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="taal.js"></script><title>Spelproef</title>
<style>body{margin:0;background:#1a0a2e;color:white;font-family:sans-serif} #spelOverlay{position:fixed;inset:0;display:flex;flex-direction:column}
#spelInhoud{flex:1;display:flex;align-items:center;justify-content:center;position:relative}</style></head><body>
<div id="spelOverlay"><div id="spelTitelBar"></div><div id="spelInhoud" style="width:100%;height:100%"></div><div id="spelChatWrap">chat</div></div>
<script type="module">
const q = new URLSearchParams(location.search)
const h = []
window.__verzonden = []
const kanaal = { topic: 'realtime:spel-proef-1', on(t, f, cb) { h.push([f && f.event, cb]); return kanaal },
  send(m) { window.__verzonden.push(m); return Promise.resolve('ok') }, subscribe(fn) { if (fn) fn('SUBSCRIBED'); return kanaal } }
window.__stuur = (event, payload) => h.filter(x => x[0] === event).forEach(x => x[1]({ type: 'broadcast', event, payload: payload || {} }))
const mod = q.get('mod')
const m = await import('./' + mod)
const extra = { Bordgeluid: await import('./bordgeluid.js') }
if (mod.startsWith('schaken')) extra.Schaak = await import('./schaak.js')
if (mod.startsWith('dammen')) extra.Dammen = await import('./dammen.js')
window.__klaar = true
await m.start({ ...extra, spelKanaal: kanaal, benIkSpeler1: q.get('rol') === 'host', vriendNaam: 'Bram', isActief: () => true })
</script></body></html>"""
def www(naam, map_):
    d = S + '/www44_' + naam + '_' + str(PORT) + '/Fibro'
    if os.path.isdir(d): subprocess.run(['rm', '-rf', d])
    os.makedirs(d)
    for f in os.listdir(map_):
        if f != 'spelproef.html': os.symlink(os.path.join(map_, f), os.path.join(d, f))
    open(d + '/spelproef.html', 'w', encoding='utf-8').write(HARNAS)
    return os.path.dirname(d)
srv = [subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', www('n', MAP), str(PORT)], stderr=subprocess.DEVNULL)]
if OUD: srv.append(subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', www('o', OUD), str(PORT + 1)], stderr=subprocess.DEVNULL))
time.sleep(0.8)
B = f'http://127.0.0.1:{PORT}/Fibro/'; BO = f'http://127.0.0.1:{PORT + 1}/Fibro/'
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": 1791103600, "user": {"id": UID}})
INIT = """(() => {
  let z = 12345; Math.random = () => { z = (z * 16807) % 2147483647; return (z - 1) / 2147483646 }
  window.__teksten = new Set()
  const P = CanvasRenderingContext2D.prototype, f = P.fillText, s = P.strokeText
  P.fillText = function (t, ...r) { try { window.__teksten.add(String(t)) } catch (e) {} return f.call(this, t, ...r) }
  P.strokeText = function (t, ...r) { try { window.__teksten.add(String(t)) } catch (e) {} return s.call(this, t, ...r) }
  try { localStorage.setItem('fibro_taal', TAAL); localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', TOKEN) } catch (e) {}
})()"""
FOTO = """() => { const t = document.title + '\\n' + document.body.innerText + '\\n' +
  [...document.querySelectorAll('[title],[aria-label],[placeholder]')].map(e => ['title', 'aria-label', 'placeholder'].map(a => e.getAttribute(a)).filter(Boolean).join(' / ')).join('\\n');
  const c = [...window.__teksten]; window.__teksten.clear(); return t + '\\n' + c.join('\\n') }"""
KLIK_BORD = """(n) => { const l = [...document.querySelectorAll('#spelInhoud [data-r], #spelInhoud div')].filter(e => getComputedStyle(e).cursor === 'pointer' && !e.querySelector('button'));
  if (!l.length) return 0; l[n % l.length].dispatchEvent(new MouseEvent('click', { bubbles: true })); return l.length }"""
TIK = """(xy) => { const c = document.querySelector('#spelInhoud canvas'); if (!c) return; const r = c.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.left + r.width * xy[0], clientY: r.top + r.height * xy[1], pointerId: 1, pointerType: 'touch', isPrimary: true };
  for (const t of ['pointerdown', 'mousedown']) c.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o));
  for (const t of ['pointerup', 'mouseup', 'click']) c.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o)) }"""
TOETS = """(k) => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key: k, code: k === ' ' ? 'Space' : k, bubbles: true })) }"""
KNOP = """(t) => { const b = [...document.querySelectorAll('button')].find(b => !b.hidden && b.offsetParent && (b.textContent.includes(t) || (b.className || '').includes(t)));
  if (b) b.click(); return !!b }"""
# Een spel = (naam, pagina, stappen). Een stap: ('tijd', ms) | ('bord', n keer) | ('tik', n keer) | ('toets', toets, n) | ('knop', tekst) | ('stuur', event, payload) | ('js', code)
LANG = [('tijd', 1500)] * 40
SPELLEN = [
    ('alleen: boter-kaas-eieren', 'spel.html?spel=botkaaseiren', [('knop', 'Makkelijk|Easy'), ('bord', 30), ('tijd', 2000), ('knop', 'bke-opnieuw'), ('bord', 30)]),
    ('alleen: vier op een rij', 'spel.html?spel=vieroprij', [('knop', 'Makkelijk|Easy'), ('bord', 60), ('tijd', 2000)]),
    ('alleen: schaken', 'spel.html?spel=schaken', [('knop', 'Makkelijk|Easy'), ('bord', 160), ('tijd', 2000)]),
    ('alleen: dammen', 'spel.html?spel=dammen', [('knop', 'Makkelijk|Easy'), ('bord', 160), ('tijd', 2000)]),
    ('alleen: neo paddle', 'spel.html?spel=pong', [('knop', 'Makkelijk|Easy')] + LANG),
    ('alleen: flapper', 'spel.html?spel=flappybird', [('knop', 'Start'), ('tijd', 3500), ('tik', 12), ('tijd', 8000), ('knop', '↻')] + [('tijd', 1500)] * 8),
    ('alleen: block it', 'spel.html?spel=breakout', [('knop', 'Start')] + [('tijd', 1500), ('tik', 2)] * 20 + LANG * 3),
    ('alleen: the swarm', 'spel.html?spel=swarm', [('knop', 'Start'), ('tijd', 1000), ('knop', 'sw-verhaal|Verhaal|Story')] + [('tijd', 1500), ('tik', 3)] * 30 + LANG * 4),
    ('alleen: ghost tag', 'spel.html?spel=pacman', [('tijd', 1500), ('knop', 'kSpeel')] + [('tijd', 1500), ('toets', 'ArrowLeft', 1), ('tijd', 900), ('toets', 'ArrowUp', 1)] * 20 + LANG * 2),
    ('alleen: twin snakes', 'spel.html?spel=pinball', [('tijd', 1500), ('knop', 'kSpeel')] + LANG + [('knop', 'kOpnieuw')] + LANG),
    ('alleen: runner & gunner', 'spel.html?spel=endlessrunner', [('tijd', 2500), ('knop', 'kGunner'), ('knop', 'geluidKnop'), ('knop', 'START')] + LANG * 2),
    ('samen: bke host', 'spelproef.html?mod=bke-ui.js&rol=host', [('tijd', 1000), ('bord', 1), ('tijd', 500)]),
    ('samen: bke gast', 'spelproef.html?mod=bke-ui.js&rol=gast', [('tijd', 1000)]),
    ('samen: vier op een rij gast', 'spelproef.html?mod=vieroprij-ui.js&rol=gast', [('tijd', 1000)]),
    ('samen: schaken gast', 'spelproef.html?mod=schaken-ui.js&rol=gast', [('tijd', 1000)]),
    ('samen: dammen host', 'spelproef.html?mod=dammen-ui.js&rol=host', [('tijd', 1000), ('bord', 3)]),
    ('samen: dammen gast', 'spelproef.html?mod=dammen-ui.js&rol=gast', [('tijd', 1000)]),
    ('samen: neo paddle host', 'spelproef.html?mod=pong-ui.js&rol=host', [('tijd', 3000)]),
    ('samen: flapper host', 'spelproef.html?mod=flappy-ui.js&rol=host', [('tijd', 1500), ('tik', 4), ('tijd', 1500), ('stuur', 'fb-dood', {})] + [('tijd', 1500)] * 10),
    ('samen: space invaders host', 'spelproef.html?mod=invaders-ui.js&rol=host', [('tijd', 1000)] + LANG * 3),
    ('samen: block it host', 'spelproef.html?mod=blockit-ui.js&rol=host', [('tijd', 1500), ('stuur', 'bi-hier', {}), ('tijd', 500), ('knop', 'Twee velden|Two boards'), ('tijd', 4000),
        ('stuur', 'bi-aanval', {'rijen': 1}), ('tijd', 300), ('stuur', 'bi-aanval', {'rijen': 2}), ('tijd', 300)] + LANG * 4),  # v148: rijen van de vriend
    ('samen: block it host gedeeld', 'spelproef.html?mod=blockit-ui.js&rol=host', [('tijd', 1500), ('stuur', 'bi-hier', {}), ('tijd', 500), ('knop', 'eigen kleuren|own colours')] + [('tijd', 1500), ('tik', 2)] * 10 + LANG * 4),
    ('samen: block it gast', 'spelproef.html?mod=blockit-ui.js&rol=gast', [('tijd', 1500)]),
    ('samen: the swarm host', 'spelproef.html?mod=swarm-ui.js&rol=host', [('tijd', 1000), ('knop', 'sw-verhaal'), ('tijd', 500), ('stuur', 'sw-cmd', {'c': 'verhaal'}), ('tijd', 500)] + [('tijd', 1500), ('tik', 3)] * 20 + LANG * 4),
    ('samen: the swarm gast', 'spelproef.html?mod=swarm-ui.js&rol=gast', [('tijd', 1000), ('stuur', 'sw-cmd', {'c': 'verhaal'}), ('tijd', 6000)]),
    ('samen: ghost tag host', 'spelproef.html?mod=ecto-ui.js&rol=host', [('tijd', 2000)]),
    ('samen: twin snakes gast', 'spelproef.html?mod=twin-snakes-ui.js&rol=gast', [('tijd', 2000)]),
    ('samen: runner host', 'spelproef.html?mod=runner-gunner-ui.js&rol=host', [('tijd', 3000)]),
    ('samen: runner gast', 'spelproef.html?mod=runner-gunner-ui.js&rol=gast', [('tijd', 3000)]),
    ('losse pagina: runner & gunner', 'spellen/runner-gunner.html', [('tijd', 1500), ('knop', 'START')] + LANG * 2),
]
# Woorden die in het Engels niet meer mogen voorkomen (hele woorden, hoofdletters tellen)
NL = ['Jij', 'JIJ', 'jouw', 'Jouw', 'beurt', 'Wachten', 'WACHT', 'wint', 'WINT', 'Gelijkspel', 'GELIJKSPEL', 'Opnieuw', 'OPNIEUW', 'Volgende', 'VOLGENDE',
      'Geluid', 'GELUID', 'hartje', 'hartjes', 'Pas op', 'Tik', 'TIK', 'Veeg', 'VEEG', 'Kies', 'spelvorm', 'bak', 'GOLF', 'Golf', 'SPRING', 'SCHIET', 'MUNTEN',
      'munten', 'meter', 'Verhaal', 'Eindeloos', 'Samen', 'samen', 'zwerm', 'ZWERM', 'Koningin', 'huis', 'Sleep', 'Slaan', 'schaak', 'Schaakmat', 'vriend',
      'BOEM', 'PUNT', 'PUNTEN', 'KETTING', 'SCHOKGOLF', 'AANVAL', 'Explosie', 'Maak', 'vierkant', 'Bom', 'BOM', 'Geladen', 'Geraakt', 'beeld', 'vliegt',
      'Hou vol', 'rood', 'geel', 'Springt', 'kanon', 'VELD', 'DOOLHOF', 'KAMERS', 'BLOKJES', 'MUREN', 'SLANG', 'RONDE', 'OEFENEN', 'STAD', 'RIOOL',
      'WOESTIJN', 'TEMPEL', 'IJSGROT', 'GROEN', 'PAARS', 'KIEST', 'BENT', 'NOG', 'Toetsen', 'Licht', 'Zwaar', 'Links', 'tegenstander', 'WINNAAR',
      'VERLIEZER', 'GEWONNEN', 'GERAAKT', 'GERED', 'STROOM', 'EINDBAAS', 'FASE', 'Daar gaan', 'klaar', 'Druk', 'titelscherm', 'maatje', 'Hoe ver',
      'Spelproef']
NL_RE = re.compile(r'(?<![A-Za-zÀ-ÿ])(' + '|'.join(re.escape(w) for w in NL if w != 'Spelproef') + r')(?![A-Za-zÀ-ÿ])')
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:500] if info != '' else ''))
    if not ok: fouten.append(naam)
def speel(br, basis, taal, pad, stappen):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 800}, locale='nl-NL', has_touch=False)
    ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
    ctx.add_init_script(INIT.replace('TAAL', json.dumps(taal)).replace('TOKEN', json.dumps(TOKEN)))
    p = ctx.new_page(); log = []
    p.on('console', lambda m: log.append((m.type, m.text)))
    p.on('pageerror', lambda e: log.append(('pageerror', str(e))))
    p.on('dialog', lambda d: d.dismiss())
    p.clock.install(time=1791100000); p.clock.pause_at(1791100001)  # stil: alleen run_for laat de tijd lopen
    p.goto(basis + pad); p.wait_for_timeout(400); p.clock.run_for(1200); p.wait_for_timeout(300)
    if 'spelproef' in pad:
        for _ in range(30):
            if p.evaluate('!!window.__klaar'): break
            p.wait_for_timeout(100)
    alles = set(); rnd = random.Random(7)
    def foto():
        for r in p.evaluate(FOTO).split('\n'):
            r = r.strip()
            if r and not re.fullmatch(r'[\d\s.:·\-%,+x]*', r) and 'fps' not in r: alles.add(r)
    foto()
    for st in stappen:
        soort = st[0]
        if soort == 'tijd': p.clock.run_for(st[1])
        elif soort == 'bord':
            for _ in range(st[1]):
                p.evaluate(KLIK_BORD, rnd.randrange(1000)); p.clock.run_for(700); foto()
        elif soort == 'tik':
            for _ in range(st[1]):
                p.evaluate(TIK, [rnd.random(), rnd.random()]); p.clock.run_for(120)
        elif soort == 'toets':
            for _ in range(st[2]): p.evaluate(TOETS, st[1]); p.clock.run_for(100)
        elif soort == 'knop':
            for t in st[1].split('|'):
                if p.evaluate(KNOP, t): break
            p.clock.run_for(300)
        elif soort == 'stuur': p.evaluate('([e, v]) => window.__stuur(e, v)', [st[1], st[2]]); p.clock.run_for(200)
        elif soort == 'js': p.evaluate(st[1])
        p.wait_for_timeout(20)
        foto()
    lang = p.evaluate('document.documentElement.lang')
    r = (alles, [x for (s, x) in log if s in ('error', 'pageerror') and 'supabase.co' not in x and 'Failed to load resource' not in x and 'WebSocket' not in x and 'navigator.vibrate' not in x],
         [x for (s, x) in log if '[taal] nog geen vertaling' in x], lang)
    ctx.close(); return r
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for naam, pad, stappen in SPELLEN:
        if FILTER and FILTER not in naam: continue
        print(naam)
        n = speel(br, B, 'nl', pad, stappen)
        if OUD:
            o = speel(br, BO, 'nl', pad, stappen)
            check('NL: dezelfde teksten als de oude code', n[0] == o[0], ('nieuw extra', sorted(n[0] - o[0])[:8], 'oud extra', sorted(o[0] - n[0])[:8]))
            check('NL: geen nieuwe fouten', len(n[1]) <= len(o[1]), (n[1][:3], o[1][:3]))
        check('NL: geen vertaling gezocht', not n[2], n[2][:3])
        e = speel(br, B, 'en', pad, stappen)
        nl = sorted({m.group(0) + ' in: ' + t for t in e[0] for m in NL_RE.finditer(t) if t != 'Spelproef'})
        check('EN: geen Nederlands meer', not nl, nl[:8])
        check('EN: elke tekst vertaald', not e[2], e[2][:4])
        check('EN: geen fouten, lang="en"', not e[1] and e[3] == 'en', (e[3], e[1][:3]))
        check('EN: evenveel te zien als in het Nederlands', len(e[0]) >= len(n[0]) * 0.8, (len(e[0]), len(n[0])))
        if os.environ.get('TOON'): print('     NL: ' + ' | '.join(sorted(n[0]))[:2500]); print('     EN: ' + ' | '.join(sorted(e[0]))[:2500])
    br.close()
for s in srv: s.terminate()
print('\nproef44: ' + ('ALLES GOED' if not fouten else str(len(fouten)) + ' FOUT: ' + ', '.join(fouten)))
sys.exit(1 if fouten else 0)
