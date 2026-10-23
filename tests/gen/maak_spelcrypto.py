import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['bellen.html', 'chat.html', 'index.html', 'invite.html', 'login.html', 'moderatie.html', 'over.html', 'profiel.html',
           'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html']
r = bouw('spelcrypto', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=['spelchat-crypto.js', 'docs/security-review-2026-10-22.md', 'tests/security/test-crypto.mjs',
            'tests/security/test-game-crypto.mjs', 'tests/security/test-key-recovery.mjs', 'tests/tools/proef97.py',
            'tests/gen/maak_spelcrypto.py', 'tests/gen/testscript_spelcrypto.py'],
    oude_v=['taal.js?v=28', 'taal-en.js?v=28'],
    beschrijving="Spelchat en spelstickers versleuteld, herstelsleutel eerst gecontroleerd (stap 1 van PR #4 van valentijnpeters) (v202)",
    vereist=['tests/gen/maak_geenslot.py', 'tests/gen/testscript_geenslot.py'],
    uitpad=S + '/out/maak-spelcrypto.py')
print(r['inhoudsregels'])
