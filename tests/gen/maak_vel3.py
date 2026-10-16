# v165 in stukken (zoals v164): maak-vel3-1 ... maak-vel3-(N-1) zetten elk een paar nieuwe mp3's of plaatjes neer,
# het laatste stuk de rest (stickervellen.js, stickerfx.js, ?v=164 enz.). Elk stuk hoogstens ~130 kB, zodat het in
# Kate te plakken is. Tussenstanden: <S>/stap1, stap2, ...
# python3 -I maak_vel3.py <map met bouw.py> <werkmap met oud/ en nieuw/>
import sys, os, shutil
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
GELUID = ['duimop', 'boe', 'pijl', 'halt', 'vrede', 'oke', 'rock', 'kracht', 'hallo', 'applaus', 'yes', 'warp']
BESTANDEN = ['geluiden/%s.mp3' % g for g in GELUID] + ['stickers/f3/%02d.webp' % i for i in range(1, 13)]
GRENS = 92 * 1024  # ruwe bytes per stuk (base64 maakt het 4/3 groter)
GROEP, rij, som = [], [], 0
for b in BESTANDEN:
    n = os.path.getsize(S + '/nieuw/' + b)
    if rij and som + n > GRENS: GROEP.append(rij); rij, som = [], 0
    rij.append(b); som += n
LAATSTE_EXTRA = rij  # de laatste groep gaat mee in het laatste stuk
N = len(GROEP) + 1
vorige = S + '/oud'; gehad = []
for k, groep in enumerate(GROEP, 1):
    stap = S + '/stap%d' % k
    shutil.rmtree(stap, ignore_errors=True); shutil.copytree(vorige, stap, symlinks=True)
    for b in groep:
        os.makedirs(os.path.dirname(stap + '/' + b), exist_ok=True); shutil.copy(S + '/nieuw/' + b, stap + '/' + b)
    r = bouw('vel3-%d' % k, vorige, stap, gewijzigd=[], nieuwe=groep, oude_v=[],
             beschrijving="Stickervel 3, stuk %d van %d: %s (v165)" % (k, N, ', '.join(os.path.basename(b) for b in groep)),
             vereist=(['tests/gen/maak_vel2.py', 'stickervellen.js'] if k == 1 else gehad[-1:]),
             uitpad=S + '/out/maak-vel3-%d.py' % k)
    print(k, r['inhoudsregels'], groep); gehad += groep; vorige = stap
r = bouw('vel3-%d' % N, vorige, S + '/nieuw',
    gewijzigd=['stickervellen.js', 'stickerfx.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'chat.html', 'index.html', 'profiel.html',
               'vriend-profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef53.py'],
    nieuwe=LAATSTE_EXTRA + ['tests/tools/geluiden4.py', 'tests/tools/proef64.py', 'tests/gen/maak_vel3.py', 'tests/gen/testscript_vel3.py'],
    oude_v=['stickerfx.js?v=164', 'stickervellen.js?v=164', 'stickerkeuze.js?v=164', 'stickerwidget.js?v=164', 'stickermaker.js?v=164'],
    beschrijving="Stickervel 3, stuk %d van %d: vel 3 (handgebaren) met 12 eigen geluiden in de stickerkeuze en in Profiel (v165)" % (N, N),
    vereist=gehad + ['eigenstickers.js', 'sync.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vel3-%d.py' % N)
print(N, r['inhoudsregels'], LAATSTE_EXTRA)
