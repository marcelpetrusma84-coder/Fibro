import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('mediakast', S + '/oud', S + '/nieuw',
    gewijzigd=['service-worker.js', 'kastvullen.js', 'index.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef70.py', 'tests/gen/maak_mediakast.py', 'tests/gen/testscript_mediakast.py'],
    oude_v=['kastvullen.js?v=149'],
    beschrijving="Stickers zonder internet: de portier bewaart de stickerplaatjes en -geluiden, de kast wordt alvast gevuld (v172)",
    vereist=['stickervellen.js', 'stickerfx.js', 'tests/gen/maak_moodsticker.py'],
    uitpad=S + '/out/maak-mediakast.py')
print(r['inhoudsregels'])
