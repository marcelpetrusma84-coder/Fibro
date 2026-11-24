# proef329 (24 nov 2026, Marcel): Stekky Studio in het hamburgermenu, en de stickerkaartjes van de Studio netjes op de pc.
#  A. moderator: in het menu onder Moderator staat naast Moderatie ook Stekky Studio, en die opent studio.html
#  B. geen moderator: geen Moderator-groepje en geen Stekky Studio in het menu
#  C. Studio op de pc (1280 breed): de 12 stickerkaartjes liggen naast elkaar zonder over elkaar heen te lopen; alles van een
#     kaartje (naam, beweging, geluid, knoppen) blijft binnen dat kaartje, en de pagina schuift niet opzij
#     (ging mis: de velden waren breder dan het kaartje, zodat de kaartjes over elkaar lagen)
#  D. hetzelfde op een telefoon (390 breed)
# python3 -I proef329.py <map>
import sys, os, time, json, socket, subprocess, tempfile, base64, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
STAND = {'moderator': True}
def supa(route):
    u = route.request.url; m = route.request.method
    een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/rpc/ben_ik_moderator' in u: return route.fulfill(status=200, json=STAND['moderator'])
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=None)
    if '/rest/v1/profiles' in u and m == 'GET' and ('id=eq.' + UID) in u:
        p = {"id": UID, "username": "marcel", "is_moderator": STAND['moderator']}
        return route.fulfill(status=200, json=p if een else [p])
    if '/auth/v1/' in u and m == 'GET': return route.fulfill(status=200, json={"id": UID})
    if '/rest/v1/' in u: return route.fulfill(status=200, json=[])
    if m in ('POST', 'PATCH'): return route.fulfill(status=201, json=[])
    return route.fulfill(status=204, body='')

TEKEN = """() => {
  const c = document.createElement('canvas'); c.width = 1250; c.height = 780
  const x = c.getContext('2d'); x.fillStyle = 'rgb(232,221,200)'; x.fillRect(0, 0, 1250, 780)
  for (let n = 0; n < 14; n++) {
    const cx = 125 + (n % 5) * 250, cy = 130 + Math.floor(n / 5) * 260
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 90, 0, 7); x.fill()
    x.fillStyle = 'hsl(' + n * 25 + ',70%,45%)'; x.beginPath(); x.arc(cx, cy, 76, 0, 7); x.fill()
  }
  return c.toDataURL('image/png').split(',')[1]
}"""
# Per kaartje: steekt er iets uit (een veld, knop of plaatje buiten het kaartje)? En liggen twee kaartjes over elkaar?
METEN = """() => {
  const k = [...document.querySelectorAll('#gekozenLijst .kaartje')].map(e => e.getBoundingClientRect())
  const uit = []
  document.querySelectorAll('#gekozenLijst .kaartje').forEach((kaart, i) => {
    const r = kaart.getBoundingClientRect()
    kaart.querySelectorAll('input, select, button, img, label').forEach(e => {
      const b = e.getBoundingClientRect()
      if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) uit.push(i + ':' + e.tagName + ':' + Math.round(b.right - r.right))
    })
  })
  let over = 0
  for (let a = 0; a < k.length; a++) for (let b = a + 1; b < k.length; b++) {
    const A = k[a], B = k[b]
    if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) over++
  }
  return { aantal: k.length, uit: uit.slice(0, 6), uitTal: uit.length, over, schuif: document.documentElement.scrollWidth - window.innerWidth,
           perRij: k.filter(r => Math.abs(r.top - k[0].top) < 2).length }
}"""

tmp = tempfile.mkdtemp(prefix='proef329_'); PLAAT = os.path.join(tmp, 'plaat.png')
sock = socket.socket(); sock.bind(('127.0.0.1', 0)); poort = sock.getsockname()[1]; sock.close()
www = tempfile.mkdtemp(prefix='proef329w_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
basis = 'http://127.0.0.1:%d/Fibro/' % poort

def nieuweContext(browser, breed, hoog):
    ctx = browser.new_context(viewport={'width': breed, 'height': hoog}, service_workers='block')
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), supa)
    ctx.add_init_script("try{localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ")}catch(e){}")
    return ctx

def menuItems(pg):
    pg.goto(basis + 'index.html')
    pg.wait_for_function("() => window._profiel && window._profiel.id", timeout=20000)
    pg.evaluate("() => window.openMenu()")
    pg.wait_for_selector('#fibroMenu')
    return pg.evaluate("() => [...document.querySelectorAll('#fibroMenu [role=menuitem], #fibroMenu button')].map(b => b.textContent.trim())")

def studio(pg, wat):
    pg.goto(basis + 'studio.html')
    pg.wait_for_function("() => !document.getElementById('inhoud').classList.contains('verborgen')", timeout=15000)
    if not os.path.exists(PLAAT): open(PLAAT, 'wb').write(base64.b64decode(pg.evaluate(TEKEN)))
    pg.set_input_files('#bestand', PLAAT)
    pg.wait_for_function("() => document.querySelectorAll('#vakken .vak').length >= 12", timeout=20000)
    pg.click('#kiesEerste')
    pg.wait_for_function("() => document.querySelectorAll('#gekozenLijst .kaartje').length === 12", timeout=10000)
    m = pg.evaluate(METEN)
    check(m['aantal'] == 12, wat + ': 12 stickerkaartjes (%s)' % m['aantal'])
    check(m['over'] == 0, wat + ': geen kaartjes over elkaar heen (%s keer)' % m['over'])
    check(m['uitTal'] == 0, wat + ': niets steekt buiten een kaartje uit (%s, %s)' % (m['uitTal'], m['uit']))
    check(m['schuif'] <= 0, wat + ': de pagina schuift niet opzij (%s px te breed)' % m['schuif'])
    return m

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-proxy-server'])
        paginafouten = []

        # A. moderator
        STAND['moderator'] = True
        ctx = nieuweContext(browser, 1280, 900); pg = ctx.new_page(); pg.on('pageerror', lambda e: paginafouten.append(str(e)))
        items = menuItems(pg)
        check(any('Moderatie' in t for t in items), 'A. moderator: Moderatie staat in het menu')
        check(any(t.endswith('Stekky Studio') for t in items), 'A. moderator: Stekky Studio staat in het menu (%s)' % [t for t in items if 'Studio' in t or 'Moderatie' in t])
        i_mod = next((i for i, t in enumerate(items) if t.endswith('Moderatie')), -1)
        i_stu = next((i for i, t in enumerate(items) if t.endswith('Stekky Studio')), -1)
        check(i_mod >= 0 and i_stu == i_mod + 1, 'A. Stekky Studio staat direct onder Moderatie (%s, %s)' % (i_mod, i_stu))
        pg.evaluate("() => { const k = document.getElementById('menuKopModerator'); if (k && k.getAttribute('aria-expanded') !== 'true') k.click() }")
        if i_stu >= 0:
            pg.locator('#fibroMenu [role=menuitem]', has_text='Stekky Studio').click()
            pg.wait_for_url('**/studio.html*', timeout=15000)
        check(pg.url.split('?')[0].endswith('/studio.html'), 'A. Stekky Studio opent de Studio (%s)' % pg.url)
        ctx.close()

        # B. geen moderator
        STAND['moderator'] = False
        ctx = nieuweContext(browser, 1280, 900); pg = ctx.new_page(); pg.on('pageerror', lambda e: paginafouten.append(str(e)))
        items = menuItems(pg)
        check(not any('Studio' in t for t in items) and not any(t.endswith('Moderatie') for t in items), 'B. geen moderator: geen Moderatie en geen Studio in het menu')
        ctx.close()

        # C. Studio op de pc
        STAND['moderator'] = True
        ctx = nieuweContext(browser, 1280, 900); pg = ctx.new_page(); pg.on('pageerror', lambda e: paginafouten.append(str(e)))
        m = studio(pg, 'C. pc')
        check(m['perRij'] >= 2, 'C. pc: meerdere kaartjes naast elkaar (%s per rij)' % m['perRij'])
        ctx.close()

        # D. telefoon
        ctx = nieuweContext(browser, 390, 844); pg = ctx.new_page(); pg.on('pageerror', lambda e: paginafouten.append(str(e)))
        m = studio(pg, 'D. telefoon')
        check(m['perRij'] == 1, 'D. telefoon: één kaartje per rij (%s)' % m['perRij'])
        ctx.close()

        check(not paginafouten, 'geen paginafouten (%s)' % paginafouten[:3])
        browser.close()
except Exception as e:
    print('FOUT proef afgebroken: %s' % e); fout.append(str(e))
finally:
    server.terminate()
print('\n%d fout(en)' % len(fout)); sys.exit(1 if fout else 0)
