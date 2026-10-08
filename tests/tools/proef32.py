import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef32: menu (☰) op Home met "Berichten bewaren": keuze 1 dag t/m 1 jaar, waarschuwing als er berichten
# meteen verdwijnen, server nog niet bijgewerkt, geen internet; chat zonder internet toont geen verlopen berichten.
# python3 -I proef32.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www32_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; LOTTE = 'cccc0002-0000-4000-8000-000000000002'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'dagen': 31, 'bijgewerkt': True, 'rpc': []}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and staat.get('msgfout'): return route.abort('connectionrefused')
    if '/rest/v1/rpc/zet_bewaartermijn' in u:
        if not staat['bijgewerkt']: return route.fulfill(status=404, json={"code": "PGRST202", "message": "Could not find the function public.zet_bewaartermijn"})
        a = json.loads(route.request.post_data or '{}'); staat['rpc'].append(a)
        n = 12 if a.get('p_dagen', 31) < staat['dagen'] else 0
        if not a.get('p_tellen'): staat['dagen'] = a['p_dagen']
        return route.fulfill(status=200, json=n)
    if '/rest/v1/profiles' in u and 'bewaar_dagen' in u:
        if not staat['bijgewerkt']: return route.fulfill(status=400, json={"code": "42703", "message": "column profiles.bewaar_dagen does not exist"})
        return route.fulfill(status=200, json={"bewaar_dagen": staat['dagen']})
    if '/rest/v1/profiles' in u and m == 'GET':
        e = {"id": UID, "username": "Marcel"}
        return route.fulfill(status=200, json=e if 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:200] if info != '' else ''))
    if not ok: fouten.append(naam)
KEUZES = "() => [...document.querySelectorAll('#bewarenScherm [role=radio]')].map(b => (b.getAttribute('aria-checked') === 'true' ? '*' : '') + b.textContent.replace(/^\\S+\\s+/, ''))"
STATUS = "() => (document.querySelector('#bewarenScherm [role=status]') || {}).textContent"
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 800}); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; dialogen = []
    p.on('pageerror', lambda e: (perr.append(str(e)), print('   PAGEERROR', str(e)[:200])))
    def dialoog(d):
        dialogen.append(d.message)
        (d.accept() if staat.get('ja', True) else d.dismiss())
    p.on('dialog', dialoog)
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    p.goto(B + 'index.html'); p.wait_for_timeout(2500)
    print('1. Menu')
    p.click('#menuBtn'); p.wait_for_timeout(300)
    items = p.evaluate("() => [...document.querySelectorAll('#fibroMenu [role=menuitem]')].map(b => b.textContent)")
    check('menu met Berichten bewaren en Over Fibro', 'Berichten bewaren' in items[0] and any('Over Fibro' in t for t in items), items)  # v135: er staan er nu meer in
    check('nog op Home (niet meteen naar Over)', p.url.endswith('index.html'), p.url)
    p.mouse.click(30, 400); p.wait_for_timeout(300)
    check('tikken naast het menu sluit het', p.evaluate("() => !document.getElementById('fibroMenu')"))
    p.click('#menuBtn'); p.wait_for_timeout(200); p.keyboard.press('Escape'); p.wait_for_timeout(200)
    check('Escape sluit het menu', p.evaluate("() => !document.getElementById('fibroMenu')"))
    print('2. Berichten bewaren openen')
    p.click('#menuBtn'); p.wait_for_timeout(200); p.click('#fibroMenu [role=menuitem] >> nth=0'); p.wait_for_timeout(1000)
    k = p.evaluate(KEUZES)
    check('vijf keuzes, 31 dagen (standaard) aangevinkt', k == ['1 dag', '7 dagen', '*31 dagen (standaard)', '90 dagen', '1 jaar'], k)
    print('3. Korter kiezen: waarschuwing, dan opslaan')
    p.click('#bewarenScherm [role=radio] >> nth=1'); p.wait_for_timeout(1000)
    check('waarschuwing met aantal', len(dialogen) == 1 and '12 berichten' in dialogen[-1] and 'ook bij je vrienden' in dialogen[-1], dialogen)
    check('opgeslagen: 7 dagen', staat['dagen'] == 7 and p.evaluate(KEUZES)[1] == '*7 dagen' and 'Opgeslagen' in p.evaluate(STATUS), (staat['dagen'], p.evaluate(KEUZES), p.evaluate(STATUS)))
    check('onthouden op dit toestel', p.evaluate("u => localStorage.getItem('fibro_bewaren_' + u)", UID) == '7')
    print('4. Korter kiezen en dan "Annuleren"')
    staat['ja'] = False; nrpc = len(staat['rpc'])
    p.click('#bewarenScherm [role=radio] >> nth=0'); p.wait_for_timeout(1000)
    check('niets veranderd', staat['dagen'] == 7 and len(staat['rpc']) == nrpc + 1 and p.evaluate(KEUZES)[1] == '*7 dagen', (staat['dagen'], staat['rpc'][nrpc:]))
    staat['ja'] = True
    print('5. Langer kiezen: geen waarschuwing')
    nd = len(dialogen); p.click('#bewarenScherm [role=radio] >> nth=4'); p.wait_for_timeout(1000)
    check('1 jaar opgeslagen zonder waarschuwing', staat['dagen'] == 365 and len(dialogen) == nd and p.evaluate(KEUZES)[4] == '*1 jaar', (staat['dagen'], dialogen[nd:]))
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    check('Escape sluit het scherm', p.evaluate("() => !document.getElementById('bewarenScherm')"))
    print('6. Opnieuw openen: de keuze van de server staat er meteen')
    p.goto(B + 'index.html'); p.wait_for_timeout(2000)
    p.click('#menuBtn'); p.click('#fibroMenu [role=menuitem] >> nth=0'); p.wait_for_timeout(100)
    check('meteen 1 jaar (van dit toestel)', p.evaluate(KEUZES)[4] == '*1 jaar', p.evaluate(KEUZES))
    p.click('#bewarenScherm button:text("Sluiten")'); p.wait_for_timeout(200)
    check('Sluiten sluit het scherm', p.evaluate("() => !document.getElementById('bewarenScherm')"))
    print('7. Server nog niet bijgewerkt (SQL nog niet gedraaid)')
    staat['bijgewerkt'] = False
    p.click('#menuBtn'); p.click('#fibroMenu [role=menuitem] >> nth=0'); p.wait_for_timeout(1000)
    check('zegt dat het nog niet kan', 'nog niet bijgewerkt' in p.evaluate(STATUS), p.evaluate(STATUS))
    p.click('#bewarenScherm [role=radio] >> nth=1'); p.wait_for_timeout(1000)
    check('kiezen zegt het ook, geen fout', 'nog niet bijgewerkt' in p.evaluate(STATUS), p.evaluate(STATUS))
    staat['bijgewerkt'] = True; p.keyboard.press('Escape')
    print('8. Geen internet')
    ctx.set_offline(True); p.wait_for_timeout(300)
    p.click('#menuBtn'); p.click('#fibroMenu [role=menuitem] >> nth=0'); p.wait_for_timeout(500)
    p.click('#bewarenScherm [role=radio] >> nth=1'); p.wait_for_timeout(500)
    check('zegt geen internet', 'Geen internet' in p.evaluate(STATUS), p.evaluate(STATUS))
    p.keyboard.press('Escape')
    print('9. Chat zonder internet: verlopen berichten niet tonen')
    nu = time.time()
    def iso(t): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(t)) + '.000Z'
    log = [{"id": "m1", "sender_id": LOTTE, "receiver_id": UID, "content": "Nog geldig", "created_at": iso(nu - 3600), "expires_at": iso(nu + 86400)},
           {"id": "m2", "sender_id": LOTTE, "receiver_id": UID, "content": "Al verlopen", "created_at": iso(nu - 7200), "expires_at": iso(nu - 60)}]
    p.evaluate("""([u, v, log]) => { localStorage.setItem('fibro_chatlog_' + u + '_' + v, JSON.stringify(log));
      localStorage.setItem('fibro_chatvrienden_' + u, JSON.stringify([{ id: v, naam: 'Lotte', avatar: 'x', publicKey: null }])) }""", [UID, LOTTE, log])
    ctx.set_offline(False); staat['msgfout'] = True
    p.goto(B + 'chat.html'); p.wait_for_timeout(1500)
    p.evaluate("v => window.openChat(v, 'Lotte', 'x', null)", LOTTE); p.wait_for_timeout(1500)
    rijen = p.evaluate("() => [...document.querySelectorAll('#messages .msg-row')].map(r => r.innerText.replace(/\\s+/g, ' '))")
    check('alleen het geldige bericht (uit het geheugen)', any('Nog geldig' in r for r in rijen) and not any('Al verlopen' in r for r in rijen), rijen)
    staat['msgfout'] = False
    print('10. Over Fibro via het menu')
    p.goto(B + 'index.html'); p.wait_for_timeout(1500)
    p.click('#menuBtn'); p.click('#fibroMenu [role=menuitem]:has-text("Over Fibro")'); p.wait_for_timeout(1000)
    check('naar Over Fibro', p.url.endswith('over.html') and 'kortste' in p.inner_text('body'), p.url)
    check('geen paginafouten', not perr, perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (%d): ' % len(fouten) + ', '.join(fouten))
