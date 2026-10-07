import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('zonderpreview', S + '/b4', S + '/nieuw',
    gewijzigd=['profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef15.py', 'tests/tools/proef18.py'],
    nieuwe=['tests/gen/maak_zonderpreview.py', 'tests/gen/testscript_zonderpreview.py'],
    oude_v=[],
    beschrijving="Profiel: preview en geblokkeerd weggehaald (deblokkeren kan op Vrienden)",
    vereist=['index.html', 'vrienden.html', 'persoonblok.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-zonderpreview.py')
print(r['inhoudsregels'])
