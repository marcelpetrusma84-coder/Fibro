# v160 in vier stukken (de download lukte niet en een script van 547 kB is te groot om te plakken):
# maak-mp3-1/2/3.py zetten elk zes mp3's in geluiden/, maak-mp3-4.py de rest (stickerfx.js enz.).
# Elk stuk controleert dat het vorige gedaan is (vereist). Tussenstanden: <S>/stap1, stap2, stap3.
# python3 -I maak_mp3.py <map met bouw.py> <werkmap met oud/ en nieuw/>
import sys, os, shutil
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
GROEP = [['zucht', 'fluit', 'boing', 'slurp', 'pling', 'pop'],
         ['drama', 'vuur', 'popcorn', 'error', 'huh', 'sprong'],
         ['ting', 'boem', 'alarm', 'tsjirp', 'zoemer', 'klets']]
mp3 = lambda g: 'geluiden/' + g + '.mp3'
vorige = S + '/oud'
gehad = []
for k, groep in enumerate(GROEP, 1):
    stap = S + '/stap%d' % k
    shutil.rmtree(stap, ignore_errors=True)
    shutil.copytree(vorige, stap, symlinks=True)
    os.makedirs(stap + '/geluiden', exist_ok=True)
    for g in groep:
        shutil.copy(S + '/nieuw/' + mp3(g), stap + '/' + mp3(g))
    r = bouw('mp3-%d' % k, vorige, stap, gewijzigd=[], nieuwe=[mp3(g) for g in groep], oude_v=[],
             beschrijving="Stickergeluiden als mp3, stuk %d van 4: %s (v160)" % (k, ', '.join(groep)),
             vereist=(['tests/gen/maak_tikken.py', 'fotoviewer.js'] if k == 1 else [mp3(g) for g in gehad]),
             uitpad=S + '/out/maak-mp3-%d.py' % k)
    print(k, r['inhoudsregels'])
    gehad += groep
    vorige = stap
r = bouw('mp3-4', vorige, S + '/nieuw',
    gewijzigd=['stickerfx.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'chat.html', 'profiel.html', 'index.html', 'vriend-profiel.html',
               'tests/gen/bouw.py', 'tests/LEESMIJ.txt', 'tests/tools/proef53.py', 'tests/tools/proef54.py', 'tests/tools/proef55.py', 'tests/tools/proef56.py', 'tests/tools/proef57.py'],
    nieuwe=['tests/tools/geluiden.py', 'tests/tools/proef60.py', 'tests/gen/maak_mp3.py', 'tests/gen/testscript_mp3.py'],
    oude_v=['stickerfx.js?v=153', 'stickerkeuze.js?v=156', 'stickerwidget.js?v=157', 'stickermaker.js?v=157'],
    beschrijving="Stickergeluiden als mp3, stuk 4 van 4: afspelen als mp3, geluid klaarzetten ook bij loslaten (v160)",
    vereist=[mp3(g) for g in gehad] + ['stickervellen.js', 'eigenstickers.js', 'beltoon.js'],
    uitpad=S + '/out/maak-mp3-4.py')
print(4, r['inhoudsregels'])
