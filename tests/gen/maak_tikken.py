import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('tikken', S + '/oud', S + '/nieuw',
    gewijzigd=['fotoviewer.js', 'index.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef57.py'],
    nieuwe=['tests/gen/maak_tikken.py', 'tests/gen/testscript_tikken.py'],
    oude_v=['fotoviewer.js?v=5'],
    beschrijving="Tikken op een sticker op Home en bij een vriend speelt hem af (de fotoviewer slaat stickers over) (v159)",
    vereist=['stickerwidget.js', 'profiel.html', 'tests/gen/bouw.py', 'tests/gen/maak_volgorde.py'],
    uitpad=S + '/out/maak-tikken.py')
print(r['inhoudsregels'])
