import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('alleenalssamen', S + '/oud', S + '/nieuw',
    gewijzigd=['ecto-ui.js', 'solo.js', 'spel.html', 'chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef73.py', 'tests/gen/maak_alleenalssamen.py', 'tests/gen/testscript_alleenalssamen.py'],
    oude_v=['ecto-ui.js?v=176', 'solo.js?v=176'],
    beschrijving="Ghost Tag alleen spelen net als samen spelen: 60 beeldjes en volle scherpte (v177)",
    vereist=['tests/gen/maak_geluidlicht.py', 'profiel.html'],
    uitpad=S + '/out/maak-alleenalssamen.py')
print(r['inhoudsregels'])
