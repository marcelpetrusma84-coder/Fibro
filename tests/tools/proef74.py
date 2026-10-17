# proef74: het menu (☰) op Home in groepjes, en de uitleg 'Fibro als app installeren' (v178), echte index.html.
# Echte klikken: ☰ opent het menu met drie kopjes in deze volgorde: Instellingen (Taal / Language, Berichten bewaren),
# Accountinstellingen (Mijn gegevens downloaden, Account verwijderen), Mijn Fibro (Over Fibro, Fibro als app
# installeren); elk groepje heeft role=group met zijn kopje als naam. Elk item doet nog wat het deed (taal, bewaren,
# mijn gegevens, account verwijderen, Over Fibro). De uitleg: iPhone-stappen en Android-stappen, op een iPhone eerst
# iPhone, op Android eerst Android; draait Fibro al als app, dan staat dat erboven. Sluiten, Escape en ernaast tikken
# sluiten hem. Op een klein scherm past het menu (schuift zelf). In het Engels. Geen fouten.
# Oude map als controle: geen kopjes en geen uitleg (bijna alles MIS).
# python3 -I proef74.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel", "bewaar_dagen": 31}; return route.fulfill(status=200, json=e if obj else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
MENU = """() => { const m = document.getElementById('fibroMenu'); if (!m) return null
  return [...m.querySelectorAll('[role=group]')].map(g => [document.getElementById(g.getAttribute('aria-labelledby'))?.textContent || null,
    [...g.querySelectorAll('[role=menuitem]')].map(b => b.textContent)]) }"""
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server'])
    def pagina(ua=None, taal='nl', maat=(390, 844), app=False):
        opties = dict(service_workers='block', viewport={'width': maat[0], 'height': maat[1]})
        if ua: opties.update(user_agent=ua, is_mobile=True, has_touch=True)
        ctx = br.new_context(**opties); ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
        if app: ctx.add_init_script("Object.defineProperty(navigator, 'standalone', { get: () => true })")
        p = ctx.new_page(); p.fouten = []; p.on('pageerror', lambda e: p.fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.dismiss())
        p.goto(B + 'manifest.json')
        p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
        p.goto(B + 'index.html'); p.wait_for_timeout(2500)
        if ua == IPHONE:  # op de iPhone eerst het welkom ('Tik om te beginnen', zet de beltoon klaar)
            try: p.mouse.click(195, 420); p.wait_for_timeout(600)
            except Exception: pass
        return ctx, p
    def ev(p, js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]
    def klik(p, sel):
        try: p.click(sel, timeout=3000); p.wait_for_timeout(500); return True
        except Exception as e: print('   klik', sel, str(e)[:80]); return False
    def menuItem(p, tekst):
        klik(p, '#menuBtn'); return klik(p, '#fibroMenu [role=menuitem]:has-text("%s")' % tekst)
    # A. het menu
    ctx, p = pagina()
    klik(p, '#menuBtn')
    menu = ev(p, MENU)
    check('☰ (echte klik): drie groepjes met kopjes Instellingen, Accountinstellingen, Mijn Fibro',
          isinstance(menu, list) and [g[0] for g in menu] == ['Instellingen', 'Accountinstellingen', 'Mijn Fibro'], menu)
    check('Instellingen: Taal / Language en Berichten bewaren',
          isinstance(menu, list) and len(menu) == 3 and menu[0][1] == ['\U0001F310 Taal / Language', '⏳ Berichten bewaren'], menu and menu[0])
    check('Accountinstellingen: Mijn gegevens downloaden en Account verwijderen',
          isinstance(menu, list) and len(menu) == 3 and menu[1][1] == ['\U0001F4E6 Mijn gegevens downloaden', '\U0001F5D1️ Account verwijderen'], menu and len(menu) > 1 and menu[1])
    check('Mijn Fibro: Over Fibro en Fibro als app installeren',
          isinstance(menu, list) and len(menu) == 3 and menu[2][1] == ['ℹ️ Over Fibro', '\U0001F4F2 Fibro als app installeren'], menu and len(menu) > 2 and menu[2])
    focus = ev(p, "() => document.activeElement && document.activeElement.textContent")
    check('de focus staat op het eerste item (Taal / Language)', focus == '\U0001F310 Taal / Language', focus)
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    # B. elk item doet nog wat het deed
    menuItem(p, 'Taal / Language'); taal = ev(p, "() => !!document.getElementById('taalScherm')"); p.keyboard.press('Escape'); p.wait_for_timeout(300)
    menuItem(p, 'Berichten bewaren'); bew = ev(p, "() => !!document.getElementById('bewarenScherm')"); p.keyboard.press('Escape'); p.wait_for_timeout(300)
    menuItem(p, 'Mijn gegevens downloaden'); p.wait_for_timeout(800); geg = ev(p, "() => !!document.getElementById('gegevensScherm')")
    ev(p, "() => { const s = document.getElementById('gegevensScherm'); if (s) s.remove() }")
    menuItem(p, 'Account verwijderen'); p.wait_for_timeout(800); verw = ev(p, "() => !!document.getElementById('verwijderScherm')")
    ev(p, "() => { const s = document.getElementById('verwijderScherm'); if (s) s.remove() }")
    check('de items doen nog wat ze deden (taal, bewaren, mijn gegevens, account verwijderen)', [taal, bew, geg, verw] == [True, True, True, True], [taal, bew, geg, verw])
    menuItem(p, 'Over Fibro'); p.wait_for_timeout(800)
    check('Over Fibro opent over.html', p.url.endswith('/over.html'), p.url)
    check('geen fouten (menu)', not p.fouten, p.fouten); ctx.close()
    # C. de uitleg, op een iPhone
    ctx, p = pagina(ua=IPHONE)
    menuItem(p, 'Fibro als app installeren')
    sch = ev(p, """() => { const s = document.getElementById('appScherm'); if (!s) return null; const k = s.querySelector('[role=dialog]')
      return { titel: k.querySelector('h2').textContent, blokken: [...k.querySelectorAll('section h3')].map(h => h.textContent),
               stappen: [...k.querySelectorAll('section')].map(x => x.querySelectorAll('li').length), al: /al als app/.test(k.textContent),
               tekst: k.innerText, focus: document.activeElement === k, modaal: k.getAttribute('aria-modal') } }""")
    ok = isinstance(sch, dict)
    check('uitleg (echte klik): titel en twee blokken, op de iPhone eerst iPhone', ok and sch['titel'] == '\U0001F4F2 Fibro als app installeren' and sch['blokken'] == ['iPhone · Safari', 'Android · Chrome'], sch if not ok else (sch['titel'], sch['blokken']))
    check('iPhone 5 stappen (Safari, deelknop/•••, Zet op beginscherm, Voeg toe, nieuw icoon), Android 4', ok and sch['stappen'] == [5, 4]
          and all(w in sch['tekst'] for w in ['Safari', '•••', 'Zet op beginscherm', 'Open als webapp', 'Voeg toe', 'eigen opslag', 'alleen zo meldingen', 'Chrome', '⋮', 'App installeren', 'Toevoegen aan startscherm', 'Installeren']), ok and sch['stappen'])
    check('niet als app geopend: geen "al als app"; dialoog met focus', ok and not sch['al'] and sch['focus'] and sch['modaal'] == 'true', ok and (sch['al'], sch['focus']))
    p.keyboard.press('Escape'); p.wait_for_timeout(200); esc = ev(p, "() => !document.getElementById('appScherm')")
    menuItem(p, 'Fibro als app installeren'); klik(p, '#appScherm button:has-text("Sluiten")'); sl = ev(p, "() => !document.getElementById('appScherm')")
    menuItem(p, 'Fibro als app installeren'); p.mouse.click(195, 20); p.wait_for_timeout(300); naast = ev(p, "() => !document.getElementById('appScherm')")
    check('dicht met Escape, met Sluiten en door ernaast te tikken', [esc, sl, naast] == [True, True, True], [esc, sl, naast])
    check('geen fouten (iPhone)', not p.fouten, p.fouten); ctx.close()
    # D. op Android eerst Android; als app geopend
    ctx, p = pagina(ua=ANDROID)
    menuItem(p, 'Fibro als app installeren')
    bl = ev(p, "() => [...document.querySelectorAll('#appScherm section h3')].map(h => h.textContent)")
    check('op Android eerst Android', bl == ['Android · Chrome', 'iPhone · Safari'], bl); ctx.close()
    ctx, p = pagina(ua=IPHONE, app=True)
    menuItem(p, 'Fibro als app installeren')
    al = ev(p, "() => { const s = document.getElementById('appScherm'); return s ? s.innerText : '' }")
    check('al als app geopend: "Je gebruikt Fibro nu al als app." bovenaan', isinstance(al, str) and '✓ Je gebruikt Fibro nu al als app.' in al, str(al)[:80]); ctx.close()
    # E. klein scherm: het menu past
    ctx, p = pagina(maat=(568, 320))
    klik(p, '#menuBtn')
    past = ev(p, "() => { const m = document.getElementById('fibroMenu'); if (!m) return null; const r = m.getBoundingClientRect(); return [Math.round(r.bottom), innerHeight, m.scrollHeight > m.clientHeight, getComputedStyle(m).overflowY] }")
    check('klein scherm (liggend): het menu blijft binnen beeld en schuift zelf', isinstance(past, list) and past[0] <= past[1] and past[3] == 'auto', past); ctx.close()
    # F. Engels
    ctx, p = pagina(taal='en')
    klik(p, '#menuBtn'); menu = ev(p, MENU); p.keyboard.press('Escape'); p.wait_for_timeout(200)
    check('Engels: Settings, Account settings, My Fibro', isinstance(menu, list) and [g[0] for g in menu] == ['Settings', 'Account settings', 'My Fibro'] and menu[2][1][1] == '\U0001F4F2 Install Fibro as an app', menu)
    menuItem(p, 'Install Fibro as an app')
    en = ev(p, "() => { const s = document.getElementById('appScherm'); return s ? s.innerText : '' }")
    check('Engels: de uitleg', isinstance(en, str) and all(w in en for w in ["Add Fibro to your phone's home screen", 'Add to Home Screen', 'Open as Web App', 'Install app', 'Then open Fibro from the new icon', 'Close']), str(en)[:120])
    check('geen fouten (Engels)', not p.fouten, p.fouten); ctx.close()
    br.close()
srv.terminate(); shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
