import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef11: offline deel 3 - berichten van alle vrienden bewaren, Runner & Gunner alleen, uitloggen wist
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www11'
os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
VRIENDEN = {'bbbb0001-0000-4000-8000-000000000001': 'Bram', 'cccc0002-0000-4000-8000-000000000002': 'Lotte',
            '77770000-0000-4000-8000-000000000003': 'Stil'}
def start_srv():
    p = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8); return p
srv = start_srv()
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'online': True}
teller = {'messages': 0, 'verborgen': 0}
def berichten(fid):
    naam = VRIENDEN[fid]
    if naam == 'Stil': return []
    uit = []
    for i in range(3):
        uit.append({"id": f"{fid[:8]}-{i}", "sender_id": fid, "receiver_id": UID, "content": f"Hallo {i} van {naam}",
                    "created_at": f"2026-10-07T1{i}:00:00+00:00", "antwoord_op": None})
    return uit
def supa(route):
    u = route.request.url; m = route.request.method
    if not staat['online']: return route.abort('internetdisconnected')
    if '/auth/v1/logout' in u: return route.fulfill(status=204, body='')
    if '/rest/v1/friendships' in u and 'or=' in u:
        return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": f} for f in VRIENDEN])
    if '/rest/v1/friendships' in u:
        return route.fulfill(status=200, json=[{"friend_id": f, "profiles": {"id": f, "username": n, "avatar_url": "x"}} for f, n in VRIENDEN.items()])
    if '/rpc/mijn_geblokkeerden' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/guestbook_entries' in u: return route.fulfill(status=200, json=[])
    if '/rest/v1/verborgen_berichten' in u: teller['verborgen'] += 1; return route.fulfill(status=200, json=[])
    if '/rest/v1/messages' in u and m == 'GET':
        teller['messages'] += 1
        for f in VRIENDEN:
            if f in u: return route.fulfill(status=200, json=berichten(f))
        return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel", "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc"}
        lijst = [{"id": f, "username": n, "avatar_url": "x", "public_key": None} for f, n in VRIENDEN.items()]
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=prof)
        return route.fulfill(status=200, json=lijst if 'in.' in u else [prof])
    if m == 'GET': return route.fulfill(status=200, json=[])
    return route.abort()
def chatlogs(p):
    return p.evaluate("u => Object.keys(localStorage).filter(k => k.startsWith('fibro_chatlog_' + u + '_')).map(k => k.split('_').pop().slice(0, 8) + ':' + JSON.parse(localStorage.getItem(k)).length).sort().join(' ')", UID)
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page()
    p.on('console', lambda m: print('   console:', m.text[:200]) if m.text.startswith('[chat] berichten bewaard') or 'bewaren mislukt' in m.text else None)
    p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
    p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(1500); p.evaluate("() => navigator.serviceWorker.ready")
    print('A. Chat online openen (geen gesprek openen)')
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 3", timeout=15000)
    p.wait_for_timeout(2000)
    check('na 2 s nog niets opgehaald (wacht 5 s)', teller['messages'] == 0, teller)
    p.wait_for_timeout(5000)
    check('alle 3 vrienden bewaard', chatlogs(p) == '77770000:0 bbbb0001:3 cccc0002:3', chatlogs(p))
    check('3 berichtvragen + 2 verborgen-vragen (Stil heeft geen berichten)', teller == {'messages': 3, 'verborgen': 2}, teller)
    check('stempel gezet', p.evaluate("u => !!localStorage.getItem('fibro_chatlogs_bewaard_' + u)", UID))
    print('B. Chat opnieuw openen binnen het uur')
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 3", timeout=15000); p.wait_for_timeout(7000)
    check('geen nieuwe berichtvragen', teller == {'messages': 3, 'verborgen': 2}, teller)
    print('C. Stempel 2 uur oud, Bram meteen openen')
    p.evaluate("u => localStorage.setItem('fibro_chatlogs_bewaard_' + u, String(Date.now() - 2 * 3600 * 1000))", UID)
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 3", timeout=15000)
    p.click("#vriendenLijst .vriend-item[data-vnaam='Bram']"); p.wait_for_timeout(7000)
    check('Bram via laadBerichten, de andere 2 op de achtergrond (3+1+2)', teller['messages'] == 6, teller)
    check('stempel weer vers', p.evaluate("u => Date.now() - Number(localStorage.getItem('fibro_chatlogs_bewaard_' + u)) < 60000", UID))
    print('D. Zonder internet: Lotte openen (nooit online geopend)')
    srv.kill(); srv.wait(); staat['online'] = False
    cdp = ctx.new_cdp_session(p); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 3", timeout=15000)
    t0 = time.time(); p.click("#vriendenLijst .vriend-item[data-vnaam='Lotte']")
    p.wait_for_function("() => document.getElementById('messages').innerText.includes('Geen internet')", timeout=20000)
    tekst = p.evaluate("() => document.getElementById('messages').innerText.replace(/\\s+/g,' ')")
    check('Lotte offline: 3 berichten', all(f'Hallo {i} van Lotte' in tekst for i in range(3)), str(round(time.time() - t0, 1)) + ' s | ' + tekst[:140])
    p.wait_for_timeout(6000)
    check('offline geen achtergrondvragen', teller['messages'] == 6, teller)
    # weer online
    srv = start_srv(); staat['online'] = True
    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
    print('E. Runner & Gunner alleen (spel.html)')
    p.goto(B + 'spel.html?spel=endlessrunner'); p.wait_for_selector('.rg .ander', state='attached', timeout=15000); p.wait_for_timeout(1500)
    info = p.evaluate("() => { const a = document.querySelector('.rg .ander'); return { hidden: a.hidden, zichtbaar: a.offsetParent !== null && a.getBoundingClientRect().height > 0, tekst: a.textContent, intro: document.querySelector('.rg .laag p').textContent } }")
    check('vakje verborgen', info['hidden'] and not info['zichtbaar'] and 'NOG NIET' not in info['tekst'], info)
    check('intro alleen', info['intro'] == 'Hoe ver kom jij?', info['intro'])
    p.click('.rg .knop'); p.wait_for_timeout(3500)
    info = p.evaluate("() => ({ laag: document.querySelector('.rg .laag').hidden, canvas: !!document.querySelector('.rg canvas[width]'), ander: document.querySelector('.rg .ander').hidden })")
    check('spel start en vakje blijft weg', info['laag'] and info['ander'], info)
    print('F. Runner & Gunner met een vriend (nagemaakt kanaal)')
    info = p.evaluate("""async () => {
      document.querySelectorAll('.rg').forEach(e => e.remove())
      const m = await import('./runner-gunner-ui.js?v=128')
      const kanaal = { on() { return kanaal }, send() { return Promise.resolve('ok') } }
      await m.start({ spelKanaal: kanaal, benIkSpeler1: true, vriendNaam: 'Bram', isActief: () => true })
      const a = document.querySelector('.rg .ander')
      return { hidden: a.hidden, tekst: a.textContent, intro: document.querySelector('.rg .laag p').textContent }
    }""")
    check('met vriend: vakje zichtbaar', not info['hidden'] and info['tekst'] == 'BRAM: NOG NIET GESTART', info)
    check('met vriend: intro', info['intro'] == 'Jij en Bram rennen op dezelfde baan. Wie komt het verst?', info['intro'])
    ZET = """([u]) => { const o = 'aaaa1111-0000-4000-8000-00000000000f';
      for (const k of ['fibro_chatlog_' + u + '_x1', 'fibro_chatlog_' + u + '_x2', 'fibro_chatvrienden_' + u, 'fibro_gastenboek_' + u, 'fibro_vriendenpagina_' + u, 'fibro_chatlogs_bewaard_' + u,
                       'fibro_msg_cache_' + u, 'fibro_privkey_' + u, 'fibro_chatlog_' + o + '_x1', 'fibro_gastenboek_' + o, 'fibro_record_runner', 'fibro_custom_stickers'])
        if (!localStorage.getItem(k)) localStorage.setItem(k, '"test"') }"""
    BLIJFT = ['fibro_msg_cache_', 'fibro_privkey_']
    def na_uitloggen(naam):
        r = p.evaluate("u => { const o = 'aaaa1111-0000-4000-8000-00000000000f'; const k = Object.keys(localStorage); return {"
                       " weg: ['fibro_chatlog_' + u + '_x1', 'fibro_chatlog_' + u + '_x2', 'fibro_chatvrienden_' + u, 'fibro_gastenboek_' + u, 'fibro_vriendenpagina_' + u, 'fibro_chatlogs_bewaard_' + u].filter(x => k.includes(x)),"
                       " blijft: ['fibro_msg_cache_' + u, 'fibro_privkey_' + u, 'fibro_chatlog_' + o + '_x1', 'fibro_gastenboek_' + o, 'fibro_record_runner', 'fibro_custom_stickers'].filter(x => !k.includes(x)) } }", UID)
        check(naam + ': offline-gegevens gewist', r['weg'] == [], r['weg'])
        check(naam + ': de rest blijft (eigen berichten, sleutel, ander account)', r['blijft'] == [], r['blijft'])
    print('G. Uitloggen op Home')
    p.goto(B + 'index.html'); p.wait_for_function("() => document.getElementById('heroNaam').textContent !== 'Laden...'", timeout=15000)
    p.evaluate(ZET, [UID])
    with p.expect_navigation(url='**/login.html', timeout=15000): p.evaluate("() => { window.uitloggen() }")
    na_uitloggen('Home')
    print('H. Uitloggen op Profiel')
    p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'profiel.html'); p.wait_for_function("() => typeof window.uitloggen === 'function'", timeout=15000); p.wait_for_timeout(2500)
    p.evaluate(ZET, [UID])
    with p.expect_navigation(url='**/login.html', timeout=15000): p.evaluate("() => { window.uitloggen() }")
    na_uitloggen('Profiel')
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
