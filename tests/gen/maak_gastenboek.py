import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('gastenboek', S + '/b2/Fibro', S + '/nieuw',
    gewijzigd=['index.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef16.py', 'tests/tools/proef17.py', 'tests/gen/maak_gastenboek.py', 'tests/gen/testscript_gastenboek.py'],
    oude_v=[],
    beschrijving="gastenboek op Home meteen uit het geheugen, foto van elke schrijver maar een keer ophalen en bewaren",
    vereist=['profiel.html', 'tests/tools/proef15.py', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-gastenboek.py')
print(r['inhoudsregels'])
