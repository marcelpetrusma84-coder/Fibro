import os, sys, shutil, subprocess, hashlib, json
S, SCRIPT = sys.argv[1], sys.argv[2]
T = S + '/test'
def snap(d):
    r = {}
    for w, ms, bs in os.walk(d):
        ms[:] = [m for m in ms if m != '.git']
        for b in bs:
            p = os.path.join(w, b); r[os.path.relpath(p, d)] = hashlib.md5(open(p, 'rb').read()).hexdigest()
    return r
BASIS = sys.argv[3] if len(sys.argv) > 3 else S + '/fibro'
OUD = snap(BASIS); NIEUW = snap(S + '/nieuw')
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
# 1 goed
d = vers(); c, o = draai(d); check('goed: exit 0 en GOED', c == 0 and o.startswith('GOED'), o)
check('goed: uitkomst gelijk aan nieuw/', snap(d) == NIEUW, str([k for k in set(snap(d)) | set(NIEUW) if snap(d).get(k) != NIEUW.get(k)][:5]))
# 2 tweede keer
c, o = draai(d); check('tweede keer: AL GEDAAN, exit 1', c == 1 and 'AL GEDAAN' in o and snap(d) == NIEUW, o)
def onveranderd(naam, d, moet_bevatten):
    voor = snap(d); c, o = draai(d); na = snap(d)
    check(naam, c != 0 and 'Er is niets aangepast' in o and moet_bevatten in o and voor == na, o)
regels = open(SCRIPT).read().split('\n')
_b = regels.index('INHOUD = """'); _e = regels.index('"""', _b + 1)
data_idx = [i for i in range(_b + 1, _e) if regels[i].strip()][:-1]  # laatste regel kan korter zijn
data_idx_alle = [i for i in range(_b + 1, _e) if regels[i].strip()]
def met(regels2):
    p = T + '/mut.py'; open(p, 'w').write('\n'.join(regels2)); return p
# 3 beschadigde inhoudsregel
r2 = list(regels); i = data_idx[5]; r2[i] = ('A' if r2[i][10] != 'A' else 'B').join([r2[i][:10], r2[i][11:]])
d = vers(); voor = snap(d); c, o = draai(d, met(r2)); check('beschadigde inhoudsregel', c != 0 and 'beschadigd' in o and snap(d) == voor, o)
# 4 ontbrekende inhoudsregel
r2 = list(regels); del r2[data_idx[3]]
d = vers(); voor = snap(d); c, o = draai(d, met(r2)); check('ontbrekende inhoudsregel', c != 0 and 'inhoud onvolledig' in o and snap(d) == voor, o)
# 5 verkeerde md5 (bestand anders)
d = vers(); open(d + '/fotoviewer.js', 'ab').write(b'\n'); onveranderd('fotoviewer.js anders', d, 'anders dan verwacht')
# 7 oude verwijzing elders (ook in een submap)
d = vers(); open(d + '/spellen/proef.html', 'w').write("<script type=module>import x from '../fotoviewer.js?v=3'</script>"); onveranderd('oude verwijzing in spellen/', d, 'oude verwijzing')
# 6 verkeerde map / geen .git
d = vers('Fibro2'); onveranderd('verkeerde map', d, '~/Fibro')
d = vers(git=False); onveranderd('geen .git', d, '~/Fibro')
# 8 deels gedaan
d = vers(); shutil.copy(S + '/nieuw/vriend-profiel.html', d + '/vriend-profiel.html'); onveranderd('deels gedaan', d, 'deels gedaan')
d = vers(); open(d + '/tests/tools/proef22.py', 'w').write('iets anders'); onveranderd('nieuw bestand bestaat al', d, 'mag nog niet bestaan')
# 9 vereist
d = vers(); open(d + '/swipe.js', 'ab').write(b'//'); onveranderd('vereist bestand anders', d, 'swipe.js is anders')
d = vers(); os.remove(d + '/tests/gen/bouw.py'); onveranderd('vereist bestand weg (tests/ nog niet gedaan)', d, 'tests/gen/bouw.py ontbreekt')
# 11 gewijzigd bestand ontbreekt
d = vers(); os.remove(d + '/tests/LEESMIJ.txt'); onveranderd('gewijzigd bestand ontbreekt', d, 'tests/LEESMIJ.txt ontbreekt')
# 13 mutaties: elke regel weglaten
onveilig = []; veilig = 0; zelfde = 0; hangt = []
for i in range(len(regels)):
    r2 = regels[:i] + regels[i + 1:]
    d = vers(); voor = snap(d); c, o = draai(d, met(r2)); na = snap(d)
    if na == voor and c == 99: hangt.append(i + 1)
    if na == voor and (c != 0 or 'AL GEDAAN' in o): veilig += 1
    elif na == NIEUW and c == 0: zelfde += 1
    elif na == voor and c == 0 and o == '' and regels[i] == 'main()': veilig += 1  # doet niets; Marcel ziet geen GOED, controle met md5 vangt dit
    else: onveilig.append((i + 1, regels[i][:60], c, o.splitlines()[-1][:100] if o else ''))
print('  waarvan hangen (niets geschreven):', hangt, [regels[h - 1].strip()[:50] for h in hangt])
check('mutaties (regel weg): %d veilig gestopt, %d zonder gevolg, %d onveilig' % (veilig, zelfde, len(onveilig)), not onveilig, str(onveilig[:5]))
# 14 mutaties: elke inhoudsregel een teken anders
mis = 0
for i in data_idx_alle:
    r2 = list(regels); r2[i] = ('x' if r2[i][0] != 'x' else 'y') + r2[i][1:]  # eerste teken: ook de laatste (korte) regel
    d = vers(); voor = snap(d); c, o = draai(d, met(r2))
    if not (c != 0 and snap(d) == voor): mis += 1
check('mutaties (elke inhoudsregel beschadigd): %d van %d niet gestopt' % (mis, len(data_idx_alle)), mis == 0)
print('UITSLAG: %d van %d goed' % (sum(uitslag), len(uitslag)))
