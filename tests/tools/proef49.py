# proef49: videobellen (v150) met de echte bellen.html + bellen.js tussen twee pagina's (Bram belt, Lotte neemt op).
# - camera in HD (1280x720) i.p.v. de standaard 640x480
# - geen (vrije) camera: verder met alleen geluid + melding (NL/EN), geen leeg eigen-beeldvakje, en je ziet de ander wel
# - beeld van de ander: andersom (rechtop beeld op breed scherm of omgekeerd) = heel beeld (contain), anders vullen (cover)
# - microfoon helemaal geweigerd: zoals vroeger de melding en geen gesprek
# Nep: Supabase (inlogpas, profielen, gesprekskanaal via BroadcastChannel), lijntjes.js; de functie voor de
# postbode geeft 503 (bellen gaat dan rechtstreeks). Camera: Chromium nep-camera (liggend), of een rechtop
# canvas-camera (480x640), of geen camera. Oude map als controle: daar moet een deel MIS geven.
# python3 -I proef49.py <map>
import sys, os, time, json
from playwright.sync_api import sync_playwright
MAP = sys.argv[1]
A = 'aaaaaaaa-0000-4000-8000-00000000000a'  # Bram
B = 'bbbbbbbb-0000-4000-8000-00000000000b'  # Lotte
NAMEN = {A: 'Bram', B: 'Lotte'}
NEP_SUPA = r'''
const ik = Math.random().toString(36).slice(2)
const bc = new BroadcastChannel('nep-realtime')
const kanalen = new Set()
bc.onmessage = (e) => {
  const m = e.data; if (m.van === ik) return
  for (const k of kanalen) if (k.naam === m.naam && k.ingeschreven)
    for (const [ev, cb] of k.luisteraars) if (ev === m.event) setTimeout(() => cb({ type: 'broadcast', event: m.event, payload: m.payload }), 0)
}
function channel(naam) {
  return { topic: 'realtime:' + naam, naam, luisteraars: [], ingeschreven: false,
    on(t, f, cb) { this.luisteraars.push([f.event, cb]); return this },
    subscribe(cb) { kanalen.add(this); setTimeout(() => { this.ingeschreven = true; cb && cb('SUBSCRIBED') }, 200); return this },
    async send(m) { bc.postMessage({ van: ik, naam, event: m.event, payload: JSON.parse(JSON.stringify(m.payload)) }); return 'ok' } }
}
function vraag() {
  const v = { data: null, error: null }
  const p = new Proxy(function () {}, {
    get(t, k) { if (k === 'then') return (ok, nee) => Promise.resolve(window.__PROFIEL ? { data: window.__PROFIEL, error: null } : v).then(ok, nee); return () => p },
    apply() { return p } })
  return p
}
export const supabase = { channel, from: vraag, rpc: vraag,
  async removeChannel(k) { kanalen.delete(k); k.ingeschreven = false; return 'ok' },
  getChannels() { return [...kanalen] },
  auth: { async getSession() { const id = window.__UID; return { data: { session: id ? { user: { id }, access_token: 'tok-' + id } : null } } },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } } } }
'''
NEP_LIJN = "export function houOpen(naam, maak) { const k = maak(); k.subscribe(); return { stop() { k.ingeschreven = false } } }\n"
GEEN_CAMERA = r'''(() => { const md = navigator.mediaDevices; const echt = md.getUserMedia.bind(md); const lijst = md.enumerateDevices.bind(md)
  md.getUserMedia = async (c) => { if (c && c.video) throw new DOMException('Requested device not found', 'NotFoundError'); return echt(c) }
  md.enumerateDevices = async () => (await lijst()).filter(d => d.kind !== 'videoinput') })()'''
STAANDE_CAMERA = r'''(() => { const md = navigator.mediaDevices; const echt = md.getUserMedia.bind(md)
  md.getUserMedia = async (c) => { if (!c || !c.video) return echt(c)
    const s = c.audio ? await echt({ audio: c.audio }) : new MediaStream()
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 640; const g = cv.getContext('2d'); let i = 0
    setInterval(() => { g.fillStyle = 'hsl(' + (i++ % 360) + ',70%,50%)'; g.fillRect(0, 0, 480, 640) }, 33)
    s.addTrack(cv.captureStream(30).getVideoTracks()[0]); return s } })()'''
GEEN_MICROFOON = r'''(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError') } })()'''
INIT = ('const O = window.RTCPeerConnection; window.__pcs = []; window.RTCPeerConnection = class extends O { constructor(...a) { super(...a); window.__pcs.push(this) } };'
        ' window.__meldingen = []; new MutationObserver(l => { for (const r of l) for (const n of r.addedNodes) if (n.nodeType === 1 && n.parentNode === document.body && n.tagName === "DIV")'
        ' window.__meldingen.push(n.textContent) }).observe(document, { childList: true, subtree: true })')

def route(r):
    p = r.request.url.split('fibro.test/Fibro/')[1]
    if p.startswith('supabase.js'): return r.fulfill(body=NEP_SUPA, content_type='text/javascript')
    if p.startswith('lijntjes.js'): return r.fulfill(body=NEP_LIJN, content_type='text/javascript')
    f = os.path.join(MAP, p.split('?')[0])
    if os.path.isfile(f):
        soort = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json'}
        return r.fulfill(path=f, content_type=soort.get(os.path.splitext(f)[1]))
    return r.fulfill(status=404, body='')

uitslag = []
def check(naam, ok, info=''):
    uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:170] if info != '' else ''))

MELDING_NL = 'Geen camera beschikbaar: je belt met alleen geluid.'
MELDING_EN = "No camera available: you're calling with sound only."
METING = r'''async () => {
  const lok = document.getElementById('lokaalMedia'), rem = document.getElementById('remoteMedia')
  const lt = lok.srcObject && lok.srcObject.getVideoTracks ? lok.srcObject.getVideoTracks()[0] : null
  let videoIn = 0, geluidIn = 0
  for (const pc of window.__pcs) { if (pc.connectionState === 'closed') continue
    (await pc.getStats()).forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') videoIn += x.framesDecoded || 0
                                         if (x.type === 'inbound-rtp' && x.kind === 'audio') geluidIn += x.packetsReceived || 0 }) }
  const tekst = window.__meldingen.filter(t => /camera/i.test(t))
  let uit = ''
  for (const pc of window.__pcs) { if (pc.connectionState === 'closed') continue
    (await pc.getStats()).forEach(x => { if (x.type === 'outbound-rtp' && x.kind === 'video') uit = (x.frameWidth || 0) + 'x' + (x.frameHeight || 0) + ' ' + x.qualityLimitationReason }) }
  return { status: document.getElementById('status').textContent, camera: lt ? lt.getSettings().width + 'x' + lt.getSettings().height : null,
    eigenVak: lok.style.display, camKnop: document.getElementById('camBtn').textContent, videoIn, geluidIn,
    beeld: rem.videoWidth + 'x' + rem.videoHeight, verstuurd: uit, passen: rem.style.objectFit || getComputedStyle(rem).objectFit, meldingen: tekst } }'''

with sync_playwright() as pw:
    env = {k: v for k, v in os.environ.items() if 'proxy' not in k.lower()}
    br = pw.chromium.launch(args=['--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
                                  '--autoplay-policy=no-user-gesture-required'], env=env)
    def gesprek(video=True, camA=None, camB=None, schermA=(1280, 720), schermB=(1280, 720), taal='nl', wacht=8):
        ctx = br.new_context(permissions=['microphone', 'camera'])
        ctx.route('https://fibro.test/**', route)
        ctx.route('https://qmgatbphiplrfxrljtbe.supabase.co/functions/v1/get-turn-credentials',
                  lambda r: r.fulfill(status=503, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey'}, body='{}'))
        ctx.add_init_script(INIT)
        p = {}; dialogen = []
        for wie, uid, cam, scherm in (('A', A, camA, schermA), ('B', B, camB, schermB)):
            pg = ctx.new_page(); pg.set_viewport_size({'width': scherm[0], 'height': scherm[1]})
            pg.on('dialog', lambda d, w=wie: (dialogen.append(w + ': ' + d.message), d.dismiss()))
            pg.add_init_script('window.__UID = %s; window.__PROFIEL = { username: %s, avatar_url: "🙂" }%s' % (
                json.dumps(uid), json.dumps(NAMEN[B if uid == A else A]), ("; try { localStorage.setItem('fibro_taal', '%s') } catch (e) {}" % taal) if taal else ''))
            if cam: pg.add_init_script(cam)
            p[wie] = pg
        p['A'].goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Lotte' % B)
        p['A'].wait_for_function('typeof window.startBellen === "function"', timeout=15000)
        p['A'].evaluate('(v) => window.startBellen(v)', video)
        time.sleep(1.5)
        p['B'].goto('https://fibro.test/Fibro/bellen.html?vriend=%s&naam=Bram&inkomend=1&opnemen=1%s' % (A, '&video=1' if video else ''))
        t0 = time.time()
        while time.time() - t0 < 25:
            if all(p[w].evaluate('document.getElementById("status").textContent') in ('Verbonden', 'Connected') for w in 'AB'): break
            time.sleep(0.3)
        time.sleep(wacht)
        m = {w: p[w].evaluate(METING) for w in 'AB'}
        m['dialogen'] = dialogen
        ctx.close()
        return m
    verbonden = lambda m: all(m[w]['status'] in ('Verbonden', 'Connected') for w in 'AB')

    m = gesprek()
    check('videogesprek, beide een camera: verbonden', verbonden(m), (m['A']['status'], m['B']['status']))
    check('camera in HD (1280x720) aan beide kanten', m['A']['camera'] == '1280x720' and m['B']['camera'] == '1280x720', (m['A']['camera'], m['B']['camera']))
    check('beeld komt aan, liggend op breed scherm: vullen (cover)', m['A']['videoIn'] > 50 and m['B']['videoIn'] > 50 and m['B']['passen'] == 'cover', (m['A']['videoIn'], m['B']['videoIn'], m['B']['beeld'], m['B']['passen'], 'verstuurd ' + m['A']['verstuurd']))
    check('geen melding over de camera', not m['A']['meldingen'] and not m['B']['meldingen'], m['A']['meldingen'] + m['B']['meldingen'])

    m = gesprek(camA=GEEN_CAMERA)
    check('beller zonder camera: gesprek gaat door', verbonden(m) and not m['dialogen'], (m['A']['status'], m['dialogen']))
    check('beller zonder camera: melding in beeld', MELDING_NL in m['A']['meldingen'], m['A']['meldingen'])
    check('beller zonder camera: ziet de ander wel (video komt binnen), geluid beide kanten', m['A']['videoIn'] > 50 and m['A']['geluidIn'] > 50 and m['B']['geluidIn'] > 50, (m['A']['videoIn'], m['A']['geluidIn'], m['B']['geluidIn']))
    check('beller zonder camera: geen leeg eigen-beeldvakje, cameraknop uit', m['A']['eigenVak'] == 'none' and m['A']['camKnop'] == '🚫', (m['A']['eigenVak'], m['A']['camKnop']))

    m = gesprek(camB=GEEN_CAMERA)
    check('opnemer zonder camera: gesprek gaat door, melding bij de opnemer', verbonden(m) and MELDING_NL in m['B']['meldingen'] and not m['dialogen'], (m['B']['status'], m['B']['meldingen'], m['dialogen']))
    check('opnemer zonder camera: ziet de beller wel', m['B']['videoIn'] > 50 and m['A']['geluidIn'] > 50, (m['B']['videoIn'], m['A']['geluidIn']))

    m = gesprek(camA=GEEN_CAMERA, camB=GEEN_CAMERA)
    check('allebei zonder camera: gesprek met alleen geluid', verbonden(m) and m['A']['geluidIn'] > 50 and m['B']['geluidIn'] > 50, (m['A']['status'], m['B']['status']))

    m = gesprek(video=False, camA=GEEN_CAMERA, camB=GEEN_CAMERA)
    check('gewoon bellen (geluid) zonder camera: verbonden, geen melding', verbonden(m) and not m['A']['meldingen'] and not m['B']['meldingen'], (m['A']['meldingen'], m['B']['meldingen']))

    m = gesprek(camA=GEEN_CAMERA, taal='en')
    check('melding in het Engels', MELDING_EN in m['A']['meldingen'], m['A']['meldingen'])

    m = gesprek(schermB=(390, 844))
    check('liggend beeld op een rechtop telefoon: heel beeld (contain)', m['B']['passen'] == 'contain' and m['B']['videoIn'] > 50, (m['B']['beeld'], m['B']['passen']))
    m = gesprek(camA=STAANDE_CAMERA)
    check('rechtop telefoonbeeld op een breed scherm: heel beeld (contain)', m['B']['passen'] == 'contain' and int(m['B']['beeld'].split('x')[1]) > int(m['B']['beeld'].split('x')[0]), (m['B']['beeld'], m['B']['passen']))
    m = gesprek(camA=STAANDE_CAMERA, schermB=(390, 844))
    check('rechtop beeld op een rechtop telefoon: vullen (cover)', m['B']['passen'] == 'cover', (m['B']['beeld'], m['B']['passen']))

    m = gesprek(camA=GEEN_MICROFOON, wacht=1)
    check('microfoon geweigerd: melding zoals vroeger, geen gesprek', any('Geen toegang tot microfoon/camera' in d for d in m['dialogen']) and m['A']['status'] != 'Verbonden', (m['dialogen'], m['A']['status']))
    br.close()
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
