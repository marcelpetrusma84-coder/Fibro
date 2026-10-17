import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('menufont', S + '/oud', S + '/nieuw',
    gewijzigd=['index.html'],
    nieuwe=['tests/gen/maak_menufont.py'],
    oude_v=[],
    beschrijving="Het menu op Home altijd in DM Sans, ook bij een ander gekozen lettertype (v173)",
    vereist=['tests/gen/maak_mediakast.py'],
    uitpad=S + '/out/maak-menufont.py')
print(r['inhoudsregels'])
