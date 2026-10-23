import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('neonraiders3', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['neon-raiders-ui.js', 'solo.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['spelnet.js', 'tests/tools/proef90.py', 'tests/gen/maak_neonraiders3.py', 'tests/gen/testscript_neonraiders3.py'],
    oude_v=['taal.js?v=23', 'taal-en.js?v=23', 'solo.js?v=193', 'neon-raiders-ui.js?v=193'],
    beschrijving="Neon Raiders samen spelen vanuit de chat (v194)",
    vereist=['tests/gen/maak_neonraiders2.py', 'tests/gen/testscript_neonraiders2.py'],
    uitpad=S + '/out/maak-neonraiders3.py')
print(r['inhoudsregels'])
