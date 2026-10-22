import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('slotje', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['slotuitleg.js', 'tests/tools/proef96.py', 'tests/gen/maak_slotje.py', 'tests/gen/testscript_slotje.py'],
    oude_v=['taal.js?v=27', 'taal-en.js?v=27'],
    beschrijving="Alleen het open slotje bij een vriend, met uitleg als je erop tikt (v200)",
    vereist=['tests/gen/maak_onlinestip.py', 'tests/gen/testscript_onlinestip.py'],
    uitpad=S + '/out/maak-slotje.py')
print(r['inhoudsregels'])
