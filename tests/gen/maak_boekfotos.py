import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('boekfotos', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef41.py', 'tests/gen/maak_boekfotos.py', 'tests/gen/testscript_boekfotos.py'],
    oude_v=[],
    beschrijving="gastenboeken halen de foto's van de schrijvers niet meer steeds opnieuw op, maar via vriendfotos.js (alleen bij een ander etiket); vriend-profiel: tot 800 kB minder per bezoek",
    vereist=['vriendfotos.js', 'supabase.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-boekfotos.py')
print(r['inhoudsregels'])
