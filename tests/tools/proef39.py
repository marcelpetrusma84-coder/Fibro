import sys, os, time, json, threading, http.server, functools
from playwright.sync_api import sync_playwright
# proef39: de portier (service-worker.js) wacht hoogstens 0,4 seconde op een html-pagina; daarna de
# bewaarde kopie, en de nieuwe versie gaat intussen in de kast voor de volgende keer. Een eigen
# testserver die alleen html-pagina's vertraagt en er <!--proefversie N--> achter zet, zodat te zien is
# welke versie de pagina kreeg. Dezelfde ronde op oud en nieuw: snel internet, net op tijd (0,2 s),
# traag (3 s), de volgende keer, kopie ouder dan een week, nog geen kopie, server-fout, geen internet,
# Home bij traag internet, en evenveel vragen aan de server. Daarna "bijwerken": eerst de oude portier,
# dan de nieuwe op de site; de nieuwe neemt het over zonder de kast leeg te maken.
# python3 -I proef39.py <scratch (werkmap)> <oude map> <nieuwe map> <poort>
S = sys.argv[1]; OUD = sys.argv[2]; NIEUW = sys.argv[3]; PORT = int(sys.argv[4]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www39_' + str(PORT); os.makedirs(WWW, exist_ok=True)
def zet_map(m):
    if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
    os.symlink(m, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
srvstaat = {'ms': 0, 'versie': 1, 'status': 200, 'uit': False, 'tel': {}}
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        pad = self.path.split('?')[0]
        if pad.endswith('.html') or pad.endswith('/'):
            if srvstaat['uit']:  # "geen internet": verbinding meteen dicht
                self.close_connection = True; return
            srvstaat['tel'][pad] = srvstaat['tel'].get(pad, 0) + 1
            if srvstaat['ms']: time.sleep(srvstaat['ms'] / 1000)
            bestand = self.translate_path(pad + ('index.html' if pad.endswith('/') else ''))
            try: data = open(bestand, 'rb').read()
            except OSError: return self.send_error(404)
            data += ('\n<!--proefversie %d-->\n' % srvstaat['versie']).encode()
            self.send_response(srvstaat['status'])
            self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')  # elke keer echt bij de server vragen
            self.end_headers(); self.wfile.write(data); return
        if srvstaat['uit']: self.close_connection = True; return
        return super().do_GET()
    def end_headers(self):
        if 'Cache-Control' not in ''.join(h.decode('latin-1') for h in getattr(self, '_headers_buffer', [])):
            self.send_header('Cache-Control', 'max-age=600')
        super().end_headers()
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=WWW))
threading.Thread(target=srv.serve_forever, daemon=True).start()
def server(ms=None, versie=None, status=None, uit=None):
    if ms is not None: srvstaat['ms'] = ms
    if versie is not None: srvstaat['versie'] = versie
    if status is not None: srvstaat['status'] = status
    if uit is not None: srvstaat['uit'] = uit
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
NU = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel", "achtergrond_kleur": "#1a0a2e", "accent_kleur": "#c084fc"}
        return route.fulfill(status=200, json=prof if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
VERSIE = "() => { const c = [...document.childNodes, ...document.documentElement.childNodes, ...(document.body ? document.body.childNodes : [])].filter(n => n.nodeType === 8).map(n => n.data.trim()).filter(t => t.startsWith('proefversie')); return c.length ? parseInt(c[c.length - 1].split(' ')[1]) : null }"
KOPIE_OUD = """async ([sleutel, dagen]) => { const kast = await caches.open('fibro-v31'); const r = await kast.match(sleutel); if (!r) return 'geen kopie'
  const tekst = (await r.text()).replace(/<!--proefversie \\d+-->/, '<!--proefversie 99-->')
  const h = new Headers(r.headers); h.set('date', new Date(Date.now() - dagen * 86400000).toUTCString())
  await kast.put(sleutel, new Response(tekst, { status: 200, headers: h })); return 'ok' }"""
KAST = "async () => { const ks = await caches.keys(); const uit = {}; for (const k of ks) uit[k] = (await (await caches.open(k)).keys()).map(r => r.url.split('/').pop()); return uit }"
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:220] if info != '' else ''))
    if not ok: fouten.append(naam)
def bezoek(p, pagina, wacht_op=None):
    t0 = time.time(); fout = None; status = None
    try:
        r = p.goto(B + pagina, wait_until='commit', timeout=20000); status = r.status if r else None
    except Exception as e: fout = str(e).split('\n')[0][:120]
    ms = int((time.time() - t0) * 1000)
    if fout: return {'ms': ms, 'fout': fout}
    p.wait_for_load_state('load', timeout=20000)
    if wacht_op: p.wait_for_function(wacht_op, timeout=20000)
    return {'ms': ms, 'versie': p.evaluate(VERSIE), 'status': status, 'klaar': int((time.time() - t0) * 1000)}
def opstarten(ctx):
    p = ctx.new_page(); perr = []
    p.on('pageerror', lambda e: perr.append(str(e)[:150])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'over.html')
    p.evaluate("([t, u]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_opslagtip_later', String(Date.now()));"
               " localStorage.setItem('fibro_kast_gevuld', JSON.stringify({ kast: 'fibro-v31', tijd: Date.now() })) }", [TOKEN, UID])
    p.evaluate("() => navigator.serviceWorker.register('./service-worker.js?v=95').then(() => navigator.serviceWorker.ready).then(() => true)")  # zoals index.html
    p.goto(B + 'over.html'); p.wait_for_function("() => !!navigator.serviceWorker.controller", timeout=15000)
    return p, perr
uitslag = {}
def ronde(naam, map_):
    zet_map(map_); server(ms=0, versie=1, status=200, uit=False); srvstaat['tel'] = {}
    r = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow', viewport={'width': 390, 'height': 800}); ctx.route('**/*supabase.co/**', supa)
        p, perr = opstarten(ctx)
        server(versie=1); r['1_eerste'] = bezoek(p, 'over.html')
        server(versie=2); r['2_snel'] = bezoek(p, 'over.html')
        server(versie=3, ms=200); r['3_net_op_tijd'] = bezoek(p, 'over.html')
        server(versie=4, ms=3000); r['4_traag'] = bezoek(p, 'over.html'); p.wait_for_timeout(3500)
        server(versie=5, ms=3000); r['5_traag_volgende'] = bezoek(p, 'over.html'); p.wait_for_timeout(3500)
        r['6_kopie_oud'] = p.evaluate(KOPIE_OUD, [B + 'over.html', 10])
        server(versie=6, ms=1500); r['6_week_oud'] = bezoek(p, 'over.html')
        server(versie=7, ms=1500); r['7_geen_kopie'] = bezoek(p, 'moderatie.html')
        server(versie=8, ms=0, status=500); r['8_serverfout'] = bezoek(p, 'over.html'); server(status=200)
        tel_voor_offline = dict(srvstaat['tel'])
        server(uit=True)
        r['9_offline'] = bezoek(p, 'over.html')
        p.evaluate(KOPIE_OUD, [B + 'over.html', 30]); r['9_offline_oude_kopie'] = bezoek(p, 'over.html')
        r['9_offline_geen_kopie'] = bezoek(p, 'invite.html')
        server(uit=False, ms=0, versie=10)
        # Home: eerst gewoon (kopie in de kast), dan bij traag internet
        bezoek(p, 'index.html', "() => document.getElementById('heroNaam') && document.getElementById('heroNaam').textContent !== 'Laden...'")
        p.wait_for_timeout(1000)
        server(versie=11, ms=3000)
        r['10_home_traag'] = bezoek(p, 'index.html', "() => document.getElementById('heroNaam') && document.getElementById('heroNaam').textContent !== 'Laden...'")
        p.wait_for_timeout(3500); server(ms=0)
        r['kast'] = p.evaluate(KAST); r['tel'] = tel_voor_offline; r['fouten'] = perr
        br.close()
    return r
def snel(x): return 'ms' in x and x['ms'] < 1000
for naam, map_ in (('oud', OUD), ('nieuw', NIEUW)):
    r = uitslag[naam] = ronde(naam, map_)
    print(naam)
    for k, v in r.items():
        if k[0].isdigit(): print('   ', k, v)
    n = naam == 'nieuw'
    check(naam + ': eerste bezoek de echte pagina', r['1_eerste'].get('versie') == 1, r['1_eerste'])
    check(naam + ': snel internet: de nieuwste', r['2_snel'].get('versie') == 2 and snel(r['2_snel']), r['2_snel'])
    check(naam + ': internet 0,2 s: nog steeds de nieuwste', r['3_net_op_tijd'].get('versie') == 3, r['3_net_op_tijd'])
    if n:
        check('nieuw: internet 3 s: binnen 1 s de kopie', r['4_traag'].get('versie') == 3 and snel(r['4_traag']), r['4_traag'])
        check('nieuw: de volgende keer: de versie die op de achtergrond binnenkwam', r['5_traag_volgende'].get('versie') == 4 and snel(r['5_traag_volgende']), r['5_traag_volgende'])
    else:
        check('oud (controle): internet 3 s: 3 s wachten', r['4_traag'].get('versie') == 4 and r['4_traag']['ms'] >= 2900, r['4_traag'])
        check('oud (controle): de volgende keer weer 3 s wachten', r['5_traag_volgende'].get('versie') == 5 and r['5_traag_volgende']['ms'] >= 2900, r['5_traag_volgende'])
    check(naam + ': kopie ouder dan een week: wachten op de nieuwste', r['6_kopie_oud'] == 'ok' and r['6_week_oud'].get('versie') == 6 and r['6_week_oud']['ms'] >= 1400, (r['6_kopie_oud'], r['6_week_oud']))
    check(naam + ': nog geen kopie: wachten op de nieuwste', r['7_geen_kopie'].get('versie') == 7 and r['7_geen_kopie']['ms'] >= 1400, r['7_geen_kopie'])
    check(naam + ': server-fout: de foutmelding van de server, zoals vroeger', r['8_serverfout'].get('status') == 500 and r['8_serverfout'].get('versie') == 8, r['8_serverfout'])
    check(naam + ': geen internet: meteen de kopie (versie 6, niet de server-fout)', r['9_offline'].get('versie') == 6 and snel(r['9_offline']), r['9_offline'])
    check(naam + ': geen internet en nooit geopend: foutpagina zoals vroeger', 'fout' in r['9_offline_geen_kopie'], r['9_offline_geen_kopie'])
    check(naam + ': geen internet, kopie ouder dan een week: toch de kopie', r['9_offline_oude_kopie'].get('versie') == 99, r['9_offline_oude_kopie'])
    h = r['10_home_traag']
    if n: check('nieuw: Home bij internet 3 s: naam staat er binnen 2 s (kopie)', h.get('versie') == 10 and h['klaar'] < 2000, h)
    else: check('oud (controle): Home bij internet 3 s: naam pas na 3 s', h.get('versie') == 11 and h['klaar'] >= 2900, h)
    check(naam + ': kast heet nog fibro-v31', list(r['kast'].keys()) == ['fibro-v31'], list(r['kast'].keys()))
    check(naam + ': geen paginafouten', not r['fouten'], r['fouten'][:3])
check('evenveel vragen aan de server (oud en nieuw)', uitslag['oud']['tel'] == uitslag['nieuw']['tel'], (uitslag['oud']['tel'], uitslag['nieuw']['tel']))
# Bijwerken: oude portier staat er, nieuwe komt op de site
print('bijwerken')
zet_map(OUD); server(ms=0, versie=20, status=200, uit=False)
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='allow'); ctx.route('**/*supabase.co/**', supa)
    p, perr = opstarten(ctx)
    bezoek(p, 'over.html'); bezoek(p, 'vrienden.html')
    voor = p.evaluate(KAST)
    server(ms=3000, versie=21); a = bezoek(p, 'over.html')
    check('oude portier: 3 s wachten', a.get('versie') == 21 and a['ms'] >= 2900, a)
    zet_map(NIEUW); server(ms=0, versie=22)
    gewisseld = p.evaluate("""() => new Promise(async klaar => { navigator.serviceWorker.addEventListener('controllerchange', () => klaar(true))
      const r = await navigator.serviceWorker.getRegistration(); await r.update(); setTimeout(() => klaar(false), 10000) })""")
    check('de nieuwe portier neemt het over (zelfde aanmelding ?v=95)', gewisseld is True, gewisseld)
    na = p.evaluate(KAST)
    check('kast niet leeggemaakt (zelfde fibro-v31, zelfde inhoud)', list(na.keys()) == ['fibro-v31'] and sorted(na['fibro-v31']) == sorted(voor['fibro-v31']), (len(voor.get('fibro-v31', [])), len(na.get('fibro-v31', []))))
    # Vlak na het wisselen doet Chromium er een keer ±1 s langer over, ook bij een oude portier met
    # een byte anders (gecontroleerd); daarom eerst een gewoon bezoek.
    e = bezoek(p, 'over.html'); print('   eerste bezoek na het wisselen (snel internet):', e)
    check('eerste bezoek na het wisselen: de nieuwste', e.get('versie') == 22, e)
    server(ms=3000, versie=23); b = bezoek(p, 'over.html')
    check('daarna: internet 3 s: binnen 1 s de kopie', b.get('versie') == 22 and snel(b), b)
    p.wait_for_timeout(3500)
    check('geen paginafouten', not perr, perr[:3])
    br.close()
srv.shutdown()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
