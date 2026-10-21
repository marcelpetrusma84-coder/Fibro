import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('neonraiders', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['solo.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/taalcheck.py'],
    nieuwe=['neon-raiders-ui.js', 'tests/tools/proef88.py', 'tests/gen/maak_neonraiders.py', 'tests/gen/testscript_neonraiders.py'],
    oude_v=['taal.js?v=21', 'taal-en.js?v=21', 'solo.js?v=177'],
    beschrijving="Nieuw spel Neon Raiders, level 1 alleen spelen (v192)",
    vereist=['tests/gen/maak_chatkop.py', 'tests/tools/proef87.py'],
    uitpad=S + '/out/maak-neonraiders.py')
print(r['inhoudsregels'])
