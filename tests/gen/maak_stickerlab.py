import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('stickerlab', S + '/oud', S + '/nieuw',
    gewijzigd=['profiel.html', 'chat.html', 'stickerkeuze.js', 'taal.js', 'taal-en.js', 'bellen.html', 'index.html', 'invite.html', 'login.html',
               'moderatie.html', 'over.html', 'spel.html', 'vriend-profiel.html', 'vrienden.html', 'spellen/runner-gunner.html',
               'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef53.py'],
    nieuwe=['eigenstickers.js', 'stickermaker.js', 'tests/tools/proef54.py', 'tests/gen/maak_stickerlab.py', 'tests/gen/testscript_stickerlab.py'],
    oude_v=['taal.js?v=11', 'taal-en.js?v=11', 'stickerkeuze.js?v=153'],
    beschrijving="Het Stickerlab in Profiel: eigen stickers maken met beweging en geluid, bewaard op dit toestel (v154)",
    vereist=['supabase.js', 'stickerfx.js', 'stickervellen.js', 'account.js', 'tests/gen/bouw.py', 'tests/gen/maak_stickers.py'],
    uitpad=S + '/out/maak-stickerlab.py')
print(r['inhoudsregels'])
