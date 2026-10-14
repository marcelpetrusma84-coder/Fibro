import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('video', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['bellen.js', 'bel-luisteraar.js', 'taal.js', 'taal-en.js', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef49.py', 'tests/gen/maak_video.py', 'tests/gen/testscript_video.py'],
    oude_v=['bellen.js?v=149', 'bel-luisteraar.js?v=149', 'taal.js?v=8', 'taal-en.js?v=8'],
    beschrijving="Videobellen: camera in HD, heel beeld op een breed scherm, zonder camera verder met alleen geluid (v150)",
    vereist=['ice-config.js', 'supabase.js', 'lijntjes.js', 'tests/gen/bouw.py', 'tests/gen/maak_ice.py'],
    uitpad=S + '/out/maak-video.py')
print(r['inhoudsregels'])
