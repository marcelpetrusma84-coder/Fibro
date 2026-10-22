import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('neonraiders2', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['neon-raiders-ui.js', 'solo.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef88.py'],
    nieuwe=['tests/tools/proef89.py', 'tests/gen/maak_neonraiders2.py', 'tests/gen/testscript_neonraiders2.py'],
    oude_v=['taal.js?v=22', 'taal-en.js?v=22', 'solo.js?v=194', 'neon-raiders-ui.js?v=192'],
    beschrijving="Neon Raiders: het hele spel, 7 levels met 7 eindbazen (v193)",
    vereist=['tests/gen/maak_neonraiders.py', 'tests/gen/testscript_neonraiders.py'],
    uitpad=S + '/out/maak-neonraiders2.py')
print(r['inhoudsregels'])
