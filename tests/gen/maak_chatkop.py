import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('chatkop', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'index.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef87.py', 'tests/gen/maak_chatkop.py', 'tests/gen/testscript_chatkop.py'],
    oude_v=[],
    beschrijving="Bovenaan de Chat-lijst alleen Chat (v191)",
    vereist=['tests/gen/maak_stijltab.py', 'tests/tools/proef86.py'],
    uitpad=S + '/out/maak-chatkop.py')
print(r['inhoudsregels'])
