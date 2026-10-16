# v161 in vier stukken (zoals v160): maak-vel1geluid-1/2/3.py zetten elk vier nieuwe mp3's in geluiden/,
# maak-vel1geluid-4.py de rest (stickerfx.js, stickervellen.js enz.). Tussenstanden: <S>/stap1, stap2, stap3.
# python3 -I maak_vel1geluid.py <map met bouw.py> <werkmap met oud/ en nieuw/>
import sys, os, shutil
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
GROEP = [['spook', 'ssst', 'lach', 'schrik'], ['hartklop', 'snurk', 'uitval', 'druk'], ['grom', 'sluw', 'huil', 'moe']]
mp3 = lambda g: 'geluiden/' + g + '.mp3'
vorige = S + '/oud'; gehad = []
for k, groep in enumerate(GROEP, 1):
    stap = S + '/stap%d' % k
    shutil.rmtree(stap, ignore_errors=True); shutil.copytree(vorige, stap, symlinks=True)
    for g in groep: shutil.copy(S + '/nieuw/' + mp3(g), stap + '/' + mp3(g))
    r = bouw('vel1geluid-%d' % k, vorige, stap, gewijzigd=[], nieuwe=[mp3(g) for g in groep], oude_v=[],
             beschrijving="Eigen geluiden voor stickervel 1, stuk %d van 4: %s (v161)" % (k, ', '.join(groep)),
             vereist=(['tests/gen/maak_mp3.py', 'stickerfx.js'] if k == 1 else [mp3(g) for g in gehad]),
             uitpad=S + '/out/maak-vel1geluid-%d.py' % k)
    print(k, r['inhoudsregels']); gehad += groep; vorige = stap
r = bouw('vel1geluid-4', vorige, S + '/nieuw',
    gewijzigd=['stickerfx.js', 'stickervellen.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'chat.html', 'profiel.html', 'index.html',
               'vriend-profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/geluiden.py', 'tests/tools/proef56.py', 'tests/tools/proef60.py'],
    nieuwe=['tests/tools/geluiden2.py', 'tests/gen/maak_vel1geluid.py', 'tests/gen/testscript_vel1geluid.py'],
    oude_v=['stickerfx.js?v=160', 'stickervellen.js?v=156', 'stickerkeuze.js?v=160', 'stickerwidget.js?v=160', 'stickermaker.js?v=160'],
    beschrijving="Eigen geluiden voor stickervel 1, stuk 4 van 4: vel 1 krijgt zijn nieuwe geluiden, ook in het Stickerlab (v161)",
    vereist=[mp3(g) for g in gehad] + ['eigenstickers.js', 'sync.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vel1geluid-4.py')
print(4, r['inhoudsregels'])
