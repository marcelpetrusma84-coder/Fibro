import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
PAGINAS = ['index.html', 'chat.html', 'vrienden.html', 'profiel.html', 'vriend-profiel.html', 'bellen.html', 'invite.html', 'login.html',
           'moderatie.html', 'over.html', 'spel.html', 'spellen/runner-gunner.html']
r = bouw('geluidregelaar', S + '/oud', S + '/nieuw',
    gewijzigd=PAGINAS + ['taal.js', 'taal-en.js', 'meldingen.js', 'timer-melding.js', 'stickerfx.js', 'stickerkeuze.js', 'stickerwidget.js',
                         'stickermaker.js', 'moodsticker.js', 'profielmuziek.js', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef75.py'],
    nieuwe=['geluidregelaar.js', 'tests/tools/proef76.py', 'tests/gen/maak_geluidregelaar.py', 'tests/gen/testscript_geluidregelaar.py'],
    oude_v=['meldingen.js?v=143', 'timer-melding.js?v=143', 'stickerfx.js?v=166', 'stickerkeuze.js?v=166', 'stickerwidget.js?v=166',
            'stickermaker.js?v=166', 'moodsticker.js?v=171', 'profielmuziek.js?v=179', 'taal.js?v=16', 'taal-en.js?v=16'],
    beschrijving="De geluidsregelaar: nooit twee geluiden tegelijk, onderbroken = later verder, faden, vergrendelscherm, stil 's nachts (v180)",
    vereist=['tests/gen/maak_profielmuziek.py', 'ecto-ui.js'],
    uitpad=S + '/out/maak-geluidregelaar.py')
print(r['inhoudsregels'])
