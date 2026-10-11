import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('taal5', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'account.js', 'passkey-kluis.js', 'verbinding.js', 'offline.js', 'sync.js', 'kastvullen.js',
                         'tests/LEESMIJ.txt', 'tests/tools/taalcheck.py', 'tests/tools/proef42.py', 'tests/tools/proef43.py'],
    nieuwe=['tests/gen/maak_taal5.py', 'tests/gen/testscript_taal5.py'],
    oude_v=['taal.js?v=4', 'taal-en.js?v=4', 'account.js?v=1', 'passkey-kluis.js?v=1', 'verbinding.js?v=2', 'offline.js?v=126', 'sync.js?v=129', 'kastvullen.js?v=127'],
    beschrijving="Fibro in het Engels, portie 4: Mijn gegevens, account verwijderen, Face ID-herstel, moderatie, spelen tegen de computer, Over Fibro (Taal instellen weg uit Binnenkort) en de balkjes zonder internet",
    vereist=['huisregel.js', 'supabase.js', 'crypto.js', 'paren.js', 'solo.js', 'tests/gen/bouw.py', 'tests/gen/maak_taal4.py'],
    uitpad=S + '/out/maak-taal5.py')
print(r['inhoudsregels'])
