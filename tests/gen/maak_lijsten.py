import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('lijsten', S + '/b13', S + '/nieuw',
    gewijzigd=['chat.html', 'vrienden.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef26.py', 'tests/gen/maak_lijsten.py', 'tests/gen/testscript_lijsten.py'],
    oude_v=[],
    beschrijving="lange vriendenlijsten op Vrienden en Chat scrollen tot de laatste vriend, boven het menu; chat-vriendenblokken in de blokstijl",
    vereist=['blokstijl.js', 'verbinding.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-lijsten.py')
print(r['inhoudsregels'])
