import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('vriendprofiel', S + '/base', S + '/nieuw',
    gewijzigd=['vriend-profiel.html', 'index.html', 'profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef13.py', 'tests/gen/maak_vriendprofiel.py', 'tests/gen/testscript_vriendprofiel.py'],
    oude_v=[],
    beschrijving="vriend-profiel zonder internet: bewaarde gegevens of de vriendenlijst tonen, gastenboek van een vriend bewaard, uitloggen wist het",
    vereist=['runner-gunner-ui.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vriendprofiel.py')
print(r['inhoudsregels'])
