# proef82: je avatar van een foto weer in een emoji veranderen (v185), echte profiel.html en index.html, echte klikken.
# Nep-server die onthoudt wat Opslaan stuurt (profiles: avatar_data, avatar_url).
#  1. foto kiezen, 'Gebruik deze foto', Opslaan: de foto gaat naar de server en staat in het rondje (Profiel en Home)
#  2. emoji kiezen, Opslaan: op de server avatar_data leeg en avatar_url de emoji; de foto is weg van het toestel;
#     opnieuw Profiel en Home: de emoji (geen foto)
#  3. (v186) foto kiezen zonder op 'Gebruik deze foto' te tikken, dan Opslaan: de foto is je avatar (zo werkte het tot v184;
#     in v185 bleef de emoji staan). Meteen na het kiezen staat hij al in het rondje.
#  4. (v186) foto kiezen en meteen Opslaan (de foto is nog niet klaar): de foto gaat mee
#  5. (v186) foto kiezen en daarna toch een emoji (zelfde bezoek), Opslaan: de emoji, de foto weg van het toestel
#  6. (v186) hetzelfde bestand nog een keer kiezen (zelfde bezoek): werkt (het invoerveld wordt leeggemaakt)
#  7. weer een foto (met 'Gebruik deze foto'): de foto is terug
# Geen paginafouten. Oude map als controle: v184 stap 2 MIS (de foto blijft), v185 stap 3, 4 en 6 MIS.
# python3 -I proef82.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
werk = tempfile.mkdtemp()
def plaatje(naam, kleur):
    im = Image.new('RGB', (400, 400), kleur); d = ImageDraw.Draw(im); d.ellipse((80, 80, 320, 320), fill=(255, 255, 255)); p = os.path.join(werk, naam); im.save(p); return p
FOTO1, FOTO2, FOTO3 = plaatje('een.png', (200, 60, 60)), plaatje('twee.png', (60, 160, 60)), plaatje('drie.png', (60, 60, 200))
rij = {"id": UID, "username": "Marcel", "avatar_url": "\U0001F33F", "avatar_data": None, "bewaar_dagen": 31, "toon_online": True, "updated_at": "2026-10-01T00:00:00Z"}
posts = []
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u:
        if m in ('POST', 'PATCH'):
            b = json.loads(route.request.post_data or '{}'); b = b[0] if isinstance(b, list) else b
            posts.append(b); rij.update({k: v for k, v in b.items() if k != 'id'})
            return route.fulfill(status=201, json=[rij])
        if m == 'GET': return route.fulfill(status=200, json=dict(rij) if obj else [dict(rij)])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/Fibro/' % poort
RONDJE = """() => { const a = document.getElementById('avatarEmoji'); return a ? { foto: !!a.querySelector('img'), tekst: a.textContent.trim() } : null }"""
HOME = """() => { const h = document.getElementById('heroAvatar'), t = document.getElementById('topAvatar')
  return h ? { foto: !!h.querySelector('img'), tekst: h.textContent.trim(), top: t ? (t.querySelector('img') ? 'foto' : t.textContent.trim()) : null } : null }"""
DB = """u => new Promise(ok => { const r = indexedDB.open('FibroDB', 2); r.onsuccess = () => { try { const q = r.result.transaction('fotos').objectStore('fotos').getAllKeys(); q.onsuccess = () => ok((q.result || []).filter(k => String(k).startsWith('avatar_'))) } catch (e) { ok([]) } }; r.onerror = () => ok(null) })"""
def ev(p, js, arg=None):
    try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:100]
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--no-proxy-server'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='nl-NL')
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'manifest.json')
    p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_opslagtip_later', String(Date.now())) }", TOKEN)
    def profiel():
        p.goto(B + 'profiel.html'); p.wait_for_timeout(2500)
    def opslaan():
        n = len(posts); p.click('.save-top-btn'); p.wait_for_timeout(1500)
        return posts[-1] if len(posts) > n else None
    def kiesFoto(pad, gebruik=True):
        p.click('.avatar-ring'); p.wait_for_timeout(200); p.click('#tabFoto'); p.wait_for_timeout(200)
        p.set_input_files('#fotoInput', pad); p.wait_for_timeout(1500)
        if gebruik: p.click('text=✓ Gebruik deze foto'); p.wait_for_timeout(800)
        else: p.click('.avatar-ring'); p.wait_for_timeout(200)  # picker dicht zonder te kiezen
    def kiesEmoji(e):
        p.click('.avatar-ring'); p.wait_for_timeout(200); p.click('#tabEmoji'); p.wait_for_timeout(200)
        p.locator('#avatarPicker .emoji-opt', has_text=e).first.click(); p.wait_for_timeout(300)
    def home():
        p.goto(B + 'index.html'); p.wait_for_timeout(2500); return ev(p, HOME)

    print('1. Foto')
    profiel(); kiesFoto(FOTO1); post = opslaan()
    check('foto + Opslaan: de foto gaat naar de server', isinstance(post, dict) and str(post.get('avatar_data') or '').startswith('data:image/'), post and {k: str(v)[:30] for k, v in post.items()})
    profiel(); r = ev(p, RONDJE); h = home()
    check('Profiel en Home tonen de foto', isinstance(r, dict) and r['foto'] and isinstance(h, dict) and h['foto'] and h['top'] == 'foto', (r, h))

    print('2. Emoji')
    profiel(); kiesEmoji('\U0001F98A'); post = opslaan()
    check('emoji + Opslaan: op de server avatar_data leeg en avatar_url de emoji', isinstance(post, dict) and 'avatar_data' in post and post['avatar_data'] is None and post.get('avatar_url') == '\U0001F98A',
          post and {k: str(v)[:30] for k, v in post.items()})
    check('de foto is weg van dit toestel', ev(p, DB, UID) == [], ev(p, DB, UID))
    check('meteen na Opslaan: emoji in het rondje', ev(p, RONDJE) == {'foto': False, 'tekst': '\U0001F98A'}, ev(p, RONDJE))
    profiel(); r = ev(p, RONDJE)
    check('opnieuw Profiel: de emoji, geen foto', r == {'foto': False, 'tekst': '\U0001F98A'}, r)
    h = home()
    check('Home: de emoji, geen foto (ook bovenaan)', isinstance(h, dict) and not h['foto'] and h['tekst'] == '\U0001F98A' and h['top'] == '\U0001F98A', h)

    print('3. Foto kiezen zonder "Gebruik deze foto"')
    profiel(); kiesFoto(FOTO2, gebruik=False)
    meteen = ev(p, RONDJE); post = opslaan()
    check('meteen na het kiezen staat de foto in het rondje', isinstance(meteen, dict) and meteen['foto'], meteen)
    check('Opslaan: de foto gaat naar de server en blijft je avatar', isinstance(post, dict) and str(post.get('avatar_data') or '').startswith('data:image/') and ev(p, RONDJE) == {'foto': True, 'tekst': ''},
          (post and str(post.get('avatar_data'))[:30], ev(p, RONDJE)))
    profiel(); r = ev(p, RONDJE); h = home()
    check('opnieuw Profiel en Home: de foto', isinstance(r, dict) and r['foto'] and isinstance(h, dict) and h['foto'], (r, h))

    print('4. Foto kiezen en meteen Opslaan')
    profiel(); kiesEmoji('\U0001F98A'); opslaan()
    p.click('.avatar-ring'); p.wait_for_timeout(200); p.click('#tabFoto'); p.wait_for_timeout(200)
    n = len(posts); p.set_input_files('#fotoInput', FOTO1); p.click('.save-top-btn'); p.wait_for_timeout(2500)
    post = posts[-1] if len(posts) > n else None
    check('meteen Opslaan na het kiezen: de foto gaat toch mee', isinstance(post, dict) and str(post.get('avatar_data') or '').startswith('data:image/'), post and str(post.get('avatar_data'))[:30])

    print('5. Foto en daarna toch een emoji')
    profiel(); kiesFoto(FOTO2, gebruik=False); kiesEmoji('\U0001F984'); post = opslaan()
    check('foto, dan emoji, Opslaan: de emoji wint, foto weg', isinstance(post, dict) and post.get('avatar_url') == '\U0001F984' and 'avatar_data' in post and post['avatar_data'] is None and ev(p, DB, UID) == [],
          (post and {k: str(v)[:20] for k, v in post.items() if k.startswith('avatar')}, ev(p, DB, UID)))

    print('6. Hetzelfde bestand nog een keer')
    profiel(); kiesFoto(FOTO3, gebruik=False); kiesEmoji('\U0001F984'); kiesFoto(FOTO3, gebruik=False)
    r = ev(p, RONDJE); post = opslaan()
    check('hetzelfde bestand opnieuw kiezen werkt', isinstance(r, dict) and r['foto'] and isinstance(post, dict) and str(post.get('avatar_data') or '').startswith('data:image/'), (r, post and str(post.get('avatar_data'))[:30]))

    print('7. Weer een foto')
    profiel(); kiesEmoji('\U0001F98A'); opslaan()
    profiel(); kiesFoto(FOTO3); post = opslaan()
    profiel(); r = ev(p, RONDJE)
    check('weer een foto: naar de server en in het rondje', isinstance(post, dict) and str(post.get('avatar_data') or '').startswith('data:image/') and isinstance(r, dict) and r['foto'], (post and str(post.get('avatar_data'))[:30], r))
    check('geen paginafouten', not fouten, fouten[:3])
    br.close()
srv.kill(); shutil.rmtree(www, ignore_errors=True); shutil.rmtree(werk, ignore_errors=True)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
