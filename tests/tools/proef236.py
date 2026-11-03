# proef236 (3 nov 2026, v258): makkelijker contact, in echte pagina's in Chrome met een nep-server.
#  A. Vrienden > Uitnodigen: een knop Delen (deelmenu van de telefoon) met een zin erbij: je naam, het spel, hoe lang
#     de link werkt, en de link zelf. Zonder deelmenu (computer) geen knop. Weggetikt = niets; mislukt = kopieren.
#  B. Een lege chat: knop "👋 Zeg hoi" stuurt een versleuteld "Hoi! 👋" (met pushmelding) en verdwijnt.
#     Een chat met berichten: geen knop.
#  C. Uitnodiging aannemen met een bestaand account: daarna meteen in de chat met wie uitnodigde (met Zeg hoi).
#  D. Net vrienden geworden met een nieuw account (fibro_nieuwe_vriend_<ik>): het beginscherm stuurt een keer door naar
#     de chat; na een uur niet meer.
#  E. Uitnodiging > Inloggen: na het inloggen terug naar de uitnodiging; een vreemd adres telt niet.
# python3 -I proef236.py <map>
import sys, os, time, json, socket, subprocess, re
from playwright.sync_api import sync_playwright

MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; BRAM = 'bbbb0001-0000-4000-8000-000000000002'
NAAM = {MARCEL: 'Marcel', BRAM: 'Bram'}
TOKEN = 'fibro-abcdefghijklmnop'
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})

def rest(uid, sleutels, st):
    ander = BRAM if uid == MARCEL else MARCEL
    def supa(route):
        u = route.request.url; m = route.request.method
        st['log'].append((m, u.split('/rest/v1/')[-1].split('/functions/v1/')[-1][:120]))
        if '/functions/v1/stuur-push' in u:
            try: st['push'].append(json.loads(route.request.post_data or '{}'))
            except Exception: pass
            return route.fulfill(status=200, json={'ok': True})
        if '/rest/v1/messages' in u and m == 'POST':
            st['posts'].append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, json={"id": "00000000-0000-4000-8000-%012d" % len(st['posts'])})
        if '/rest/v1/messages' in u: return route.fulfill(status=200, json=st.get('berichten', []))
        if '/rest/v1/rpc/valideer_invite' in u: return route.fulfill(status=200, json=[{"token": TOKEN, "created_by": MARCEL}])
        if '/rest/v1/rpc/uitnodiger_van_invite' in u: return route.fulfill(status=200, json=[{"username": "Marcel", "avatar_url": "\U0001F419"}])
        if '/rest/v1/rpc/maak_vriendschap_via_invite' in u: st['vrienden'] = True; return route.fulfill(status=200, json=True)
        if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=False)
        if '/rest/v1/invite_tokens' in u and m == 'POST': st['invites'].append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, body='')
        if '/rest/v1/friendships' in u:
            if not st.get('vrienden', True): return route.fulfill(status=200, json=[])
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "online_status": True, "laatst_gezien": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), "public_key": sleutels.get(ander)}
            return route.fulfill(status=200, json=[{"id": "f1", "user_id": uid, "friend_id": ander, "status": "accepted", "profiles": vr}])
        if '/rest/v1/profiles' in u and m == 'GET':
            ik = {"id": uid, "username": NAAM[uid], "display_name": None, "avatar_url": "\U0001F419"}
            vr = {"id": ander, "username": NAAM[ander], "display_name": None, "avatar_url": "\U0001F438", "public_key": sleutels.get(ander), "avatar_data": None}
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vr if ander in u else ik)
            return route.fulfill(status=200, json=[vr] if ('in.' in u or ander in u) else [ik])
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        return route.fulfill(status=200, json=[])
    return supa

MAP = os.path.abspath(sys.argv[1])
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
uitslag = []; fouten = []
def check(n, ok, info=''): uitslag.append(bool(ok)); print(('OK   ' if ok else 'MIS  ') + n + ('  | ' + str(info)[:300] if info != '' else ''), flush=True)
def wacht(pg, js, ms, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False

DEEL = """(() => { window.__gedeeld = []; window.__deelFout = null
  Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async function (d) {
    window.__gedeeld.push(d); if (window.__deelFout) { const e = new DOMException('x', window.__deelFout); throw e } } }) })()"""
GEEN_DEEL = "(() => { try { delete Navigator.prototype.share } catch (e) {} })()"

def toestel(br, uid, sl, st, taal='nl', init=None):
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, permissions=['clipboard-read', 'clipboard-write'])
    ctx.route('**/*supabase.co/**', rest(uid, sl, st))
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); naam = NAAM[uid]
    pg.on('pageerror', lambda e: fouten.append(naam + ': ' + str(e)[:200])); pg.on('dialog', lambda d: (st['dialogen'].append(d.message), d.dismiss()))
    pg.goto(B + 'manifest.json')
    pg.evaluate("([t, taal, uid]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal); localStorage.setItem('fibro_profiel_' + uid, JSON.stringify({ naam: uid.startsWith('aaaa') ? 'Marcel' : '' })) }", [token(uid), taal, uid])
    sl[uid] = pg.evaluate("async uid => { const c = await import('./crypto.js?v=182'); const ik = await c.genereerKeypair(); c.slaPrivateKeyOp(uid, ik.privateKeyB64); return ik.publicKeyB64 }", uid)
    return ctx, pg

def nieuw_st(**k): return dict({'log': [], 'push': [], 'posts': [], 'invites': [], 'dialogen': []}, **k)

def maak_link(pg, spel='', duur=None):
    pg.evaluate("openInviteModal()")
    if duur: pg.click('#uitDuur .uit-chip[data-sec="%d"]' % duur)
    if spel: pg.select_option('#uitSpel', spel)
    pg.click('#uitMaak')
    return wacht(pg, "() => document.getElementById('qr-sectie').style.display === 'block' && !!document.getElementById('invite-link').value", 10000)

try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        sl = {}
        # Bram moet een sleutel hebben voor Marcels chat: eerst Bram aanmaken
        stb0 = nieuw_st(); cb0, b0 = toestel(br, BRAM, sl, stb0); cb0.close()

        # ---- A. Delen ----
        st = nieuw_st()
        cm, m = toestel(br, MARCEL, sl, st, init=DEEL)
        m.goto(B + 'vrienden.html'); m.wait_for_timeout(1500)
        gemaakt = maak_link(m)
        zichtbaar = m.evaluate("!document.getElementById('deel-link-btn').hidden && getComputedStyle(document.getElementById('deel-link-btn')).display !== 'none'")
        check('A1 link gemaakt, knop Delen zichtbaar', gemaakt and zichtbaar and len(st['invites']) == 1, (gemaakt, zichtbaar, st['invites']))
        m.click('#deel-link-btn'); m.wait_for_timeout(300)
        d = m.evaluate("window.__gedeeld")
        link = m.evaluate("document.getElementById('invite-link').value")
        tekst = (d[0] or {}).get('text', '') if d else ''
        check('A2 deelt een zin met je naam, hoe lang, en de link', len(d) == 1 and tekst == 'Marcel nodigt je uit voor Fibro! Tik binnen 3 dagen op de link om vrienden te worden:\n' + link
              and link.startswith('https://marcelpetrusma84-coder.github.io/Fibro/invite.html?token=fibro-') and '#s=' in link and 'url' not in d[0], d)
        m.evaluate("sluitModal()")
        gemaakt = maak_link(m, spel='dammen', duur=3600)
        m.evaluate("window.__gedeeld = []"); m.click('#deel-link-btn'); m.wait_for_timeout(300)
        d = m.evaluate("window.__gedeeld"); link = m.evaluate("document.getElementById('invite-link').value")
        check('A3 met spel en 1 uur', gemaakt and d and d[0]['text'] == 'Marcel nodigt je uit voor Fibro en daagt je uit voor een potje Draughts! Tik binnen 1 uur op de link om vrienden te worden:\n' + link and '&spel=dammen' in link, d)
        # weggetikt: niets; mislukt: kopieren
        m.evaluate("window.__deelFout = 'AbortError'"); st['dialogen'].clear()
        m.click('#deel-link-btn'); m.wait_for_timeout(500)
        k1 = m.evaluate("document.getElementById('kopieer-link-btn').textContent")
        m.evaluate("window.__deelFout = 'NotAllowedError'")
        m.click('#deel-link-btn'); m.wait_for_timeout(500)
        k2 = m.evaluate("document.getElementById('kopieer-link-btn').textContent")
        klembord = m.evaluate("navigator.clipboard.readText().catch(() => '')")
        check('A4 weggetikt: niets; lukt delen niet: kopieren', k1 == 'Kopieer' and (k2 == 'Gekopieerd!' or st['dialogen']) and (klembord == link or st['dialogen']), (k1, k2, klembord[:60], st['dialogen']))
        cm.close()
        # Engels
        st = nieuw_st()
        cm, m = toestel(br, MARCEL, sl, st, taal='en', init=DEEL)
        m.goto(B + 'vrienden.html'); m.wait_for_timeout(1500)
        maak_link(m, duur=604800); m.click('#deel-link-btn'); m.wait_for_timeout(300)
        d = m.evaluate("window.__gedeeld")
        knop = m.evaluate("document.getElementById('deel-link-btn').textContent")
        check('A5 Engels', d and d[0]['text'].startswith('Marcel invites you to Fibro! Tap the link within 7 days to become friends:\nhttps://') and knop == '📤 Share', (knop, d))
        cm.close()
        # zonder deelmenu (computer): geen knop, wel Kopieer
        st = nieuw_st()
        cm, m = toestel(br, MARCEL, sl, st, init=GEEN_DEEL)
        m.goto(B + 'vrienden.html'); m.wait_for_timeout(1500)
        maak_link(m)
        check('A6 zonder deelmenu: geen knop Delen', m.evaluate("document.getElementById('deel-link-btn').hidden && typeof navigator.share !== 'function'"))
        cm.close()

        # ---- B. Lege chat: Zeg hoi ----
        st = nieuw_st()
        cm, m = toestel(br, MARCEL, sl, st)
        m.goto(B + 'chat.html?vriend=' + BRAM)
        hoi = wacht(m, "() => { const k = document.getElementById('zegHoi'); return k && k.offsetParent !== null }", 15000)
        check('B1 lege chat: knop Zeg hoi', hoi and m.evaluate("document.getElementById('zegHoi').textContent") == '👋 Zeg hoi', m.evaluate("document.getElementById('messages').innerText"))
        st['push'].clear()
        m.click('#zegHoi'); m.wait_for_timeout(1500)
        post = st['posts'][-1] if st['posts'] else {}
        check('B2 tik: versleuteld bericht aan Bram, knop weg, pushmelding', len(st['posts']) == 1 and post.get('receiver_id') == BRAM and str(post.get('content', '')).startswith('e2e:')
              and not m.evaluate("!!document.getElementById('zegHoi')") and any(x.get('message_id') for x in st['push']), (st['posts'], st['push']))
        # het bericht is echt "Hoi! 👋" (ontsleutelen met Bram zijn sleutel kan hier niet; de eigen cache van Marcel wel)
        cache = m.evaluate("() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('fibro_msg_cache_')) return localStorage.getItem(k) } return '' }")
        check('B3 de tekst is "Hoi! 👋"', 'Hoi! 👋' in (cache or ''), cache[:200] if cache else m.evaluate("Object.keys(localStorage)"))
        cm.close()
        st = nieuw_st(berichten=[{"id": "00000000-0000-4000-8000-000000000099", "sender_id": BRAM, "receiver_id": MARCEL, "content": "hallo", "created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}])
        cm, m = toestel(br, MARCEL, sl, st)
        m.goto(B + 'chat.html?vriend=' + BRAM)
        rij = wacht(m, "() => !!document.querySelector('#messages .msg-row')", 15000); m.wait_for_timeout(800)
        check('B4 chat met berichten: geen Zeg hoi', rij and not m.evaluate("!!document.getElementById('zegHoi')"))
        cm.close()

        # ---- C. Uitnodiging aannemen (bestaand account) ----
        st = nieuw_st(vrienden=False)
        cb, b = toestel(br, BRAM, sl, st)
        b.goto(B + 'invite.html?token=' + TOKEN)
        bestaand = wacht(b, "() => getComputedStyle(document.getElementById('bestaandScherm')).display === 'block'", 15000)
        b.click('#toevoegBtn')
        naar = wacht(b, "v => location.pathname.endsWith('/chat.html') && new URLSearchParams(location.search).get('vriend') === v", 10000, MARCEL)
        open_ = wacht(b, "() => { const k = document.getElementById('zegHoi'); return getComputedStyle(document.getElementById('chatScherm')).display === 'flex' && k && k.offsetParent !== null }", 15000)
        check('C uitnodiging aangenomen: meteen in de chat met Marcel, met Zeg hoi', bestaand and naar and open_ and st['vrienden'], (bestaand, naar, open_, b.url))
        cb.close()

        # ---- D. Beginscherm stuurt een keer door ----
        st = nieuw_st()
        cb, b = toestel(br, BRAM, sl, st)
        b.evaluate("([ik, v]) => localStorage.setItem('fibro_nieuwe_vriend_' + ik, JSON.stringify({ id: v, t: Date.now() }))", [BRAM, MARCEL])
        b.goto(B + 'index.html')
        naar = wacht(b, "v => location.pathname.endsWith('/chat.html') && location.search === '?vriend=' + v", 10000, MARCEL)
        weg = b.evaluate("ik => localStorage.getItem('fibro_nieuwe_vriend_' + ik)", BRAM) is None
        hoi = wacht(b, "() => !!document.getElementById('zegHoi')", 15000)
        check('D1 nieuw account: beginscherm stuurt door naar de chat (een keer)', naar and weg and hoi, (b.url, weg, hoi))
        b.goto(B + 'index.html'); b.wait_for_timeout(2000)
        check('D2 daarna gewoon het beginscherm', b.url.endswith('/index.html'), b.url)
        b.evaluate("([ik, v]) => localStorage.setItem('fibro_nieuwe_vriend_' + ik, JSON.stringify({ id: v, t: Date.now() - 2 * 3600 * 1000 }))", [BRAM, MARCEL])
        b.goto(B + 'index.html'); b.wait_for_timeout(2000)
        check('D3 na een uur niet meer (en opgeruimd)', b.url.endswith('/index.html') and b.evaluate("ik => localStorage.getItem('fibro_nieuwe_vriend_' + ik)", BRAM) is None, b.url)
        b.evaluate("ik => localStorage.setItem('fibro_nieuwe_vriend_' + ik, JSON.stringify({ id: 'javascript:alert(1)', t: Date.now() }))", BRAM)
        b.goto(B + 'index.html'); b.wait_for_timeout(2000)
        check('D4 geen geldig id: geen doorsturen', b.url.endswith('/index.html'), b.url)
        cb.close()

        # ---- E. Na het inloggen terug naar de uitnodiging ----
        st = nieuw_st()
        cb, b = toestel(br, BRAM, sl, st)
        b.evaluate("t => sessionStorage.setItem('fibro_invite_terug', 'invite.html?token=' + t + '&spel=dammen')", TOKEN)
        b.goto(B + 'login.html')
        terug = wacht(b, "t => location.pathname.endsWith('/invite.html') && location.search === '?token=' + t + '&spel=dammen'", 15000, TOKEN)
        check('E1 na het inloggen terug naar de uitnodiging', terug and b.evaluate("sessionStorage.getItem('fibro_invite_terug')") is None, b.url)
        b.goto(B + 'manifest.json'); b.evaluate("sessionStorage.setItem('fibro_invite_terug', 'https://example.com/invite.html?token=x')")
        b.goto(B + 'login.html')
        thuis = wacht(b, "() => location.pathname.endsWith('/index.html')", 15000)
        check('E2 een vreemd adres: gewoon het beginscherm', thuis, b.url)
        cb.close()
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
