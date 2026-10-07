import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('tabblad', S + '/b3', S + '/nieuw',
    gewijzigd=['profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef18.py', 'tests/gen/maak_tabblad.py', 'tests/gen/testscript_tabblad.py'],
    oude_v=[],
    beschrijving="Profiel: preview en geblokkeerd alleen bij het tabblad Profiel (een losse sluit-tag te veel)",
    vereist=['index.html', 'tests/tools/proef17.py', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-tabblad.py')
print(r['inhoudsregels'])
