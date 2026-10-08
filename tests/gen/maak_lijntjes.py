import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('lijntjes', S + '/oud', S + '/nieuw',
    gewijzigd=['chat.html', 'index.html', 'profiel.html', 'vrienden.html', 'vriend-profiel.html', 'bellen.html',
               'meldingen.js', 'timer-melding.js', 'ongelezen.js', 'speluitnodiging.js', 'bellen.js', 'bel-luisteraar.js',
               'tests/LEESMIJ.txt'],
    nieuwe=['lijntjes.js', 'tests/tools/proef30.py', 'tests/gen/maak_lijntjes.py', 'tests/gen/testscript_lijntjes.py'],
    oude_v=['meldingen.js?v=122', 'timer-melding.js?v=122', 'ongelezen.js?v=101', 'speluitnodiging.js?v=101', 'bellen.js?v=106', 'bel-luisteraar.js?v=106'],
    beschrijving="open lijntjes weer open na een netwerkwissel of als de server ze sluit; gemiste berichten, buzz en ongelezen alsnog (lijntjes.js?v=1, ?v=131)",
    vereist=['supabase.js', 'paren.js', 'offline.js', 'tests/gen/bouw.py'],
    uitpad=S + '/out/maak-lijntjes.py')
print(r['inhoudsregels'])
