import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html', 'login.html',
           'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('profielmuziek', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['profielmuziek.js', 'tests/tools/proef75.py', 'tests/gen/maak_profielmuziek.py', 'tests/gen/testscript_profielmuziek.py'],
    oude_v=['taal.js?v=15', 'taal-en.js?v=15'],
    beschrijving="Profielmuziek: in het tabblad Profiel, speelt vanzelf op Home en bij vrienden, schakelaar in het menu (v179)",
    vereist=['tests/gen/maak_menu.py', 'ecto-ui.js'],
    uitpad=S + '/out/maak-profielmuziek.py')
print(r['inhoudsregels'])
