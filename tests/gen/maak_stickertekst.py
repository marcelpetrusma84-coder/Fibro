import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickertekst', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef62.py', 'tests/gen/maak_stickertekst.py', 'tests/gen/testscript_stickertekst.py'],
    oude_v=[],
    beschrijving="Aangepaste of weggegooide eigen sticker blijft in de chat staan als Sticker-tekstballon (v163)",
    vereist=['eigenstickers.js', 'sync.js', 'tests/gen/bouw.py', 'tests/gen/maak_versie.py'],
    uitpad=S + '/out/maak-stickertekst.py')
print(r['inhoudsregels'])
