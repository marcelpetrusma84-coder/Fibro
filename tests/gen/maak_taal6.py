import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
SPELLEN = ['bke-ui.js', 'vieroprij-ui.js', 'schaken-ui.js', 'dammen-ui.js', 'pong-ui.js', 'flappy-ui.js', 'blockit-ui.js', 'invaders-ui.js',
           'swarm-ui.js', 'runner-gunner-ui.js', 'ecto-ui.js', 'twin-snakes-ui.js']
r = bouw('taal6', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + SPELLEN + ['bordgeluid.js', 'solo.js', 'taal.js', 'taal-en.js',
                                   'tests/LEESMIJ.txt', 'tests/tools/taalcheck.py'],
    nieuwe=['tests/tools/proef44.py', 'tests/gen/maak_taal6.py', 'tests/gen/testscript_taal6.py'],
    oude_v=['taal.js?v=5', 'taal-en.js?v=5', 'bke-ui.js?v=96', 'dammen-ui.js?v=96', 'pong-ui.js?v=115', 'vieroprij-ui.js?v=115', 'schaken-ui.js?v=96',
            'flappy-ui.js?v=115', 'blockit-ui.js?v=115', 'invaders-ui.js?v=115', 'swarm-ui.js?v=109', 'runner-gunner-ui.js?v=128',
            'ecto-ui.js?v=118', 'twin-snakes-ui.js?v=118', 'bordgeluid.js?v=95', 'solo.js?v=128'],
    beschrijving="Fibro in het Engels, portie 5: de spellen zelf (alle twaalf, ook de losse Runner & Gunner-pagina)",
    vereist=['huisregel.js', 'schaak.js', 'dammen.js', 'flappy-geluid.js', 'solo-bord.js', 'tests/gen/bouw.py', 'tests/gen/maak_taal5.py'],
    uitpad=S + '/out/maak-taal6.py')
print(r['inhoudsregels'])
