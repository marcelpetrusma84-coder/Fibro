import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('avatarfoto', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef82.py'],
    nieuwe=['tests/gen/maak_avatarfoto.py', 'tests/gen/testscript_avatarfoto.py'],
    oude_v=[],
    beschrijving="Een gekozen foto is meteen je avatar (kiezen en Opslaan is genoeg), ook na een emoji (v186)",
    vereist=['tests/gen/maak_avatar.py', 'tests/gen/testscript_avatar.py'],
    uitpad=S + '/out/maak-avatarfoto.py')
print(r['inhoudsregels'])
