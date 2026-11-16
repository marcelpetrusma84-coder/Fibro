# proef303 (16 nov 2026): de online-golf in de echte chat, met uitsluitend nagebootste vrienden en serverantwoorden.
# A. Een geopende offline chat toont de bewaarde geschiedenis zonder golf.
# B. De echte online-poll ziet offline -> online: 2,5 seconden golf, daarna een duidelijke melding.
# C. Herhaalde status en een al online vriend opnieuw openen spelen niets opnieuw af.
# D. Teruggaan of weer offline gaan stopt ook de uitgestelde melding.
# E. Een eerste nog onbekende status is een beginstand, geen nieuwe binnenkomst.
# python -I tests/tools/proef303.py <map>
import datetime
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse

from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
VRIEND = 'bbbb0001-0000-4000-8000-000000000002'
BERICHT = 'cccc0001-0000-4000-8000-000000000003'
NAAM = 'NeonFriend42'
AUTH = 'sb-qmgatbphiplrfxrljtbe-auth-token'
TOKEN = json.dumps({'access_token': 'proef303-token', 'refresh_token': 'proef303-refresh',
                   'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600,
                   'user': {'id': UID}})
stand = {'online': False, 'bekend': True}
fout = []
paginafouten = []


def check(ok, tekst):
    print(('OK   ' if ok else 'FOUT ') + tekst)
    if not ok:
        fout.append(tekst)


def nu():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def supa(route):
    url = urllib.parse.unquote(route.request.url)
    if '/auth/v1/user' in url:
        return route.fulfill(status=200, json={'id': UID})
    if '/auth/v1/token' in url:
        return route.fulfill(status=200, json=json.loads(TOKEN))
    if '/rest/v1/friendships' in url:
        return route.fulfill(status=200, json=[{'user_id': UID, 'friend_id': VRIEND, 'status': 'accepted'}])
    if '/rest/v1/profiles' in url:
        rij = {'id': VRIEND, 'username': NAAM, 'avatar_url': '👤', 'public_key': ''} if VRIEND in url else {'id': UID, 'username': 'GolfTester', 'avatar_url': '🌿'}
        if rij['id'] == VRIEND and stand['bekend']:
            rij.update(online_status=stand['online'], laatst_gezien=nu() if stand['online'] else '2020-01-01T00:00:00Z')
        enkel = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        return route.fulfill(status=200, json=rij if enkel else [rij])
    if '/rest/v1/messages' in url and route.request.method == 'GET':
        bericht = {'id': BERICHT, 'sender_id': VRIEND, 'receiver_id': UID,
                   'content': 'Dit is alleen een lokaal testbericht.', 'created_at': nu()}
        return route.fulfill(status=200, json=[bericht])
    return route.fulfill(status=200, json=[])


INIT = """({ token, taal, auth }) => {
  localStorage.setItem(auth, token);
  localStorage.setItem('fibro_taal', taal);
  localStorage.setItem('fibro_opslagtip_later', String(Date.now()));
  const echt = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...args) => {
    if (typeof fn === 'function' && fn.name === 'haalOnlineOp' && ms === 120000) window.__onlineGolfPoll = fn;
    return echt(fn, ms, ...args);
  };
}"""


def context(browser, taal='nl'):
    ctx = browser.new_context(service_workers='block', locale='nl-NL', reduced_motion='no-preference',
                              viewport={'width': 390, 'height': 844})
    # Geen verzoek, websocket of bericht kan de echte Supabase-server bereiken.
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda route: route.fulfill(status=204, body=''))
    ctx.route('**/*supabase.co/**', supa)
    ctx.route_web_socket('**/*supabase.co/**', lambda websocket: websocket.close())
    ctx.add_init_script('(' + INIT + ')(' + json.dumps({'token': TOKEN, 'taal': taal, 'auth': AUTH}) + ')')
    pg = ctx.new_page()
    pg.on('pageerror', lambda error: paginafouten.append(str(error)))
    pg.goto(BASIS + 'chat.html')
    pg.wait_for_selector('.vriend-item[data-vid="' + VRIEND + '"]')
    pg.wait_for_function("() => typeof window.__onlineGolfPoll === 'function' && typeof window.openChat === 'function'")
    # De normale klik blijft de productiefunctie uitvoeren. De test wacht op haar bestaande Promise,
    # zodat ook foto's/reacties klaar zijn en we niet met een willekeurige pauze op 'klaar' gokken.
    pg.evaluate("""() => { const echt = window.openChat; window.openChat = (...args) => {
      const klaar = echt(...args); window.__onlineGolfOpen = klaar; return klaar;
    }; }""")
    open_chat(pg)
    return ctx, pg


def open_chat(pg):
    pg.click('.vriend-item[data-vid="' + VRIEND + '"]')
    pg.evaluate('() => window.__onlineGolfOpen')
    pg.wait_for_selector('#chatScherm', state='visible')
    pg.wait_for_selector('#messages .msg-row[data-mid="' + BERICHT + '"]')


def poll(pg, online, bekend=True):
    stand.update(online=online, bekend=bekend)
    pg.evaluate('async () => { await window.__onlineGolfPoll(); }')


def geen_golf(pg):
    return pg.locator('.chat-onlinegolf').count() == 0


www = tempfile.mkdtemp(prefix='proef303_')
os.symlink(MAP, os.path.join(www, 'Fibro'))
sock = socket.socket()
sock.bind(('127.0.0.1', 0))
poort = sock.getsockname()[1]
sock.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=['--no-proxy-server'])
        for taal in ['nl', 'en']:
            stand.update(online=False, bekend=True)
            ctx, pg = context(browser, taal)
            check(geen_golf(pg) and pg.locator('#messages .msg-row').count() == 1,
                  'A (%s): een geopende offline chat toont geschiedenis zonder animatie' % taal)
            verwachte_tekst = pg.evaluate("naam => T('{naam} is zojuist online gekomen', { naam })", NAAM)
            if taal == 'en':
                check(NAAM in verwachte_tekst and 'zojuist' not in verwachte_tekst, 'B: de melding is ook vertaald naar het Engels')
            begin = pg.evaluate('performance.now()')
            poll(pg, True)
            pg.wait_for_selector('.chat-onlinegolf')
            check(pg.get_attribute('.chat-onlinegolf', 'aria-hidden') == 'true'
                  and pg.evaluate("getComputedStyle(document.querySelector('.chat-onlinegolf')).pointerEvents") == 'none',
                  'B (%s): de golf is decoratief en blokkeert geen aanrakingen' % taal)
            pg.wait_for_selector('.chat-onlinegolf-melding.is-zichtbaar', timeout=6000)
            duur = pg.evaluate('performance.now()') - begin
            check(geen_golf(pg) and 2200 <= duur <= 5500,
                  'B (%s): na ongeveer 2,5 seconden is de golf weg (%.0f ms)' % (taal, duur))
            check(pg.text_content('.chat-onlinegolf-melding') == verwachte_tekst
                  and pg.get_attribute('.chat-onlinegolf-melding', 'role') == 'status',
                  'B (%s): een leesbare live-melding noemt de juiste vriend' % taal)
            check(pg.locator('#messages .msg-row').count() == 1
                  and not pg.locator('#messages').evaluate("e => e.classList.contains('chat-onlinegolf-lezen')"),
                  'B (%s): de berichten blijven behouden en zijn weer scherp' % taal)
            poll(pg, True)
            check(geen_golf(pg), 'C (%s): dezelfde online-status speelt niets opnieuw af' % taal)
            pg.click('.top-bar .back-btn')
            open_chat(pg)
            check(geen_golf(pg) and pg.locator('.chat-onlinegolf-melding').count() == 0,
                  'C (%s): een al online vriend opnieuw openen start geen golf' % taal)

            poll(pg, False)
            poll(pg, True)
            pg.wait_for_selector('.chat-onlinegolf')
            pg.click('.top-bar .back-btn')
            pg.wait_for_timeout(2700)
            check(geen_golf(pg) and pg.locator('.chat-onlinegolf-melding').count() == 0,
                  'D (%s): teruggaan stopt de golf en voorkomt een late melding' % taal)
            open_chat(pg)
            poll(pg, False)
            poll(pg, True)
            pg.wait_for_selector('.chat-onlinegolf')
            poll(pg, False)
            pg.wait_for_timeout(2700)
            check(geen_golf(pg) and pg.locator('.chat-onlinegolf-melding').count() == 0
                  and not pg.locator('#chatAv').evaluate("e => e.classList.contains('is-online')"),
                  'D (%s): weer offline annuleert ook de melding en het groene stipje' % taal)
            ctx.close()

        stand.update(online=False, bekend=False)
        ctx, pg = context(browser)
        poll(pg, True, bekend=True)
        check(geen_golf(pg) and pg.locator('.chat-onlinegolf-melding').count() == 0,
              'E: de eerste bekende online-stand na een onbekende cache is alleen de beginstand')
        poll(pg, False)
        poll(pg, True)
        pg.wait_for_selector('.chat-onlinegolf')
        check(not geen_golf(pg), 'E: een volgende echte offline-online-overgang speelt de golf wel')
        ctx.close()
        browser.close()
except Exception as error:
    check(False, 'proef afgebroken: ' + str(error).split('\n')[0])
finally:
    srv.terminate()

check(not paginafouten, 'geen paginafouten (%s)' % paginafouten[:3])
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
