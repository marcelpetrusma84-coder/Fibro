import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('spelsticker', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef68.py', 'tests/gen/maak_spelsticker.py', 'tests/gen/testscript_spelsticker.py'],
    oude_v=[],
    beschrijving="Stickers in plaats van emoji's in een beurtspel, een per beurt, groot midden in beeld (v170)",
    vereist=['stickerkeuze.js', 'tests/gen/maak_spelchat.py'],
    uitpad=S + '/out/maak-spelsticker.py')
print(r['inhoudsregels'])
