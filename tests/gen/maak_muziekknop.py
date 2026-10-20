import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('muziekknop', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'vriend-profiel.html', 'profielmuziek.js', 'tests/LEESMIJ.txt', 'tests/tools/proef80.py'],
    nieuwe=['tests/tools/proef81.py', 'tests/gen/maak_muziekknop.py', 'tests/gen/testscript_muziekknop.py'],
    oude_v=['profielmuziek.js?v=180'],
    beschrijving="Het knopje van de profielmuziek verslepen met je vinger; vast aan de kant, onthouden (v184)",
    vereist=['tests/gen/maak_versienummer.py', 'tests/gen/testscript_versienummer.py'],
    uitpad=S + '/out/maak-muziekknop.py')
print(r['inhoudsregels'])
