# proef71: de oude emoji-stickers weg uit Profiel (v173), met de echte profiel.html.
# Op het toestel staat een oud profiel met emoji-stickers en de widget 'Sticker board'. Profiel -> Stickers (echte
# klik): geen Actieve stickers, Natuur & Planten, Sfeer & Magie, Muziek & Kunst, Dieren meer; wel nog je eigen
# chatstickers (Stickerlab) en de stickervellen van Fibro. Widgets (echte klik): geen Sticker board meer, de andere
# widgets nog wel. Opslaan (echte klik): op het toestel geen 'stickers' en geen 'stickerboard' meer; de andere widgets
# blijven; naar de server gaat gewoon de rij. De Mood-stickerkeuze werkt nog. Geen fouten.
# Oude map als controle: daar staan de emoji-vakken er nog (bijna alles MIS).
# python3 -I proef71.py <map>
import sys, os, time, json, socket, subprocess, tempfile, shutil
from playwright.sync_api import sync_playwright
MAP = os.path.abspath(sys.argv[1])
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
uitslag = []
def check(naam, ok, info=''):
    ok = bool(ok); uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + str(info)[:240] if info != '' else ''))
staat = {'ik': {"id": UID, "username": "marcel", "mood": "\U0001F60A Blij", "offline_emoji": "\U0001F60A", "offline_bericht": "Blij", "toon_online": True}, 'patch': []}
def supa(route):
    u = route.request.url; m = route.request.method
    obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
    if '/rest/v1/profiles' in u and m in ('PATCH', 'POST'):
        try: staat['patch'].append(json.loads(route.request.post_data or '{}'))
        except Exception: pass
        return route.fulfill(status=200, json=[])
    if '/rest/v1/profiles' in u and m == 'GET':
        e = staat['ik']; return route.fulfill(status=200, json=e if obj else [e])
    if '/functions/v1/' in u: return route.fulfill(status=200, json={})
    return route.fulfill(status=200, json=[])
OUD_PROFIEL = {"naam": "marcel", "bio": "", "mood": "Blij", "avatar": "\U0001F60A", "widgets": ["gastenboek", "mood", "stickerboard", "muziek"], "stickers": ["\U0001F33F", "\U0001F3B5", "\U0001F98A"]}
OUDE_KOPPEN = ['Actieve stickers', 'Natuur & Planten', 'Sfeer & Magie', 'Muziek & Kunst', 'Dieren']
www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
with sync_playwright() as pw:
    s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    BASIS = 'http://127.0.0.1:%d/Fibro/' % poort
    br = pw.chromium.launch(args=['--no-proxy-server'])
    ctx = br.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    ctx.route('**/*supabase.co/**', supa); ctx.route_web_socket('**/realtime/v1/websocket**', lambda w: None)
    p = ctx.new_page(); fouten = []; p.on('pageerror', lambda e: fouten.append(str(e)[:200])); p.on('dialog', lambda d: d.dismiss())
    def ev(js, arg=None):
        try: return p.evaluate(js, arg) if arg is not None else p.evaluate(js)
        except Exception as e: return 'FOUT: ' + str(e)[:100]
    p.goto(BASIS + 'manifest.json')
    ev("([t, u, pr]) => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_taal', 'nl'); localStorage.setItem('fibro_profiel_' + u, JSON.stringify(pr)) }", [TOKEN, UID, OUD_PROFIEL])
    p.goto(BASIS + 'profiel.html'); p.wait_for_timeout(2500)
    # Profiel -> Stickers
    try: p.click('.main-tab:has-text("Stickers")', timeout=3000)
    except Exception as e: print('   tabblad Stickers:', str(e)[:80])
    p.wait_for_timeout(800)
    paneel = ev("""() => { const p = document.getElementById('panel-stickers'); if (!p) return null
      return { zichtbaar: getComputedStyle(p).display !== 'none', koppen: [...p.querySelectorAll('.section-label')].map(k => k.textContent.trim()),
               emoji: p.querySelectorAll('.sticker-item, .sticker-galerij').length, eigen: (document.getElementById('eigenStickers') || {}).childElementCount || 0,
               vellen: [...p.querySelectorAll('#fibroStickers .sw-sectie')].map(s => s.dataset.vel) } }""")
    ok = isinstance(paneel, dict)
    check('Stickers (echte klik): het tabblad opent', ok and paneel['zichtbaar'], paneel)
    check('geen emoji-vakken meer (Actieve stickers, Natuur & Planten, Sfeer & Magie, Muziek & Kunst, Dieren)', ok and not any(k in paneel['koppen'] for k in OUDE_KOPPEN) and paneel['emoji'] == 0, ok and paneel['koppen'])
    check('je eigen chatstickers (Stickerlab) staan er nog', ok and 'Je eigen chatstickers' in paneel['koppen'] and paneel['eigen'] > 0, ok and (paneel['koppen'], paneel['eigen']))
    check('de stickervellen van Fibro staan er nog (vel 1 t/m 4)', ok and paneel['vellen'] == ['f1', 'f2', 'f3', 'f4'], ok and paneel['vellen'])
    zicht = ev("() => [...document.querySelectorAll('#panel-stickers .section-label')].filter(k => k.offsetParent).map(k => k.textContent.trim())")
    check('op het scherm: geen emoji-koppen', isinstance(zicht, list) and not any(k in zicht for k in OUDE_KOPPEN), zicht)
    # Widgets
    try: p.click('.main-tab:has-text("Widgets")', timeout=3000)
    except Exception as e: print('   tabblad Widgets:', str(e)[:80])
    p.wait_for_timeout(500)
    wid = ev("""() => ({ board: !!document.getElementById('widget-stickerboard') || [...document.querySelectorAll('#panel-widgets .widget-name')].some(n => n.textContent.trim() === 'Sticker board'),
                     namen: [...document.querySelectorAll('#panel-widgets .widget-name')].map(n => n.textContent.trim()),
                     aan: ['gastenboek', 'mood', 'muziek'].map(w => { const t = document.getElementById('widget-' + w); return !!(t && t.classList.contains('on')) }) })""")
    ok = isinstance(wid, dict)
    check('Widgets (echte klik): geen Sticker board meer', ok and not wid['board'], wid)
    check('de andere widgets staan er nog (Gastenboek, Mood, Muziek aan)', ok and wid['aan'] == [True, True, True] and len(wid['namen']) >= 10, ok and (wid['aan'], len(wid['namen'])))
    # Mood: de stickerkeuze werkt nog
    try: p.click('.main-tab:has-text("Profiel")', timeout=3000); p.wait_for_timeout(300); p.click('#moodEmojiGekozen', timeout=3000)
    except Exception as e: print('   mood:', str(e)[:80])
    p.wait_for_timeout(500)
    keuze = ev("() => { const k = document.getElementById('moodEmojiPicker'); return k ? [getComputedStyle(k).display, k.querySelectorAll('.sk-sticker').length] : null }")
    check('Mood: de stickerkeuze opent nog (echte klik)', isinstance(keuze, list) and keuze[0] != 'none' and keuze[1] >= 12, keuze)
    try: p.locator('#moodEmojiPicker .sk-sticker').nth(0).click(timeout=3000)
    except Exception: pass
    # Opslaan (echte klik)
    try: p.click('button.save-top-btn', timeout=3000)
    except Exception as e: print('   opslaan:', str(e)[:80])
    p.wait_for_timeout(2500)
    lok = ev("u => JSON.parse(localStorage.getItem('fibro_profiel_' + u) || 'null')", UID)
    ok = isinstance(lok, dict)
    check("Opslaan (echte klik): op het toestel geen 'stickers' meer", ok and 'stickers' not in lok, lok)
    check("... en geen 'stickerboard' bij de widgets; de andere blijven", ok and lok.get('widgets') == ['gastenboek', 'mood', 'muziek'], ok and lok.get('widgets'))
    lay = ev("u => JSON.parse(localStorage.getItem('fibro_widgets_profiel_' + u) || '[]').map(w => w.id)", UID)
    check('Home-indeling: Gastenboek, Mood, Muziek', isinstance(lay, list) and sorted(lay) == ['gastenboek', 'mood', 'muziek'], lay)
    rij = next((x for x in staat['patch'] if isinstance(x, dict) and 'offline_emoji' in x), None)
    check('naar de server: de gewone rij (met de mood-sticker), zonder stickers', rij and str(rij.get('offline_emoji', '')).startswith('fxsticker:') and 'stickers' not in rij, rij and {k: rij[k] for k in rij if k in ('offline_emoji', 'mood', 'stickers')})
    check('geen fouten op de pagina', fouten == [], fouten)
    ctx.close(); br.close(); srv.terminate()
shutil.rmtree(www, ignore_errors=True)
print('%d van %d goed' % (sum(uitslag), len(uitslag)))
