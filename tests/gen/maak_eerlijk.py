import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('eerlijk', S + '/oud', S + '/nieuw',
    gewijzigd=['over.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/gen/maak_eerlijk.py', 'tests/gen/testscript_eerlijk.py'],
    oude_v=[],
    beschrijving="Over Fibro: eerlijk wat er op de server staat (berichten versleuteld, gastenboek niet, profielfoto, wie met wie) en welke bedrijven meedoen",
    vereist=['huisregel.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-eerlijk.py')
print(r['inhoudsregels'])
