import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('sneller', S + '/oud', S + '/nieuw',
    gewijzigd=['kastvullen.js', 'index.html', 'vrienden.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['tests/tools/proef98.py', 'tests/gen/maak_sneller.py', 'tests/gen/testscript_sneller.py'],
    oude_v=['kastvullen.js?v=172'],
    beschrijving="Fibro sneller: de kast eerder en na elke update vullen, Vrienden meteen uit het geheugen (v203)",
    vereist=['tests/gen/maak_spelcrypto.py', 'tests/gen/testscript_spelcrypto.py'],
    uitpad=S + '/out/maak-sneller.py')
print(r['inhoudsregels'])
