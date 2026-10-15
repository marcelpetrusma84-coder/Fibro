import sys
sys.path.insert(0, sys.argv[1])
from bouw import bouw
S = sys.argv[2]
r = bouw('vel1', S + '/oud', S + '/nieuw',
    gewijzigd=['stickervellen.js', 'stickerkeuze.js', 'chat.html', 'tests/gen/bouw.py', 'tests/LEESMIJ.txt', 'tests/tools/proef53.py'],
    nieuwe=['stickers/f1/01.webp', 'stickers/f1/02.webp', 'stickers/f1/03.webp', 'stickers/f1/04.webp', 'stickers/f1/05.webp', 'stickers/f1/06.webp', 'stickers/f1/07.webp', 'stickers/f1/08.webp', 'stickers/f1/09.webp', 'stickers/f1/10.webp', 'stickers/f1/11.webp', 'stickers/f1/12.webp'] + ['tests/tools/proef56.py', 'tests/gen/maak_vel1.py', 'tests/gen/testscript_vel1.py'],
    oude_v=['stickervellen.js?v=153', 'stickerkeuze.js?v=155'],
    beschrijving="Stickervel 1: twaalf stickers met beweging en geluid in de chat (v156)",
    vereist=['stickerfx.js', 'eigenstickers.js', 'sync.js', 'tests/gen/maak_stickersync.py'],
    uitpad=S + '/out/maak-vel1.py')
print(r['inhoudsregels'])
