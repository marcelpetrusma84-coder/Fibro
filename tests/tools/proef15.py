import subprocess, sys, time, json, os, asyncio, wave, struct, math
from playwright.async_api import async_playwright
# proef15: tekst op Home en Profiel meteen uit het geheugen; niets overschrijven wat je zelf al veranderd hebt;
# zonder internet; eerste keer (nog niets bewaard); mp3-maker pas laden bij muziek.
# python3 -I proef15.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www15_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "bram", "display_name": None, "bio": "Server-bio", "mood": "\U0001F60E Lekker", "avatar_url": "\U0001F419",
         "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc", "toon_online": False, "offline_emoji": "\U0001F4A4", "offline_bericht": "Even weg",
         "public_key": "pk", "avatar_data": None, "wallpaper_data": "data:image/png;base64,AAAA"}
staat = {'lat': 0.05, 'online': True}
async def supa(route):
    u = route.request.url; m = route.request.method
    await asyncio.sleep(staat['lat'])
    if not staat['online']: return await route.abort('internetdisconnected')
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return await route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    return await route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
# wat staat er op het moment dat de html gelezen is (voordat de modules draaien)
VROEG = """(() => { document.addEventListener('DOMContentLoaded', () => { const g = id => document.getElementById(id);
  window.__vroeg = { hero: g('heroNaam') && g('heroNaam').textContent, user: g('heroUsername') && g('heroUsername').textContent,
    mood: g('heroMood') && g('heroMood').textContent, bio: g('heroBio') && g('heroBio').textContent,
    pnaam: g('editNaam') && g('editNaam').value, puser: g('usernameWeergave') && g('usernameWeergave').textContent,
    pmood: g('editMood') && g('editMood').value, ponline: g('onlineLabel') && g('onlineLabel').textContent, lame: typeof window.lamejs } }, { capture: true }) })()"""
LEES = """() => { const g = id => document.getElementById(id); return { hero: g('heroNaam') && g('heroNaam').textContent,
  pnaam: g('editNaam') && g('editNaam').value, pbio: g('editBio') && g('editBio').value, pmood: g('editMood') && g('editMood').value,
  emoji: g('moodEmojiGekozen') && g('moodEmojiGekozen').textContent, ponline: g('onlineLabel') && g('onlineLabel').textContent,
  preview: g('previewNaam') && g('previewNaam').textContent, puser: g('usernameWeergave') && g('usernameWeergave').textContent,
  teller: g('bioTeller') && g('bioTeller').textContent, lame: typeof window.lamejs } }"""
wav = S + '/kort.wav'
with wave.open(wav, 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes(b''.join(struct.pack('<h', int(8000 * math.sin(i / 10))) for i in range(22050)))
async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(); ctx = await br.new_context(service_workers='allow'); await ctx.route('**/*supabase.co/**', supa)
        await ctx.add_init_script(VROEG)
        p = await ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200]))
        async def dlg(d): await d.accept()
        p.on('dialog', lambda d: asyncio.ensure_future(dlg(d)))
        await p.goto(B + 'login.html')
        await p.evaluate("([t, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_profiel_' + uid, JSON.stringify({ naam: 'Bram B', bio: 'Mijn bio' })) }", [TOKEN, UID])
        print('1. Eerste keer (nog niets bewaard)')
        await p.goto(B + 'profiel.html'); await p.wait_for_timeout(2500)
        r = await p.evaluate(LEES); v = await p.evaluate("() => window.__vroeg")
        check('profiel eerste keer: na laden goed', r['pnaam'] == 'Bram B' and r['puser'] == 'bram' and r['pmood'] == 'Lekker' and r['ponline'] == 'Offline' and r['teller'] == '92 tekens over', r)
        check('profiel eerste keer: vroeg nog leeg (er was niets bewaard)', v['puser'] == '—', v)
        check('profiel bewaart profiel zonder wallpaper', await p.evaluate("u => { const c = JSON.parse(localStorage.getItem('fibro_profielcache_' + u)); return c && c.username === 'bram' && !('wallpaper_data' in c) }", UID))
        await p.evaluate("u => localStorage.removeItem('fibro_profielcache_' + u)", UID)
        await p.goto(B + 'index.html'); await p.wait_for_timeout(2500); await p.evaluate("() => navigator.serviceWorker.ready")
        r = await p.evaluate(LEES); v = await p.evaluate("() => window.__vroeg")
        check('home eerste keer: na laden goed', r['hero'] == 'Bram B', r['hero'])
        check('home eerste keer: vroeg Laden...', v['hero'] == 'Laden...', v['hero'])
        check('home: geen mp3-maker geladen', r['lame'] == 'undefined' and v['lame'] == 'undefined', (r['lame'], v['lame']))
        print('2. Tweede keer: tekst al voordat de modules draaien')
        staat['lat'] = 3.0
        await p.goto(B + 'index.html'); await p.wait_for_timeout(300)
        v = await p.evaluate("() => window.__vroeg")
        check('home vroeg: naam, @naam, bio, mood', v['hero'] == 'Bram B' and v['user'] == '@bram' and v['bio'] == 'Mijn bio' and 'Even weg' in v['mood'], v)
        await p.wait_for_timeout(4000)
        m = await p.evaluate("() => document.getElementById('heroMood').textContent")
        check('home: mood niet dubbel na het verse profiel', m == '\U0001F4A4Even weg', m)
        await p.goto(B + 'profiel.html'); await p.wait_for_timeout(300)
        v = await p.evaluate("() => window.__vroeg")
        check('profiel vroeg: naam, @naam, mood, offline', v['pnaam'] == 'Bram B' and v['puser'] == 'bram' and v['pmood'] == 'Lekker' and v['ponline'] == 'Offline' and v['lame'] == 'undefined', v)
        print('3. Zelf al iets veranderen voordat de server antwoordt (server 3 s)')
        await p.fill('#editNaam', 'Nieuwe naam'); await p.fill('#editMood', 'Moe')
        await p.wait_for_timeout(4500)
        r = await p.evaluate(LEES)
        check('profiel: eigen wijziging blijft staan', r['pnaam'] == 'Nieuwe naam' and r['pmood'] == 'Moe' and r['pbio'] == 'Mijn bio', r)
        check('profiel: voorbeeld toont eigen naam (of is er niet meer)', r['preview'] in ('Nieuwe naam', None), r['preview'])
        print('4. Online-knop vroeg indrukken (server 3 s)')
        await p.goto(B + 'profiel.html'); await p.wait_for_function("() => typeof window.toggleOnlineStatus === 'function'", timeout=5000)
        await p.evaluate("() => window.toggleOnlineStatus()"); await p.wait_for_timeout(4500)
        r = await p.evaluate(LEES)
        check('profiel: online-knop werkt en blijft staan', r['ponline'] == 'Online', r['ponline'])
        print('5. Zonder internet')
        staat['lat'] = 0.05; staat['online'] = False
        await p.goto(B + 'profiel.html'); await p.wait_for_timeout(3000)
        r = await p.evaluate(LEES)
        check('profiel zonder server: tekst uit het geheugen', r['pnaam'] == 'Bram B' and r['puser'] == 'bram', r)
        staat['online'] = True
        print('6. Muziek omzetten laadt de mp3-maker pas dan')
        await p.goto(B + 'profiel.html'); await p.wait_for_timeout(2500)
        check('profiel: nog geen mp3-maker', (await p.evaluate(LEES))['lame'] == 'undefined')
        await p.set_input_files('#muziekUpload', wav); await p.wait_for_timeout(5000)
        r = await p.evaluate("() => new Promise(res => { const q = indexedDB.open('FibroDB'); q.onsuccess = e => { const g = e.target.result.transaction('fotos').objectStore('fotos').get('muziek_track'); g.onsuccess = () => res({ lame: typeof window.lamejs, mp3: !!(g.result && g.result.data && String(g.result.data).startsWith('data:audio')) }) } })")
        check('profiel: muziek omgezet met de mp3-maker', r['lame'] != 'undefined' and r['mp3'], r)
        await br.close()
asyncio.run(main())
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
