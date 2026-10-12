import subprocess, sys, time, json, os, re
from playwright.sync_api import sync_playwright
# proef45: Home zet je taal in je profiel (v148), zodat stuur-push de pushmelding in jouw taal maakt.
# Alleen schrijven als de taal in het profiel anders is dan de gekozen taal; niet als de kolom er nog
# niet is (sql/taal.sql niet gedraaid: dan geen taal in het antwoord), niet bij een geblokkeerd account.
# Ook: Home vraagt de kolom taal mee op en valt bij een onbekende kolom terug op select=* (zoals altijd).
# python3 -I proef45.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3])
d = S + '/www45_' + str(PORT); os.makedirs(d, exist_ok=True)
if os.path.islink(d + '/Fibro'): os.remove(d + '/Fibro')
os.symlink(MAP, d + '/Fibro')
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', d, str(PORT)], stderr=subprocess.DEVNULL)
time.sleep(0.8)
B = f'http://127.0.0.1:{PORT}/Fibro/'
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:300] if info != '' else ''))
    if not ok: fouten.append(naam)

def ronde(br, taal, profiel, zonder_kolom=False):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 900}, locale='nl-NL')
    schrijf, vragen = [], []
    def supa(route):
        u = route.request.url; m = route.request.method
        een = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        if '/rest/v1/profiles' in u and m == 'PATCH':
            if '"taal"' in (route.request.post_data or ''): schrijf.append((u, route.request.post_data))  # niet de hartslag
            return route.fulfill(status=204, body='')
        if '/rest/v1/profiles' in u and m == 'GET' and 'id=eq.' + UID in u:
            vragen.append(u)
            if zonder_kolom and 'taal' in u.split('select=')[1].split('&')[0]:
                return route.fulfill(status=400, json={"code": "42703", "message": "column profiles.taal does not exist"})
            p = dict(profiel)
            return route.fulfill(status=200, json=p if een else [p])
        if '/auth/v1/' in u and m == 'GET': return route.fulfill(status=200, json={"id": UID})
        if m in ('POST', 'PATCH'): return route.fulfill(status=201, json=[])
        return route.fulfill(status=200, json=[])
    ctx.route('**/*supabase.co/**', supa)
    ctx.route('**/realtime/**', lambda r: r.abort())
    ctx.add_init_script("try{localStorage.setItem('fibro_taal'," + json.dumps(taal) + ");localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token'," + json.dumps(TOKEN) + ")}catch(e){}")
    p = ctx.new_page(); log = []
    p.on('pageerror', lambda e: log.append(str(e)))
    p.goto(B + 'index.html'); p.wait_for_timeout(3500)
    cache = p.evaluate("() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/profiel/i.test(k) && k.includes('" + UID + "')) return localStorage.getItem(k) } return null }")
    ctx.close()
    return schrijf, vragen, log, cache

BASIS = {"id": UID, "username": "Marcel", "geblokkeerd": False, "public_key": "x" * 20}
with sync_playwright() as pw:
    br = pw.chromium.launch()
    print('Engels gekozen, profiel nog nl')
    w, v, log, cache = ronde(br, 'en', dict(BASIS, taal='nl'))
    check('vraagt taal mee op', any('taal' in x for x in v), v[:1])
    check('schrijft taal=en, een keer', len(w) == 1 and json.loads(w[0][1]) == {"taal": "en"} and 'id=eq.' + UID in w[0][0], w)
    check('bewaarde kopie heeft taal en', cache is not None and '"taal":"en"' in cache, (cache or '')[:80])
    check('geen fouten', not log, log[:2])
    print('Engels gekozen, profiel al en')
    w, v, log, _ = ronde(br, 'en', dict(BASIS, taal='en'))
    check('schrijft niets', not w, w)
    print('Nederlands, profiel nl')
    w, v, log, _ = ronde(br, 'nl', dict(BASIS, taal='nl'))
    check('schrijft niets', not w, w)
    print('Nederlands gekozen, profiel en (ander toestel in het Engels)')
    w, v, log, _ = ronde(br, 'nl', dict(BASIS, taal='en'))
    check('schrijft taal=nl', len(w) == 1 and json.loads(w[0][1]) == {"taal": "nl"}, w)
    print('geblokkeerd account')
    w, v, log, _ = ronde(br, 'en', dict(BASIS, taal='nl', geblokkeerd=True))
    check('schrijft niets', not w, w)
    print('kolom taal bestaat nog niet (SQL niet gedraaid)')
    w, v, log, _ = ronde(br, 'en', dict(BASIS), zonder_kolom=True)
    check('valt terug op select=* en schrijft niets', any(re.search(r'select=(\*|%2A)(&|$)', x) for x in v) and not w, (v, w))
    check('geen fouten', not log, log[:2])
    br.close()
srv.terminate()
print('\nproef45: ' + ('ALLES GOED' if not fouten else str(len(fouten)) + ' FOUT: ' + ', '.join(fouten)))
sys.exit(1 if fouten else 0)
