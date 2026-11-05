# proef237 (4 nov 2026, v258): meldingen meteen aanzetten (meldingen-aan.js), in echte pagina's in Chrome.
# De meldingen van de telefoon zelf (Notification, service worker, pushManager) zijn nagebootst: zo is te zien wat Fibro
# vraagt en opslaat. Vanzelf aanzetten kan niet (de gebruiker tikt zelf op 'Sta toe'); het moet EEN tik zijn.
#  H. Home: een kaart tot de meldingen aan staan. Tik = de vraag van de telefoon METEEN bij de tik (anders laat de
#     iPhone hem niet zien), dan het abonnement opslaan. 'Nu niet' = 3 dagen niet. Geweigerd = uitleg waar je ze
#     weer aanzet. Safari op de iPhone: geen kaart (daar staat de tip voor het beginscherm); als app wel, en daar vraagt
#     de eerste tik op 'Welkom bij Fibro, tik om te beginnen' (beltoon.js) meteen mee om de meldingen.
#  W. Het welkomstscherm na het inschrijven (invite.html): een knop Meldingen aanzetten, voor het nieuwe account.
# python3 -I proef237.py <map>
import sys, os, time, json, socket, subprocess, re
from playwright.sync_api import sync_playwright

MARCEL = 'aaaaaaaa-0000-4000-8000-000000000001'; NIEUW = 'cccc0003-0000-4000-8000-000000000003'
TOKEN = 'fibro-abcdefghijklmnop'
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
def token(uid): return json.dumps({"access_token": "tok-" + uid[:4], "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": uid}})

def rest(uid, st):
    def supa(route):
        u = route.request.url; m = route.request.method
        if '/rest/v1/push_subscriptions' in u and m == 'POST':
            st['abonnementen'].append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, body='')
        if '/auth/v1/signup' in u:
            return route.fulfill(status=200, json={"access_token": "tok-nieuw", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600,
                                                   "expires_at": int(time.time()) + 3600, "user": {"id": NIEUW, "aud": "authenticated", "email": "x@fibro.internal"}})
        if '/rest/v1/rpc/valideer_invite' in u: return route.fulfill(status=200, json=[{"token": TOKEN, "created_by": MARCEL}])
        if '/rest/v1/rpc/uitnodiger_van_invite' in u: return route.fulfill(status=200, json=[{"username": "Marcel", "avatar_url": "\U0001F419"}])
        if '/rest/v1/rpc/registratie_stand' in u: return route.fulfill(status=200, json='open')
        if '/rest/v1/rpc/maak_vriendschap_via_invite' in u: return route.fulfill(status=200, json=True)
        if '/rest/v1/rpc/' in u: return route.fulfill(status=200, json=False)
        if '/rest/v1/profiles' in u and m == 'GET':
            ik = {"id": uid, "username": "Marcel", "display_name": None, "avatar_url": "\U0001F419"}
            if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=ik)
            return route.fulfill(status=200, json=[ik])
        if '/auth/v1/user' in u: return route.fulfill(status=200, json={"id": uid, "aud": "authenticated"})
        if m in ('POST', 'PATCH'): return route.fulfill(status=201, body='')
        return route.fulfill(status=200, json=[])
    return supa

# Nep-meldingen van de telefoon. De stand per test staat in localStorage '__nepmelding' = { perm, sub, antwoord, app }.
NEP = r"""(() => {
  let c = {}; try { c = JSON.parse(localStorage.getItem('__nepmelding') || '{}') } catch (e) {}
  const S = window.__melding = { gevraagd: 0, vraagInKlik: null, inKlik: false, subscribe: null }
  let perm = c.perm || 'default', sub = c.sub ? 'https://push.example/oud' : null
  addEventListener('click', () => { S.inKlik = true; setTimeout(() => { S.inKlik = false }, 0) }, true)
  window.Notification = class { static get permission() { return perm }
    static requestPermission() { S.gevraagd++; S.vraagInKlik = S.inKlik; perm = c.antwoord || 'granted'; return Promise.resolve(perm) } }
  const abon = e => ({ endpoint: e, toJSON: () => ({ endpoint: e, keys: { p256dh: 'p', auth: 'a' } }) })
  const pm = { getSubscription: async () => sub ? abon(sub) : null,
               subscribe: async o => { S.subscribe = { userVisibleOnly: o.userVisibleOnly, sleutel: String(o.applicationServerKey) }; sub = 'https://push.example/nieuw'; return abon(sub) } }
  const reg = { pushManager: pm, scope: '/' }
  if (!window.PushManager) window.PushManager = function () {}
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: async () => reg, ready: Promise.resolve(reg),
    getRegistration: async () => reg, getRegistrations: async () => [reg], addEventListener() {}, removeEventListener() {}, controller: null } })
  if (c.app) Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  try { delete window.PublicKeyCredential } catch (e) {}
  window.PublicKeyCredential = undefined // geen passkeys: na het inschrijven het gewone welkomstscherm (herstelcode)
})()"""

MAP = os.path.abspath(sys.argv[1])
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', MAP], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
B = 'http://127.0.0.1:%d/' % poort
uitslag = []; fouten = []
def check(n, ok, info=''): uitslag.append(bool(ok)); print(('OK   ' if ok else 'MIS  ') + n + ('  | ' + str(info)[:300] if info != '' else ''), flush=True)
def wacht(pg, js, ms, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False

def toestel(br, st, nep, ingelogd=True, taal='nl', ua=None, uid=MARCEL):
    k = {'service_workers': 'block', 'viewport': {'width': 390, 'height': 844}}
    if ua: k['user_agent'] = ua
    ctx = br.new_context(**k)
    ctx.add_init_script("(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('fibro_eigennaam_gevraagd_') ? '1' : g.call(this, k) } })()")  # v270: geen vraag 'Hoe heet je?' over Home heen (eigennaam.js; die heeft een eigen test)
    ctx.route('**/*supabase.co/**', rest(uid, st))
    ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)(?!.*supabase\.co).*'), lambda r: r.fulfill(status=204, body=''))
    ctx.add_init_script(NEP)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(B + 'manifest.json')
    pg.evaluate("([t, taal, nep, inl]) => { if (inl) localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', taal); localStorage.setItem('__nepmelding', JSON.stringify(nep)) }",
                [token(uid), taal, nep, ingelogd])
    return ctx, pg

def nieuw_st(): return {'abonnementen': []}
KAART = "() => { const k = document.getElementById('meldkaart'); return !!k && k.offsetParent !== null }"
def home(pg):
    pg.goto(B + 'index.html'); pg.wait_for_timeout(2500)
WELKOM = "() => [...document.body.children].some(d => (d.textContent || '').includes('Tik om te beginnen'))"
def tik_welkom(pg):
    # het welkomstscherm van de iPhone (beltoon.js) aantikken, zoals een echte vinger
    er = wacht(pg, WELKOM, 8000)
    pg.mouse.click(195, 600); pg.wait_for_timeout(900)
    return er

try:
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-proxy-server'])
        # H1-H2: nog niet gevraagd: kaart; een tik = de vraag meteen bij de tik, abonnement opgeslagen
        st = nieuw_st(); ctx, pg = toestel(br, st, {})
        home(pg)
        zichtbaar = wacht(pg, KAART, 8000)
        tekst = pg.evaluate("(document.getElementById('meldkaart') || {}).innerText || ''")
        check('H1 nog geen meldingen: kaart op Home met Aanzetten', zichtbaar and 'Zet meldingen aan' in tekst and 'Aanzetten' in tekst, tekst)
        pg.click('#meldkaart .meldkaart-aan'); pg.wait_for_timeout(800)
        m = pg.evaluate("window.__melding")
        ab = st['abonnementen'][-1] if st['abonnementen'] else {}
        check('H2 tik: de vraag van de telefoon meteen bij de tik, abonnement voor dit account opgeslagen',
              m['gevraagd'] == 1 and m['vraagInKlik'] is True and m['subscribe'] and m['subscribe']['userVisibleOnly'] is True
              and ab.get('user_id') == MARCEL and (ab.get('subscription') or {}).get('endpoint') == 'https://push.example/nieuw', (m, st['abonnementen']))
        klaar = pg.evaluate("(document.getElementById('meldkaart') || {}).innerText || ''")
        weg = wacht(pg, "() => !document.getElementById('meldkaart')", 5000)
        check('H3 daarna "Meldingen staan aan!" en de kaart verdwijnt', 'Meldingen staan aan' in klaar and weg, klaar)
        ctx.close()
        # H4: staan al aan: geen kaart
        st = nieuw_st(); ctx, pg = toestel(br, st, {'perm': 'granted', 'sub': True}); home(pg)
        check('H4 meldingen staan al aan: geen kaart', not pg.evaluate("!!document.getElementById('meldkaart')"))
        ctx.close()
        # H5: toestemming wel, abonnement niet (bijvoorbeeld na een nieuwe installatie): kaart, tik = zonder nieuwe vraag aan
        st = nieuw_st(); ctx, pg = toestel(br, st, {'perm': 'granted'}); home(pg)
        zichtbaar = wacht(pg, KAART, 8000)
        pg.click('#meldkaart .meldkaart-aan'); pg.wait_for_timeout(800)
        check('H5 toestemming al gegeven maar geen abonnement: een tik zet ze aan (zonder vraag)', zichtbaar and pg.evaluate("window.__melding.gevraagd") == 0 and len(st['abonnementen']) == 1, st['abonnementen'])
        ctx.close()
        # H6: 'Nu niet': weg, na herladen nog steeds weg, na 3 dagen terug
        st = nieuw_st(); ctx, pg = toestel(br, st, {}); home(pg)
        wacht(pg, KAART, 8000); pg.click('#meldkaart .meldkaart-weg'); pg.wait_for_timeout(200)
        weg1 = not pg.evaluate("!!document.getElementById('meldkaart')")
        home(pg); weg2 = not pg.evaluate("!!document.getElementById('meldkaart')")
        pg.evaluate("localStorage.setItem('fibro_meldkaart_weg', String(Date.now() - 4 * 86400000))"); home(pg)
        terug = wacht(pg, KAART, 8000)
        check('H6 Nu niet: weg, na herladen weg, na 3 dagen terug', weg1 and weg2 and terug and not st['abonnementen'], (weg1, weg2, terug))
        ctx.close()
        # H7: vraag weggetikt: kaart blijft, met de knop
        st = nieuw_st(); ctx, pg = toestel(br, st, {'antwoord': 'default'}); home(pg)
        wacht(pg, KAART, 8000); pg.click('#meldkaart .meldkaart-aan'); pg.wait_for_timeout(600)
        check('H7 vraag weggetikt: kaart en knop blijven', pg.evaluate("!!document.querySelector('#meldkaart .meldkaart-aan')") and not st['abonnementen'])
        ctx.close()
        # H8: geweigerd (meteen of bij de tik): uitleg waar je ze aanzet, geen knop
        st = nieuw_st(); ctx, pg = toestel(br, st, {'perm': 'denied'}); home(pg)
        zichtbaar = wacht(pg, KAART, 8000); tekst = pg.evaluate("(document.getElementById('meldkaart') || {}).innerText || ''")
        check('H8 geweigerd: uitleg (slotje naast het adres), geen knop', zichtbaar and 'Meldingen staan uit' in tekst and 'slotje' in tekst and not pg.evaluate("!!document.querySelector('#meldkaart .meldkaart-aan')"), tekst)
        ctx.close()
        st = nieuw_st(); ctx, pg = toestel(br, st, {'antwoord': 'denied', 'app': True}, ua=IPHONE); home(pg)
        wacht(pg, KAART, 8000); welkom = tik_welkom(pg)
        tekst = pg.evaluate("(document.getElementById('meldkaart') || {}).innerText || ''")
        check('H9 iPhone-app, bij de eerste tik geweigerd: uitleg Instellingen > Meldingen > Stekky', welkom and 'Instellingen > Meldingen > Stekky' in tekst and not st['abonnementen'], tekst)
        ctx.close()
        # H10: Safari op de iPhone: geen meldkaart, wel de tip voor het beginscherm. Als app (beginscherm): wel de kaart.
        st = nieuw_st(); ctx, pg = toestel(br, st, {}, ua=IPHONE); home(pg)
        tip = wacht(pg, "() => !!document.querySelector('.beginscherm-tip')", 6000)
        check('H10 Safari op de iPhone: geen meldkaart, wel de beginscherm-tip', tip and not pg.evaluate("!!document.getElementById('meldkaart')"))
        ctx.close()
        st = nieuw_st(); ctx, pg = toestel(br, st, {'app': True}, ua=IPHONE); home(pg)
        zichtbaar = wacht(pg, KAART, 8000); welkom = tik_welkom(pg)
        m = pg.evaluate("window.__melding")
        check('H11 iPhone als app: de eerste tik op Welkom bij Stekky vraagt meteen de meldingen (in de tik) en zet ze aan',
              zichtbaar and welkom and m['gevraagd'] == 1 and m['vraagInKlik'] is True and len(st['abonnementen']) == 1
              and not pg.evaluate("!!document.querySelector('.beginscherm-tip')") and wacht(pg, "() => !document.getElementById('meldkaart')", 5000), (m, st['abonnementen']))
        ctx.close()
        st = nieuw_st(); ctx, pg = toestel(br, st, {'app': True}, ua=IPHONE)
        pg.evaluate("localStorage.setItem('fibro_meldkaart_weg', String(Date.now()))"); home(pg)
        welkom = tik_welkom(pg)
        check('H11b iPhone als app, net Nu niet gekozen: de eerste tik vraagt niets', welkom and pg.evaluate("window.__melding.gevraagd") == 0 and not st['abonnementen'])
        ctx.close()
        # H12: Engels
        st = nieuw_st(); ctx, pg = toestel(br, st, {}, taal='en'); home(pg)
        wacht(pg, KAART, 8000); tekst = pg.evaluate("(document.getElementById('meldkaart') || {}).innerText || ''")
        check('H12 Engels', 'Turn on notifications' in tekst and 'Turn on' in tekst, tekst)
        ctx.close()

        # W1: inschrijven via een uitnodiging: op het welkomstscherm een knop voor de meldingen, voor het nieuwe account
        def inschrijven(pg):
            pg.goto(B + 'invite.html?token=' + TOKEN)
            wacht(pg, "() => getComputedStyle(document.getElementById('uitnodigingScherm')).display === 'block'", 15000)
            pg.fill('#eigennaam', 'Sanne de Vries')   # v270: je eigen naam is verplicht
            pg.fill('#wachtwoord', 'geheim-1234'); pg.fill('#geboortejaar', '1990'); pg.check('#akkoord')
            pg.evaluate("registreren()")
            return wacht(pg, "() => getComputedStyle(document.getElementById('herstelScherm')).display === 'block'", 20000)
        st = nieuw_st(); ctx, pg = toestel(br, st, {}, ingelogd=False, uid=NIEUW)
        welkom = inschrijven(pg)
        vak = wacht(pg, "() => { const v = document.getElementById('meldWelkom'); return v && !v.hidden && v.offsetParent !== null }", 8000)
        pg.click('#meldWelkomKnop'); pg.wait_for_timeout(1000)
        ab = st['abonnementen'][-1] if st['abonnementen'] else {}
        tekst = pg.evaluate("document.getElementById('meldWelkomTekst').textContent")
        check('W1 welkomstscherm: Meldingen aanzetten met een tik, voor het nieuwe account', welkom and vak and ab.get('user_id') == NIEUW
              and pg.evaluate("window.__melding.vraagInKlik") is True and 'Meldingen staan aan' in tekst and not pg.evaluate("!!document.getElementById('meldWelkomKnop')"), (welkom, vak, st['abonnementen'], tekst))
        ctx.close()
        # W2: in Safari op de iPhone: geen knop (kan daar niet), wel de uitleg over het beginscherm
        st = nieuw_st(); ctx, pg = toestel(br, st, {}, ingelogd=False, ua=IPHONE, uid=NIEUW)
        welkom = inschrijven(pg); pg.wait_for_timeout(1200)
        check('W2 Safari op de iPhone: geen meldingenknop op het welkomstscherm', welkom and pg.evaluate("document.getElementById('meldWelkom').hidden") and 'beginscherm' in pg.evaluate("document.getElementById('herstelScherm').innerText"))
        ctx.close()
        br.close()
finally:
    srv.terminate()
check('geen paginafouten', not fouten, fouten[:4])
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
sys.exit(0 if uitslag and all(uitslag) else 1)
