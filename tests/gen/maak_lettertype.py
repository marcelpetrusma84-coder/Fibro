import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('lettertype', S + '/b5', S + '/nieuw',
    gewijzigd=['profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef19.py', 'tests/gen/maak_lettertype.py', 'tests/gen/testscript_lettertype.py'],
    oude_v=[],
    beschrijving="Profiel: elk lettertype laat zichzelf zien, kiezen geldt meteen, na Opslaan meteen de wijziging zien",
    vereist=['animatie.js', 'lettertypes.js', 'thema.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-lettertype.py')
print(r['inhoudsregels'])
