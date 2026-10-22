# proef96: alleen nog het OPEN slotje bij een vriend, met uitleg als je erop tikt (v200, slotuitleg.js).
# Echte vrienden.html en chat.html, nagebootste telefoon met echte tikken, Nederlands en Engels. Drie vrienden: Bram met
# sleutel, Lotte zonder, en <b>Kees</b> zonder (een naam met html: moet als tekst blijven).
#  1. Vrienden: bij Bram geen slotje (geen 🔒 meer op de pagina); bij Lotte een knop 🔓 met label
#  2. tik op het open slotje: uitleg (titel, twee zinnen, Begrepen) in de goede taal, je blijft op Vrienden (geen profiel,
#     geen 'ontvrienden'-vraag); Begrepen sluit; Escape sluit ook
#  3. tik op de rij van Lotte (niet op het slotje): naar haar profiel zoals altijd
#  4. Chat-lijst: bij Bram geen slotje, bij Lotte wel; tik = uitleg en geen gesprek; tik op de rij = gesprek open
#  5. de naam met html staat als tekst in de uitleg (geen <b>-element)
#  6. geen paginafouten
# Oude map (v199) als controle: bijna alles MIS.
# python3 -I proef96.py <map>
import sys, os, time, json, socket, subprocess, tempfile
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'b1a00000-0000-4000-8000-000000000002'; LOTTE = 'c1a00000-0000-4000-8000-000000000003'; KEES = 'd1a00000-0000-4000-8000-000000000004'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''), flush=True)
def iso(sec): return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - sec))
PROF = {BRAM: {"id": BRAM, "username": "Bram", "avatar_url": "\U0001F438", "public_key": "MFkw-nep-sleutel", "online_status": False, "laatst_gezien": iso(9000), "updated_at": iso(9000)},
        LOTTE: {"id": LOTTE, "username": "Lotte", "avatar_url": "\U0001F98A", "public_key": None, "online_status": False, "laatst_gezien": iso(9000), "updated_at": iso(9000)},
        KEES: {"id": KEES, "username": "<b>Kees</b>", "avatar_url": "\U0001F43B", "public_key": None, "online_status": False, "laatst_gezien": iso(9000), "updated_at": iso(9000)}}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m == 'PATCH': e = {"toon_online": True}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/profiles' in u and m == 'GET':
        if 'in.' in u: return route.fulfill(status=200, json=list(PROF.values()))
        for i in PROF:
            if i in u: return route.fulfill(status=200, json=PROF[i] if obj else [PROF[i]])
        e = {"id": UID, "username": "Marcel", "toon_online": True}; return route.fulfill(status=200, json=e if obj else [e])
    if '/rest/v1/friendships' in u:
        rijen = [{"user_id": UID, "friend_id": i, "status": "accepted"} for i in PROF]
        if 'profiles' in u:
            for r in rijen: r["profiles"] = PROF[r["friend_id"]]
        return route.fulfill(status=200, json=rijen)
    if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=[])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
TXT = {'nl': dict(kop='🔓 Nog geen versleuteling met Lotte', zin='Lotte heeft nog geen sleutel', zin2='Fibro opent en opnieuw inlogt', knop='Begrepen', label='Nog geen versleuteling met Lotte — tik voor uitleg', kees='🔓 Nog geen versleuteling met <b>Kees</b>'),
       'en': dict(kop='🔓 No encryption with Lotte yet', zin="Lotte doesn't have a key", zin2='opens Fibro and logs in again', knop='Got it', label='No encryption with Lotte yet — tap for an explanation', kees='🔓 No encryption with <b>Kees</b> yet')}
UITLEG = "() => { const d = document.getElementById('slotUitleg'); if (!d) return null; return { kop: d.querySelector('h2').textContent, tekst: d.innerText, b: !!d.querySelector('b'), knop: d.querySelector('button').textContent, focus: document.activeElement === d.querySelector('button') } }"
RIJ = """sel => [...document.querySelectorAll(sel)].map(r => ({ tekst: r.innerText, open: !!r.querySelector('.slot-open'), label: (r.querySelector('.slot-open') || {getAttribute(){return ''}}).getAttribute('aria-label'), dicht: r.innerHTML.includes('\\u{1F512}') }))"""
def ev(p, js, a=None):
    try: return p.evaluate(js, a) if a is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
fouten = []
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        for taal in ['nl', 'en']:
            t = TXT[taal]; print('== ' + taal, flush=True)
            ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
            p = ctx.new_page(); p.on('pageerror', lambda e: fouten.append(str(e)[:150]))
            vragen = []; p.on('dialog', lambda d: (vragen.append(d.message), d.dismiss()))
            p.goto(B + 'manifest.json')
            p.evaluate("([t, l]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', l); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", [TOKEN, taal])
            # ---- Vrienden ----
            p.goto(B + 'vrienden.html'); p.wait_for_timeout(2500)
            r = ev(p, RIJ, '.friend-row')
            bram = next((x for x in r if 'Bram' in x['tekst']), None) if isinstance(r, list) else None
            lotte = next((x for x in r if 'Lotte' in x['tekst']), None) if isinstance(r, list) else None
            check('%s 1 Vrienden: Bram zonder slotje, Lotte met open slotje (label)' % taal, bram and lotte and not bram['open'] and not bram['dicht'] and lotte['open'] and lotte['label'] == t['label']
                  and '\U0001F512' not in ev(p, "document.body.innerHTML"), (bram, lotte))
            url0 = p.url
            try: p.locator('.friend-row', has_text='Lotte').locator('.slot-open').tap(timeout=4000)
            except Exception: pass
            p.wait_for_timeout(900)
            u = ev(p, UITLEG)
            check('%s 2a tik op het slotje: uitleg in de goede taal, op Vrienden gebleven, geen ontvrienden-vraag' % taal,
                  isinstance(u, dict) and u['kop'] == t['kop'] and t['zin'] in u['tekst'] and t['zin2'] in u['tekst'] and u['knop'] == t['knop'] and u['focus'] and p.url == url0 and not vragen, (u, p.url[-40:], vragen))
            try: p.get_by_role('button', name=t['knop']).tap(timeout=3000)
            except Exception: pass
            p.wait_for_timeout(300); dicht1 = ev(p, UITLEG) is None
            try: p.locator('.friend-row', has_text='Lotte').locator('.slot-open').tap(timeout=4000)
            except Exception: pass
            p.wait_for_timeout(300); p.keyboard.press('Escape'); p.wait_for_timeout(300); dicht2 = ev(p, UITLEG) is None
            check('%s 2b "%s" sluit, Escape sluit ook' % (taal, t['knop']), dicht1 and dicht2, (dicht1, dicht2))
            try: p.locator('.friend-row', has_text='<b>Kees</b>').locator('.slot-open').tap(timeout=4000)
            except Exception: pass
            p.wait_for_timeout(500); u = ev(p, UITLEG)
            check('%s 5 een naam met html blijft tekst in de uitleg' % taal, isinstance(u, dict) and u['kop'] == t['kees'] and not u['b'], u)
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
            try:
                with p.expect_navigation(timeout=5000): p.locator('.friend-row', has_text='Lotte').locator('div').nth(2).tap()
            except Exception: pass
            check('%s 3 tik op de rij van Lotte (niet op het slotje): naar haar profiel' % taal, 'vriend-profiel.html' in p.url and LOTTE in p.url, p.url[-70:])
            # ---- Chat ----
            p.goto(B + 'chat.html'); p.wait_for_timeout(2500)
            r = ev(p, RIJ, '#vriendenLijst .vriend-item')
            bram = next((x for x in r if 'Bram' in x['tekst']), None) if isinstance(r, list) else None
            lotte = next((x for x in r if 'Lotte' in x['tekst']), None) if isinstance(r, list) else None
            try: p.locator('#vriendenLijst .vriend-item', has_text='Lotte').locator('.slot-open').tap(timeout=4000)
            except Exception: pass
            p.wait_for_timeout(800)
            u = ev(p, UITLEG); gesprek = ev(p, "getComputedStyle(document.getElementById('chatScherm')).display !== 'none'")
            check('%s 4a Chat-lijst: Bram zonder slotje, Lotte met; tik = uitleg en geen gesprek' % taal,
                  bram and lotte and not bram['open'] and not bram['dicht'] and lotte['open'] and isinstance(u, dict) and u['kop'] == t['kop'] and gesprek is False, (bram, lotte, u, gesprek))
            p.keyboard.press('Escape'); p.wait_for_timeout(300)
            try: p.locator('#vriendenLijst .vriend-item', has_text='Lotte').locator('.vriend-naam').tap(timeout=4000)
            except Exception: pass
            p.wait_for_timeout(1200)
            naam = ev(p, "document.getElementById('chatNaam').textContent")
            check('%s 4b tik op de rij: het gesprek met Lotte gaat open' % taal, naam == 'Lotte' and ev(p, UITLEG) is None, naam)
            ctx.close()
        br.close()
finally:
    srv.terminate()
check('6 geen paginafouten', not fouten, fouten[:3])
print('UITSLAG proef96: %d/%d %s' % (sum(uitslag), len(uitslag), 'GOED' if all(uitslag) else 'FOUT'))
