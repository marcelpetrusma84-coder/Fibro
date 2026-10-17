import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('emojiweg', S + '/oud', S + '/nieuw',
    gewijzigd=['profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef71.py', 'tests/gen/maak_emojiweg.py', 'tests/gen/testscript_emojiweg.py'],
    oude_v=[],
    beschrijving="De oude emoji-stickers en de widget Sticker board weg uit Profiel (v173)",
    vereist=['service-worker.js', 'tests/gen/maak_mediakast.py'],
    uitpad=S + '/out/maak-emojiweg.py')
print(r['inhoudsregels'])
