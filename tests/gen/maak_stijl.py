import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stijl', S + '/b14', S + '/nieuw',
    gewijzigd=['index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['stijl.css', 'tests/tools/proef27.py', 'tests/gen/maak_stijl.py', 'tests/gen/testscript_stijl.py'],
    oude_v=[],
    beschrijving="menu onderaan overal gelijk; schaduw achter tekst alleen bij een achtergrondfoto (stijl.css?v=1 op 5 paginas)",
    vereist=['thema.js', 'wallpaper.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-stijl.py')
print(r['inhoudsregels'])
