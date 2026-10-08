import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
# proef26: veel vrienden (20) op Vrienden en Chat: je kunt naar beneden scrollen en de laatste vriend
# staat dan helemaal in beeld, boven het menu; Chat-vriendenblokken volgen de blokstijl (kleur/hoeken) zoals de rest.
# python3 -I proef26.py <scratch met tools/server.py> <map> <poort>
S = sys.argv[1]; MAP = sys.argv[2]; PORT = int(sys.argv[3]); B = f'http://127.0.0.1:{PORT}/Fibro/'
WWW = S + '/www26_' + str(PORT); os.makedirs(WWW, exist_ok=True)
if os.path.islink(WWW + '/Fibro'): os.remove(WWW + '/Fibro')
os.symlink(MAP, WWW + '/Fibro')
UID = 'aaaaaaaa-0000-4000-8000-000000000001'
VR = ['f%07d-0000-4000-8000-%012d' % (i, i) for i in range(20)]
srv = subprocess.Popen([sys.executable, '-I', S + '/tools/server.py', WWW, str(PORT)], stderr=subprocess.DEVNULL); time.sleep(0.8)
TOKEN = json.dumps({"access_token": "x", "refresh_token": "y", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": {"id": UID}})
def prof(i): return {"id": VR[i], "username": "Vriend%02d" % i, "avatar_url": "\U0001F600", "online_status": False, "laatst_gezien": "2026-10-08T09:00:00Z"}
def supa(route):
    u = route.request.url; m = route.request.method
    if '/rest/v1/friendships' in u and m == 'GET':
        return route.fulfill(status=200, json=[{"user_id": UID, "friend_id": v, "status": "accepted", "profiles": prof(i)} for i, v in enumerate(VR)])
    if '/rest/v1/profiles' in u and m == 'GET':
        obj = 'vnd.pgrst.object' in (route.request.headers.get('accept') or '')
        if obj: return route.fulfill(status=200, json={"id": UID, "username": "marcel"})
        return route.fulfill(status=200, json=[prof(i) for i in range(20)])
    return route.fulfill(status=200, json=[])
fouten = []
def check(naam, ok, info=''):
    print(('  OK   ' if ok else '  FOUT ') + naam + (' | ' + str(info) if info != '' else ''))
    if not ok: fouten.append(naam)
LAATSTE = """sel => { const r = [...document.querySelectorAll(sel)]; if (!r.length) return null; const l = r[r.length - 1]; window.scrollTo(0, 1e7); let e = l.parentElement; while (e) { e.scrollTop = 1e7; e = e.parentElement }
  return new Promise(res => setTimeout(() => { const b = l.getBoundingClientRect(); const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
  const midden = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  res({ n: r.length, onder: Math.round(b.bottom), navTop: Math.round(nav.top), zichtbaar: !!midden && l.contains(midden) }) }, 400)) }"""
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 390, 'height': 700}, is_mobile=True, has_touch=True, service_workers='block'); ctx.route('**/*supabase.co/**', supa)
    p = ctx.new_page(); perr = []; p.on('pageerror', lambda e: perr.append(str(e)[:150]))
    p.goto(B + 'login.html'); p.evaluate("t => { localStorage.setItem('sb-qmgatbphiplrfxrljtbe-auth-token', t); localStorage.setItem('fibro_blokstijl', JSON.stringify({ kleur: '#ff0000', doorzicht: 50, hoek: 30 })) }", TOKEN)
    for pg, sel in [('vrienden.html', '#vriendenLijst .friend-row'), ('chat.html', '#vriendenLijst .vriend-item')]:
        p.goto(B + pg); p.wait_for_function("s => document.querySelectorAll(s).length >= 20", arg=sel, timeout=15000); p.wait_for_timeout(500)
        r = p.evaluate(LAATSTE, sel)
        check(pg + ': laatste vriend helemaal in beeld boven het menu', r and r['n'] == 20 and r['zichtbaar'] and r['onder'] <= r['navTop'], r)
    st = p.evaluate("() => { const e = document.querySelector('#vriendenLijst .vriend-item'); const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopLeftRadius] }")
    check('chat: vriendenblokken in de blokstijl (rood, hoek 30)', st[0] == 'rgba(255, 0, 0, 0.5)' and st[1] == '30px', st)
    check('geen fouten op de pagina', perr == [], perr)
    br.close()
srv.kill()
print('KLAAR:', 'alles goed' if not fouten else 'FOUTEN: ' + ', '.join(fouten))
