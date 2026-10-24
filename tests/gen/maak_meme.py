# De meme-, montage- en emotiegeluiden in stukken (zoals stickervel 5): maak-meme-1 ... maak-meme-5 zetten elk een paar
# nieuwe mp3's neer, het laatste stuk de rest (de laatste mp3's, stickerfx.js, ?v= enz.). Elk script hoogstens 130 kB,
# zodat het in Kate te plakken is; sinds v183 is elk script een eigen versie (FIBRO_VERSIE een hoger): v209 ... v214.
# De mp3's zijn niet even groot: ze worden verdeeld over vakken van ~83 kB (het laatste vak kleiner, daar komt de code
# nog bij), telkens het grootste geluid in het vak waar het het krapst nog past. De tussenstanden <S>/stap1, stap2, ...
# maakt dit script zelf (de stand ervoor met de mp3's van dat stuk erbij en het versienummer een hoger).
# python3 -I maak_meme.py <map met bouw.py> <werkmap met oud/ en nieuw/>
import sys, os, re, shutil
sys.path.insert(0, sys.argv[1])
from bouw import bouw, versie_van
S = sys.argv[2]
KEUZE = ['hoorn', 'badumtss', 'kras', 'spanning', 'glijfluit', 'pijp', 'zoefweg', 'gameover', 'levelup', 'fout', 'ooh', 'aww', 'bruh',
         'viool', 'tadaa', 'bling', 'clown', 'piep', 'kazoo', 'uitglijden', 'slowmo', 'storing', 'roffel', 'woesj', 'woehoe', 'bang',
         'verrast', 'ieuw', 'giechel', 'trots', 'geeuw', 'bluergh', 'argh', 'ontroerd', 'dankbaar']
BESTANDEN = ['geluiden/%s.mp3' % k for k in KEUZE]
VAKKEN = [85000] * 5 + [57000]  # ruwe bytes per stuk (x ~1,45 in het script, plus ~10 kB; het laatste stuk ook de code)
groot = {b: os.path.getsize(S + '/nieuw/' + b) for b in BESTANDEN}
GROEP = [[] for _ in VAKKEN]; vrij = list(VAKKEN)
for b in sorted(BESTANDEN, key=lambda b: (-groot[b], b)):
    past = [i for i in range(len(VAKKEN)) if vrij[i] >= groot[b]]
    if not past: sys.exit('past niet: ' + b)
    i = min(past, key=lambda i: (vrij[i] - groot[b], i)); GROEP[i].append(b); vrij[i] -= groot[b]
for g in GROEP: g.sort(key=BESTANDEN.index)
N = len(GROEP)
v_oud, _ = versie_van(S + '/oud'); v_nieuw, datum = versie_van(S + '/nieuw')
if v_nieuw != v_oud + N: sys.exit('nieuw/index.html moet v%d zijn (%d stukken na v%d), is v%d' % (v_oud + N, N, v_oud, v_nieuw))
naam = lambda b: os.path.basename(b)[:-4]
vorige = S + '/oud'; gehad = []
for k, groep in enumerate(GROEP[:-1], 1):
    stap = S + '/stap%d' % k
    shutil.rmtree(stap, ignore_errors=True); shutil.copytree(vorige, stap, symlinks=True)
    for b in groep: shutil.copy(S + '/nieuw/' + b, stap + '/' + b)
    p = stap + '/index.html'; t = open(p, encoding='utf-8').read()
    t, n1 = re.subn(r"^const FIBRO_VERSIE = \d+$", 'const FIBRO_VERSIE = %d' % (v_oud + k), t, flags=re.M)
    t, n2 = re.subn(r"^const FIBRO_DATUM = '[\d-]+'$", "const FIBRO_DATUM = '%s'" % datum, t, flags=re.M)
    assert n1 == 1 and n2 == 1
    open(p, 'w', encoding='utf-8', newline='').write(t)
    uit = S + '/out/maak-meme-%d.py' % k
    r = bouw('meme-%d' % k, vorige, stap, gewijzigd=['index.html'], nieuwe=groep, oude_v=[],
             beschrijving="Meme-geluiden, stuk %d van %d: %s (v%d)" % (k, N, ', '.join(naam(b) for b in groep), v_oud + k),
             vereist=(['tests/gen/maak_vel5.py', 'tests/gen/testscript_vel5.py', 'stickerfx.js'] if k == 1 else gehad[-1:]),
             uitpad=uit)
    print(k, 'v%d' % (v_oud + k), r['inhoudsregels'], os.path.getsize(uit), [naam(b) for b in groep])
    assert os.path.getsize(uit) <= 130 * 1024, 'te groot om te plakken'
    gehad += groep; vorige = stap
uit = S + '/out/maak-meme-%d.py' % N
r = bouw('meme-%d' % N, vorige, S + '/nieuw',
    gewijzigd=['stickerfx.js', 'stickerkeuze.js', 'stickerwidget.js', 'stickermaker.js', 'moodsticker.js', 'chat.html', 'index.html', 'profiel.html',
               'vriend-profiel.html', 'tests/LEESMIJ.txt', 'tests/tools/proef43.py'],
    nieuwe=GROEP[-1] + ['tests/tools/geluiden6.py', 'tests/tools/proef102.py', 'tests/gen/maak_meme.py', 'tests/gen/testscript_meme.py'],
    oude_v=['stickerfx.js?v=180', 'stickerkeuze.js?v=208', 'stickerwidget.js?v=208', 'stickermaker.js?v=208', 'moodsticker.js?v=208'],
    beschrijving="Meme-geluiden, stuk %d van %d: de 35 geluiden in het Stickerlab, met %s (v%d)" % (N, N, ', '.join(naam(b) for b in GROEP[-1]), v_nieuw),
    vereist=gehad + ['stickervellen.js', 'eigenstickers.js', 'tests/gen/bouw.py'],
    uitpad=uit)
print(N, 'v%d' % v_nieuw, r['inhoudsregels'], os.path.getsize(uit), [naam(b) for b in GROEP[-1]])
assert os.path.getsize(uit) <= 130 * 1024, 'te groot om te plakken'
