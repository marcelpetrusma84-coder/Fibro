import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('schaakpr3', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['bel-luisteraar.js', 'bellen.js', 'bordgeluid.js', 'schaken-ui.js', 'solo.js', 'speluitnodiging.js', 'spelversies.js',
                         'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef91.py', 'tests/tools/proef92.py'],
    nieuwe=['chess-layout.css', 'chess-layout.js', 'spelsessie.js', 'tests/tools/proef93.py', 'tests/gen/maak_schaakpr3.py', 'tests/gen/testscript_schaakpr3.py'],
    oude_v=['taal.js?v=25', 'taal-en.js?v=25', 'bellen.js?v=152', 'bel-luisteraar.js?v=152', 'bordgeluid.js?v=148', 'speluitnodiging.js?v=143',
            'schaken-ui.js?v=195', 'solo.js?v=196', 'spelversies.js?v=1'],
    beschrijving="PR #3 van valentijnpeters: schaken met webcam, een vriend uitnodigen, nieuwe instellingen, in twee talen (v197)",
    vereist=['tests/gen/maak_spelversies.py', 'tests/gen/testscript_spelversies.py'],
    uitpad=S + '/out/maak-schaakpr3.py')
print(r['inhoudsregels'])
