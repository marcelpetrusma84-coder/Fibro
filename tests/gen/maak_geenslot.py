import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('geenslot', S + '/oud', S + '/nieuw',
    gewijzigd=['vrienden.html', 'index.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef96.py'],
    nieuwe=['tests/gen/maak_geenslot.py', 'tests/gen/testscript_geenslot.py'],
    oude_v=[],
    beschrijving="Geen slotje meer op Vrienden (stond daar altijd open) (v201)",
    vereist=['tests/gen/maak_slotje.py', 'tests/gen/testscript_slotje.py'],
    uitpad=S + '/out/maak-geenslot.py')
print(r['inhoudsregels'])
