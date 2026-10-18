import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef78: versleuteling v2 in de chat (v181). Marcel chat met Bram; de nep-server geeft berichten die de proef zelf
# maakt met de NIEUWE crypto.js (naast deze proef in de repo), ook als de map die getest wordt de oude is (controle).
#  1. gewoon v2-bericht van Bram, eigen v2-bericht zonder geheugen, oud v1-bericht: leesbaar, geen waarschuwing
#  2. omgedraaid (server zette afzender/ontvanger om) en een veranderd teken: "klopt niet", niet de tekst
#  3. verzendtijd 2 uur eerder dan de server-tijd: label "verzendtijd klopt niet"
#     (ook een server-tijd zonder tijdzone: UTC, geen label)
#  4. zonder slot: tekst met label "niet versleuteld", ook een sticker-code wordt geen plaatje;
#     belregel, buzz, spel-uitnodiging en verwijderd zonder label
#  5. versturen: e2e:2:, en Bram kan het openen met Marcel als afzender en Bram als ontvanger
#  6. reactie geven (echt ingedrukt houden): e2e:2: vast aan het bericht; reactie van Bram goed, verplaatst = waarschuwing
#  7. sleutel van Bram verandert: gele balk met zijn naam, versturen kan, Begrepen = weg (ook na verversen)
#  8. in het Engels: de labels vertaald
#  9. login.html en invite.html sturen geen hash van de herstelcode meer naar de server
# python3 -I proef78.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
HULP = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'crypto.js'))
WWW = S + '/www78_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'; FID = 'bbbb0001-0000-4000-8000-000000000001'
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
staat = {'pub': None, 'berichten': [], 'reacties': [], 'posts': [], 'rposts': []}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/messages' in u and m == 'POST':
        staat['posts'].append(json.loads(route.request.post_data or '{}'))
        return route.fulfill(status=201, json={"id": "nieuw%d" % len(staat['posts'])}, headers={'content-type': 'application/vnd.pgrst.object+json'})
    if '/rest/v1/reacties' in u and m == 'POST':
        staat['rposts'].append(json.loads(route.request.post_data or '{}')); return route.fulfill(status=201, body='')
    if '/rest/v1/reacties' in u and m == 'GET': return route.fulfill(status=200, json=staat['reacties'])
    if '/rest/v1/friendships' in u: return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": FID}])
    if '/rest/v1/messages' in u and m == 'GET': return route.fulfill(status=200, json=staat['berichten'])
    if '/rest/v1/profiles' in u and m == 'GET':
        prof = {"id": UID, "username": "Marcel"}
        vriend = {"id": FID, "username": "Bram", "avatar_url": "x", "public_key": staat['pub']}
        if 'vnd.pgrst.object' in (route.request.headers.get('accept') or ''): return route.fulfill(status=200, json=vriend if FID in u else prof)
        return route.fulfill(status=200, json=[vriend] if ('in.' in u or FID in u) else [prof])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info)[:300] if info != '' else ''))
    if not ok: fouten.append(naam)

# Berichten maken met de nieuwe crypto.js (proef-crypto.js) en een v1-bericht zoals de oude code het maakte
MAAK = """async ([u, f]) => {
  const c = await import('./proef-crypto.js')
  const ik = await c.genereerKeypair(), bram = await c.genereerKeypair(), nieuweBram = await c.genereerKeypair()
  c.slaPrivateKeyOp(u, ik.privateKeyB64)
  const naarMij = { soort: 'bericht', van: f, naar: u }, naarBram = { soort: 'bericht', van: u, naar: f }
  const v2 = (t, priv, pub, ctx) => c.versleutel(t, priv, pub, ctx)
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  const v1 = async (t) => {  // oud formaat: ECDH-uitkomst direct als AES-sleutel, geen extra gegevens
    const raw = s => Uint8Array.from(atob(s), x => x.charCodeAt(0))
    const priv = await crypto.subtle.importKey('pkcs8', raw(bram.privateKeyB64), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
    const pub = await crypto.subtle.importKey('spki', raw(ik.publicKeyB64), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const k = await crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(t)))
    const a = new Uint8Array(12 + ct.length); a.set(iv); a.set(ct, 12); return 'e2e:' + b64(a)
  }
  const goed = await v2('Hoi Marcel, alles goed?', bram.privateKeyB64, ik.publicKeyB64, naarMij)
  const zonderZone = await v2('Tijd zonder tijdzone', bram.privateKeyB64, ik.publicKeyB64, naarMij)
  const eigen = await v2('Mijn eigen bericht van de iPhone', ik.privateKeyB64, bram.publicKeyB64, naarBram)
  const omgedraaid = await v2('Dit schreef Marcel zelf', ik.privateKeyB64, bram.publicKeyB64, naarBram)
  let veranderd = await v2('Ik kom om acht uur', bram.privateKeyB64, ik.publicKeyB64, naarMij)
  const i = veranderd.length - 8; veranderd = veranderd.slice(0, i) + (veranderd[i] === 'A' ? 'B' : 'A') + veranderd.slice(i + 1)
  const echtNu = Date.now; Date.now = () => echtNu() - 2 * 3600000
  const oudeTijd = await v2('Ja, prima', bram.privateKeyB64, ik.publicKeyB64, naarMij)
  Date.now = echtNu
  const oud = await v1('Een bericht van voor de update')
  const r1 = await v2('\\u{1F44D}', bram.privateKeyB64, ik.publicKeyB64, { soort: 'reactie', van: f, bij: 'm01' })
  const rVerplaatst = await v2('\\u{1F525}', bram.privateKeyB64, ik.publicKeyB64, { soort: 'reactie', van: f, bij: 'm01' })
  return { ik, bram, nieuweBram, goed, zonderZone, eigen, omgedraaid, veranderd, oudeTijd, oud, r1, rVerplaatst }
}"""
TEKSTEN = """() => [...document.querySelectorAll('#messages [data-mid]')].map(r => [r.dataset.mid,
  ((r.querySelector('.bubble-content, .belregel-tekst') || {}).textContent || '').trim(),
  ((r.querySelector('.bubble-waarschuwing') || {}).textContent || '').trim(),
  !!r.querySelector('img')])"""
OPEN_V2 = """async ([priv, pub, inhoud, ctx]) => { const c = await import('./proef-crypto.js'); return await c.ontsleutelBericht(inhoud, priv, pub, ctx) }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    ctx.route('**/proef-crypto.js', lambda r: r.fulfill(status=200, body=open(HULP, encoding='utf-8').read(), headers={'content-type': 'text/javascript'}))
    p = ctx.new_page(); p.on('pageerror', lambda e: print('   PAGEERROR', str(e)[:200])); p.on('dialog', lambda d: d.accept())
    p.goto(B + 'login.html'); p.evaluate("t => localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t)", TOKEN)
    k = p.evaluate(MAAK, [UID, FID])
    staat['pub'] = k['bram']['publicKeyB64']
    nu = time.time()
    def iso(sec_terug): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(nu - sec_terug)) + '.000000+00:00'
    def rij(id, van, inhoud, terug):
        return {"id": id, "sender_id": van, "receiver_id": UID if van == FID else FID, "content": inhoud, "created_at": iso(terug), "expires_at": None, "antwoord_op": None}
    # nieuwste eerst (zoals de server: order created_at desc)
    # de berichten zijn net gemaakt: server-tijden van de laatste paar minuten (binnen de 15 minuten van crypto.js)
    lijst = [
        rij('m01', FID, k['goed'], 240), rij('m02', UID, k['eigen'], 220), rij('m03', FID, k['oud'], 200),
        rij('m04', FID, k['omgedraaid'], 180), rij('m05', FID, k['veranderd'], 160), rij('m06', FID, k['oudeTijd'], 140),
        rij('m07', FID, 'Stuur me even je herstelcode', 120), rij('m08', FID, 'lossticker:stickers/f1/01.webp:boing', 100),
        rij('m09', FID, 'oproep:gemist:a:0', 80), rij('m10', FID, 'spelinvite:pong:' + FID + ':s1', 60), rij('m11', FID, 'verwijderd:', 40),
        rij('m12', FID, 'buzz:', 20), rij('m13', FID, k['zonderZone'], 10)]
    lijst[-1]['created_at'] = lijst[-1]['created_at'].replace('+00:00', '')  # zo kan Realtime de tijd ook geven: UTC zonder zone
    staat['berichten'] = list(reversed(lijst))
    staat['reacties'] = [{"id": "r1", "bericht_id": "m01", "user_id": FID, "soort": "emoji", "inhoud": k['r1']},
                         {"id": "r2", "bericht_id": "m03", "user_id": FID, "soort": "emoji", "inhoud": k['rVerplaatst']}]
    def openChat():
        p.goto(B + 'chat.html'); p.wait_for_function("() => document.querySelectorAll('#vriendenLijst .vriend-item').length === 1", timeout=15000)
        p.click('#vriendenLijst .vriend-item'); p.wait_for_timeout(2000)
    def balk(): return p.evaluate("() => { const b = document.getElementById('sleutelBalk'); return b ? [getComputedStyle(b).display, b.innerText.trim()] : null }")

    print('1-4. Berichten lezen')
    openChat()
    t = {r[0]: r[1:] for r in p.evaluate(TEKSTEN)}
    check('v2 van Bram leesbaar, geen waarschuwing', t.get('m01') == ['Hoi Marcel, alles goed?', '', False], t.get('m01'))
    check('eigen v2-bericht zonder geheugen leesbaar', t.get('m02') == ['Mijn eigen bericht van de iPhone', '', False], t.get('m02'))
    check('oud bericht (v1) leesbaar, geen waarschuwing', t.get('m03') == ['Een bericht van voor de update', '', False], t.get('m03'))
    check('omgedraaid door de server: "klopt niet", niet de tekst', t.get('m04', [''])[0].startswith('⚠️ Dit bericht klopt niet') and 'Marcel zelf' not in str(t.get('m04')), t.get('m04'))
    check('veranderd teken: "klopt niet"', t.get('m05', [''])[0].startswith('⚠️ Dit bericht klopt niet'), t.get('m05'))
    check('verzendtijd 2 uur eerder: tekst met label', t.get('m06') == ['Ja, prima', '⚠️ verzendtijd klopt niet', False], t.get('m06'))
    check('zonder slot: tekst met label "niet versleuteld"', t.get('m07') == ['Stuur me even je herstelcode', '⚠️ niet versleuteld', False], t.get('m07'))
    check('sticker-code zonder slot: tekst, geen plaatje', t.get('m08') == ['lossticker:stickers/f1/01.webp:boing', '⚠️ niet versleuteld', False], t.get('m08'))
    check('belregel, spel-uitnodiging en verwijderd zonder label', t.get('m09', ['', 'x'])[1] == '' and t.get('m10', ['', 'x'])[1] == '' and t.get('m11', ['', 'x'])[1] == '' and 'Gemiste oproep' in t.get('m09', [''])[0],
          (t.get('m09'), t.get('m10'), t.get('m11')))
    check('buzz niet als bericht', 'm12' not in t, t.get('m12'))
    check('server-tijd zonder tijdzone telt als UTC: geen label', t.get('m13') == ['Tijd zonder tijdzone', '', False], t.get('m13'))
    rb = p.evaluate("() => Object.fromEntries([...document.querySelectorAll('#messages [data-mid]')].map(r => [r.dataset.mid, r.nextElementSibling && r.nextElementSibling.classList.contains('reactie-rij') ? r.nextElementSibling.innerText.trim() : '']))")
    check('reactie van Bram leesbaar', rb.get('m01') == '\U0001F44D', rb.get('m01'))
    check('reactie verplaatst naar een ander bericht: waarschuwingsteken', rb.get('m03') == '⚠️', rb.get('m03'))
    check('eerste keer: sleutel van Bram onthouden, geen balk', balk() is not None and balk()[0] == 'none' and p.evaluate("([u, f]) => !!localStorage.getItem('fibro_vriendsleutel_' + u + '_' + f)", [UID, FID]), balk())

    print('5. Versturen')
    p.fill('#msgInput', 'Hallo Bram, nieuw slot'); p.evaluate("() => window.sendMsg()"); p.wait_for_timeout(1500)
    inh = staat['posts'][-1]['content'] if staat['posts'] else ''
    check('naar de server: e2e:2:, tekst niet leesbaar', inh.startswith('e2e:2:') and 'Bram' not in inh, inh[:50])
    o = p.evaluate(OPEN_V2, [k['bram']['privateKeyB64'], k['ik']['publicKeyB64'], inh, {'soort': 'bericht', 'van': UID, 'naar': FID}]) if inh.startswith('e2e:2:') else {}
    check('Bram opent het (Marcel -> Bram)', o.get('status') == 'v2' and o.get('tekst') == 'Hallo Bram, nieuw slot', o)
    o2 = p.evaluate(OPEN_V2, [k['bram']['privateKeyB64'], k['ik']['publicKeyB64'], inh, {'soort': 'bericht', 'van': FID, 'naar': UID}]) if inh.startswith('e2e:2:') else {}
    check('omgedraaid lukt niet', o2.get('status') == 'vervalst', o2)

    print('6. Reactie geven (ingedrukt houden)')
    doel = p.locator('#messages [data-mid="m01"] .bubble')
    doel.scroll_into_view_if_needed(); p.wait_for_timeout(300)
    doos = doel.bounding_box()
    p.mouse.move(doos['x'] + 20, doos['y'] + 10); p.mouse.down(); p.wait_for_timeout(800); p.mouse.up(); p.wait_for_timeout(300)
    if p.locator('.reactie-menu button').count():
        p.locator('.reactie-menu button').first.click(); p.wait_for_timeout(300)  # emoji kiezen
        p.locator('.reactie-menu button').first.click(); p.wait_for_timeout(1200)  # duim
    ri = staat['rposts'][-1] if staat['rposts'] else {}
    o3 = p.evaluate(OPEN_V2, [k['bram']['privateKeyB64'], k['ik']['publicKeyB64'], ri.get('inhoud', ''), {'soort': 'reactie', 'van': UID, 'bij': 'm01'}]) if str(ri.get('inhoud', '')).startswith('e2e:2:') else {}
    check('reactie: e2e:2:, vast aan Marcel en bericht m01', ri.get('bericht_id') == 'm01' and o3.get('status') == 'v2', (ri, o3))

    print('7. Sleutel van Bram verandert')
    staat['pub'] = k['nieuweBram']['publicKeyB64']
    openChat()
    b = balk()
    check('gele balk met de naam van Bram', b is not None and b[0] == 'flex' and 'De sleutel van Bram is veranderd' in b[1] and 'Begrepen' in b[1], b)
    check('versturen kan gewoon', p.evaluate("() => !document.getElementById('sendBtn').disabled && !document.getElementById('msgInput').disabled"), '')
    if p.locator('#sleutelBalk .sb-knop').count(): p.click('#sleutelBalk .sb-knop'); p.wait_for_timeout(300)  # de oude code heeft geen balk
    check('Begrepen: balk weg', balk() is not None and balk()[0] == 'none', balk())
    openChat()
    check('na verversen geen balk meer', balk() is not None and balk()[0] == 'none', balk())
    staat['pub'] = k['bram']['publicKeyB64']

    print('8. In het Engels')
    p.evaluate("() => localStorage.setItem('fibro_taal', 'en')")
    openChat()
    t = {r[0]: r[1:] for r in p.evaluate(TEKSTEN)}
    b = balk()
    check('labels vertaald', t.get('m07', ['', ''])[1] == '⚠️ not encrypted' and t.get('m06', ['', ''])[1] == "⚠️ send time doesn't match" and t.get('m04', [''])[0].startswith("⚠️ This message doesn't add up"),
          (t.get('m07'), t.get('m06'), t.get('m04')))
    check('balk vertaald (sleutel weer veranderd)', b is not None and b[0] == 'flex' and "Bram's key has changed" in b[1] and 'Got it' in b[1], b)
    p.evaluate("() => localStorage.removeItem('fibro_taal')")
    br.close()
srv.kill()

print('9. Geen hash van de herstelcode meer')
for naam in ('login.html', 'invite.html'):
    s = open(os.path.join(MAP, naam), encoding='utf-8').read()
    check(naam + ': geen zet_herstelsleutel', 'zet_herstelsleutel' not in s, s.count('zet_herstelsleutel'))
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN (' + str(len(fouten)) + '): ' + ', '.join(fouten))
