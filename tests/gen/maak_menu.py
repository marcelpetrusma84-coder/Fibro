import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html', 'login.html',
           'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('menu', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef74.py', 'tests/gen/maak_menu.py', 'tests/gen/testscript_menu.py'],
    oude_v=['taal.js?v=14', 'taal-en.js?v=14'],
    beschrijving="Het menu op Home in groepjes (Instellingen, Accountinstellingen, Mijn Fibro) en uitleg Fibro als app installeren (v178)",
    vereist=['tests/gen/maak_alleenalssamen.py', 'ecto-ui.js'],
    uitpad=S + '/out/maak-menu.py')
print(r['inhoudsregels'])
