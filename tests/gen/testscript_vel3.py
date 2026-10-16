# testscript_vel3.py - veiligheid van maak-vel3-1..N.py (v165), naar testscript_vel2.py.
# python3 -I testscript_vel3.py <werkmap> <maak-vel3-K.py> <basis = stand ervoor> <nieuw = stand erna> <K>
# Stuk 1..N-1: alleen nieuwe mp3's en plaatjes (base64). Het laatste stuk: ook de code (stickervellen.js enz.), met de
# controles op oude ?v=. Welk stuk het laatste is, ziet het script zelf (daar verandert stickervellen.js).
import os, sys, shutil, subprocess, hashlib
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
IS_NIEUW_BESTAND = lambda k: k.startswith('geluiden/') or k.startswith('stickers/f3/')
NIEUWE_MP3 = sorted(k for k in NIEUW if IS_NIEUW_BESTAND(k) and k not in _B)
LAATSTE = NIEUW.get('stickervellen.js') != _B.get('stickervellen.js')
V160 = {'geluiden/' + g + '.mp3' for g in ['alarm', 'boem', 'boing', 'drama', 'error', 'fluit', 'huh', 'klets', 'pling', 'pop', 'popcorn', 'slurp', 'sprong', 'ting', 'tsjirp', 'vuur', 'zoemer', 'zucht']}
def vers(naam='Fibro', git=True):
    d = os.path.join(T, 'w', naam)
    shutil.rmtree(os.path.join(T, 'w'), ignore_errors=True)
    shutil.copytree(BASIS, d, symlinks=True)
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
regels = open(SCRIPT).read().split('\n')
_b = regels.index('INHOUD = """'); _e = regels.index('"""', _b + 1)
data_idx = [i for i in range(_b + 1, _e) if regels[i].strip()][:-1]
data_idx_alle = [i for i in range(_b + 1, _e) if regels[i].strip()]
def met(regels2):
    p = T + '/mut.py'; open(p, 'w').write('\n'.join(regels2)); return p
print('stuk %d%s: %d nieuwe bestanden, %d inhoudsregels' % (STUK, ' (laatste)' if LAATSTE else '', len(NIEUWE_MP3), len(data_idx_alle)))
# 1 goed, 2 tweede keer
d = vers(); c, o = draai(d); check('goed: exit 0 en GOED', c == 0 and o.startswith('GOED'), o)
check('goed: uitkomst gelijk aan de stand erna', snap(d) == NIEUW, str([k for k in set(snap(d)) | set(NIEUW) if snap(d).get(k) != NIEUW.get(k)][:5]))
c, o = draai(d); check('tweede keer: AL GEDAAN, exit 1', c == 1 and 'AL GEDAAN' in o and snap(d) == NIEUW, o)
# 3 beschadigd, 4 ontbrekend
r2 = list(regels); i = data_idx[5]; r2[i] = ('A' if r2[i][10] != 'A' else 'B').join([r2[i][:10], r2[i][11:]])
d = vers(); voor = snap(d); c, o = draai(d, met(r2)); check('beschadigde inhoudsregel', c != 0 and 'beschadigd' in o and snap(d) == voor, o)
r2 = list(regels); del r2[data_idx[3]]
d = vers(); voor = snap(d); c, o = draai(d, met(r2)); check('ontbrekende inhoudsregel', c != 0 and 'inhoud onvolledig' in o and snap(d) == voor, o)
# 6 verkeerde map / geen .git
d = vers('Fibro2'); onveranderd('verkeerde map', d, '~/Fibro')
d = vers(git=False); onveranderd('geen .git', d, '~/Fibro')
# 8 nieuw bestand bestaat al
if NIEUWE_MP3:
    d = vers(); os.makedirs(os.path.dirname(d + '/' + NIEUWE_MP3[0]), exist_ok=True); open(d + '/' + NIEUWE_MP3[0], 'wb').write(b'iets anders'); onveranderd('nieuw bestand (geluid/plaatje) bestaat al', d, 'mag nog niet bestaan')
if LAATSTE:
    d = vers(); open(d + '/tests/tools/geluiden4.py', 'w').write('iets anders'); onveranderd('nieuw bestand bestaat al', d, 'mag nog niet bestaan')
# 9 vereist: het vorige stuk is nog niet gedraaid
if STUK == 1:
    d = vers(); os.remove(d + '/tests/gen/maak_vel2.py'); onveranderd('vorig script (v164) nog niet gedraaid', d, 'maak_vel2.py ontbreekt')
    d = vers(); open(d + '/stickervellen.js', 'ab').write(b'//'); onveranderd('vereist bestand anders', d, 'stickervellen.js is anders')
else:
    VOLG = ['geluiden/%s.mp3' % g for g in ['duimop', 'boe', 'pijl', 'halt', 'vrede', 'oke', 'rock', 'kracht', 'hallo', 'applaus', 'yes', 'warp']] + ['stickers/f3/%02d.webp' % i for i in range(1, 13)]
    eerder = [k for k in VOLG if k in _B]
    if LAATSTE: d = vers(); os.remove(d + '/' + eerder[0]); onveranderd('eerste stuk nog niet gedraaid (bestand ontbreekt)', d, os.path.basename(eerder[0]) + ' ontbreekt')
    d = vers(); os.remove(d + '/' + eerder[-1]); onveranderd('vorig stuk nog niet gedraaid (laatste bestand ontbreekt)', d, os.path.basename(eerder[-1]) + ' ontbreekt')
    d = vers(); open(d + '/' + eerder[-1], 'ab').write(b'x'); onveranderd('bestand van een vorig stuk beschadigd', d, os.path.basename(eerder[-1]) + ' is anders')
if LAATSTE:
    d = vers(); open(d + '/stickerfx.js', 'ab').write(b'\n'); onveranderd('stickerfx.js anders', d, 'anders dan verwacht')
    d = vers(); shutil.copy(NIEUWMAP + '/index.html', d + '/index.html'); onveranderd('deels gedaan', d, 'deels gedaan')
    d = vers(); os.remove(d + '/stickerkeuze.js'); onveranderd('gewijzigd bestand ontbreekt', d, 'stickerkeuze.js ontbreekt')
    d = vers(); open(d + '/extra.html', 'w').write('<script type="module">import { speel } from "./stickerfx.js?v=164"</script>'); onveranderd('oude verwijzing elders', d, 'laadt nog stickerfx.js?v=164')
    d = vers(); open(d + '/spellen/extra.html', 'w').write('<script type="module">import "../stickervellen.js?v=164"</script>'); onveranderd('oude verwijzing in spellen/', d, 'laadt nog stickervellen.js?v=164')
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
