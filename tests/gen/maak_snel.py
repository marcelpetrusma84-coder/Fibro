import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('snel', S + '/base', S + '/nieuw',
    gewijzigd=['index.html', 'profiel.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef14.py', 'tests/tools/proef15.py', 'tests/tools/server_traag.py', 'tests/gen/maak_snel.py', 'tests/gen/testscript_snel.py'],
    oude_v=[],
    beschrijving="tekst op Home en Profiel meteen uit het geheugen, Profiel wacht niet meer op de hartslag, mp3-maker pas laden bij muziek",
    vereist=['lame.min.js', 'thema.js', 'heartbeat.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-snel.py')
print(r['inhoudsregels'])
