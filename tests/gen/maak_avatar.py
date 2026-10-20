import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('avatar', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef82.py', 'tests/gen/maak_avatar.py', 'tests/gen/testscript_avatar.py'],
    oude_v=[],
    beschrijving="Avatar van een foto weer in een emoji veranderen werkt; de emoji gaat ook naar vrienden (v185)",
    vereist=['tests/gen/maak_muziekknop.py', 'tests/tools/proef81.py'],
    uitpad=S + '/out/maak-avatar.py')
print(r['inhoudsregels'])
