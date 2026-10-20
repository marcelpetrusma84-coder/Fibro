import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html', 'login.html',
           'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('offlinestip', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef83.py'],
    nieuwe=['tests/tools/proef84.py', 'tests/gen/maak_offlinestip.py', 'tests/gen/testscript_offlinestip.py'],
    oude_v=['taal.js?v=19', 'taal-en.js?v=19'],
    beschrijving="Een rood stipje op je avatar op Home als je op offline staat (v188)",
    vereist=['tests/gen/maak_rustigebuzz.py', 'tests/gen/testscript_rustigebuzz.py'],
    uitpad=S + '/out/maak-offlinestip.py')
print(r['inhoudsregels'])
