import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('sleutelcontrole', S + '/oud', S + '/nieuw',
    gewijzigd=['crypto.js', 'account.js', 'index.html', 'chat.html', 'vrienden.html', 'invite.html', 'login.html',
               'tests/LEESMIJ.txt', 'tests/tools/proef77.mjs'],
    nieuwe=['tests/tools/proef79.py', 'tests/gen/maak_sleutelcontrole.py', 'tests/gen/testscript_sleutelcontrole.py'],
    oude_v=['crypto.js?v=181', 'account.js?v=3'],
    beschrijving="Versleuteling stap 2: onzichtbare sleutelcontrole via de uitnodigingslink, herstelcode uit echte willekeur (v182)",
    vereist=['tests/gen/maak_versleuteling.py', 'tests/tools/nepslot.py'],
    uitpad=S + '/out/maak-sleutelcontrole.py')
print(r['inhoudsregels'])
