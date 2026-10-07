import subprocess, sys, time, json, os, statistics
import asyncio
from playwright.async_api import async_playwright
# proef16: hoe snel staat het gastenboek op Home (tweede bezoek); antwoorden met foto's duren langer (500 KB/s)
# python3 -I proef14.py <scratch met tools/server.py> <map> <poort> [cpu-vertraging] [server-ms]
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3])
CPU = float(sys.argv[4]) if len(sys.argv) > 4 else 4
LAT = int(sys.argv[5]) if len(sys.argv) > 5 else 400
B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www16_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server_traag.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
EIGEN = {"id": UID, "username": "marcel", "display_name": None, "bio": "Server-bio", "mood": "\U0001F60E Lekker", "avatar_url": "\U0001F419",
         "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc", "toon_online": True, "offline_emoji": "\U0001F4A4", "offline_bericht": "Even weg",
         "public_key": "pk", "avatar_data": None, "wallpaper_data": None}
import base64
AUT = ['eeee000%d-0000-4000-8000-00000000000%d' % (i, i) for i in range(4)]
FOTO = 'data:image/jpeg;base64,' + base64.b64encode(os.urandom(30000)).decode()
async def supa(route):
    u = route.request.url; m = route.request.method
    await asyncio.sleep(LAT / 1000)
    if '/rest/v1/guestbook_entries' in u and m == 'GET':
        metfoto = 'avatar_data' in u
        rijen = [{"id": i, "profile_id": UID, "author_id": AUT[i % 4], "content": f"Groet {i}", "created_at": "2026-10-07T10:00:00Z",
                  "author": dict({"username": f"schrijver{i % 4}", "avatar_url": "\U0001F600"}, **({"avatar_data": FOTO} if metfoto else {}))} for i in range(40)]
        body = json.dumps(rijen); await asyncio.sleep(len(body) / 500000)
        return await route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
    if '/rest/v1/profiles' in u and m == 'GET' and 'id=in.' in u:
        body = json.dumps([{"id": a, "avatar_data": FOTO} for a in AUT]); await asyncio.sleep(len(body) / 500000)
        return await route.fulfill(status=200, body=body, headers={'content-type': 'application/json'})
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return await route.fulfill(status=200, json=EIGEN if obj else [EIGEN])
    if m == 'GET': return await route.fulfill(status=200, json=[])
    if m in ('PATCH', 'POST'): return await route.fulfill(status=200, json=[])
    return await route.fulfill(status=200, json=[])
# meet: eerste moment (ms sinds navigatie) dat de tekst er staat
MEET = """(() => { const t0 = performance.timeOrigin; window.__tekst = {};
  const kijk = () => {
    const g = id => document.getElementById(id);
    if (!window.__tekst.home && g('heroNaam') && g('heroNaam').textContent && g('heroNaam').textContent !== 'Laden...') window.__tekst.home = performance.now();
    if (!window.__tekst.widget && document.querySelector('#home-sectie .widget-blok')) window.__tekst.widget = performance.now();
    if (!window.__tekst.gastenboek && /Groet/.test((document.querySelector('#gbl') || {}).textContent || '')) window.__tekst.gastenboek = performance.now();
    if (!window.__tekst.profiel && g('usernameWeergave') && g('usernameWeergave').textContent !== '—' && g('editNaam') && g('editNaam').value) window.__tekst.profiel = performance.now();
    if (!window.__tekst.klaar) requestAnimationFrame(kijk) };
  requestAnimationFrame(kijk); setInterval(kijk, 5) })()"""
LAYOUT = json.dumps([{"id": "gastenboek", "aan": True, "w": 4, "h": 4, "volgorde": 0, "icon": "x", "titel": "Gastenboek"},
                     {"id": "klok", "aan": True, "w": 4, "h": 2, "volgorde": 1, "icon": "x", "titel": "Klok"}])
uit = {}
async def main():
  async with async_playwright() as pw:
      br = await pw.chromium.launch(); ctx = await br.new_context(service_workers='allow'); await ctx.route('**/*supabase.co/**', supa)
      await ctx.add_init_script(MEET)
      p = await ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200])); p.on('dialog', lambda d: d.accept())
      await p.goto(B + 'login.html')
      await p.evaluate("([t, uid, lay]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_widgets_home_' + uid, lay);"
                 " localStorage.setItem('fibro_profiel_' + uid, JSON.stringify({ naam: 'Marcel P', bio: 'Mijn bio' })) }", [TOKEN, UID, LAYOUT])
      # eerst de kast vullen en de caches laten ontstaan (zoals een gewone gebruiker al gedaan heeft)
      await p.goto(B + 'index.html'); await p.wait_for_timeout(2500); await p.evaluate("() => navigator.serviceWorker.ready")
      await p.goto(B + 'profiel.html'); await p.wait_for_timeout(2500)
      await p.goto(B + 'index.html'); await p.wait_for_timeout(2500)
      cdp = await ctx.new_cdp_session(p); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': CPU})
      for pagina, sleutels in [('index.html', ['home', 'widget', 'gastenboek'])]:
          for k in sleutels: uit[k] = []
          for i in range(5):
              await p.goto(B + pagina); await p.wait_for_timeout(int(3000 + LAT * 4))
              r = await p.evaluate("() => window.__tekst")
              for k in sleutels: uit[k].append(r.get(k))
          controle = await p.evaluate("() => ({ h: (document.getElementById('heroNaam')||{}).textContent, u: (document.getElementById('usernameWeergave')||{}).textContent, n: (document.getElementById('editNaam')||{}).value, m: (document.getElementById('editMood')||{}).value, pn: (document.getElementById('previewNaam')||{}).textContent })")
          print('  ', pagina, controle)
      await br.close()
asyncio.run(main())
srv.kill()
for k, v in uit.items():
    ok = [x for x in v if x is not None]
    print(f'{k:8s} mediaan {round(statistics.median(ok)) if ok else "-"} ms  ({", ".join(str(round(x)) if x else "nooit" for x in v)})')
