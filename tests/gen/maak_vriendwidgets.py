import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('vriendwidgets', S + '/b6', S + '/nieuw',
    gewijzigd=['sync.js', 'kastvullen.js', 'index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef21.py', 'tests/gen/maak_vriendwidgets.py', 'tests/gen/testscript_vriendwidgets.py'],
    oude_v=['sync.js?v=122'],
    beschrijving="vriend-profiel: spel = zelf spelen, lege poll/timer zeggen dat, nieuwe gegevens van de sync werken de widgets meteen bij (sync.js?v=129)",
    vereist=['spel.html', 'solo.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-vriendwidgets.py')
print(r['inhoudsregels'])
