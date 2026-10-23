import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('webcamgeluid', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['bel-luisteraar.js', 'bellen.js', 'schaken-ui.js', 'solo.js', 'spelversies.js', 'taal.js', 'taal-en.js',
                         'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef94.py', 'tests/gen/maak_webcamgeluid.py', 'tests/gen/testscript_webcamgeluid.py'],
    oude_v=['taal.js?v=26', 'taal-en.js?v=26', 'bellen.js?v=197', 'bel-luisteraar.js?v=197', 'schaken-ui.js?v=197', 'solo.js?v=197', 'spelversies.js?v=2'],
    beschrijving="Webcam-status volgt de echte camera, knop voor tegengehouden geluid (melding van Tijn, v198)",
    vereist=['tests/gen/maak_schaakpr3.py', 'tests/gen/testscript_schaakpr3.py'],
    uitpad=S + '/out/maak-webcamgeluid.py')
print(r['inhoudsregels'])
