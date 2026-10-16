import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickerwidget', S + '/oud', S + '/nieuw',
    gewijzigd=['profiel.html', 'index.html', 'vriend-profiel.html', 'stickermaker.js', 'taal.js', 'taal-en.js', 'bellen.html', 'chat.html', 'invite.html',
               'login.html', 'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html', 'vrienden.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['stickerwidget.js', 'tests/tools/proef57.py', 'tests/gen/maak_stickerwidget.py', 'tests/gen/testscript_stickerwidget.py'],
    oude_v=['taal.js?v=13', 'taal-en.js?v=13', 'stickermaker.js?v=155'],
    beschrijving="Stickers als widget op Home: stickervel 1 in Profiel onder je eigen stickers, bij elke sticker een knopje voor Home (v157)",
    vereist=['stickervellen.js', 'eigenstickers.js', 'stickerfx.js', 'volgorde.js', 'stickers/f1/07.webp', 'tests/gen/bouw.py', 'tests/gen/maak_vel1.py'],
    uitpad=S + '/out/maak-stickerwidget.py')
print(r['inhoudsregels'])
