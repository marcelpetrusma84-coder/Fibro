import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('schaaktaal', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['schaken-ui.js', 'solo.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef91.py', 'tests/gen/maak_schaaktaal.py', 'tests/gen/testscript_schaaktaal.py'],
    oude_v=['taal.js?v=24', 'taal-en.js?v=24', 'solo.js?v=195', 'schaken-ui.js?v=149'],
    beschrijving="Het vernieuwde schaken weer in het Nederlands en het Engels (v195)",
    vereist=['tests/gen/maak_neonraiders3.py', 'tests/gen/testscript_neonraiders3.py'],
    uitpad=S + '/out/maak-schaaktaal.py')
print(r['inhoudsregels'])
