import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('geenontvriend', S + '/oud', S + '/nieuw',
    gewijzigd=['vriend-profiel.html', 'index.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef100.py', 'tests/gen/maak_geenontvriend.py', 'tests/gen/testscript_geenontvriend.py'],
    oude_v=[],
    beschrijving="Geen 'Vriendschap beeindigen' meer onderaan het profiel van een vriend (v205)",
    vereist=['tests/gen/maak_achtergrond.py', 'tests/gen/testscript_achtergrond.py'],
    uitpad=S + '/out/maak-geenontvriend.py')
print(r['inhoudsregels'])
