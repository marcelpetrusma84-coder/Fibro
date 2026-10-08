import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
from playwright._impl import _network as _pwn
def _sluitPagina(self, event):  # Playwright 1.56: 'code' ontbreekt soms als de pagina de verbinding sluit
    if self._on_page_close: self._on_page_close(event.get('code'), event.get('reason'))
_pwn.WebSocketRoute._channel_close_page = _sluitPagina
# proef30: open lijntjes (realtime) gaan na een netwerkwissel / dichtgaan weer open, en wat er in het gat
# binnenkwam komt alsnog. Nep-server voor Supabase Realtime (Phoenix, vsn 2.0.0) via route_web_socket.
# python3 -I proef30.py <scratch met tools/server.py> <map> <poort> [kort]
#   kort = sla de lange proef (verbinding weg terwijl de pagina op de achtergrond staat, 70 s) over
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
KORT = len(sys.argv) > 4 and sys.argv[4] == 'kort'
WWW = S + '/www30_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'cccc0002-0000-4000-8000-000000000002'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})

# ── nep-database ──
db = {'messages': [], 'teller': 0}
tel = {'msg_get': 0, 'ongelezen': 0, 'buzz_get': 0}
def iso(t=None):
    t = time.time() if t is None else t
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(t)) + '.%03dZ' % int((t % 1) * 1000)
def bericht(tekst, van=FID, naar=UID, t=None):
    db['teller'] += 1
    m = {"id": "m%03d" % db['teller'], "sender_id": van, "receiver_id": naar, "content": tekst, "created_at": iso(t), "antwoord_op": None}
    db['messages'].append(m); return m
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID, "status": "accepted"}])
    if '/rest/v1/messages' in u and m == 'GET':
        rijen = sorted(db['messages'], key=lambda x: x['created_at'], reverse=True)
        if 'content=eq.buzz' in u:
            tel['buzz_get'] += 1
            rijen = [r for r in rijen if r['content'] == 'buzz:']
            import urllib.parse as up
            q = up.parse_qs(up.urlparse(u).query)
            for g in q.get('created_at', []):
                if g.startswith('gt.'): rijen = [r for r in rijen if r['created_at'] > g[3:]]
        else: tel['msg_get'] += 1
        return route.fulfill(status=200, json=rijen[:50])
    if '/rest/v1/rpc/ongelezen_per_vriend' in u:
        tel['ongelezen'] += 1
        return route.fulfill(status=200, json=[{"vriend_id": FID, "aantal": 3}])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        vriend = {"id": FID, "username": "Lotte", "avatar_url": "x", "public_key": None}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])

# ── nep-Realtime ──
rt = {'conns': [], 'pgid': 0}
class Conn:
    def __init__(s, ws):
        s.ws = ws; s.zombie = False; s.dicht = False; s.topics = {}  # topic -> {'join_ref', 'pg': [(id, filter)]}
        ws.on_message(s.bericht)
        ws.on_close(lambda *a: setattr(s, 'dicht', True))
    def stuur(s, arr):
        if s.dicht or s.zombie: return
        try: s.ws.send(json.dumps(arr))
        except Exception: s.dicht = True
    def bericht(s, msg):
        if s.zombie or not isinstance(msg, str): return
        try: join_ref, ref, topic, event, payload = json.loads(msg)
        except Exception: return
        if event == 'heartbeat': return s.stuur([None, ref, 'phoenix', 'phx_reply', {"status": "ok", "response": {}}])
        if event == 'phx_join':
            pg = []
            for f in ((payload or {}).get('config') or {}).get('postgres_changes') or []:
                rt['pgid'] += 1; pg.append((rt['pgid'], f))
            s.topics[topic] = {'join_ref': join_ref, 'pg': pg}
            resp = {"postgres_changes": [dict(f, id=i) for i, f in pg]}
            return s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": resp}])
        if event == 'phx_leave':
            s.topics.pop(topic, None)
            return s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {}}])
        if ref: s.stuur([join_ref, ref, topic, 'phx_reply', {"status": "ok", "response": {}}])
def nieuweVerbinding(ws):
    rt['conns'].append(Conn(ws))
def levend(): return [c for c in rt['conns'] if not c.dicht]
def onderwerpen(): return sorted({t for c in levend() if not c.zombie for t in c.topics})
def bezorg(rec, soort='INSERT', table='messages'):
    n = 0
    for c in levend():
        for topic, info in list(c.topics.items()):
            ids = []
            for i, f in info['pg']:
                if f.get('table') != table or f.get('event') not in ('*', soort): continue
                flt = f.get('filter')
                if flt:
                    kol, waarde = flt.split('=eq.')
                    if rec.get(kol) != waarde: continue
                ids.append(i)
            if ids:
                c.stuur([info['join_ref'], None, topic, 'postgres_changes', {"ids": ids, "data": {"type": soort, "schema": "public", "table": table, "commit_timestamp": rec['created_at'], "record": rec, "columns": [], "errors": None}}]); n += 1
    return n
def sluitKanaal(deel):
    for c in levend():
        for topic, info in list(c.topics.items()):
            if deel in topic:
                c.stuur([info['join_ref'], None, topic, 'phx_close', {}]); c.topics.pop(topic, None)
def verbindingWeg():
    for c in levend():
        try: c.ws.close()
        except Exception: pass
        c.dicht = True

fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:200] if info != '' else ''))
    if not ok: fouten.append(naam)
ZIET = "() => [...document.querySelectorAll('#messages .msg-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())"
MIDS = "() => [...document.querySelectorAll('#messages .msg-row[data-mid]')].map(r => r.dataset.mid)"
def zichtbaar(p, ja):
    p.evaluate("""ja => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => ja ? 'visible' : 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => !ja }); document.dispatchEvent(new Event('visibilitychange')) }""", ja)
def herstel(p, topic=None):
    # oude code: een dode lijn komt niet vanzelf terug; voor de volgende proef de verbinding verbreken
    # (dan verbindt Supabase zelf opnieuw), zodat elke proef los te beoordelen is
    topic = topic or BER
    if topic in onderwerpen(): return
    print('   (lijn was nog dicht: verbinding verbroken voor de volgende proef)')
    verbindingWeg()
    for i in range(40):
        if topic in onderwerpen(): break
        p.wait_for_timeout(250)
def staatEr(p, tekst): return any(tekst in r for r in p.evaluate(ZIET))
BER = 'realtime:berichten-' + UID
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block')
    ctx.route('**/*supabase.co/rest/**', supa); ctx.route('**/*supabase.co/auth/**', supa); ctx.route('**/*supabase.co/functions/**', supa)
    ctx.route_web_socket('**/realtime/v1/websocket**', nieuweVerbinding)
    p = ctx.new_page(); perr = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200]))); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    bericht('Oud bericht', t=time.time() - 600)
    p.goto(B + 'chat.html?vriend=' + FID)
    p.wait_for_function("() => document.querySelectorAll('#messages .msg-row').length >= 1", timeout=15000)
    for i in range(50):
        if BER in onderwerpen(): break
        p.wait_for_timeout(200)
    check('chat open, berichtenlijn open', BER in onderwerpen(), onderwerpen())
    print('1. Gewoon: bericht komt meteen binnen')
    m = bericht('Een via de lijn'); bezorg(m); p.wait_for_timeout(800)
    check('bericht meteen zichtbaar', staatEr(p, 'Een via de lijn'), p.evaluate(ZIET))

    print('2. Netwerkwissel: lijn lijkt open maar is dood (geen antwoord meer); terug naar de app')
    for c in levend(): c.zombie = True
    m = bericht('Twee in het gat'); bezorg(m)
    zichtbaar(p, False); p.wait_for_timeout(1500); zichtbaar(p, True)
    p.wait_for_timeout(9000)
    check('na terugkomen binnen 9 s alsnog zichtbaar', staatEr(p, 'Twee in het gat'), p.evaluate(ZIET))
    check('daarna weer een levende lijn', BER in onderwerpen(), onderwerpen())
    m = bericht('Drie live'); bezorg(m); p.wait_for_timeout(800)
    check('en nieuwe berichten komen weer meteen', staatEr(p, 'Drie live'), p.evaluate(ZIET))

    herstel(p)
    print('3. De server sluit de lijn (bijv. inlogpas verlopen)')
    sluitKanaal('berichten-'); p.wait_for_timeout(300)
    m = bericht('Vier na sluiten'); bezorg(m)
    p.wait_for_timeout(6000)
    check('lijn weer open binnen 6 s', BER in onderwerpen(), onderwerpen())
    check('bericht uit het gat alsnog zichtbaar', staatEr(p, 'Vier na sluiten'), p.evaluate(ZIET))
    m = bericht('Vijf live'); bezorg(m); p.wait_for_timeout(800)
    check('nieuw bericht weer meteen', staatEr(p, 'Vijf live'), p.evaluate(ZIET))

    herstel(p)
    print('4. Verbinding valt helemaal weg (wifi -> 4G)')
    verbindingWeg(); m = bericht('Zes tijdens wissel')
    p.wait_for_timeout(5000)
    check('lijn weer open', BER in onderwerpen(), onderwerpen())
    check('bericht uit het gat alsnog zichtbaar', staatEr(p, 'Zes tijdens wissel'), p.evaluate(ZIET))

    herstel(p)
    print('5. Geen dubbele berichten')
    mids = p.evaluate(MIDS)
    check('elk bericht precies een keer', len(mids) == len(set(mids)) and len(mids) == len(db['messages']), (len(mids), len(set(mids)), len(db['messages'])))
    m = bericht('Zeven dubbel'); bezorg(m); bezorg(m); p.wait_for_timeout(800)
    mids = p.evaluate(MIDS)
    check('zelfde bericht twee keer bezorgd: een keer getoond', mids.count(m['id']) == 1, mids)

    print('6. Gezonde lijn: terugkomen kost geen nieuwe verbinding en geen extra ophalen')
    p.wait_for_timeout(1500)
    nconn = len(rt['conns']); nget = tel['msg_get']
    for i in range(3):
        zichtbaar(p, False); p.wait_for_timeout(400); zichtbaar(p, True); p.wait_for_timeout(1500)
    p.wait_for_timeout(3000)
    check('geen nieuwe verbinding', len(rt['conns']) == nconn, (nconn, len(rt['conns'])))
    check('berichten niet opnieuw opgehaald', tel['msg_get'] == nget, (nget, tel['msg_get']))

    herstel(p)
    print('7. Eigen bericht versturen terwijl de lijn dood is')
    for c in levend(): c.zombie = True
    m = bericht('Acht van mij', van=UID, naar=FID); bezorg(m)
    p.evaluate("() => window.dispatchEvent(new Event('online'))")
    p.wait_for_timeout(9000)
    check('eigen bericht alsnog zichtbaar', staatEr(p, 'Acht van mij') or any(m['id'] == x for x in p.evaluate(MIDS)), p.evaluate(ZIET))

    if not KORT:
        herstel(p)
        print('8. Verbinding weg terwijl de pagina op de achtergrond staat (Deck: ander tabblad)')
        zichtbaar(p, False); p.wait_for_timeout(500)
        verbindingWeg(); m = bericht('Negen op de achtergrond')
        p.wait_for_timeout(70000)
        check('ook op de achtergrond weer verbonden (binnen 70 s)', BER in onderwerpen(), onderwerpen())
        bezorg(bericht('Tien op de achtergrond live')); p.wait_for_timeout(800)
        check('bericht komt op de achtergrond binnen', staatEr(p, 'Tien op de achtergrond live'), p.evaluate(ZIET))
        zichtbaar(p, True); p.wait_for_timeout(3000)
        check('bij terugkomen staat ook het gat erin', staatEr(p, 'Negen op de achtergrond'), p.evaluate(ZIET))

    print('9. Home: buzz en ongelezen na sluiten van de lijnen')
    p.goto(B + 'index.html'); p.wait_for_timeout(500)
    p.evaluate("""() => { window._meld = []; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
      if (n.nodeType === 1 && n.parentElement && n.parentElement.id === 'fibro-meldingen' && /buzzt je/.test(n.textContent || '')) window._meld.push(n.textContent) }).observe(document.body, { childList: true, subtree: true }) }""")
    for i in range(50):
        if ('realtime:meldingen-berichten-' + UID) in onderwerpen() and ('realtime:ongelezen-' + UID) in onderwerpen(): break
        p.wait_for_timeout(200)
    check('buzz- en ongelezenlijn open', ('realtime:meldingen-berichten-' + UID) in onderwerpen() and ('realtime:ongelezen-' + UID) in onderwerpen(), onderwerpen())
    m = bericht('buzz:'); bezorg(m); p.wait_for_timeout(1000)
    check('buzz live: melding', len(p.evaluate('() => window._meld')) == 1, p.evaluate('() => window._meld'))
    p.wait_for_timeout(5500)
    nong = tel['ongelezen']
    sluitKanaal('meldingen-berichten-'); sluitKanaal('ongelezen-'); p.wait_for_timeout(300)
    m = bericht('buzz:'); bezorg(m)
    p.wait_for_timeout(6000)
    check('buzzlijn weer open', ('realtime:meldingen-berichten-' + UID) in onderwerpen(), onderwerpen())
    check('ongelezenlijn weer open', ('realtime:ongelezen-' + UID) in onderwerpen(), onderwerpen())
    check('buzz uit het gat alsnog gemeld', len(p.evaluate('() => window._meld')) == 2, p.evaluate('() => window._meld'))
    check('ongelezen opnieuw geteld', tel['ongelezen'] > nong, (nong, tel['ongelezen']))
    p.wait_for_timeout(5500)
    verbindingWeg(); p.wait_for_timeout(5000)
    check('opnieuw verbonden: oude buzz niet nog eens', len(p.evaluate('() => window._meld')) == 2, p.evaluate('() => window._meld'))
    bericht('buzz:', t=time.time() - 600)
    sluitKanaal('meldingen-berichten-'); p.wait_for_timeout(6000)
    check('buzz van 10 minuten geleden: geen melding meer', len(p.evaluate('() => window._meld')) == 2, p.evaluate('() => window._meld'))

    print('10. Speluitnodiging en bellen: lijn gaat na sluiten weer open')
    for naam in ['speluitnodiging-', 'bel-uitnodiging-']:
        sluitKanaal(naam)
    p.wait_for_timeout(6000)
    for naam in ['speluitnodiging-', 'bel-uitnodiging-']:
        check(naam + ' weer open', ('realtime:' + naam + UID) in onderwerpen(), onderwerpen())
    check('geen paginafouten', not perr, perr)
    br.close()
srv.kill()
print('verbindingen:', len(rt['conns']), '| berichten opgehaald:', tel['msg_get'], '| buzz opgehaald:', tel['buzz_get'])
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
