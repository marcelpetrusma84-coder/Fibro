import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('serverbalk2', S + '/b12', S + '/nieuw',
    gewijzigd=['verbinding.js', 'index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'bellen.html', 'tests/LEESMIJ.txt', 'tests/tools/proef24.py'],
    nieuwe=['tests/gen/maak_serverbalk2.py', 'tests/gen/testscript_serverbalk2.py'],
    oude_v=['verbinding.js?v=1'],
    beschrijving="serverbalkje niet te snel: alleen database/inloggen tellen, rustpauze na openen, eerst zelf nakijken (verbinding.js?v=2)",
    vereist=['offline.js', 'thema.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-serverbalk2.py')
print(r['inhoudsregels'])
