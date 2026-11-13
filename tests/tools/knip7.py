# knip7.py <bron.jpg> <uitmap> [controle.png] : stickervel 7 (Sinterklaas, voor de Stekky Store) uit het plaatje van
# Marcel (13 nov 2026, 1024 x 559, 15 stickers met een witte rand op beige perkament; met roetveegpieten).
# Marcel koos er 12 (weg: 'Cadeautjes!' met tekst, 'Piet in schoorsteen!' met tekst en 'De roe!').
# <uitmap>/01.webp .. 12.webp = stickers/f7/. controle.png: alle 12 op een ruitjespatroon en op een donkere chat.
# Werkwijze zoals knip6.py: de witte rand van elke sticker zoeken, alles daarbinnen is de sticker; 380 px in een vak
# van 384 x 384, ~60% gevuld, strakke zachte rand, WebP 80. De bron is groot genoeg (stickers ~170 px): geen ESRGAN nodig,
# alleen Lanczos (zo'n 1,3 keer groter).
# Nodig: Pillow, numpy, scipy.
import sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

BRON, UIT = sys.argv[1], sys.argv[2]; CONTROLE = sys.argv[3] if len(sys.argv) > 3 else None
KWAL, STEIL, VULLING, RAND_ZACHT = 80, 2.5, 0.60, 1.2
os.makedirs(UIT, exist_ok=True)

beeld = np.asarray(Image.open(BRON).convert('RGB')).astype(np.int16)
H, W = beeld.shape[:2]
wit = (beeld.min(2) > 232) & (beeld.max(2) - beeld.min(2) < 24)
rand = nd.binary_dilation(wit, iterations=1)
lab, n = nd.label(rand)
groot = [(i + 1, s) for i, s in enumerate(nd.find_objects(lab)) if s and s[0].stop - s[0].start > 90 and s[1].stop - s[1].start > 90]
# rij op het midden (boven < 190 px, midden < 375 px, onder), dan links naar rechts
rij = lambda s: 0 if (s[0].start + s[0].stop) / 2 < 190 else 1 if (s[0].start + s[0].stop) / 2 < 375 else 2
groot.sort(key=lambda t: (rij(t[1]), t[1][1].start))
for _, s_ in groot: print('   midden', ((s_[1].start + s_[1].stop) // 2, (s_[0].start + s_[0].stop) // 2))
# volgorde op het plaatje (3 rijen van 5) en welke we houden
ALLE = ['sinterklaas', 'piet', 'schoentje', 'chocoladeletter', 'cadeautjes-tekst',
        'pakjesboot', 'cadeautjes', 'zak', 'ozosnel', 'piet-schoorsteen-tekst',
        'strooigoed', 'piet-dak', 'sint-en-piet', 'roe', 'mijter-staf']
WEG = {'cadeautjes-tekst', 'piet-schoorsteen-tekst', 'roe'}
assert len(groot) == 15, 'verwacht 15 stickers, gevonden: %d %s' % (len(groot), [(s[0].start, s[1].start) for _, s in groot])

vel = Image.new('RGBA', (6 * 200, 2 * 200), (0, 0, 0, 0)) if CONTROLE else None
i = 0
for (k, (sy, sx)), naam in zip(groot, ALLE):
    if naam in WEG: continue
    i += 1; nr = '%02d' % i
    m = 4
    y0, y1, x0, x1 = max(0, sy.start - m), min(H, sy.stop + m), max(0, sx.start - m), min(W, sx.stop + m)
    vak = beeld[y0:y1, x0:x1].copy()
    eigen = lab[y0:y1, x0:x1] == k
    for stap in range(0, 8):
        dicht = nd.binary_closing(eigen, structure=np.ones((3, 3)), iterations=stap) if stap else eigen
        voor = nd.binary_fill_holes(dicht)
        if voor.sum() > 0.45 * voor.size: break
    if stap: print('   %s: witte rand had een gaatje, dichtgemaakt in %d stap(pen)' % (nr, stap))
    vak[~voor] = 255
    groot_rgb = Image.fromarray(vak.astype(np.uint8))
    f = 3   # eerst ruim vergroten (Lanczos), dan een gladde rand maken, daarna terug naar 380 px
    rgb = groot_rgb.resize((groot_rgb.width * f, groot_rgb.height * f), Image.LANCZOS)
    alfa = Image.fromarray((voor * 255).astype(np.uint8)).resize(rgb.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(RAND_ZACHT * f))
    rgba = rgb.convert('RGBA'); rgba.putalpha(alfa)
    ys, xs = np.where(np.asarray(alfa) > 127)
    rgba = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    zijde = max(rgba.size); schaal = 380 / zijde
    vulling = (np.asarray(rgba)[..., 3] > 127).sum() * schaal ** 2 / 384 ** 2
    schaal *= min(1.0, (VULLING / vulling) ** 0.5)
    g = rgba.resize((max(1, round(rgba.width * schaal)), max(1, round(rgba.height * schaal))), Image.LANCZOS)
    a = np.asarray(g).astype(np.float32)
    a[..., 3] = np.clip((a[..., 3] / 255 - 0.5) * STEIL + 0.5, 0, 1) * 255
    g = Image.fromarray(np.round(a).astype(np.uint8))
    uit = Image.new('RGBA', (384, 384), (0, 0, 0, 0)); uit.alpha_composite(g, ((384 - g.width) // 2, (384 - g.height) // 2))
    arr = np.asarray(uit).copy(); arr[arr[..., 3] == 0, :3] = 0; uit = Image.fromarray(arr)
    uit.save('%s/%s.webp' % (UIT, nr), 'WEBP', quality=KWAL, method=6)
    print(nr, naam, 'bron', (x1 - x0, y1 - y0), '->', g.size, os.path.getsize('%s/%s.webp' % (UIT, nr)), 'bytes')
    if vel: vel.alpha_composite(uit.resize((192, 192), Image.LANCZOS), (((i - 1) % 6) * 200 + 4, ((i - 1) // 6) * 200 + 4))
assert i == 12
if CONTROLE:
    ruit = Image.new('RGBA', vel.size, (255, 255, 255, 255)); px = ruit.load()
    for y in range(vel.size[1]):
        for x in range(vel.size[0]):
            if (x // 12 + y // 12) % 2: px[x, y] = (200, 200, 200, 255)
    donker = Image.new('RGBA', vel.size, (20, 10, 40, 255))
    a = ruit.copy(); a.alpha_composite(vel); b = donker.copy(); b.alpha_composite(vel)
    samen = Image.new('RGB', (vel.size[0], vel.size[1] * 2)); samen.paste(a.convert('RGB'), (0, 0)); samen.paste(b.convert('RGB'), (0, vel.size[1]))
    samen.save(CONTROLE)
