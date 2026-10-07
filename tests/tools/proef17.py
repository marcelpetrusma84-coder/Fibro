import subprocess, sys, time, json, os, asyncio, base64
from playwright.async_api import async_playwright
# proef17: gastenboek op Home meteen uit het geheugen, foto's per schrijver één keer, bladeren blijft staan,
# nieuw bericht komt erbij, plaatsen werkt, zonder internet.
# python3 -I proef17.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www17_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
AUT = ['eeee000%d-0000-4000-8000-00000000000%d' % (i, i) for i in range(3)]
FOTO = {a: 'data:image/jpeg;base64,' + base64.b64encode(bytes([i + 1]) * 30000).decode() for i, a in enumerate(AUT)}
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "bram", "accent_kleur": "#c084fc"}
staat = {'lat': 0.05, 'online': True, 'n': 12, 'verzoeken': []}
def rij(i, metfoto):
    a = AUT[i % 3]
    au = {"username": "schrijver%d" % (i % 3), "avatar_url": "\U0001F600"}
    if metfoto: au["avatar_data"] = FOTO[a]
    return {"id": 1000 - i, "profile_id": UID, "author_id": a, "content": "Groet %d" % (staat['n'] - 1 - i), "created_at": "2026-10-07T10:00:00Z", "author": au}
async def supa(route):
    u = route.request.url; m = route.request.method
    await asyncio.sleep(staat['lat'])
    if not staat['online']: return await route.abort('internetdisconnected')
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        staat['verzoeken'].append('gb' + ('+foto' if 'avatar_data' in u else ''))
        return await route.fulfill(status=200, json=[rij(i, 'avatar_data' in u) for i in range(staat['n'])])
    if '/rest/v1/guestbook_entries' in u and m == 'POST':
        staat['n'] += 1; return await route.fulfill(status=201, json=[])
    if '/rest/v1/profiles' in u and m == 'GET' and 'id=in.' in u:
        staat['verzoeken'].append('fotos')
        return await route.fulfill(status=200, json=[{"id": a, "avatar_data": FOTO[a]} for a in AUT])
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return await route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    return await route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
LAYOUT = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 4, "volgorde": 0, "icon": "x", "titel": "Gastenboek"}])
LEES = """() => { const l = document.querySelector('#gbl'); const n = document.querySelector('#gbl-nav');
  return { tekst: l ? l.innerText.replace(/\\s+/g, ' ').slice(0, 120) : null, fotos: l ? l.querySelectorAll('img').length : -1, blz: n ? n.innerText.replace(/\\s+/g, ' ').trim() : '' } }"""
async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(); ctx = await br.new_context(service_workers='allow'); await ctx.route('**/*supabase.co/**', supa)
        p = await ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
        await p.goto(B + 'login.html')
        await p.evaluate("([t, uid, lay]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + uid, lay) }", [TOKEN, UID, LAYOUT])
        print('1. Eerste keer (niets bewaard), server 1,5 s')
        staat['lat'] = 1.5
        await p.goto(B + 'index.html'); await p.wait_for_selector('#gbl', timeout=10000)
        r = await p.evaluate(LEES)
        check('eerste keer: niet "nog leeg" terwijl het laadt', 'leeg' not in (r['tekst'] or ''), r)
        await p.wait_for_timeout(5000)
        r = await p.evaluate(LEES)
        check('eerste keer: berichten met foto', 'Groet 11' in r['tekst'] and r['fotos'] == 4 and r['blz'].startswith('‹ blz. 1 van 3'), r)
        grootte = await p.evaluate("u => (localStorage.getItem('fibro_gastenboek_' + u) || '').length", UID)
        check('bewaard: elke foto maar één keer (klein genoeg)', 100000 < grootte < 200000, grootte)
        check('server: tekst en foto apart (geen foto bij elk bericht)', 'gb+foto' not in staat['verzoeken'], staat['verzoeken'])
        await p.evaluate("() => navigator.serviceWorker.ready")
        print('2. Tweede keer, server 3 s')
        staat['lat'] = 3.0
        await p.goto(B + 'index.html'); await p.wait_for_selector('#gbl', timeout=10000); await p.wait_for_timeout(300)
        r = await p.evaluate(LEES)
        check('tweede keer: berichten met foto meteen', 'Groet 11' in (r['tekst'] or '') and r['fotos'] == 4, r)
        await p.click('#gbl-nav [data-blader="vooruit"]'); await p.wait_for_timeout(5500)
        r = await p.evaluate(LEES)
        check('bladeren blijft staan als er niets veranderd is', r['blz'].startswith('‹ blz. 2 van 3'), r)
        print('3. Intussen nieuw bericht op de server')
        staat['lat'] = 0.05; staat['n'] = 13
        await p.goto(B + 'index.html'); await p.wait_for_timeout(2500)
        r = await p.evaluate(LEES)
        check('nieuw bericht komt erbij', 'Groet 12' in r['tekst'] and r['blz'].startswith('‹ blz. 1 van 4'), r)
        print('4. Zelf plaatsen')
        await p.click('#gbl-nav [data-blader="vooruit"]')
        await p.fill('#gbi', 'Hallo'); await p.click('#gbs'); await p.wait_for_timeout(2000)
        r = await p.evaluate(LEES)
        check('na plaatsen: blz. 1 met het nieuwe bericht', 'Groet 13' in r['tekst'] and r['blz'].startswith('‹ blz. 1 van 4'), r)
        print('5. Zonder internet')
        staat['online'] = False
        await p.goto(B + 'index.html'); await p.wait_for_timeout(2500)
        r = await p.evaluate(LEES)
        check('zonder server: bewaard boek met foto', 'Groet 13' in (r['tekst'] or '') and r['fotos'] == 4, r)
        await br.close()
asyncio.run(main())
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
