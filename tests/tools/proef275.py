# proef275 (10 nov 2026, v276): iPhone met Vergrendelingsmodus (Lockdown Mode). Dan bestaan FileReader (overal) en
# indexedDB (in Safari, niet in de app op het beginscherm) niet. Meldingen uit de foutmelder van 9 nov:
#   "Can't find variable: FileReader" (index.html, foto kiezen) en "Can't find variable: indexedDB" (profiel.html, vriend-profiel.html).
# Nagebootst in Chromium door FileReader en indexedDB weg te halen:
#  A. Home (zonder FileReader, zoals op het beginscherm): een foto kiezen in de 3x3-widget en in de polaroid-widget
#     werkt en de foto wordt bewaard; geen paginafouten
#  B. Profiel (zonder FileReader en indexedDB, zoals in Safari) met een avatarfoto: het profiel laadt helemaal
#     (tot het einde), geen fout over indexedDB
#  C. Vriendprofiel (zonder indexedDB) met avatar en achtergrondfoto: de achtergrond verschijnt, geen fout over indexedDB
#  D. Gewone Chrome (alles aanwezig): de foto in de 3x3-widget werkt nog net zo
# python3 -I proef275.py <map>
import sys, os, time, json, socket, subprocess, tempfile, base64
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

UID = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
FOTO = KLEIN = None  # testfoto's: in de browser gemaakt (een canvas als JPEG)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
WIDGETS = [{"id": "fotos_3x3", "icon": "x", "titel": "Foto grid 3x3", "w": 4, "h": 3, "volgorde": 0, "aan": True},
           {"id": "fotos_masonry", "icon": "x", "titel": "Polaroid grid", "w": 4, "h": 3, "volgorde": 1, "aan": True}]
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u and m == 'GET': return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": BRAM, "status": "accepted"}])
    if '/rest/v1/profiles' in u and m == 'GET':
        if BRAM in u: rij = {"id": BRAM, "username": "Bram", "avatar_url": "x", "avatar_data": KLEIN, "wallpaper_data": KLEIN, "updated_at": "2026-11-09T10:00:00Z", "public_key": None}
        else: rij = {"id": UID, "username": "Marcel", "avatar_data": KLEIN}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=rij)
        return route.fulfill(status=200, json=[rij])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
GEEN_LEZER = "try { delete window.FileReader } catch (e) {}"
GEEN_DB = "try { delete window.indexedDB } catch (e) {} try { delete Window.prototype.indexedDB } catch (e) {}"
LEES = """async (sleutel) => { const db = await new Promise((ok, nee) => { const r = indexedDB.open('FibroDB', 2);
  r.onupgradeneeded = e => { const d = e.target.result; if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos', { keyPath: 'id' }) };
  r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error) })
  const v = await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(sleutel); q.onsuccess = () => ok(q.result ? q.result.data : null) }); db.close()
  return v ? String(v).slice(0, 11) : null }"""

www = tempfile.mkdtemp(prefix='proef275_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
def nieuw(b, extra):
    ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 800})
    ctx.route('**/*supabase.co/**', supa)
    pg = ctx.new_page(); fouten = []
    pg.on('pageerror', lambda e: fouten.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(BASIS + 'login.html')
    pg.evaluate("([t, u, w]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now()));"
                " localStorage.setItem('fibro_widgets_profiel_' + u, JSON.stringify(w)) }", [TOKEN, UID, WIDGETS])
    for e in extra: ctx.add_init_script(e)
    return ctx, pg, fouten
def foto_kiezen(pg, sel, sleutel):
    if not pg.query_selector(sel): return 'geen ' + sel
    pg.set_input_files(sel, files=[{'name': 'foto.jpg', 'mimeType': 'image/jpeg', 'buffer': FOTO}]); pg.wait_for_timeout(2500)
    return pg.evaluate(LEES, sleutel)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        maak = b.new_page()
        jpeg = "([w, h, k]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = k; g.fillRect(0, 0, w, h); return c.toDataURL('image/jpeg', 0.9) }"
        FOTO = base64.b64decode(maak.evaluate(jpeg, [800, 600, '#28a05a']).split(',', 1)[1])
        KLEIN = maak.evaluate(jpeg, [64, 64, '#c83232']); maak.close()
        # A + D: Home
        for soort, extra in [('vergrendeld', [GEEN_LEZER]), ('gewoon', [])]:
            ctx, pg, fouten = nieuw(b, extra)
            pg.goto(BASIS + 'index.html'); pg.wait_for_timeout(3500)
            if soort == 'vergrendeld':
                check(pg.evaluate("typeof FileReader") == 'undefined', 'A: nabootsing: geen FileReader')
            r = foto_kiezen(pg, '#foto-inp-3x3-0', 'pfoto_3x3_0_' + UID)
            check(isinstance(r, str) and r.startswith('data:image'), '%s: foto in de 3x3-widget bewaard (%s)' % ('A' if soort == 'vergrendeld' else 'D', r))
            if soort == 'vergrendeld':
                r = foto_kiezen(pg, '#foto-inp-polaroid-0', 'pfoto_polaroid_0_' + UID)
                check(isinstance(r, str) and r.startswith('data:image'), 'A: foto in de polaroid-widget bewaard (%s)' % r)
            check(not fouten, '%s: geen paginafouten (%s)' % ('A' if soort == 'vergrendeld' else 'D', fouten[:3]))
            ctx.close()
        # B: Profiel
        ctx, pg, fouten = nieuw(b, [GEEN_LEZER, GEEN_DB])
        pg.goto(BASIS + 'profiel.html'); pg.wait_for_timeout(4000)
        check(pg.evaluate("typeof indexedDB") == 'undefined', 'B: nabootsing: geen indexedDB')
        klaar = pg.evaluate("!!document.getElementById('editNaam').oninput")  # het allerlaatste wat het laden doet
        check(klaar, 'B: profiel laadt helemaal door (tot het einde)')
        check(not any('indexedDB' in f for f in fouten), 'B: geen fout over indexedDB (%s)' % fouten[:3])
        ctx.close()
        # C: Vriendprofiel
        ctx, pg, fouten = nieuw(b, [GEEN_LEZER, GEEN_DB])
        pg.goto(BASIS + 'vriend-profiel.html?id=' + BRAM); pg.wait_for_timeout(4000)
        bg = pg.evaluate("(document.getElementById('wallpaperBg') || { style: {} }).style.backgroundImage || ''")
        check(bg.startswith('url('), 'C: achtergrond van Bram zichtbaar (%r)' % bg[:30])
        check(not any('indexedDB' in f for f in fouten), 'C: geen fout over indexedDB (%s)' % fouten[:3])
        ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
sys.exit(1 if fout else 0)
