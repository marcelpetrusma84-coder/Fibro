import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('portier', S + '/oud', S + '/nieuw',
    gewijzigd=['service-worker.js', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef39.py', 'tests/gen/maak_portier.py', 'tests/gen/testscript_portier.py'],
    oude_v=[],
    beschrijving="de portier wacht hoogstens 0,4 seconde op een pagina, daarna de bewaarde kopie (de nieuwe gaat intussen in de kast): bij internet van 1 s staat Home er na 0,7 s in plaats van 1,3 s",
    vereist=['index.html', 'login.html', 'profiel.html', 'kastvullen.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-portier.py')
print(r['inhoudsregels'])
