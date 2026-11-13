# proef299 (13 nov 2026): Koningsjacht, alleen tegen het kasteel, met de perkamentkaarten op een houten tafel.
# Speelt echt in spel.html op een telefoonscherm.
#  A. beginscherm: drie niveaus, spelregels, vermelding van Regicide; tafel = hout + perkament (geen knop 🎴)
#  B. een nieuw spel: 8 kaarten in je hand, de eerste vijand is een boer met 20 leven, 11 in het kasteel
#  C. ♣ klaveren = dubbele schade; daarna slaat de vijand terug en weer je af
#  D. ♠ schoppen (vegen) = een schild: de vijand slaat minder hard
#  E. precies op nul = verslagen, de vijand ligt bovenop de taveerne en een nieuwe vijand komt (slaat niet terug)
#  F. ♦ ruiten = kaarten pakken (de verslagen boer komt in je hand) en een boer in je hand weert 10 af
#  G. passen (niet twee keer achter elkaar) en een nar (hand weg, 8 nieuwe kaarten)
#  H. het spel wordt bewaard: na herladen "Verder spelen"
#  I. verliezen (kan niet afweren) en winnen (medaille op het beginscherm)
#  J. in het Engels: King Hunt; geen paginafouten
#  K. v2 (13 nov 2026): na een tik staat het geluid open (iPhone); epische muziek aan/uit (🎵, bewaard), en bij een aanval licht: gloeiende kaarten, een zwaardhaal,
#     vonken; ♣ = twee halen; de vijand slaat terug met drie klauwhalen; geluiden via koningsjacht-geluid.js
# python3 -I proef299.py <map>
import sys, os, time, socket, subprocess, tempfile, re
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
fout = []
def check(ok, wat):
    print(('OK   ' if ok else 'FOUT ') + wat)
    if not ok: fout.append(wat)

www = tempfile.mkdtemp(prefix='proef299_'); os.symlink(MAP, os.path.join(www, 'Fibro'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); poort = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
fouten = []
HAND = "() => [...document.querySelectorAll('.kt-hand .kt-kaart')].map(k => k.dataset.id).sort()"
RUST = "!document.querySelector('.kt-laag .kt-vlieg')"
KLAAR = "() => (!!document.querySelector('.kt-einde') || !!document.querySelector('.kt-tafel.kt-mijnbeurt')) && " + RUST
LEVEN = "() => document.querySelector('.kj-balk span').textContent"
KNOP = "n => !!document.querySelector('.kt-knop[data-naam=' + n + ']')"
INFO = "() => document.querySelector('.kt-info').textContent"
STATUS = "() => document.querySelector('.kt-status').textContent"

# Een stand maken (met koningsjacht.js in de pagina zelf) en bewaren, zodat "Verder spelen" hem opent
ZET = """async o => {
  const K = await import('./koningsjacht.js?v=1')
  const s = K.nieuwSpel({ niveau: o.niveau || 'schildknaap' })
  const alle = [...s.kasteel, ...s.taveerne, ...s.hand]
  const hoofd = id => ['B', 'V', 'H'].includes(id.slice(1))
  const vast = [...o.kasteel, ...o.hand, ...(o.afleg || [])]
  const restHoofden = alle.filter(id => hoofd(id) && !vast.includes(id))
  s.kasteel = o.kasteel.concat(o.restNaar === 'afleg' ? [] : restHoofden)
  s.afleg = (o.afleg || []).concat(o.restNaar === 'afleg' ? restHoofden : [])
  s.hand = o.hand.slice(); s.tafel = []
  s.taveerne = alle.filter(id => !hoofd(id) && !vast.includes(id))
  Object.assign(s, { schade: o.schade || 0, schild: o.schild || 0, narren: o.narren ?? 4, verslagen: o.verslagen || 0 })
  if (!K.geldigeStand(s)) throw new Error('stand klopt niet')
  localStorage.setItem('fibro_koningsjacht_stand', JSON.stringify(s))
}"""

def wacht(pg, js, ms=15000, arg=None):
    try: pg.wait_for_function(js, arg=arg, timeout=ms); return True
    except Exception: return False
def midden(pg, sel):
    return pg.eval_on_selector(sel, """e => { const r = e.getBoundingClientRect()
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) for (let fx = 0.08; fx < 0.95; fx += 0.08) {
            const x = r.left + r.width * fx, y = r.top + r.height * fy, raak = document.elementFromPoint(x, y)
            if (raak && (raak === e || e.contains(raak))) return [x, y] }
        return [r.left + r.width / 2, r.top + r.height / 2] }""")
def kaart(id): return '.kt-hand .kt-kaart[data-id="%s"]' % id
def kies(pg, *ids):
    for id in ids:
        x, y = midden(pg, kaart(id)); pg.mouse.click(x, y); time.sleep(0.15)
def veeg(pg, id):
    x, y = midden(pg, kaart(id))
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, 9): pg.mouse.move(x, y - 26 * i); time.sleep(0.012)
    pg.mouse.up()
def knop(pg, naam): pg.click('.kt-knop[data-naam=%s]' % naam)

def nieuwe_pagina(ctx, taal='nl'):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: fouten.append((str(e) + ' ' + str(getattr(e, 'stack', '') or ''))[:400])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto(BASIS + 'manifest.json')
    pg.evaluate("t => { localStorage.setItem('fibro_taal', t) }", taal)
    return pg
def open_spel(pg):
    pg.goto(BASIS + 'spel.html?spel=koningsjacht&titel=1')
    pg.wait_for_selector('.kj-start', timeout=10000)
def verder(pg, stand):
    pg.evaluate(ZET, stand)
    open_spel(pg)
    pg.click('.kj-verder')
    return wacht(pg, KLAAR)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-proxy-server'])
        ctx = b.new_context(service_workers='block', locale='nl-NL', viewport={'width': 390, 'height': 844}, has_touch=True, reduced_motion='reduce')
        ctx.route('**/*supabase.co/**', lambda r: r.fulfill(status=200, json=[]))
        ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.fulfill(status=204, body=''))

        # ════════ A. beginscherm ════════
        pg = nieuwe_pagina(ctx)
        open_spel(pg)
        check(pg.evaluate("() => [...document.querySelectorAll('.kj-niveau')].map(b => b.dataset.niveau).join()") == 'schildknaap,ridder,koning', 'A: drie niveaus')
        check('Regicide' in pg.text_content('.kj-bron') and 'Badgers From Mars' in pg.text_content('.kj-bron'), 'A: vermelding van Regicide (Badgers From Mars)')
        check(pg.evaluate("() => document.querySelectorAll('.kj-kaarten .kt-pk-hoek').length") == 3, 'A: perkamentkaarten met scherpe hoekjes op het beginscherm')
        check(not pg.query_selector('.kj-verder'), 'A: nog geen "Verder spelen"')
        pg.click('.kj-regelknop')
        check(pg.is_visible('.kj-regelkaart') and '♣ klaveren: dubbele schade' in pg.text_content('.kj-regelkaart'), 'A: de spelregels openen')
        pg.click('.kj-regelkaart .kj-knop')
        check(not pg.query_selector('.kj-regels'), 'A: en gaan weer dicht')
        check(pg.evaluate("() => import('./koningsjacht-geluid.js?v=2').then(m => m.geluidStaat())") == 'running', 'K: na een tik staat het geluid open (nodig op de iPhone)')
        check(pg.get_attribute('.kj-muziek', 'aria-pressed') == 'false', 'K: de muziek staat eerst uit')
        pg.click('.kj-muziek')
        check(pg.get_attribute('.kj-muziek', 'aria-pressed') == 'true' and pg.evaluate("() => localStorage.getItem('fibro_koningsjacht_muziek')") == 'aan'
              and pg.evaluate("() => import('./koningsjacht-geluid.js?v=2').then(m => m.speeltMuziek())"), 'K: 🎵 = epische muziek aan (en onthouden)')

        # ════════ B. een nieuw spel ════════
        pg.click('.kj-niveau[data-niveau=schildknaap]')
        check(wacht(pg, KLAAR), 'B: na het delen ben jij aan de beurt')
        check(pg.evaluate("() => { const t = document.querySelector('.kt-tafel'); return t.classList.contains('kt-hout') && t.classList.contains('kj') && getComputedStyle(t).backgroundImage.includes('hout.webp') }"), 'B: houten tafelblad')
        check(not pg.query_selector('.kt-stijlknop'), 'B: geen knop 🎴 (de kaarten zijn altijd perkament)')
        check(pg.evaluate("() => [...document.querySelectorAll('.kt-hand .kt-kaart')].every(k => k.querySelector('.kt-pk img[src*=\"kaarten/perkament/\"]'))"), 'B: alle kaarten in je hand zijn perkament')
        check(len(pg.evaluate(HAND)) == 8, 'B: 8 kaarten in je hand')
        vijand = pg.evaluate("() => document.querySelector('.kj-kaart').dataset.id")
        check(vijand[1:] == 'B' and pg.evaluate(LEVEN) == '❤ 20 / 20', 'B: de eerste vijand is een boer met 20 leven (%s, %s)' % (vijand, pg.evaluate(LEVEN)))
        check('11' in pg.text_content('.kj-kasteel span'), 'B: nog 11 in het kasteel')
        check(pg.evaluate("() => getComputedStyle(document.querySelector('.kj-kaart .kt-pk-hoek')).position") == 'absolute', 'B: de vijand heeft ook het scherpe hoekje')
        check(pg.evaluate("() => !!JSON.parse(localStorage.getItem('fibro_koningsjacht_stand'))"), 'B: het spel staat bewaard')

        # ════════ C t/m F: een vaste stand ════════
        ok = verder(pg, { 'kasteel': ['hB', 'kB'], 'hand': ['k6', 'k9', 'hA', 's7', 'h3', 'h2', 'r5', 'sA'] })
        check(ok and pg.evaluate("() => document.querySelector('.kj-kaart').dataset.id") == 'hB', 'C: verder spelen tegen de boer van harten')
        pg.evaluate("""() => { window.__fx = { haal: 0, vonk: 0, licht: 0, gloeit: 0 }; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList) {
            if (n.classList.contains('kj-haal')) window.__fx.haal++; if (n.classList.contains('kj-vonk')) window.__fx.vonk++; if (n.classList.contains('kj-licht')) window.__fx.licht++ }
            for (const m of ms) if (m.type === 'attributes' && m.target.classList.contains('kj-gloeit')) window.__fx.gloeit++ }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }) }""")
        kies(pg, 'k6')
        check('12 schade' in pg.evaluate(STATUS), 'C: de uitleg zegt 12 schade (%s)' % pg.evaluate(STATUS))
        knop(pg, 'aanval')
        check(wacht(pg, KLAAR) and pg.evaluate(LEVEN) == '❤ 8 / 20', 'C: ♣ klaveren doet dubbele schade (%s)' % pg.evaluate(LEVEN))
        check(pg.evaluate(KNOP, 'afweer') and 'Weer 10 af' in pg.evaluate(STATUS), 'C: de boer slaat terug met 10')
        fx = pg.evaluate('window.__fx')
        check(fx['gloeit'] >= 1 and fx['vonk'] >= 5 and fx['licht'] >= 2, 'K: aanval met licht: gloeiende kaart, vonken en lichtflitsen (%s)' % fx)
        check(fx['haal'] >= 5, 'K: ♣ twee zwaardhalen plus drie klauwhalen van de vijand (%s)' % fx)
        check(not pg.query_selector('.kj-fx > *'), 'K: na afloop is al het licht weer weg')
        check(pg.evaluate(KNOP, 'muziek') and 'kt-nadruk' in pg.get_attribute('.kt-knop[data-naam=muziek]', 'class'), 'K: knop 🎵 op tafel, licht op want de muziek staat aan')
        knop(pg, 'muziek')
        check(pg.evaluate("() => localStorage.getItem('fibro_koningsjacht_muziek')") == 'uit' and not pg.evaluate("() => import('./koningsjacht-geluid.js?v=2').then(m => m.speeltMuziek())"), 'K: 🎵 op tafel = muziek uit')
        kies(pg, 'k9')
        knop(pg, 'afweer'); time.sleep(0.3)
        check(pg.evaluate(KNOP, 'afweer') and 'k9' in pg.evaluate(HAND), 'C: 9 is te weinig, de kaart blijft in je hand')
        kies(pg, 'hA')
        check('Afweren 10/10' in pg.text_content('.kt-knop[data-naam=afweer]'), 'C: de knop telt mee (10/10)')
        knop(pg, 'afweer')
        check(wacht(pg, KLAAR) and pg.evaluate(KNOP, 'aanval') and 'k9' not in pg.evaluate(HAND) and '🗑️ 2' in pg.evaluate(INFO), 'C: afgeweerd, 2 kaarten op de aflegstapel')

        veeg(pg, 's7')
        check(wacht(pg, KLAAR) and pg.evaluate(LEVEN) == '❤ 1 / 20', 'D: veeg ♠7 omhoog: 7 schade')
        check(pg.evaluate("() => document.querySelector('.kj-regel').textContent").startswith('⚔️ 3') and '🛡️ 7' in pg.text_content('.kj-regel'), 'D: schild 7, de boer slaat nog maar met 3')
        kies(pg, 'h3'); knop(pg, 'afweer')
        check(wacht(pg, KLAAR) and pg.evaluate(KNOP, 'aanval'), 'D: afgeweerd met 3')

        kies(pg, 'sA'); knop(pg, 'aanval')
        check(wacht(pg, KLAAR) and pg.evaluate("() => document.querySelector('.kj-kaart').dataset.id") == 'kB', 'E: precies op nul: verslagen, de boer van klaveren is de nieuwe vijand')
        check(pg.evaluate(KNOP, 'aanval') and '👑 1/12' in pg.evaluate(INFO), 'E: de nieuwe vijand slaat niet terug; 1 van 12 verslagen')
        kies(pg, 'r5')
        check('pak 5' in pg.evaluate(STATUS), 'F: de uitleg zegt pak 5')
        knop(pg, 'aanval')
        hand = pg.evaluate(HAND) if wacht(pg, KLAAR) else []
        check(len(hand) == 6 and 'hB' in hand and pg.evaluate(LEVEN) == '❤ 15 / 20', 'F: ♦ ruiten: 5 kaarten gepakt, de verslagen boer zit erbij (%s)' % hand)
        kies(pg, 'hB'); knop(pg, 'afweer')
        check(wacht(pg, KLAAR) and pg.evaluate(KNOP, 'aanval') and 'hB' not in pg.evaluate(HAND), 'F: een boer in je hand weert 10 af')

        # ════════ G. passen en een nar ════════
        knop(pg, 'pas')
        check(wacht(pg, KLAAR) and pg.evaluate(KNOP, 'afweer'), 'G: passen: de vijand slaat meteen terug')
        knop(pg, 'nar'); time.sleep(0.2)
        if pg.query_selector('.kt-keuze'): pg.click('.kt-keuzerij button >> nth=0')   # kun je al afweren, dan vraagt het eerst
        check(wacht(pg, KLAAR) and len(pg.evaluate(HAND)) == 8 and '🃏 3' in pg.evaluate(INFO), 'G: een nar: 8 nieuwe kaarten, nog 3 narren')
        waarde = lambda id: 1 if id[1:] == 'A' else int(id[1:])
        som, gekozen = 0, []
        for id in sorted(pg.evaluate(HAND), key=lambda id: -waarde(id)):
            if som >= 10: break
            gekozen.append(id); som += waarde(id)
        kies(pg, *gekozen); knop(pg, 'afweer')
        check(wacht(pg, KLAAR) and pg.evaluate(KNOP, 'aanval'), 'G: na de nar toch afgeweerd')
        check(pg.evaluate("() => document.querySelector('.kt-knop[data-naam=pas]').disabled") is True, 'G: niet twee keer achter elkaar passen')
        knop(pg, 'nar')
        check(pg.is_visible('.kt-keuze') and 'Nar inzetten?' in pg.text_content('.kt-keuze'), 'G: een nar bij het aanvallen vraagt het eerst')
        pg.click('.kt-keuzerij button >> nth=1')
        check(not pg.query_selector('.kt-keuze') and '🃏 3' in pg.evaluate(INFO), 'G: Nee = geen nar gebruikt')

        # ════════ H. bewaard ════════
        open_spel(pg)
        check(pg.is_visible('.kj-verder') and 'Schildknaap' in pg.text_content('.kj-verder'), 'H: na herladen: "Verder spelen (Schildknaap, ...)"')

        # ════════ I. verliezen en winnen ════════
        verder(pg, { 'kasteel': ['hH'], 'hand': ['s2', 'k3'], 'narren': 0, 'niveau': 'koning' })
        kies(pg, 'k3'); knop(pg, 'aanval')
        check(wacht(pg, "() => !!document.querySelector('.kt-einde')"), 'I: kan 20 niet afweren en geen nar: einde')
        check('heer van harten' in pg.text_content('.kt-eindetitel'), 'I: "Verslagen door de heer van harten" (%s)' % pg.text_content('.kt-eindetitel'))
        check(pg.evaluate("() => localStorage.getItem('fibro_koningsjacht_stand')") is None, 'I: een afgelopen spel wordt niet bewaard')
        pg.click('.kt-opnieuw')
        check(wacht(pg, "() => !!document.querySelector('.kj-start')"), 'I: Opnieuw spelen = terug naar het beginscherm')
        verder(pg, { 'kasteel': ['sH'], 'restNaar': 'afleg', 'hand': ['k2', 'h9'], 'schade': 37, 'narren': 0, 'niveau': 'koning', 'verslagen': 11 })
        kies(pg, 'k2'); knop(pg, 'aanval')
        check(wacht(pg, "() => !!document.querySelector('.kt-einde')") and 'kasteel is van jou' in pg.text_content('.kt-eindetitel'), 'I: de laatste heer verslagen: gewonnen')
        check('goud' in pg.text_content('.kt-eindesub'), 'I: zonder nar = gouden medaille (%s)' % pg.text_content('.kt-eindesub'))
        pg.click('.kt-opnieuw'); pg.wait_for_selector('.kj-start')
        check('🥇' in pg.text_content('.kj-niveau[data-niveau=koning]'), 'I: de medaille staat bij Koning op het beginscherm')
        pg.close()

        # ════════ J. Engels ════════
        pg = nieuwe_pagina(ctx, 'en')
        open_spel(pg)
        check(pg.text_content('.kj-titel') == 'King Hunt' and 'Squire' in pg.text_content('.kj-niveaus'), 'J: in het Engels: King Hunt, Squire')
        pg.click('.kj-niveau[data-niveau=ridder]')
        wacht(pg, KLAAR)
        check(' of ' in pg.text_content('.kj-naam') and 'Jack' in pg.text_content('.kj-naam'), 'J: de vijand heet "Jack of ..." (%s)' % pg.text_content('.kj-naam'))
        pg.close()
        check(not fouten, 'J: geen paginafouten %s' % fouten[:3])
        b.close()
except Exception as e:
    check(False, 'proef afgebroken: ' + str(e).split('\n')[0])
finally:
    srv.terminate()
print('\n%d fout(en)' % len(fout))
sys.exit(1 if fout else 0)
