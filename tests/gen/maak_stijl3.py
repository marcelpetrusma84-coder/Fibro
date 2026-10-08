import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stijl3', S + '/b16', S + '/nieuw',
    gewijzigd=['stijl.css', 'index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'over.html', 'login.html', 'invite.html', 'bellen.html', 'spel.html', 'moderatie.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef29.py', 'tests/gen/maak_stijl3.py', 'tests/gen/testscript_stijl3.py'],
    oude_v=['stijl.css?v=2'],
    beschrijving="witte tekst spierwit, knoppen zonder schaduw, stijl.css op alle paginas (stijl.css?v=3)",
    vereist=['thema.js', 'offline.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-stijl3.py')
print(r['inhoudsregels'])
