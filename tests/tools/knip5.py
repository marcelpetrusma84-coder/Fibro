# knip5.py <bronmap> <uitmap> [controle.png] : stickervel 5 (v206-v208) uit de twee plaatjes van Marcel (24 okt 2026).
# <bronmap>/plaat1.png en plaat2.png (1024 x 559, elk 6 x 3 stickers in een chatscherm, de stickers die hij niet wilde met
# een paars kruis erdoor) staan niet in de repo. <uitmap>/01.webp .. 12.webp = stickers/f5/. controle.png: alle 12 op
# een ruitjespatroon en op een donkere chat. Nodig: Pillow, numpy, scipy.
# Elke sticker heeft een witte rand. Alles wat van buitenaf bereikbaar is zonder die rand over te steken, is achtergrond
# (het chatscherm, het ruitjespatroon, de paarse kruizen van de stickers ernaast). Daarna: bijsnijden, vierkant,
# 380 px breed in een vak van 384 x 384 (zoals vel 1-4), een strakke zachte rand van ~1 px, WebP 78 (samen ~210 kB;
# kwaliteit 82 was ~235 kB: dan paste stickervel 5 niet in drie scripts van ~130 kB, en het verschil is niet te zien).
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage as nd
BRON, UIT = sys.argv[1], sys.argv[2]; CONTROLE = sys.argv[3] if len(sys.argv) > 3 else None
W, H = 1024 / 6, 559 / 3
SCHERP, KWAL, STEIL = 30, 78, 2.5  # verscherpen (%), WebP-kwaliteit, hoe strak de rand van het masker wordt
# (nr, plaatje, kolom, rij, naam)
STICKERS = [('01', 1, 3, 0, 'lol'), ('02', 2, 0, 1, 'rolf'), ('03', 2, 2, 1, 'omg'), ('04', 1, 2, 1, 'thx'), ('05', 1, 0, 2, 'vinkje'),
            ('06', 1, 2, 2, 'no'), ('07', 2, 4, 0, 'brb'), ('08', 2, 1, 0, 'vibing'), ('09', 1, 4, 1, 'noob'), ('10', 2, 3, 2, 'cringe'),
            ('11', 1, 3, 2, 'GOAT'), ('12', 2, 0, 0, 'meh')]  # 12 was eerst de goat (2, 2, 2); Marcel koos meh
os.makedirs(UIT, exist_ok=True)
bron = {1: Image.open(BRON + '/plaat1.png').convert('RGB'), 2: Image.open(BRON + '/plaat2.png').convert('RGB')}
# Bij 'noob' ligt de paarse streep van het kruis op de sticker ernaast over de witte rand (rechtsboven, bij de b): een gat
# van ~11 px. Dan loopt de achtergrond naar binnen en blijft alleen de rand over. Daar trekken we een stukje witte rand
# (lijnstukken in de coordinaten van het uitgeknipte vak, 5 px dik zoals de rand eromheen).
BRUG = {'09': [((130, 25), (141, 36))]}
def knip(nr, plaat, kol, rij):
    m = 6  # een paar pixels marge: de witte rand mag tot op de celgrens lopen
    box = (max(0, int(kol * W) - m), max(0, int(rij * H) - m), min(1024, int((kol + 1) * W) + m), min(559, int((rij + 1) * H) + m))
    vak = bron[plaat].crop(box)
    if nr in BRUG:
        tek = ImageDraw.Draw(vak)
        for p0, p1 in BRUG[nr]: tek.line([p0, p1], fill=(255, 255, 255), width=5)
    a = np.asarray(vak).astype(np.int16)
    mx, mn = a.max(2), a.min(2)
    wit = (mn > 205) & (mx - mn < 45)
    rand = nd.binary_dilation(wit, iterations=1)            # kleine gaatjes in de witte rand dicht
    lab, n = nd.label(~rand)
    randlab = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    achter = np.isin(lab, list(randlab))
    # de witte rand zelf hoort erbij, maar de 1 px die we erbij smeerden niet: weer 1 px eraf, alleen waar het niet wit is
    voor = ~achter & ~(rand & ~wit & nd.binary_dilation(achter, iterations=1))
    if nr in BRUG:
        # wat er van de paarse streep binnen de nieuwe rand ligt: wit, zoals de rand eromheen
        paars = nd.binary_dilation(np.abs(a - np.array([65, 31, 92])).max(2) < 32, iterations=1) & ~wit
        lp, _ = nd.label(paars)
        buiten = set(np.unique(lp[paars & ~voor])) - {0}
        weg = np.isin(lp, list(buiten)) & voor
        a = a.copy(); a[weg] = 255
        print('   %s: witte rand gedicht, %d paarse pixels wit gemaakt' % (nr, int(weg.sum())))
    # ingesloten stukjes achtergrond (bij 'rolf' tussen de tekst en het hoofd: het grijs van het chatscherm, helemaal
    # omringd door witte rand): weg, als bijna alle pixels de kleur van de achtergrond buiten de sticker hebben
    ac = a[achter & ~nd.binary_dilation(voor, iterations=3)]; ac = ac[::max(1, len(ac) // 400)]
    lab3, n3 = nd.label(~rand & voor)
    maat = np.bincount(lab3.ravel()); maat[0] = 0
    for i in range(1, n3 + 1):
        if i == maat.argmax() or maat[i] < 12: continue
        pix = a[lab3 == i]
        if (np.abs(pix[:, None, :] - ac[None, :, :]).max(2).min(1) < 14).mean() > 0.8:
            gat = lab3 == i
            voor = voor & ~gat & ~(rand & ~wit & nd.binary_dilation(gat, iterations=1))
            print('   %s: ingesloten stukje achtergrond weg (%d px)' % (nr, int(maat[i])))
    # alleen het grootste stuk en wat er dicht bij ligt (sterretjes, noten, uitroeptekens met een eigen witte rand)
    lab2, n2 = nd.label(voor)
    if n2 > 1:
        groot = np.bincount(lab2.ravel())[1:]
        hoofd = 1 + int(groot.argmax())
        dicht = nd.binary_dilation(lab2 == hoofd, iterations=14)
        houd = {hoofd} | {i + 1 for i, g in enumerate(groot) if g >= 40 and (dicht & (lab2 == i + 1)).any()}
        voor = np.isin(lab2, list(houd))
    return box, a.astype(np.uint8), voor
vel = Image.new('RGBA', (6 * 200, 2 * 200), (0, 0, 0, 0)) if CONTROLE else None
for i, (nr, plaat, kol, rij, naam) in enumerate(STICKERS):
    box, a, voor = knip(nr, plaat, kol, rij)
    ys, xs = np.where(voor); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    alfa = Image.fromarray((voor * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    rgba = Image.fromarray(a).convert('RGBA'); rgba.putalpha(alfa)
    rgba = rgba.crop((x0, y0, x1, y1))
    zijde = max(rgba.size); schaal = 380 / zijde
    groot = rgba.resize((max(1, round(rgba.width * schaal)), max(1, round(rgba.height * schaal))), Image.LANCZOS)
    if SCHERP: groot = groot.filter(ImageFilter.UnsharpMask(radius=1.2, percent=SCHERP, threshold=2))
    # het masker is ~2,5 keer vergroot en daardoor 3-4 px zacht: weer een strakke rand van ~1 px (mooier en kleiner)
    g = np.asarray(groot).astype(np.float32)
    g[..., 3] = np.clip((g[..., 3] / 255 - 0.5) * STEIL + 0.5, 0, 1) * 255
    groot = Image.fromarray(np.round(g).astype(np.uint8))
    uit = Image.new('RGBA', (384, 384), (0, 0, 0, 0)); uit.alpha_composite(groot, ((384 - groot.width) // 2, (384 - groot.height) // 2))
    # volledig doorzichtige pixels: kleur op 0 (kleiner bestand, geen randje van de oude achtergrond)
    arr = np.asarray(uit).copy(); arr[arr[..., 3] == 0, :3] = 0; uit = Image.fromarray(arr)
    uit.save('%s/%s.webp' % (UIT, nr), 'WEBP', quality=KWAL, method=6)
    print(nr, naam, 'bron', (x1 - x0, y1 - y0), '->', groot.size, os.path.getsize('%s/%s.webp' % (UIT, nr)), 'bytes')
    if vel: vel.alpha_composite(uit.resize((192, 192), Image.LANCZOS), ((i % 6) * 200 + 4, (i // 6) * 200 + 4))
if CONTROLE:
    # op een ruitjespatroon en op een donkere chat-achtergrond, om randjes en weggevallen stukjes te zien
    ruit = Image.new('RGBA', vel.size, (255, 255, 255, 255))
    px = ruit.load()
    for y in range(vel.size[1]):
        for x in range(vel.size[0]):
            if (x // 12 + y // 12) % 2: px[x, y] = (200, 200, 200, 255)
    donker = Image.new('RGBA', vel.size, (20, 10, 40, 255))
    a = ruit.copy(); a.alpha_composite(vel); b = donker.copy(); b.alpha_composite(vel)
    samen = Image.new('RGB', (vel.size[0], vel.size[1] * 2)); samen.paste(a.convert('RGB'), (0, 0)); samen.paste(b.convert('RGB'), (0, vel.size[1]))
    samen.save(CONTROLE)
