import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('versie', S + '/oud', S + '/nieuw',
    gewijzigd=['eigenstickers.js', 'sync.js', 'chat.html', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'index.html', 'profiel.html',
               'vriend-profiel.html', 'vrienden.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef61.py', 'tests/gen/maak_versie.py', 'tests/gen/testscript_versie.py'],
    oude_v=['sync.js?v=155', 'eigenstickers.js?v=155', 'stickerkeuze.js?v=161', 'stickerwidget.js?v=161', 'stickermaker.js?v=161'],
    beschrijving="Eigen stickers met versie: aangepast of weggegooid = weg uit de chat; vriend offline: 1 sticker via de server (v162)",
    vereist=['paren.js', 'stickerfx.js', 'stickervellen.js', 'crypto.js', 'tests/gen/bouw.py', 'tests/gen/maak_vel1geluid.py'],
    uitpad=S + '/out/maak-versie.py')
print(r['inhoudsregels'])
