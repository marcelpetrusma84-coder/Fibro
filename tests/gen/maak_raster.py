import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('raster', S + '/oud', S + '/nieuw',
    gewijzigd=['stickerkeuze.js', 'chat.html', 'profiel.html', 'index.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef104.py', 'tests/gen/maak_raster.py', 'tests/gen/testscript_raster.py'],
    oude_v=['stickerkeuze.js?v=215'],
    beschrijving="De stickerkeuze altijd 4 naast elkaar, ook op een breed scherm (v216)",
    vereist=['tests/gen/maak_vel5geluid.py', 'tests/gen/testscript_vel5geluid.py'],
    uitpad=S + '/out/maak-raster.py')
print(r['inhoudsregels'])
