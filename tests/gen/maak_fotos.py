import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('fotos', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'profiel.html', 'chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef38.py', 'tests/gen/maak_fotos.py', 'tests/gen/testscript_fotos.py'],
    oude_v=[],
    beschrijving="fotos als WebP of JPEG in plaats van stilletjes PNG (iPhone kan geen WebP, Chromium geen AVIF): achtergrond 1,5 MB naar 0,1 MB, chatfoto 1,5 MB naar 0,04-0,08 MB",
    vereist=['p2pfoto.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-fotos.py')
print(r['inhoudsregels'])
