import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('onlinestip', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'index.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef87.py'],
    nieuwe=['tests/tools/proef95.py', 'tests/gen/maak_onlinestip.py', 'tests/gen/testscript_onlinestip.py'],
    oude_v=[],
    beschrijving="Geen 'actief' meer in een gesprek, een groen stipje bij de foto als de vriend online is (v199)",
    vereist=['tests/gen/maak_webcamgeluid.py', 'tests/gen/testscript_webcamgeluid.py'],
    uitpad=S + '/out/maak-onlinestip.py')
print(r['inhoudsregels'])
