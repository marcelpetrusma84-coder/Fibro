import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html', 'login.html',
           'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('rustigebuzz', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['meldingen.js', 'timer-melding.js', 'service-worker.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt',
                         'tests/tools/proef76.py', 'tests/tools/proef80.py'],
    nieuwe=['tests/tools/proef83.py', 'tests/gen/maak_rustigebuzz.py', 'tests/gen/testscript_rustigebuzz.py'],
    oude_v=['meldingen.js?v=180', 'timer-melding.js?v=180', 'taal.js?v=18', 'taal-en.js?v=18'],
    beschrijving="Menu > Instellingen: 'Buzz schudt en trilt' aan/uit; uit = een buzz is alleen een melding (v187)",
    vereist=['tests/gen/maak_avatarfoto.py', 'tests/gen/testscript_avatarfoto.py'],
    uitpad=S + '/out/maak-rustigebuzz.py')
print(r['inhoudsregels'])
