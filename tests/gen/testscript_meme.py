# testscript_meme.py - veiligheid van maak-meme-1..N.py (v209-v214), naar testscript_vel5.py.
# python3 -I testscript_meme.py <werkmap> <maak-meme-K.py> <basis = stand ervoor> <nieuw = stand erna> <K>
# Stuk 1..N-1: alleen nieuwe mp3's (base64) en het versienummer. Het laatste stuk: ook de code (stickerfx.js enz.), met de
# controles op oude ?v=. Welk stuk het laatste is, ziet het script zelf (daar verandert stickerfx.js). Welke mp3 van een
# vorig stuk vereist is, leest het uit het script zelf (VEREIST): de mp3's zijn op grootte verdeeld, niet op volgorde.
import os, sys, re, shutil, subprocess, hashlib
S, SCRIPT, BASIS, NIEUWMAP, STUK = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
T = S + '/test'
def snap(d):
    r = {}
    for w, ms, bs in os.walk(d):
        ms[:] = [m for m in ms if m != '.git']
        for b in bs:
            p = os.path.join(w, b); r[os.path.relpath(p, d)] = hashlib.md5(open(p, 'rb').read()).hexdigest()
    return r
NIEUW = snap(NIEUWMAP)
_B = snap(BASIS)
NIEUWE_MP3 = sorted(k for k in NIEUW if k.startswith('geluiden/') and k not in _B)
LAATSTE = NIEUW.get('stickerfx.js') != _B.get('stickerfx.js')
tekst = open(SCRIPT).read()
blok = re.search(r'^VEREIST = \{\n(.*?)^\}', tekst, re.M | re.S).group(1)
VEREIST_MP3 = re.findall(r"'(geluiden/[a-z]+\.mp3)'", blok)
def vers(naam='Fibro', git=True, van=None):
    d = os.path.join(T, 'w', naam)
    shutil.rmtree(os.path.join(T, 'w'), ignore_errors=True)
    shutil.copytree(van or BASIS, d, symlinks=True)
    if git: os.mkdir(d + '/.git')
    return d
def draai(d, script=SCRIPT):
    try:
        r = subprocess.run([sys.executable, '-I', script], cwd=d, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return 99, 'HANGT (afgebroken na 15 s)'
    return r.returncode, (r.stdout + r.stderr).strip()
uitslag = []
def check(naam, ok, info=''):
    uitslag.append(ok); print(('OK   ' if ok else 'MIS  ') + naam + ('  | ' + info.splitlines()[-1][:150] if info else ''))
def onveranderd(naam, d, moet_bevatten):
    voor = snap(d); c, o = draai(d); na = snap(d)
    check(naam, c != 0 and 'Er is niets aangepast' in o and moet_bevatten in o and voor == na, o)
regels = tekst.split('\n')
_b = regels.index('INHOUD = """'); _e = regels.index('"""', _b + 1)
data_idx = [i for i in range(_b + 1, _e) if regels[i].strip()][:-1]
data_idx_alle = [i for i in range(_b + 1, _e) if regels[i].strip()]
def met(regels2):
    p = T + '/mut.py'; open(p, 'w').write('\n'.join(regels2)); return p
def versie(d):
    m = re.search(r'^const FIBRO_VERSIE = (\d+)$', open(d + '/index.html', encoding='utf-8').read(), re.M); return int(m.group(1)) if m else None
print('stuk %d%s: %d nieuwe mp3\'s, v%s -> v%s, %d inhoudsregels, %d kB, vereist %d mp3\'s' % (STUK, ' (laatste)' if LAATSTE else '', len(NIEUWE_MP3), versie(BASIS), versie(NIEUWMAP),
      len(data_idx_alle), os.path.getsize(SCRIPT) // 1024, len(VEREIST_MP3)))
check('het stuk zet de versie precies een hoger en is hoogstens 130 kB', versie(NIEUWMAP) == versie(BASIS) + 1 and os.path.getsize(SCRIPT) <= 130 * 1024, '')
# 1 goed, 2 tweede keer
d = vers(); c, o = draai(d); check('goed: exit 0 en GOED', c == 0 and o.startswith('GOED'), o)
check('goed: uitkomst gelijk aan de stand erna', snap(d) == NIEUW, str([k for k in set(snap(d)) | set(NIEUW) if snap(d).get(k) != NIEUW.get(k)][:5]))
c, o = draai(d); check('tweede keer: AL GEDAAN, exit 1', c == 1 and 'AL GEDAAN' in o and snap(d) == NIEUW, o)
# 3 beschadigd, 4 ontbrekend
r2 = list(regels); i = data_idx[5]; r2[i] = ('A' if r2[i][10] != 'A' else 'B').join([r2[i][:10], r2[i][11:]])
d = vers(); voor = snap(d); c, o = draai(d, met(r2)); check('beschadigde inhoudsregel', c != 0 and 'beschadigd' in o and snap(d) == voor, o)
r2 = list(regels); del r2[data_idx[3]]
d = vers(); voor = snap(d); c, o = draai(d, met(r2)); check('ontbrekende inhoudsregel', c != 0 and 'inhoud onvolledig' in o and snap(d) == voor, o)
# 5 index.html anders (bijvoorbeeld een ander versienummer)
d = vers(); p = d + '/index.html'; t = open(p, encoding='utf-8').read(); open(p, 'w', encoding='utf-8').write(re.sub(r'^const FIBRO_VERSIE = \d+$', 'const FIBRO_VERSIE = 999', t, flags=re.M))
onveranderd('index.html met een ander versienummer', d, 'index.html is anders dan verwacht')
# 6 verkeerde map / geen .git
d = vers('Fibro2'); onveranderd('verkeerde map', d, '~/Fibro')
d = vers(git=False); onveranderd('geen .git', d, '~/Fibro')
# 7 deels gedaan, gewijzigd bestand ontbreekt
d = vers(); shutil.copy(NIEUWMAP + '/index.html', d + '/index.html'); onveranderd('deels gedaan (index.html al nieuw)', d, 'deels gedaan')
d = vers(); os.remove(d + '/index.html'); onveranderd('gewijzigd bestand ontbreekt (index.html)', d, 'index.html ontbreekt')
# 8 nieuw bestand bestaat al
if NIEUWE_MP3:
    d = vers(); open(d + '/' + NIEUWE_MP3[0], 'wb').write(b'iets anders'); onveranderd('nieuwe mp3 bestaat al', d, 'mag nog niet bestaan')
if LAATSTE:
    d = vers(); open(d + '/tests/tools/proef102.py', 'w').write('iets anders'); onveranderd('nieuw bestand bestaat al (proef102.py)', d, 'mag nog niet bestaan')
# 9 vereist: het vorige stuk is nog niet gedraaid, of een stuk overgeslagen
if STUK == 1:
    d = vers(); os.remove(d + '/tests/gen/maak_vel5.py'); onveranderd('vorig script (v208) nog niet gedraaid', d, 'maak_vel5.py ontbreekt')
    d = vers(); open(d + '/stickerfx.js', 'ab').write(b'//'); onveranderd('vereist bestand anders', d, 'stickerfx.js is anders')
else:
    check('het script vereist mp3 van een vorig stuk', len(VEREIST_MP3) >= 1 and all(m in _B for m in VEREIST_MP3), str(VEREIST_MP3))
    if VEREIST_MP3:
        d = vers(); os.remove(d + '/' + VEREIST_MP3[0]); onveranderd('vorig stuk nog niet gedraaid (mp3 ontbreekt)', d, os.path.basename(VEREIST_MP3[0]) + ' ontbreekt')
        d = vers(); open(d + '/' + VEREIST_MP3[-1], 'ab').write(b'x'); onveranderd('mp3 van een vorig stuk beschadigd', d, os.path.basename(VEREIST_MP3[-1]) + ' is anders')
    terug = S + ('/oud' if STUK == 2 else '/stap%d' % (STUK - 2))
    d = vers(van=terug); onveranderd('vorig stuk overgeslagen (stand v%s)' % versie(terug), d, 'ontbreekt')
if LAATSTE:
    d = vers(); open(d + '/stickervellen.js', 'ab').write(b'\n'); onveranderd('stickervellen.js anders (vereist)', d, 'stickervellen.js is anders')
    d = vers(); shutil.copy(NIEUWMAP + '/stickerfx.js', d + '/stickerfx.js'); onveranderd('deels gedaan (stickerfx.js al nieuw)', d, 'deels gedaan')
    d = vers(); os.remove(d + '/stickerkeuze.js'); onveranderd('gewijzigd bestand ontbreekt (stickerkeuze.js)', d, 'stickerkeuze.js ontbreekt')
    d = vers(); open(d + '/extra.html', 'w').write('<script type="module">import { speel } from "./stickerfx.js?v=180"</script>'); onveranderd('oude verwijzing elders', d, 'laadt nog stickerfx.js?v=180')
    d = vers(); open(d + '/spellen/extra.html', 'w').write('<script type="module">import "../moodsticker.js?v=208"</script>'); onveranderd('oude verwijzing in spellen/', d, 'laadt nog moodsticker.js?v=208')
# 13 mutaties: elke regel weglaten (van de inhoud elke 20e)
onveilig = []; veilig = 0; zelfde = 0; hangt = []
steek = set(data_idx_alle[::20]) | set(data_idx_alle[-2:])
for i in range(len(regels)):
    if i in data_idx_alle and i not in steek: continue
    r2 = regels[:i] + regels[i + 1:]
    d = vers(); voor = snap(d); c, o = draai(d, met(r2)); na = snap(d)
    if na == voor and c == 99: hangt.append(i + 1)
    if na == voor and (c != 0 or 'AL GEDAAN' in o): veilig += 1
    elif na == NIEUW and c == 0: zelfde += 1
    elif na == voor and c == 0 and o == '' and regels[i] == 'main()': veilig += 1
    else: onveilig.append((i + 1, regels[i][:60], c, o.splitlines()[-1][:100] if o else ''))
print('  waarvan hangen (niets geschreven):', hangt, [regels[h - 1].strip()[:50] for h in hangt])
check('mutaties (regel weg): %d veilig gestopt, %d zonder gevolg, %d onveilig' % (veilig, zelfde, len(onveilig)), not onveilig, str(onveilig[:5]))
# 14 mutaties: inhoudsregel een teken anders
mis = 0
for i in sorted(steek):
    r2 = list(regels); r2[i] = ('x' if r2[i][0] != 'x' else 'y') + r2[i][1:]
    d = vers(); voor = snap(d); c, o = draai(d, met(r2))
    if not (c != 0 and snap(d) == voor): mis += 1
check('mutaties (elke 20e inhoudsregel beschadigd): %d van %d niet gestopt' % (mis, len(steek)), mis == 0)
print('UITSLAG stuk %d: %d van %d goed' % (STUK, sum(uitslag), len(uitslag)))
