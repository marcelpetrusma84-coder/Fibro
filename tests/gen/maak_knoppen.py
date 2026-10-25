import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('knoppen', S + '/oud', S + '/nieuw',
    gewijzigd=['profiel.html', 'stickermaker.js', 'index.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef105.py', 'tests/gen/maak_knoppen.py', 'tests/gen/testscript_knoppen.py'],
    oude_v=['stickermaker.js?v=215'],
    beschrijving="Witte stippellijnen met schaduw en duidelijkere knoppen op de Stijl-pagina (v217)",
    vereist=['tests/gen/maak_raster.py', 'tests/gen/testscript_raster.py'],
    uitpad=S + '/out/maak-knoppen.py')
print(r['inhoudsregels'])
