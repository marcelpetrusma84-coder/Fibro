# radioskins_bouw.py (19 nov 2026) - knipt de radio-skins van Marcel uit zijn twee ontwerp-schermafbeeldingen en maakt
# ze klaar voor radio.js:
#  - het schermpje wordt leeggemaakt (de tekst "Intense Radio" en "Station 1 of 4" eruit): radio.js zet er de echte
#    zendernaam op;
#  - het vaste naaldje op de zenderschaal wordt weggepoetst (met een stukje schaal ernaast): radio.js tekent een
#    naaldje dat meeloopt met de zender.
# Schrijft radioskins/<naam>.webp en drukt de plekken (in procenten) af voor radioskins.js.
# python3 -I tests/gen/radioskins_bouw.py <a.jpg> <b.jpg> <c.jpg> <uitmap>
# (a en b: de eerste 7 skins; c (19 nov 2026, tweede ronde): draak, candy, onderwater, space)
import sys, json, os
from PIL import Image, ImageDraw

A, B, C, UIT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
# box = de radio in de schermafbeelding; plekken in pixels vanaf de linkerbovenhoek van de box
SKINS = {
 'hout': ('A', (49, 477, 657, 747), dict(speaker=(12,15,198,165), vorige=(216,18,270,110), scherm=(281,19,526,109), volgende=(537,18,591,110), schaal=(216,125,592,165),
   p=[(13,195,61,245),(71,195,118,245),(128,195,177,245),(186,195,234,245)], play=(463,220,37), knop=(553,220,38))),
 'neon': ('A', (49, 798, 657, 1053), dict(speaker=(13,17,197,163), vorige=(218,20,268,108), scherm=(282,22,525,108), volgende=(540,20,588,108), schaal=(217,126,591,158),
   p=[(15,190,60,236),(73,190,118,236),(130,190,176,236),(188,190,234,236)], play=(463,212,37), knop=(553,212,37))),
 'scifi': ('A', (47, 1100, 657, 1345), dict(speaker=(15,17,197,150), vorige=(218,19,270,101), scherm=(282,20,526,101), volgende=(538,19,591,101), schaal=(220,112,591,147),
   p=[(16,175,64,225),(74,175,122,225),(131,175,179,225),(189,175,237,225)], play=(464,197,36), knop=(555,197,37))),
 'natuur': ('B', (35, 249, 666, 496), dict(speaker=(29,28,211,148), vorige=(231,30,284,100), scherm=(296,33,539,98), volgende=(551,30,605,100), schaal=(231,113,605,138),
   p=[(28,175,75,218),(85,175,133,218),(143,175,190,218),(200,175,248,218)], play=(477,191,36), knop=(567,191,38))),
 'graffiti': ('B', (49, 533, 657, 752), dict(speaker=(15,15,197,120), vorige=(217,18,270,75), scherm=(282,20,525,75), volgende=(537,18,591,75), schaal=(217,85,591,115),
   p=[(14,145,62,195),(72,145,119,195),(129,145,176,195),(186,145,234,195)], play=(462,170,40), knop=(554,170,38))),
 'pixel': ('B', (49, 797, 657, 1055), dict(speaker=(13,16,197,163), vorige=(217,20,270,108), scherm=(281,20,525,108), volgende=(538,20,590,108), schaal=(216,125,591,161),
   p=[(14,188,62,238),(72,188,119,238),(129,188,177,238),(186,188,234,238)], play=(463,211,37), knop=(554,211,38))),
 'draak': ('C', (32, 163, 443, 310), dict(speaker=(13,14,136,100), vorige=(148,12,180,67), scherm=(188,12,356,67), volgende=(363,12,395,67), schaal=(146,72,398,97),
   p=[(14,104,46,136),(51,104,83,136),(89,104,121,136),(126,104,158,136)], play=(313,120,22), knop=(375,119,23))),
 'candy': ('C', (25, 333, 450, 510), dict(speaker=(20,20,142,102), vorige=(155,19,190,75), scherm=(197,19,360,75), volgende=(368,19,403,75), schaal=(155,87,403,109),
   p=[(27,124,50,159),(63,124,87,159),(101,124,124,159),(138,124,161,159)], play=(318,140,18), knop=(380,139,25))),
 'onderwater': ('C', (30, 537, 444, 709), dict(speaker=(13,13,137,110), vorige=(150,15,185,73), scherm=(192,15,357,73), volgende=(365,15,400,73), schaal=(148,83,400,106),
   p=[(11,125,45,159),(51,125,85,159),(90,125,124,159),(130,125,164,159)], play=(314,142,24), knop=(375,141,25))),
 'space': ('C', (30, 736, 444, 905), dict(speaker=(12,17,137,107), vorige=(150,19,183,72), scherm=(192,17,358,74), volgende=(366,19,399,72), schaal=(148,80,400,104),
   p=[(12,122,45,155),(50,122,83,155),(90,122,123,155),(130,122,162,155)], play=(314,137,25), knop=(377,136,26))),
 'steampunk': ('B', (49, 1099, 657, 1345), dict(speaker=(13,15,197,150), vorige=(217,18,270,95), scherm=(280,20,526,108), volgende=(538,18,590,95), schaal=(217,115,591,148),
   p=[(15,175,62,225),(72,175,120,225),(130,175,177,225),(187,175,235,225)], play=(464,198,36), knop=(554,198,40))),
}
# hoeveel het schermpje naar binnen moet om de rand te sparen (links, boven, rechts, onder)
# tweede ronde: het schermpje vullen met een verloop van de rand boven naar de rand onder (de tekst loopt daar bijna
# tot de rechterrand, en in de hoeken staan versieringen)
VERLOOP = {'draak', 'candy', 'onderwater', 'space'}
INZET = {'draak': (7, 6, 5, 6), 'candy': (6, 6, 6, 6), 'onderwater': (6, 6, 6, 6), 'space': (7, 7, 7, 7), 'hout': (10, 9, 9, 9), 'neon': (10, 9, 10, 9), 'scifi': (10, 9, 10, 9), 'natuur': (10, 8, 10, 8), 'graffiti': (10, 6, 10, 6), 'pixel': (11, 10, 11, 10), 'steampunk': (16, 12, 18, 12)}

def leegScherm(im, r, inzet):
    x0, y0, x1, y1 = r
    a, b, c, d = inzet
    x0 += a; y0 += b; x1 -= c; y1 -= d
    px = im.load()
    rijen = []
    for y in range(y0, y1):
        kol = sorted([px[x, y] for x in range(x1 - 6, x1 - 1)], key=lambda p: sum(p))
        rijen.append(kol[len(kol) // 2])
    # een beetje gladstrijken (geen strepen van gloed of glitch)
    for i, y in enumerate(range(y0, y1)):
        buren = rijen[max(0, i - 4):i + 5]
        kleur = tuple(sum(c[k] for c in buren) // len(buren) for k in range(3))
        for x in range(x0, x1): px[x, y] = kleur
    return (x0, y0, x1, y1)

def verloopScherm(im, r, inzet):
    x0, y0, x1, y1 = r
    a, b, c, d = inzet
    x0 += a; y0 += b; x1 -= c; y1 -= d
    px = im.load()
    rij = lambda y: sorted([px[x, y] for x in range(x0, x1)], key=lambda p: sum(p))
    boven = [rij(y)[(x1 - x0) // 2] for y in range(y0 - 2, y0 + 1)]
    onder = [rij(y)[(x1 - x0) // 2] for y in range(y1 - 1, y1 + 2)]
    gem = lambda l: tuple(sum(c[k] for c in l) // len(l) for k in range(3))
    kb, ko = gem(boven), gem(onder)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - 1 - y0)
        kleur = tuple(round(kb[k] * (1 - t) + ko[k] * t) for k in range(3))
        for x in range(x0, x1): px[x, y] = kleur
    return (x0, y0, x1, y1)

def poetsNaald(im, schaal):
    x0, y0, x1, y1 = schaal
    # het vaste naaldje staat ongeveer 20-45 pixels van links; vul aan met de schaal 4 streepjes verder (64 px)
    gat = (x0 + 10, y0 + 1, x0 + 52, y1 - 1)
    stuk = im.crop((gat[0] + 64, gat[1], gat[2] + 64, gat[3]))
    im.paste(stuk, gat[:2])

os.makedirs(UIT, exist_ok=True)
plekken = {}
for naam, (bron, box, p) in SKINS.items():
    src = Image.open({'A': A, 'B': B, 'C': C}[bron]).convert('RGB')
    im = src.crop(box)
    w, h = im.size
    scherm = (verloopScherm if naam in VERLOOP else leegScherm)(im, p['scherm'], INZET[naam])
    poetsNaald(im, p['schaal'])
    im.save(os.path.join(UIT, naam + '.webp'), 'WEBP', quality=86, method=6)
    pct = lambda r: [round(r[0] / w * 100, 2), round(r[1] / h * 100, 2), round((r[2] - r[0]) / w * 100, 2), round((r[3] - r[1]) / h * 100, 2)]
    cirkel = lambda c: pct((c[0] - c[2], c[1] - c[2], c[0] + c[2], c[1] + c[2]))
    plekken[naam] = {'b': w, 'h': h, 'scherm': pct(scherm), 'vorige': pct(p['vorige']), 'volgende': pct(p['volgende']), 'schaal': pct(p['schaal']),
                     'speaker': pct(p['speaker']), 'p': [pct(x) for x in p['p']], 'play': cirkel(p['play']), 'knop': cirkel(p['knop'])}
print(json.dumps(plekken))
