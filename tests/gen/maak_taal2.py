import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'login.html', 'invite.html', 'chat.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html',
           'bellen.html', 'over.html', 'moderatie.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('taal2', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'bel-luisteraar.js', 'bellen.js', 'blokkade.js', 'fotoviewer.js', 'meldingen.js', 'persoonblok.js',
                         'speluitnodiging.js', 'timer-melding.js', 'tests/LEESMIJ.txt', 'tests/tools/taalcheck.py'],
    nieuwe=['tests/tools/proef43.py', 'tests/gen/maak_taal2.py', 'tests/gen/testscript_taal2.py'],
    oude_v=['taal.js?v=1', 'taal-en.js?v=1', 'bel-luisteraar.js?v=142', 'bellen.js?v=131', 'blokkade.js?v=1', 'fotoviewer.js?v=4', 'meldingen.js?v=131',
            'persoonblok.js?v=2', 'speluitnodiging.js?v=131', 'timer-melding.js?v=131'],
    beschrijving="Fibro in het Engels, portie 1: Vrienden, het profiel van een vriend, blokkeren, meldingen (buzz, online, spel), bellen en de fotoviewer",
    vereist=['huisregel.js', 'supabase.js', 'paren.js', 'lijntjes.js', 'vriendfotos.js', 'tests/gen/bouw.py', 'tests/gen/maak_taal.py'],
    uitpad=S + '/out/maak-taal2.py')
print(r['inhoudsregels'])
