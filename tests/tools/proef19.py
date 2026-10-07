import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef19: Profiel - elk lettertype laat zichzelf zien, kiezen geldt meteen voor de hele pagina,
# na Opslaan meteen de nieuwe animatie en (op Home) de nieuwe mood, zonder verversen.
# (de .woff2-bestanden zitten niet in upload-alles; dit kijkt of de .css geladen wordt)
# python3 -I proef19.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www19_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "bram", "lettertype": "'Lora',serif", "animatie": "geen", "offline_emoji": "\U0001F600", "offline_bericht": "Oud"}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    if '/rest/v1/profiles' in u and m == 'POST':
        EIGEN.update({k: v for k, v in json.loads(route.request.post_data or '{}').items() if k in ('lettertype', 'animatie', 'offline_emoji', 'offline_bericht')})
        return route.fulfill(status=201, json=[])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
FONT = "sel => getComputedStyle(document.querySelector(sel)).fontFamily"
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 400, 'height': 800}); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html')
    p.evaluate("([t, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_lettertype', \"'Lora',serif\"); localStorage.setItem('fibro_font', \"'Lora',serif\");"
               " localStorage.setItem('fibro_profiel_' + uid, JSON.stringify({ naam: 'Bram B', lettertype: \"'Lora',serif\" })) }", [TOKEN, UID])
    p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    print('1. Tabblad Lettertype')
    p.evaluate("() => window.switchTab('lettertype')"); p.wait_for_timeout(1500)
    tegels = p.evaluate("() => [...document.querySelectorAll('#fontGrid .font-item')].map(d => ({ naam: d.querySelector('.font-preview').textContent, font: getComputedStyle(d.querySelector('.font-preview')).fontFamily }))")
    eigen = [t for t in tegels if t['naam'] in t['font']]
    check('elke tegel in zijn eigen lettertype', len(tegels) >= 30 and len(eigen) == len(tegels), (len(eigen), len(tegels), tegels[:2]))
    geladen = p.evaluate("() => [...document.querySelectorAll('link[id^=font-]')].map(l => l.id)")
    check('alleen de lettertypen in beeld geladen (niet alle 38)', 2 <= len(geladen) < 30, len(geladen))
    t = p.locator('#fontGrid .font-item', has_text='Pacifico'); t.scroll_into_view_if_needed(); p.wait_for_timeout(800)
    check('Pacifico geladen als hij in beeld komt', p.evaluate("() => !!document.getElementById('font-pacifico')"))
    print('2. Pacifico kiezen (nog niet opslaan)')
    t.click(); p.wait_for_timeout(500)
    check('hele pagina meteen in Pacifico', 'Pacifico' in p.evaluate(FONT, '.section-label') and 'Pacifico' in p.evaluate(FONT, '#editNaam'), (p.evaluate(FONT, '.section-label'), p.evaluate(FONT, '#editNaam')))
    check('andere tegels houden hun eigen lettertype', 'Lobster' in p.evaluate("() => getComputedStyle([...document.querySelectorAll('#fontGrid .font-preview')].find(e => e.textContent === 'Lobster')).fontFamily"))
    print('3. Animatie Sneeuw en mood, dan Opslaan')
    p.evaluate("() => window.switchTab('animatie')"); p.evaluate("() => window.selectAnimatie('sneeuw')")
    p.evaluate("() => window.switchTab('profiel')"); p.fill('#editMood', 'Nieuw')
    p.evaluate("() => window.slaAllesOp()"); p.wait_for_timeout(1500)
    r = p.evaluate("() => { const c = document.getElementById('fibro-animatie-canvas'); return { canvas: !!c && c.style.display !== 'none', font: getComputedStyle(document.querySelector('.section-label')).fontFamily, ff: localStorage.getItem('fibro_font') } }")
    check('na Opslaan: sneeuw meteen op de achtergrond', r['canvas'], r)
    check('na Opslaan: lettertype blijft en is bewaard', 'Pacifico' in r['font'] and 'Pacifico' in (r['ff'] or ''), r)
    print('4. Home en opnieuw Profiel')
    p.goto(B + 'index.html'); p.wait_for_timeout(200)
    m = p.evaluate("() => document.getElementById('heroMood').textContent")
    check('Home toont meteen de nieuwe mood', 'Nieuw' in m, m)
    p.wait_for_timeout(2000)
    check('Home in Pacifico', 'Pacifico' in p.evaluate(FONT, '#heroNaam'), p.evaluate(FONT, '#heroNaam'))
    p.goto(B + 'profiel.html'); p.wait_for_timeout(300)
    check('Profiel opnieuw: meteen Pacifico (niet eerst het oude)', 'Pacifico' in p.evaluate(FONT, '.section-label'), p.evaluate(FONT, '.section-label'))
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
