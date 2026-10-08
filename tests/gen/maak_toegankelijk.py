import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('toegankelijk', S + '/b10', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'over.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/keuring.py', 'tests/gen/maak_toegankelijk.py', 'tests/gen/testscript_toegankelijk.py'],
    oude_v=[],
    beschrijving="toegankelijkheid: zoomen op Home, beter contrast, hoofdgebied, hoofdtitel en menu voor schermlezers",
    vereist=['verbinding.js', 'spel.html', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-toegankelijk.py')
print(r['inhoudsregels'])
