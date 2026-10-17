import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('geluidlicht', S + '/oud', S + '/nieuw',
    gewijzigd=['ecto-ui.js', 'solo.js', 'spel.html', 'chat.html', 'tests/LEESMIJ.txt'],
    nieuwe=['tests/tools/proef72.py', 'tests/gen/maak_geluidlicht.py', 'tests/gen/testscript_geluidlicht.py'],
    oude_v=['ecto-ui.js?v=174', 'solo.js?v=174'],
    beschrijving="Ghost Tag: lichter geluid (Web Audio; op de iPhone minder spelers) (v176)",
    vereist=['tests/gen/maak_fps30.py', 'tests/gen/maak_emojiweg.py'],
    uitpad=S + '/out/maak-geluidlicht.py')
print(r['inhoudsregels'])
