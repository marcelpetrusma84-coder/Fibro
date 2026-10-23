import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('achtergrond', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['thema.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef99.py', 'tests/gen/maak_achtergrond.py', 'tests/gen/testscript_achtergrond.py'],
    oude_v=['thema.js?v=130', 'taal.js?v=29', 'taal-en.js?v=29'],
    beschrijving="De achtergrond meteen bewaren en delen; Gradient en wallpapers werken; nooit je eigen achtergrond bij een vriend (v204)",
    vereist=['tests/gen/maak_sneller.py', 'tests/gen/testscript_sneller.py'],
    uitpad=S + '/out/maak-achtergrond.py')
print(r['inhoudsregels'])
