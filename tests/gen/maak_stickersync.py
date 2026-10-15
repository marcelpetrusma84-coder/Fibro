import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickersync', S + '/oud', S + '/nieuw',
    gewijzigd=['sync.js', 'chat.html', 'stickerkeuze.js', 'eigenstickers.js', 'stickermaker.js', 'profiel.html', 'index.html', 'vrienden.html',
               'vriend-profiel.html', 'taal.js', 'taal-en.js', 'bellen.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'spel.html',
               'spellen/runner-gunner.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef54.py'],
    nieuwe=['tests/tools/proef55.py', 'tests/gen/maak_stickersync.py', 'tests/gen/testscript_stickersync.py'],
    oude_v=['taal.js?v=12', 'taal-en.js?v=12', 'stickerkeuze.js?v=154', 'eigenstickers.js?v=154', 'stickermaker.js?v=154'],
    beschrijving="Eigen stickers slim gesynct: via sync.js naar je vrienden, de vriend van de open chat eerst, versturen in de chat (v155)",
    vereist=['supabase.js', 'paren.js', 'ice-config.js', 'stickerfx.js', 'stickervellen.js', 'tests/gen/bouw.py', 'tests/gen/maak_stickerlab.py'],
    uitpad=S + '/out/maak-stickersync.py')
print(r['inhoudsregels'])
