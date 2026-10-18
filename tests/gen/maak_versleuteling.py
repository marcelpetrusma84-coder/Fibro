import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html', 'login.html',
           'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('versleuteling', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['crypto.js', 'reacties.js', 'account.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt',
                         'tests/tools/proef12.py', 'tests/tools/proef35.py', 'tests/tools/proef53.py', 'tests/tools/proef56.py',
                         'tests/tools/proef63.py', 'tests/tools/proef64.py', 'tests/tools/proef65.py'],
    nieuwe=['tests/tools/nepslot.py', 'tests/tools/proef77.mjs', 'tests/tools/proef78.py',
            'tests/gen/maak_versleuteling.py', 'tests/gen/testscript_versleuteling.py'],
    oude_v=['crypto.js?v=95', 'reacties.js?v=144', 'account.js?v=2', 'taal.js?v=17', 'taal-en.js?v=17'],
    beschrijving="Versleuteling v2, stap 1: afzender, ontvanger en tijd vast aan elk bericht, HKDF, waarschuwingen in de chat (v181)",
    vereist=['tests/gen/maak_geluidregelaar.py', 'geluidregelaar.js'],
    uitpad=S + '/out/maak-versleuteling.py')
print(r['inhoudsregels'])
