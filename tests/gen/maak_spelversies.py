import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('spelversies', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['spelversies.js', 'tests/tools/proef92.py', 'tests/gen/maak_spelversies.py', 'tests/gen/testscript_spelversies.py'],
    oude_v=[],
    beschrijving="Elk spel een eigen versienummer in Stijl > Widgets, los van het nummer van Fibro (v196)",
    vereist=['tests/gen/maak_schaaktaal.py', 'tests/gen/testscript_schaaktaal.py'],
    uitpad=S + '/out/maak-spelversies.py')
print(r['inhoudsregels'])
