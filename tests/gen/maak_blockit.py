import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('blockit', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['blockit-ui.js', 'solo.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef44.py'],
    nieuwe=['tests/gen/maak_blockit.py', 'tests/gen/testscript_blockit.py'],
    oude_v=['blockit-ui.js?v=147', 'solo.js?v=147', 'taal.js?v=6', 'taal-en.js?v=6'],
    beschrijving="Block It: de lading van een steen blijft een getal (geen 'CRUSH true' meer) en '+n RIJEN!' ook in het Engels (v148)",
    vereist=['huisregel.js', 'flappy-ui.js', 'swarm-ui.js', 'tests/gen/bouw.py', 'tests/gen/maak_push.py'],
    uitpad=S + '/out/maak-blockit.py')
print(r['inhoudsregels'])
