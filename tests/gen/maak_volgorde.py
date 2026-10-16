import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('volgorde', S + '/oud', S + '/nieuw',
    gewijzigd=['profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef58.py', 'tests/gen/maak_volgorde.py', 'tests/gen/testscript_volgorde.py'],
    oude_v=[],
    beschrijving="Opslaan in Profiel houdt je eigen volgorde van Home: nieuwe widgets en stickers achteraan (v158)",
    vereist=['index.html', 'volgorde.js', 'stickerwidget.js', 'tests/gen/bouw.py', 'tests/gen/maak_stickerwidget.py'],
    uitpad=S + '/out/maak-volgorde.py')
print(r['inhoudsregels'])
