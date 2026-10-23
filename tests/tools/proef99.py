# proef99: de achtergrond meteen bewaren en delen (v204). Echte profiel.html (Marcel) en vriend-profiel.html (Bram kijkt
# bij Marcel), nep-Supabase die de profielen bijhoudt (GET met select, PATCH = update, POST = upsert). NL, en EN apart.
#  P1 een foto kiezen: zonder Opslaan meteen naar de server (wallpaper_data, updated_at); regel "✓ Bewaard ..."
#  P2 Bram ziet de foto van Marcel op diens profiel (ook al heeft Bram zelf een eigen achtergrond)
#  P3 met een foto toch een gradient kiezen: eerst de vraag; "nee" = niets veranderd; "ja" = foto weg (toestel en server),
#     het verloop gaat als achtergrond_kleur naar de server en staat op het toestel
#  P4 Bram ziet het verloop van Marcel, niet zijn eigen achtergrond en niet meer de foto van de vorige keer
#  P5 de wallpaper Oceaan: naar de server; opnieuw openen = Wallpaper en Oceaan gekozen
#  P6 een kleur: naar de server; opnieuw openen = Kleur met die code
#  P7 Home van Marcel met Oceaan: het verloop is de achtergrond (Home liet ook een gewone kleur nooit zien), de rand van
#     het stipje de eerste kleur
#  P8 een video kiezen: een melding, er wordt niets bewaard of gestuurd; het kiesvak vraagt alleen foto's
#  P9 Opslaan daarna: stuurt de gekozen achtergrond (het verloop), niet opnieuw de foto
#  P10 geen verbinding: regel "Niet gedeeld ..."; met Opslaan gaat het alsnog mee
#  V  vriend zonder achtergrond (Lotte): Bram ziet daar niet zijn eigen foto
#  E  in het Engels: de uitleg en "✓ Saved ..."
#  F  geen paginafouten, geen ontbrekende vertaling
# Oude map (v203) als controle: P1, P3, P4, P5, P7, P8, V en E MIS.
# python3 -I proef99.py <map>
import sys, os, re, io, time, json, base64, socket, tempfile, threading, http.server, functools
from urllib.parse import unquote
from playwright.sync_api import sync_playwright
from PIL import Image
MAP = os.path.abspath(sys.argv[1])
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'; LOTTE = 'cccc0002-0000-4000-8000-000000000003'
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''), flush=True)
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
def jpeg_bytes(kleur, w=600, h=900):
    b = io.BytesIO(); Image.new('RGB', (w, h), kleur).save(b, 'JPEG', quality=85); return b.getvalue()
BLAUW = 'data:image/jpeg;base64,' + base64.b64encode(jpeg_bytes((20, 60, 230), 400, 800)).decode()
FOTO = tempfile.mkdtemp() + '/rood.jpg'; open(FOTO, 'wb').write(jpeg_bytes((230, 20, 20)))
VIDEO = tempfile.mkdtemp() + '/film.mp4'; open(VIDEO, 'wb').write(b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 400)

www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', poort), functools.partial(H, directory=www))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort

# ---- nep-Supabase: de profielen ----
def leeg(uid, naam): return {"id": uid, "username": naam, "display_name": None, "bio": "", "mood": "", "avatar_url": "\U0001F642", "avatar_data": None,
    "wallpaper_data": None, "achtergrond_kleur": None, "accent_kleur": None, "accent_kleur2": None, "lettertype": None, "animatie": None, "widgets": None,
    "online_status": True, "toon_online": True, "laatst_gezien": None, "offline_emoji": None, "offline_bericht": None, "updated_at": "2026-10-01T10:00:00Z",
    "avatar_versie": "", "wallpaper_versie": "", "public_key": "k" * 100, "taal": "nl"}
DB = {}
LOG = []          # (methode, uid, body)
NET = {'uit': False}
def reset():
    DB.clear(); DB[MARCEL] = leeg(MARCEL, 'Marcel'); DB[BRAM] = leeg(BRAM, 'Bram'); DB[LOTTE] = leeg(LOTTE, 'Lotte'); LOG.clear()
import hashlib
def zet(uid, velden):
    r = DB.setdefault(uid, leeg(uid, '?'))
    for k, v in velden.items():
        if k in r or k in ('updated_at',): r[k] = v
    if 'wallpaper_data' in velden: r['wallpaper_versie'] = hashlib.md5((velden['wallpaper_data'] or '').encode()).hexdigest() if velden['wallpaper_data'] else ''
    if 'avatar_data' in velden: r['avatar_versie'] = hashlib.md5((velden['avatar_data'] or '').encode()).hexdigest() if velden['avatar_data'] else ''
def ik_van(route):
    a = route.request.headers.get('authorization') or ''
    return {'tok-aaaa': MARCEL, 'tok-bbbb': BRAM}.get(a.replace('Bearer ', ''), MARCEL)
def supa(route):
    u = route.request.url; m = route.request.method
    if NET['uit'] and m in ('PATCH', 'POST') and '/rest/v1/profiles' in u: return route.abort('internetdisconnected')
    if '/rest/v1/profiles' in u:
        if m == 'PATCH':
            uid = re.search(r'id=eq\.([0-9a-f-]+)', u).group(1); body = json.loads(route.request.post_data or '{}')
            LOG.append(('PATCH', uid, body)); zet(uid, body); return route.fulfill(status=204, body='')
        if m == 'POST':
            body = json.loads(route.request.post_data or '{}'); rijen = body if isinstance(body, list) else [body]
            for r in rijen: LOG.append(('POST', r.get('id'), r)); zet(r.get('id'), r)
            return route.fulfill(status=201, body='')
        sel = unquote(re.search(r'select=([^&]*)', u).group(1)) if 'select=' in u else '*'
        kols = None if sel == '*' else [k.strip() for k in sel.split(',') if k.strip()]
        ids = re.findall(r'(?:id=eq\.|id=in\.\(?)([0-9a-f-]{36})', u) or re.findall(r'([0-9a-f]{8}-[0-9a-f-]{27})', u)
        rijen = [DB[i] for i in ids if i in DB] or ([DB[ik_van(route)]] if not ids else [])
        uit = [r if kols is None else {k: r.get(k) for k in kols} for r in rijen]
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=uit[0] if uit else {})
        return route.fulfill(status=200, json=uit)
    if '/rest/v1/friendships' in u:
        ik = ik_van(route); anderen = [x for x in (MARCEL, BRAM, LOTTE) if x != ik]
        return route.fulfill(status=200, json=[{"user_id": ik, "friend_id": a, "status": "accepted", "profiles": DB[a]} for a in anderen])
    if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": ik_van(route), "aud": "authenticated"})
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[] if m == 'GET' else {})
def ws(w):
    def bericht(msg):
        if isinstance(msg, (bytes, bytearray)): return
        try: jr, ref, topic, event, payload = json.loads(msg)
        except Exception: return
        if event == 'phx_join':
            pg_ = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
            w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg_}}])); return
        if ref: w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
    w.on_message(bericht)
fouten, taalfout = [], []
DIALOOG = {'doe': 'accept', 'gezien': []}
def dialoog(d):
    DIALOOG['gezien'].append((d.type, d.message))
    (d.accept if (d.type != 'confirm' or DIALOOG['doe'] == 'accept') else d.dismiss)()
def toestel(br, uid, taal='nl', eigen_foto=None):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', ws)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(str(e)[:200]))
    pg.on('console', lambda m: taalfout.append(m.text) if 'nog geen vertaling' in m.text else None)
    pg.on('dialog', dialoog)
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("([t, taal, u]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal); localStorage.setItem('fibro_fotos_verstuurd_' + u, JSON.stringify({ a: '-', w: '-' })) }", [token(uid), taal, uid])
    if eigen_foto: zet_idb(pg, 'bg_wallpaper_' + uid, eigen_foto)
    return ctx, pg
def zet_idb(pg, sleutel, data):
    pg.evaluate("""([id, data]) => new Promise(ok => { const q = indexedDB.open('FibroDB', 2)
      q.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' }) }
      q.onsuccess = e => { const tx = e.target.result.transaction('fotos', 'readwrite'); tx.objectStore('fotos').put({ id, data }); tx.oncomplete = () => ok(true) } })""", [sleutel, data])
LEES_IDB = """id => new Promise(ok => { const q = indexedDB.open('FibroDB', 2)
  q.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos', { keyPath: 'id' }) }
  q.onsuccess = e => { const r = e.target.result.transaction('fotos').objectStore('fotos').get(id); r.onsuccess = () => ok(r.result ? String(r.result.data).slice(0, 30) : null); r.onerror = () => ok(null) } })"""
def wacht(pg, js, ms, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False
def ev(pg, js, arg=None):
    try: return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:120]
def wacht_log(pg, pred, ms=6000):   # (met pg.wait_for_timeout: dan werkt de nep-server intussen door)
    t = time.time()
    while time.time() - t < ms / 1000:
        hit = [x for x in list(LOG) if pred(x)]
        if hit: return hit
        pg.wait_for_timeout(100)
    return []
STATUS = "() => { const s = document.getElementById('bgDeelStatus'); return s && !s.hidden ? s.textContent : null }"
ACTIEF = "() => { const b = document.querySelector('.type-btn.active'); return b ? b.id : null }"
def open_profiel(pg):
    pg.goto(BASIS + 'profiel.html')
    wacht(pg, "() => typeof window.switchTab === 'function' && !!document.getElementById('panel-achtergrond')", 15000)
    pg.wait_for_timeout(1500)
    ev(pg, "() => switchTab('achtergrond')"); pg.wait_for_timeout(300)
def zet_invoer(pg, sel, waarde):
    ev(pg, "([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })) }", [sel, waarde])
import PIL.Image
def kleur_rand(png):
    im = PIL.Image.open(io.BytesIO(png)).convert('RGB')
    p = [im.getpixel((x, y)) for x in (3, 386) for y in (200, 400, 600, 780)]
    return tuple(round(sum(c[i] for c in p) / len(p)) for i in range(3))
def vriendprofiel(pg, wie):
    pg.goto(BASIS + 'vriend-profiel.html?id=' + wie); pg.wait_for_timeout(3500)
    return {'rand': kleur_rand(pg.screenshot()), 'body': (ev(pg, "() => getComputedStyle(document.body).backgroundImage") or '')[:120],
            'eigenlaag': ev(pg, "() => !!document.getElementById('fibro-wallpaper')"), 'laag': (ev(pg, "() => getComputedStyle(document.getElementById('wallpaperBg')).backgroundImage") or '')[:40]}
roodachtig = lambda c: c[0] > 120 and c[0] > c[2] + 60
blauwachtig = lambda c: c[2] > 120 and c[2] > c[0] + 60
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        reset()
        cm, m = toestel(br, MARCEL)
        cb, b = toestel(br, BRAM, eigen_foto=BLAUW)
        open_profiel(m)
        uitleg = ev(m, "() => document.getElementById('panel-achtergrond').textContent.includes('Wat je hier kiest, geldt meteen')")
        accept = ev(m, "() => document.getElementById('bgUpload').getAttribute('accept')")
        # P1
        n0 = len(LOG)
        m.set_input_files('#bgUpload', FOTO)
        hit = wacht_log(m, lambda x: x[0] == 'PATCH' and str(x[2].get('wallpaper_data') or '').startswith('data:image'))
        m.wait_for_timeout(600)
        st = ev(m, STATUS)
        check('P1 een foto kiezen: zonder Opslaan meteen naar de server, met updated_at; "✓ Bewaard ..."', hit and 'updated_at' in hit[0][2] and st and st.startswith('✓ Bewaard') and uitleg,
              (bool(hit), hit and sorted(hit[0][2])[:4], st, uitleg))
        # P2
        v = vriendprofiel(b, MARCEL)
        check('P2 Bram ziet de foto van Marcel (en niet zijn eigen)', roodachtig(v['rand']) and not v['eigenlaag'], v)
        # P3: gradient terwijl er een foto is
        DIALOOG['doe'] = 'dismiss'; DIALOOG['gezien'].clear(); n0 = len(LOG)
        ev(m, "() => setAchtergrondType('gradient')")
        zet_invoer(m, '#grad1Picker', '#ff8800'); m.wait_for_timeout(1500)
        vraag = [x for x in DIALOOG['gezien'] if x[0] == 'confirm']
        nee = (len(LOG) == n0, ev(m, LEES_IDB, 'bg_wallpaper_' + MARCEL))
        DIALOOG['doe'] = 'accept'
        zet_invoer(m, '#grad2Picker', '#00aa00'); m.wait_for_timeout(1500)
        verloop = 'linear-gradient(135deg,#ff8800,#00aa00)'
        stuur = [x for x in LOG[n0:] if x[0] == 'PATCH']
        samen = {}
        for x in stuur: samen.update(x[2])
        ja = (samen.get('achtergrond_kleur'), 'wallpaper_data' in samen and samen['wallpaper_data'] is None, ev(m, LEES_IDB, 'bg_wallpaper_' + MARCEL),
              ev(m, "u => JSON.parse(localStorage.getItem('fibro_profiel_' + u) || '{}').bgKleur", MARCEL))
        check('P3 met een foto een gradient kiezen: eerst de vraag; nee = niets; ja = foto weg (toestel en server), verloop naar de server en het toestel',
              vraag and nee[0] and nee[1] and ja == (verloop, True, None, verloop), (vraag[:1], nee, ja))
        # P4
        v = vriendprofiel(b, MARCEL)
        check('P4 Bram ziet het verloop van Marcel, niet zijn eigen achtergrond', 'linear-gradient' in v['body'] and 'rgb(255, 136, 0)' in v['body'] and not blauwachtig(v['rand']) and not v['eigenlaag'], v)
        # P5: wallpaper Oceaan
        n0 = len(LOG)
        ev(m, "() => setAchtergrondType('wallpaper')")
        m.click('.wallpaper-cell >> nth=1'); m.wait_for_timeout(1500)
        oceaan = 'linear-gradient(135deg,#042f2e,#0f172a)'
        stuur = [x[2].get('achtergrond_kleur') for x in LOG[n0:] if x[0] == 'PATCH' and 'achtergrond_kleur' in x[2]]
        open_profiel(m)
        terug = (ev(m, ACTIEF), ev(m, "() => { const c = document.querySelector('.wallpaper-cell.selected'); return c ? c.textContent.trim() : null }"))
        check('P5 de wallpaper Oceaan: naar de server; opnieuw openen = Wallpaper en Oceaan gekozen', stuur[-1:] == [oceaan] and terug == ('type-wallpaper', 'Oceaan'), (stuur, terug))
        # P7: Home van Marcel
        m.goto(BASIS + 'index.html'); m.wait_for_timeout(3000)
        home = (ev(m, "() => getComputedStyle(document.body).backgroundImage + ' | ' + getComputedStyle(document.documentElement).backgroundImage"),
                ev(m, "() => getComputedStyle(document.documentElement).getPropertyValue('--bg-kleur').trim()"),
                ev(m, "() => { const s = document.querySelector('.offline-stip'); return s ? getComputedStyle(s).borderTopColor : null }"))
        check('P7 Home met Oceaan: het verloop is de achtergrond, de rand van het stipje de eerste kleur', 'linear-gradient' in str(home[0]) and home[1] == '#042f2e' and home[2] in (None, 'rgb(4, 47, 46)'), home)
        # P6: een kleur
        open_profiel(m); n0 = len(LOG)
        ev(m, "() => setAchtergrondType('kleur')")
        m.click('#bg-kleur-sectie .swatch >> nth=4'); m.wait_for_timeout(1500)
        stuur = [x[2].get('achtergrond_kleur') for x in LOG[n0:] if x[0] == 'PATCH' and 'achtergrond_kleur' in x[2]]
        open_profiel(m)
        terug = (ev(m, ACTIEF), ev(m, "() => document.getElementById('bgKleurHex').value"))
        check('P6 een kleur: naar de server; opnieuw openen = Kleur met die code', stuur[-1:] == ['#14532d'] and terug == ('type-kleur', '#14532d'), (stuur, terug))
        # P8: video
        DIALOOG['gezien'].clear(); n0 = len(LOG)
        try: m.set_input_files('#bgUpload', {'name': 'film.mp4', 'mimeType': 'video/mp4', 'buffer': open(VIDEO, 'rb').read()})
        except Exception as e: print('  (video kiezen:', str(e)[:80], ')')
        m.wait_for_timeout(1500)
        melding = [x for x in DIALOOG['gezien'] if x[0] == 'alert']
        check('P8 een video: een melding, niets bewaard of gestuurd; het kiesvak vraagt alleen foto\'s',
              melding and 'Alleen een foto' in melding[0][1] and len(LOG) == n0 and ev(m, LEES_IDB, 'bg_wallpaper_' + MARCEL) is None and accept == 'image/*', (melding[:1], len(LOG) - n0, accept))
        # P9: Opslaan
        ev(m, "() => setAchtergrondType('gradient')"); zet_invoer(m, '#grad1Picker', '#ff8800'); zet_invoer(m, '#grad2Picker', '#00aa00'); m.wait_for_timeout(1500)
        n0 = len(LOG)
        m.click('.save-top-btn'); m.wait_for_timeout(2500)
        post = [x[2] for x in LOG[n0:] if x[0] == 'POST' and x[1] == MARCEL]
        check('P9 Opslaan: stuurt het gekozen verloop, niet opnieuw de foto', post and post[-1].get('achtergrond_kleur') == verloop and 'wallpaper_data' not in post[-1],
              post and {k: str(v)[:40] for k, v in post[-1].items() if k in ('achtergrond_kleur', 'wallpaper_data', 'avatar_data')})
        # P10: geen verbinding
        open_profiel(m); ev(m, "() => setAchtergrondType('kleur')")
        NET['uit'] = True
        m.click('#bg-kleur-sectie .swatch >> nth=2'); m.wait_for_timeout(2000)
        st = ev(m, STATUS)
        NET['uit'] = False; n0 = len(LOG)
        m.click('.save-top-btn'); m.wait_for_timeout(2500)
        post = [x[2] for x in LOG[n0:] if x[0] == 'POST' and x[1] == MARCEL]
        check('P10 geen verbinding: "Niet gedeeld ..."; met Opslaan gaat het alsnog mee', st and st.startswith('Niet gedeeld') and post and post[-1].get('achtergrond_kleur') == '#0f172a', (st, post and post[-1].get('achtergrond_kleur')))
        # V: vriend zonder achtergrond
        v = vriendprofiel(b, LOTTE)
        check('V Lotte heeft geen achtergrond: Bram ziet daar niet zijn eigen foto', not blauwachtig(v['rand']) and not v['eigenlaag'] and v['body'] == 'none', v)
        cm.close(); cb.close()
        # E: Engels
        reset(); ce, e = toestel(br, MARCEL, 'en'); open_profiel(e)
        uitleg = ev(e, "() => document.getElementById('panel-achtergrond').textContent.includes('What you choose here applies straight away')")
        e.click('#bg-kleur-sectie .swatch >> nth=3'); e.wait_for_timeout(1800)
        st = ev(e, STATUS)
        check('E in het Engels: de uitleg en "✓ Saved ..."', uitleg and st and st.startswith('✓ Saved'), (uitleg, st))
        ce.close(); br.close()
finally:
    srv.shutdown()
check('F geen paginafouten, geen ontbrekende vertaling', not fouten and not taalfout, (fouten[:3], taalfout[:3]))
goed = sum(uitslag)
print('UITSLAG proef99: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
