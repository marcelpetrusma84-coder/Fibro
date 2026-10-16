import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('badge', S + '/oud', S + '/nieuw',
    gewijzigd=['ongelezen.js', 'service-worker.js', 'index.html', 'chat.html', 'profiel.html', 'vrienden.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef66.py', 'tests/gen/maak_badge.py', 'tests/gen/testscript_badge.py'],
    oude_v=['ongelezen.js?v=152'],
    beschrijving="Bolletje met het aantal ongelezen berichten op het icoon van de app (iPhone), meldingen weg als alles gelezen is (Android) (v168)",
    vereist=['sync.js', 'tests/gen/maak_gebed.py'],
    uitpad=S + '/out/maak-badge.py')
print(r['inhoudsregels'])
