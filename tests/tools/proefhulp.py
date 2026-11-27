# proefhulp.py — de stukken die bijna elke browsertest (proef*.py) nodig heeft, op één plek.
#
# Bovenaan een nieuwe proef (de proeven draaien met python3 -I, daarom de sys.path-regel):
#   import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
#   from proefhulp import *
#
# Wat erin zit:
#   MAP, BASIS          de map van de app en het adres van een eigen webservertje (/Fibro/ zoals op GitHub Pages)
#   check(ok, wat)      één controle: print OK of FOUT
#   klaar()             onderaan: paginafouten nakijken, "ALLES GOED" of "n FOUT(EN)", en stoppen met de goede code
#   fouten              lijst met paginafouten (vult zich vanzelf bij pagina's uit nieuwe_pagina / lege_spelpagina)
#   wacht(pg, js, ms)   wacht tot een JavaScript-voorwaarde waar is; True of False (nooit een uitzondering)
#   browser(p)          start Chromium zoals op GitHub
#   context(b, ...)     een nieuw browservenster (telefoonmaat, geen service worker, Nederlands)
#   nep_supabase(ctx, f)  alle verkeer naar buiten dicht; Supabase gaat naar jouw functie f(route, url, body)
#   sessie(uid, naam)   een nagemaakte inlog (zet hem met inloggen(ctx, s))
#   inloggen(ctx, s)    zet taal en sessie in localStorage voordat de app opent
#   nieuwe_pagina(ctx, wie)       een pagina die paginafouten in `fouten` zet en pop-ups wegklikt
#   lege_spelpagina(ctx, wie)     een lege pagina met alleen #spelOverlay / #spelInhoud, voor één spel-UI
#   KANAAL              JavaScript: een nagemaakt spelkanaal (BroadcastChannel) voor 2 tot 6 spelers in één browser
#   start_spel(q, bestand, opties)  importeer een spel-UI en roep start() aan; opties.kanaal = [nr, naam] maakt een KANAAL
#   RUST, HAND          JavaScript: er vliegt geen kaart meer / de ids van de kaarten in je hand
#   dubbeltik(q, sel)   twee keer tikken op het zichtbare deel van een element (een kaart die half bedekt is)
import sys, os, re, json, time, base64, functools, http.server, threading

MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []      # mislukte controles
fouten = []    # paginafouten


def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)
    return ok


def klaar(paginafouten=True):
    if paginafouten: check(not fouten, 'geen paginafouten (%s)' % fouten[:3])
    print('\n' + ('ALLES GOED' if not fout else '%d FOUT(EN)' % len(fout)))
    sys.exit(1 if fout else 0)


class _H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, p): return super().translate_path(p.removeprefix('/Fibro'))
    def log_message(self, *a): pass


_srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_H, directory=MAP))
threading.Thread(target=_srv.serve_forever, daemon=True).start()
BASIS = 'http://127.0.0.1:%d/Fibro/' % _srv.server_port


def wacht(pg, js, ms=12000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False


def browser(p):
    return p.chromium.launch(args=['--no-proxy-server'])


def context(b, breed=390, hoog=844, **extra):
    opties = dict(viewport={'width': breed, 'height': hoog}, service_workers='block', locale='nl-NL')
    opties.update(extra)
    return b.new_context(**opties)


def nep_supabase(ctx, antwoord):
    """antwoord(route, url, body) handelt Supabase af; geeft hij None terug, dan volgt een lege lijst."""
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))
    def via(route):
        u = route.request.url
        try: body = json.loads(route.request.post_data or '{}') if route.request.method == 'POST' else {}
        except Exception: body = {}
        if antwoord(route, u, body) is None:
            try: route.fulfill(status=200, json=[])
            except Exception: pass
    ctx.route('**/*supabase.co/**', via)


def _b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')


def sessie(uid, naam='Marcel', email='marcel@x.nl'):
    eind = int(time.time()) + 7200
    jwt = _b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + _b64({'sub': uid, 'role': 'authenticated', 'exp': eind, 'aud': 'authenticated'}) + '.x'
    user = {'id': uid, 'aud': 'authenticated', 'role': 'authenticated', 'email': email, 'created_at': '2026-01-01T00:00:00Z', 'user_metadata': {'username': naam}}
    return {'access_token': jwt, 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': eind, 'user': user}


def inloggen(ctx, s=None, taal='nl', extra=None):
    """zet taal, sessie en eventueel meer localStorage-sleutels ({sleutel: waarde}) voordat de app opent"""
    q = ctx.new_page(); q.goto(BASIS + 'manifest.json')
    q.evaluate("""([s, taal, extra]) => { localStorage.setItem('fibro_taal', taal)
        if (s) localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', JSON.stringify(s))
        for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) }""", [s, taal, extra])
    q.close()


def nieuwe_pagina(ctx, wie=''):
    q = ctx.new_page()
    q.on('pageerror', lambda e: fouten.append((wie + ': ' if wie else '') + str(e)[:300]))
    q.on('dialog', lambda d: d.dismiss())
    return q


def lege_spelpagina(ctx, wie='', taal='nl'):
    q = nieuwe_pagina(ctx, wie)
    q.goto(BASIS + 'manifest.json'); q.evaluate("t => localStorage.setItem('fibro_taal', t)", taal)
    q.evaluate("() => { document.body.innerHTML = '<div id=\"spelOverlay\"><div id=\"spelTitelBar\"></div><div id=\"spelInhoud\" style=\"position:fixed;inset:0\"></div></div>' }")
    return q


KANAAL = """(ik, naam) => {
    const bc = new BroadcastChannel(naam), lui = {}
    bc.onmessage = e => { if (e.data.van !== ik) for (const f of (lui[e.data.event] || [])) f({ payload: e.data.payload }) }
    return { on(_, f, fn) { (lui[f.event] = lui[f.event] || []).push(fn); return this }, send(m) { bc.postMessage({ van: ik, event: m.event, payload: m.payload }); return Promise.resolve('ok') } }
}"""


def start_spel(q, bestand, opties=None):
    """import('./<bestand>') en start(opties). Met opties['kanaal'] = [nr, naam] krijgt het spel een KANAAL als spelKanaal.
    Met opties['solo'] = 'record:7' krijgt het een nagemaakte solo (scores komen in window.__scores)."""
    q.evaluate("""async ([bestand, o, maak]) => { await import('./taal.js').catch(() => {})
        o = o || {}
        if (o.kanaal) { o.spelKanaal = (0, eval)('(' + maak + ')')(o.kanaal[0], o.kanaal[1]); delete o.kanaal }
        if (typeof o.solo === 'string' && o.solo.startsWith('record:')) { const r = +o.solo.slice(7); window.__scores = []
            o.solo = { record: () => r, nieuweScore: n => { window.__scores.push(n); return n > r } } }
        ;(await import('./' + bestand)).start(o) }""", [bestand, opties, KANAAL])


RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id)"


def dubbeltik(q, sel, pauze=150):
    """tik twee keer op een punt dat echt van dit element is (kaarten liggen deels over elkaar)"""
    x, y = q.eval_on_selector(sel, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) for (let fx = 0.08; fx < 0.95; fx += 0.08) { const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y); if (raak && e.contains(raak)) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
    q.mouse.click(x, y); q.wait_for_timeout(pauze); q.mouse.click(x, y)
