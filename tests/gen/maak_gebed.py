import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('gebed', S + '/oud', S + '/nieuw',
    gewijzigd=['stickers/f4/05.webp', 'tests/gen/bouw.py', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/gen/maak_gebed.py', 'tests/gen/testscript_gebed.py'],
    oude_v=[],
    beschrijving="Nieuw plaatje voor sticker f4-05 (Alsjeblieft) (v167)",
    vereist=['stickervellen.js', 'tests/gen/maak_vel4.py'],
    uitpad=S + '/out/maak-gebed.py')
print(r['inhoudsregels'])
