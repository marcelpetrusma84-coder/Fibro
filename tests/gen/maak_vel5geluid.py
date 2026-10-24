import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('vel5geluid', S + '/oud', S + '/nieuw',
    gewijzigd=['stickervellen.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'moodsticker.js', 'chat.html', 'index.html', 'profiel.html',
               'vriend-profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py', 'tests/tools/proef102.py'],
    nieuwe=['tests/tools/proef103.py', 'tests/gen/maak_vel5geluid.py', 'tests/gen/testscript_vel5geluid.py'],
    oude_v=['stickervellen.js?v=208', 'stickerkeuze.js?v=214', 'stickerwidget.js?v=214', 'stickermaker.js?v=214', 'moodsticker.js?v=214'],
    beschrijving="Acht stickers van vel 5 met een meme-geluid (v215)",
    vereist=['tests/gen/maak_meme.py', 'tests/gen/testscript_meme.py', 'stickerfx.js', 'geluiden/ooh.mp3', 'geluiden/dankbaar.mp3', 'geluiden/tadaa.mp3',
             'geluiden/fout.mp3', 'geluiden/zoefweg.mp3', 'geluiden/gameover.mp3', 'geluiden/kras.mp3', 'geluiden/hoorn.mp3'],
    uitpad=S + '/out/maak-vel5geluid.py')
print(r['inhoudsregels'])
