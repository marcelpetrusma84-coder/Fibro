import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('versienummer', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html', 'tests/gen/bouw.py', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef80.py', 'tests/gen/maak_versienummer.py', 'tests/gen/testscript_versienummer.py'],
    oude_v=[],
    beschrijving="Het versienummer onderaan in het menu; bouw.py zet het voortaan bij elk script een hoger (v183)",
    vereist=['tests/gen/maak_sleutelcontrole.py', 'tests/tools/proef79.py'],
    uitpad=S + '/out/maak-versienummer.py')
print(r['inhoudsregels'])
