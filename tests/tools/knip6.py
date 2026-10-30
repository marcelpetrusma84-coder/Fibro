# knip6.py <bron.png> <EDSR_x4.pb> <uitmap> [controle.png] : stickervel 6 uit het plaatje van Marcel (30 okt 2026).
# <bron.png> (471 x 328, 12 grote emoji-stickers met een witte rand op donkerblauw, 4 x 3, met kleine stickertjes
# ertussen) staat niet in de repo. <uitmap>/01.webp .. 12.webp = stickers/f6/. controle.png: alle 12 op een
# ruitjespatroon en op een donkere chat.
# Het plaatje is klein (elke sticker ~95 px). Daarom vergroten we 4 keer met het model EDSR_x4 (OpenCV dnn_superres;
# het model komt van github.com/Saafke/EDSR_Tensorflow, Apache 2.0, en staat niet in de repo: het is alleen gereedschap).
# Nodig: Pillow, numpy, scipy, opencv-contrib-python-headless.
# Werkwijze (zoals knip5.py): de witte rand van elke sticker zoeken; alles binnen die rand is de sticker. Buiten de
# rand maken we het wit voor het vergroten (anders lekt het donkerblauw in de witte rand). Daarna: bijsnijden,
# vierkant, 380 px in een vak van 384 x 384, een strakke zachte rand van ~1 px, WebP 78.
import sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd
import cv2

BRON, MODEL, UIT = sys.argv[1], sys.argv[2], sys.argv[3]; CONTROLE = sys.argv[4] if len(sys.argv) > 4 else None
KWAL, STEIL = 78, 2.5
os.makedirs(UIT, exist_ok=True)
sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(MODEL); sr.setModel('edsr', 4)

beeld = np.asarray(Image.open(BRON).convert('RGB')).astype(np.int16)
H, W = beeld.shape[:2]
wit = (beeld.min(2) > 200) & (beeld.max(2) - beeld.min(2) < 45)
rand = nd.binary_dilation(wit, iterations=1)       # kleine gaatjes in de witte rand dicht
lab, n = nd.label(rand)
# De 12 grote stickers: witte randen van minstens 60 x 60 px, gesorteerd per rij (boven naar onder), dan links naar rechts
groot = [(i + 1, s) for i, s in enumerate(nd.find_objects(lab)) if s and s[0].stop - s[0].start > 60 and s[1].stop - s[1].start > 60]
assert len(groot) == 12, 'verwacht 12 stickers, gevonden: %d' % len(groot)
groot.sort(key=lambda t: (round(t[1][0].start / 100), t[1][1].start))
NAMEN = ['lachtranen', 'grijns', 'oeps', 'bleh', 'blij', 'snif', 'knipoog', 'gekkie', 'incognito', 'lippen', 'kushandje', 'vloek']

vel = Image.new('RGBA', (6 * 200, 2 * 200), (0, 0, 0, 0)) if CONTROLE else None
for i, (k, (sy, sx)) in enumerate(groot):
    nr = '%02d' % (i + 1)
    m = 4
    y0, y1, x0, x1 = max(0, sy.start - m), min(H, sy.stop + m), max(0, sx.start - m), min(W, sx.stop + m)
    vak = beeld[y0:y1, x0:x1].copy()
    eigen = lab[y0:y1, x0:x1] == k
    # de witte rand en alles wat erbinnen ligt. Bij 'bleh' heeft de rand een gaatje (rechts, bij het sterretje ernaast):
    # dan is er niets 'binnen'. Dan de rand stapje voor stapje dichtmaken tot de sticker het grootste deel van het vak vult.
    for stap in range(0, 6):
        dicht = nd.binary_closing(eigen, structure=np.ones((3, 3)), iterations=stap) if stap else eigen
        voor = nd.binary_fill_holes(dicht)
        if voor.sum() > 0.5 * voor.size: break
    if stap: print('   %s: witte rand had een gaatje, dichtgemaakt in %d stap(pen)' % (nr, stap))
    # de 1 px die we bij het dichten erbij smeerden: weer eraf, alleen waar het niet echt wit is
    echtwit = wit[y0:y1, x0:x1]
    buiten = ~voor
    voor = voor & ~(eigen & ~echtwit & nd.binary_dilation(buiten, iterations=1))
    vak[~voor] = 255                                 # buiten de sticker: wit, zodat er geen blauw de rand in lekt
    # 4 keer vergroten (EDSR verwacht BGR)
    bgr = cv2.cvtColor(vak.astype(np.uint8), cv2.COLOR_RGB2BGR)
    rgb = cv2.cvtColor(sr.upsample(bgr), cv2.COLOR_BGR2RGB)
    alfa = Image.fromarray((voor * 255).astype(np.uint8)).resize((rgb.shape[1], rgb.shape[0]), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    rgba = Image.fromarray(rgb).convert('RGBA'); rgba.putalpha(alfa)
    ys, xs = np.where(np.asarray(alfa) > 127)
    rgba = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    zijde = max(rgba.size); schaal = 380 / zijde
    g = rgba.resize((max(1, round(rgba.width * schaal)), max(1, round(rgba.height * schaal))), Image.LANCZOS)
    a = np.asarray(g).astype(np.float32)
    a[..., 3] = np.clip((a[..., 3] / 255 - 0.5) * STEIL + 0.5, 0, 1) * 255   # strakke rand van ~1 px
    g = Image.fromarray(np.round(a).astype(np.uint8))
    uit = Image.new('RGBA', (384, 384), (0, 0, 0, 0)); uit.alpha_composite(g, ((384 - g.width) // 2, (384 - g.height) // 2))
    arr = np.asarray(uit).copy(); arr[arr[..., 3] == 0, :3] = 0; uit = Image.fromarray(arr)
    uit.save('%s/%s.webp' % (UIT, nr), 'WEBP', quality=KWAL, method=6)
    print(nr, NAMEN[i], 'bron', (x1 - x0, y1 - y0), '->', g.size, os.path.getsize('%s/%s.webp' % (UIT, nr)), 'bytes')
    if vel: vel.alpha_composite(uit.resize((192, 192), Image.LANCZOS), ((i % 6) * 200 + 4, (i // 6) * 200 + 4))
if CONTROLE:
    ruit = Image.new('RGBA', vel.size, (255, 255, 255, 255)); px = ruit.load()
    for y in range(vel.size[1]):
        for x in range(vel.size[0]):
            if (x // 12 + y // 12) % 2: px[x, y] = (200, 200, 200, 255)
    donker = Image.new('RGBA', vel.size, (20, 10, 40, 255))
    a = ruit.copy(); a.alpha_composite(vel); b = donker.copy(); b.alpha_composite(vel)
    samen = Image.new('RGB', (vel.size[0], vel.size[1] * 2)); samen.paste(a.convert('RGB'), (0, 0)); samen.paste(b.convert('RGB'), (0, vel.size[1]))
    samen.save(CONTROLE)
