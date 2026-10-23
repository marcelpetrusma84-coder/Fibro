# proef97: v202, stap 1 van PR #4 (valentijnpeters): spelchat en spelstickers versleuteld. Twee ECHTE chat.html's
# (Marcel, Bram) met de nep-Realtime van proef93/94; Boter-Kaas-Eieren (een beurtspel met chatbalk). In NL en EN:
#  A. Marcel typt een zin met html en drukt Enter: Bram ziet precies die tekst (als tekst), Marcel ook; het vak is leeg.
#     Over Realtime ging bij 'spelchat' alleen { ciphertext: 'e2e:2:...' }: geen 'tekst', en de zin staat nergens leesbaar.
#     Bram antwoordt, Marcel ziet het.
#  B. Een sticker: Bram ziet hem groot in beeld; over Realtime bij 'spelsticker' alleen ciphertext, geen 'code'.
#  C. Hetzelfde versleutelde pakket nog eens (herhaald): Bram toont het niet dubbel. Een beschadigd pakket: niets.
#  D. Een oude app stuurt leesbare tekst { tekst } of een sticker { code }: niet getoond, wel het regeltje
#     "Je vriend heeft nog een oude Fibro ..." (EN "Your friend still has an old version of Fibro ...").
#  E. Geen sleutel bij de vriend: "Niet verstuurd: Bram heeft nog geen sleutel.", de tekst blijft in het vak, er gaat niets.
#     Sleutel van de vriend veranderd (andere vingerafdruk onthouden): "... is veranderd ...", er gaat niets.
#     Geen eigen sleutel op dit toestel: "Niet verstuurd: de sleutel van dit toestel ontbreekt.", er gaat niets.
#  F. geen paginafouten, geen ontbrekende vertaling
# Oude map (v201) als controle: A (alleen versleuteld), D en E MIS.
# python3 -I proef97.py <map> [nl|en|alles]
import sys, os, time, json, socket, subprocess, tempfile, threading
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1]); TALEN = ('nl', 'en') if len(sys.argv) < 3 or sys.argv[2] == 'alles' else (sys.argv[2],)
MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:230] if info != '' else ''), flush=True)
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})
www = tempfile.mkdtemp(); d = www + '/Fibro'; os.makedirs(d)
for f in os.listdir(MAP): os.symlink(os.path.join(MAP, f), os.path.join(d, f))
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten, taalfout = [], []
def volg(pg, wie):
    pg.on('pageerror', lambda e: fouten.append(wie + ': ' + str(e)[:200] + ' @ ' + str(getattr(e, 'stack', '') or '')[:300].replace(chr(10), ' ')))
    pg.on('console', lambda m: taalfout.append(wie + ': ' + m.text) if 'nog geen vertaling' in m.text else None)
    pg.on('dialog', lambda dl: dl.dismiss())
def wacht(pg, js, ms, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False
def klik(pg, sel, **kw):
    try: pg.click(sel, timeout=4000, **kw); return True
    except Exception: return False
def ev(pg, js, arg=None):
    try: return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
    except Exception as e: return 'FOUT: ' + str(e)[:120]

# ---- nep-server (uit proef94): REST per toestel, Realtime gedeeld tussen de twee toestellen ----
RT = {'sockets': [], 'uit': [], 'lock': threading.Lock()}
def rest(uid, sleutels, geen_sleutel):
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        if '/rest/v1/messages' in u and m == 'POST': return route.fulfill(status=201, json={"id": "mn1"})
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=[])
        if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": uid, "friend_id": ander, "status": "accepted"}])
        if '/rest/v1/profiles' in u and m == 'GET':
            ik = {"id": uid, "username": NAAM[uid], "display_name": None, "avatar_url": "\U0001F419"}
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "public_key": None if geen_sleutel else sleutels.get(ander), "avatar_data": None}
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if ander in u else ik)
            return route.fulfill(status=200, json=[vr] if ('in.' in u or ander in u) else [ik])
        if '/functions/v1/' in u: return route.fulfill(status=200, json={})
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        return route.fulfill(status=200, json=[])
    return supa
def stuur_door(van, topic, event, payload):
    with RT['lock']:
        RT['uit'].append((topic, event, payload))
        for s in list(RT['sockets']):
            if s['w'] is van or topic not in s['topics']: continue
            try: s['w'].send(json.dumps([s['topics'][topic], None, topic, 'broadcast', {'type': 'broadcast', 'event': event, 'payload': payload}]))
            except Exception: pass
def ws(w):
    s = {'w': w, 'topics': {}}
    with RT['lock']: RT['sockets'].append(s)
    def bericht(m):
        if isinstance(m, (bytes, bytearray)):
            b = bytes(m)
            try:
                if b[0] != 3: return
                lj, lr, lt, le, lm, cod = b[1], b[2], b[3], b[4], b[5], b[6]; i = 7 + lj + lr
                topic = b[i:i + lt].decode(); i += lt; ev_ = b[i:i + le].decode(); i += le + lm
                stuur_door(w, topic, ev_, json.loads(b[i:].decode() or '{}') if cod == 1 else None)
            except Exception: pass
            return
        try: jr, ref, topic, event, payload = json.loads(m)
        except Exception: return
        if event == 'phx_join':
            s['topics'][topic] = jr
            pg_ = [dict(f, id=k + 1) for k, f in enumerate(((payload or {}).get('config') or {}).get('postgres_changes') or [])]
            w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {'postgres_changes': pg_}}])); return
        if event == 'phx_leave': s['topics'].pop(topic, None)
        if event == 'broadcast': stuur_door(w, topic, (payload or {}).get('event'), (payload or {}).get('payload'))
        if ref: w.send(json.dumps([jr, ref, topic, 'phx_reply', {'status': 'ok', 'response': {}}]))
    w.on_message(bericht)
    w.on_close(lambda *a: RT['sockets'].remove(s) if s in RT['sockets'] else None)
def http_broadcast(route):
    try:
        for m in (json.loads(route.request.post_data or '{}').get('messages') or []):
            t = m.get('topic') or ''
            stuur_door(None, t if t.startswith('realtime:') else 'realtime:' + t, m.get('event'), m.get('payload'))
    except Exception: pass
    return route.fulfill(status=202, body='')

def toestel(br, uid, taal, sleutels, geen_sleutel=False):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['camera', 'microphone'])
    ctx.route('**/*supabase.co/**', rest(uid, sleutels, geen_sleutel))
    ctx.route_web_socket('**/realtime/v1/websocket**', ws)
    ctx.route('**/realtime/v1/api/broadcast**', http_broadcast)
    pg = ctx.new_page(); volg(pg, NAAM[uid])
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("([t, taal]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal) }", [token(uid), taal])
    sleutels[uid] = pg.evaluate("""async uid => { const c = await import('./crypto.js?v=95'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }""", uid)
    return ctx, pg
def start(br, taal, geen_sleutel=False, voor_m=None):
    RT['uit'].clear(); sleutels = {}
    cm, m = toestel(br, MARCEL, taal, sleutels, geen_sleutel); cb, b = toestel(br, BRAM, taal, sleutels)
    if voor_m: m.evaluate(voor_m)   # nog op manifest.json: voordat chat.html opent
    return cm, m, cb, b
def open_spel(m, b):
    for pg in (m, b):
        pg.goto(BASIS + 'chat.html')
        if wacht(pg, "() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", 15000): klik(pg, '#vriendenLijst .vriend-item')
    m.wait_for_timeout(1200)
    sessie = m.evaluate("Date.now().toString(36)")
    for pg in (m, b): ev(pg, "([s, n, u]) => { window.speelMee(s, n, u) }", ['botkaaseiren', sessie, MARCEL])
    k = "() => !!document.querySelector('#spelChatWrap input')"
    return wacht(m, k, 10000) and wacht(b, k, 10000)
def typ(pg, tekst):
    try: pg.fill('#spelChatWrap input', tekst, timeout=3000); pg.press('#spelChatWrap input', 'Enter', timeout=3000); return True
    except Exception: return False
BUBBELS = "() => [...document.querySelectorAll('#spelChatLaag > div')].map(b => b.textContent)"
STATUS = "() => { const s = document.getElementById('spelChatStatus'); return s && !s.hidden ? s.textContent : null }"
INVOER = "() => (document.querySelector('#spelChatWrap input') || {}).value"
def pakketten(event): return [p for (t, e, p) in list(RT['uit']) if e == event]
def speltopic(): return next((t for (t, e, p) in list(RT['uit']) if t.startswith('realtime:spel_')), None) or next((t for s in RT['sockets'] for t in s['topics'] if t.startswith('realtime:spel_')), None)
T97 = {'nl': dict(oud='Je vriend heeft nog een oude Fibro. Chatten in het spel lukt pas als je vriend Fibro sluit en opnieuw opent.',
                  geen='Niet verstuurd: Bram heeft nog geen sleutel.', anders='Niet verstuurd: de sleutel van Bram is veranderd. Kijk eerst in de chat.',
                  eigen='Niet verstuurd: de sleutel van dit toestel ontbreekt.'),
       'en': dict(oud='Your friend still has an old version of Fibro. Chatting in the game works once your friend closes Fibro and opens it again.',
                  geen="Not sent: Bram doesn't have a key yet.", anders="Not sent: Bram's key has changed. Check the chat first.",
                  eigen='Not sent: the key for this device is missing.')}
ZIN = 'Hallo Bram <b>vet?</b> & "zo" 🎲'
try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        for taal in TALEN:
            t = T97[taal]; print('--- %s ---' % taal, flush=True)
            cm, m, cb, b = start(br, taal)
            ok = open_spel(m, b)
            m.wait_for_timeout(800)
            typ(m, ZIN)
            zien = wacht(b, "z => [...document.querySelectorAll('#spelChatLaag > div')].some(b => b.textContent === z)", 6000, ZIN)
            mb, bb, leeg = ev(m, BUBBELS), ev(b, BUBBELS), ev(m, INVOER)
            check('%s A1 Bram ziet precies de zin (als tekst), Marcel ook, het vak is leeg' % taal,
                  ok and zien and mb == [ZIN] and bb == [ZIN] and leeg == '' and ev(b, "() => !document.querySelector('#spelChatLaag b')") is True, (ok, zien, mb, bb, leeg))
            pk = pakketten('spelchat'); ruw = json.dumps([x for x in RT['uit']], ensure_ascii=False)
            check('%s A2 over Realtime alleen ciphertext (e2e:2:), nergens de zin leesbaar' % taal,
                  len(pk) == 1 and set(pk[0]) == {'ciphertext'} and str(pk[0]['ciphertext']).startswith('e2e:2:') and 'Hallo Bram' not in ruw and 'vet?' not in ruw, (len(pk), pk[:1]))
            # C: herhaald en beschadigd
            top = speltopic()
            if pk and top:
                stuur_door(None, top, 'spelchat', dict(pk[0]))
                c = pk[0].get('ciphertext')
                if isinstance(c, str) and len(c) > 10:   # (oude map: leesbare tekst, dan niets te beschadigen)
                    kapot = c[:-6] + ('A' if c[-6] != 'A' else 'B') + c[-5:]
                    stuur_door(None, top, 'spelchat', {'ciphertext': kapot})
            b.wait_for_timeout(1500)
            bb2, mb2 = ev(b, BUBBELS), ev(m, BUBBELS)
            check('%s C1 hetzelfde pakket nog eens en een beschadigd pakket: niets dubbel, niets extra' % taal, bool(top) and bb2 == [ZIN] and mb2 == [ZIN], (top, bb2, mb2))
            typ(b, 'Hoi Marcel')
            check('%s A3 Bram antwoordt, Marcel ziet het' % taal, wacht(m, "() => [...document.querySelectorAll('#spelChatLaag > div')].some(b => b.textContent === 'Hoi Marcel')", 6000), ev(m, BUBBELS))
            # B: sticker
            klik(m, '#spelStickerKnop'); wacht(m, "() => document.querySelectorAll('#spelStickerPaneel .sk-sticker').length > 0", 6000)
            klik(m, '#spelStickerPaneel .sk-sticker >> nth=0')
            st_b = wacht(b, "() => !!document.getElementById('spelStickerGroot')", 6000)
            sp = pakketten('spelsticker')
            check('%s B1 sticker: Bram ziet hem; over Realtime alleen ciphertext, geen code' % taal,
                  st_b and len(sp) == 1 and set(sp[0]) == {'ciphertext'} and str(sp[0]['ciphertext']).startswith('e2e:2:'), (st_b, sp[:1]))
            # D: een oude app
            b.wait_for_timeout(3500)
            if top: stuur_door(None, top, 'spelchat', {'tekst': 'leesbaar oud bericht'})
            m.wait_for_timeout(1200)
            d1 = (ev(m, BUBBELS), ev(m, STATUS))
            check('%s D1 leesbare tekst van een oude app: niet getoond, wel "%s..."' % (taal, t['oud'][:30]),
                  'leesbaar oud bericht' not in (d1[0] or []) and d1[1] == t['oud'], d1)
            ev(m, "() => { const s = document.getElementById('spelChatStatus'); if (s) { s.textContent = ''; s.hidden = true } }")
            ev(m, "() => { const s = document.getElementById('spelStickerGroot'); if (s) s.remove() }")
            if top: stuur_door(None, top, 'spelsticker', {'code': 'f1-01'})
            m.wait_for_timeout(1200)
            d2 = (ev(m, "() => !!document.getElementById('spelStickerGroot')"), ev(m, STATUS))
            check('%s D2 leesbare sticker van een oude app: niet getoond, wel het regeltje' % taal, d2 == (False, t['oud']), d2)
            cm.close(); cb.close()
            # E1: vriend zonder sleutel
            cm, m, cb, b = start(br, taal, geen_sleutel=True)
            ok = open_spel(m, b); m.wait_for_timeout(600)
            n0 = len(pakketten('spelchat')); typ(m, 'gaat niet'); m.wait_for_timeout(1200)
            e1 = (ev(m, STATUS), ev(m, INVOER), ev(m, BUBBELS), len(pakketten('spelchat')) - n0)
            check('%s E1 vriend zonder sleutel: "%s", tekst blijft staan, er gaat niets' % (taal, t['geen']), ok and e1 == (t['geen'], 'gaat niet', [], 0), (ok, e1))
            cm.close(); cb.close()
            # E2: sleutel van de vriend veranderd (andere vingerafdruk onthouden)
            andere = "async () => { const c = await import('./crypto.js?v=95'); const k = await c.genereerKeypair(); localStorage.setItem('fibro_vriendsleutel_%s_%s', await c.sleutelVingerafdruk(k.publicKeyB64)) }" % (MARCEL, BRAM)
            cm, m, cb, b = start(br, taal, voor_m=andere)
            ok = open_spel(m, b); m.wait_for_timeout(600)
            n0 = len(pakketten('spelchat')); typ(m, 'ook niet'); m.wait_for_timeout(1200)
            e2 = (ev(m, STATUS), ev(m, INVOER), len(pakketten('spelchat')) - n0)
            check('%s E2 sleutel van de vriend veranderd: "%s", er gaat niets' % (taal, t['anders'][:40]), ok and e2 == (t['anders'], 'ook niet', 0), (ok, e2))
            cm.close(); cb.close()
            # E3: geen eigen sleutel op dit toestel
            cm, m, cb, b = start(br, taal, voor_m="() => localStorage.removeItem('fibro_privkey_%s')" % MARCEL)
            ok = open_spel(m, b); m.wait_for_timeout(600)
            n0 = len(pakketten('spelchat')); typ(m, 'zonder sleutel'); m.wait_for_timeout(1200)
            e3 = (ev(m, STATUS), ev(m, INVOER), len(pakketten('spelchat')) - n0)
            check('%s E3 geen eigen sleutel: "%s", er gaat niets' % (taal, t['eigen'][:40]), ok and e3 == (t['eigen'], 'zonder sleutel', 0), (ok, e3))
            cm.close(); cb.close()
        br.close()
finally:
    srv.terminate()
check('F geen paginafouten, geen ontbrekende vertaling', not [f for f in fouten if 'proef97' not in f] and not taalfout, (fouten[:3], taalfout[:3]))
goed = sum(uitslag)
print('UITSLAG proef97: %d/%d %s' % (goed, len(uitslag), 'GOED' if goed == len(uitslag) else 'FOUT'))
