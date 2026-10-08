import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('vegen', S + '/b7', S + '/nieuw',
    gewijzigd=['fotoviewer.js', 'index.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef22.py', 'tests/gen/maak_vegen.py', 'tests/gen/testscript_vegen.py'],
    oude_v=['fotoviewer.js?v=3'],
    beschrijving="vegen: foto naar beneden vegen sluit hem, in het gastenboek bladeren met vegen (fotoviewer.js?v=4)",
    vereist=['swipe.js', 'sync.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vegen.py')
print(r['inhoudsregels'])
