import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stijl2', S + '/b15', S + '/nieuw',
    gewijzigd=['stijl.css', 'index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef28.py', 'tests/gen/maak_stijl2.py', 'tests/gen/testscript_stijl2.py'],
    oude_v=['stijl.css?v=1'],
    beschrijving="geen schaduw achter de tekst in het gastenboek, ook niet met achtergrondfoto (stijl.css?v=2)",
    vereist=['thema.js', 'wallpaper.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-stijl2.py')
print(r['inhoudsregels'])
