# Stickervel 5 in stukken (zoals vel 2-4): maak-vel5-1 ... maak-vel5-(N-1) zetten elk een paar nieuwe plaatjes neer, het
# laatste stuk de rest (de laatste plaatjes, stickervellen.js, ?v= enz.). Elk stuk hoogstens ~130 kB, zodat het in Kate te
# plakken is. Sinds v183 is elk script een eigen versie (FIBRO_VERSIE een hoger): stuk 1 = v206, stuk 2 = v207, stuk 3
# (het laatste) = v208. Die versie staat in nieuw/index.html; de tussenstanden <S>/stap1, stap2, ... maakt dit script zelf
# (de stand ervoor met de plaatjes van dat stuk erbij en het versienummer een hoger).
# python3 -I maak_vel5.py <map met bouw.py> <werkmap met oud/ en nieuw/>
import sys, os, re, shutil
sys.path.insert(0, sys.argv[1])
from bouw import bouw, versie_van
S = sys.argv[2]
BESTANDEN = ['stickers/f5/%02d.webp' % i for i in range(1, 13)]
GRENS = 82 * 1024  # ruwe bytes per stuk (base64 en de controlegetallen maken het ~1,45 keer groter, plus ~10 kB script)
GROEP, rij, som = [], [], 0
for b in BESTANDEN:
    n = os.path.getsize(S + '/nieuw/' + b)
    if rij and som + n > GRENS: GROEP.append(rij); rij, som = [], 0
    rij.append(b); som += n
LAATSTE_EXTRA = rij  # de laatste groep gaat mee in het laatste stuk
N = len(GROEP) + 1
v_oud, _ = versie_van(S + '/oud'); v_nieuw, datum = versie_van(S + '/nieuw')
if v_nieuw != v_oud + N: sys.exit('nieuw/index.html moet v%d zijn (%d stukken na v%d), is v%d' % (v_oud + N, N, v_oud, v_nieuw))
vorige = S + '/oud'; gehad = []
for k, groep in enumerate(GROEP, 1):
    stap = S + '/stap%d' % k
    shutil.rmtree(stap, ignore_errors=True); shutil.copytree(vorige, stap, symlinks=True)
    for b in groep:
        os.makedirs(os.path.dirname(stap + '/' + b), exist_ok=True); shutil.copy(S + '/nieuw/' + b, stap + '/' + b)
    p = stap + '/index.html'; t = open(p, encoding='utf-8').read()
    t, n1 = re.subn(r"^const FIBRO_VERSIE = \d+$", 'const FIBRO_VERSIE = %d' % (v_oud + k), t, flags=re.M)
    t, n2 = re.subn(r"^const FIBRO_DATUM = '[\d-]+'$", "const FIBRO_DATUM = '%s'" % datum, t, flags=re.M)
    assert n1 == 1 and n2 == 1
    open(p, 'w', encoding='utf-8', newline='').write(t)
    r = bouw('vel5-%d' % k, vorige, stap, gewijzigd=['index.html'], nieuwe=groep, oude_v=[],
             beschrijving="Stickervel 5, stuk %d van %d: de plaatjes %s (v%d)" % (k, N, ', '.join(os.path.basename(b) for b in groep), v_oud + k),
             vereist=(['tests/gen/maak_geenontvriend.py', 'tests/gen/testscript_geenontvriend.py', 'stickervellen.js'] if k == 1 else gehad[-1:]),
             uitpad=S + '/out/maak-vel5-%d.py' % k)
    print(k, 'v%d' % (v_oud + k), r['inhoudsregels'], groep); gehad += groep; vorige = stap
r = bouw('vel5-%d' % N, vorige, S + '/nieuw',
    gewijzigd=['stickervellen.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'moodsticker.js', 'chat.html', 'index.html', 'profiel.html',
               'vriend-profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef53.py'],
    nieuwe=LAATSTE_EXTRA + ['tests/tools/knip5.py', 'tests/tools/proef101.py', 'tests/gen/maak_vel5.py', 'tests/gen/testscript_vel5.py'],
    oude_v=['stickervellen.js?v=166', 'stickerkeuze.js?v=190', 'stickerwidget.js?v=180', 'stickermaker.js?v=180', 'moodsticker.js?v=180'],
    beschrijving="Stickervel 5, stuk %d van %d: vel 5 (chattaal) in de stickerkeuze en in Profiel, met geluiden die er al waren (v%d)" % (N, N, v_nieuw),
    vereist=gehad + ['stickerfx.js', 'eigenstickers.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vel5-%d.py' % N)
print(N, 'v%d' % v_nieuw, r['inhoudsregels'], LAATSTE_EXTRA)
