# De portretten van boer, vrouw en heer (binnen het lijntje), 3x zo groot en recht.
import cv2
from uitknip import recht
HOF = {   # bron, (midden x, midden y, breed, hoog, hoek) van het portretvak; de heer is met de hand gemeten
    'kleur': ('klaveren', {'B': (858, 486, 158, 187, 7.1), 'V': (1016, 512, 155, 182, 12.4), 'H': (1173, 556, 157, 185, 16.5)}),
    'grijs': ('schoppen', {'B': (858, 485, 158, 187, 6.9), 'V': (1017, 513, 155, 182, 12.7), 'H': (1173, 556, 157, 185, 16.5)}),
}
PW, PH = 474, 561   # vaste maat van een portret (3x)
def portret(set_, w, met_omrekening=False):
    """Het portret, PW x PH. Met met_omrekening ook een functie die een vak uit WEG (gemeten op het portret zonder
    bijsnijden) omrekent naar dit portret."""
    bron, maten = HOF[set_]
    img = cv2.imread('bron/' + bron + '.jpg')
    cx, cy, bw, bh, a = maten[w]
    c = recht(img, cx, cy, bw, bh, a, s=3)
    H, W = c.shape[:2]
    # randen eraf waar de witte kaartrand (van deze of de volgende kaart) of het donkere lijntje in het vak kwam
    f = c.astype(int); wit = (f.min(2) > 238) & (f[..., 2] - f[..., 0] < 10); donker = f.max(2) < 120
    rand = lambda v: v.mean() > .04
    r = W
    while r > W * .9 and (rand(wit[:, r - 1]) or donker[:, r - 1].mean() > .5): r -= 1
    l = 0
    while l < W * .05 and (rand(wit[:, l]) or donker[:, l].mean() > .5): l += 1
    o = H
    while o > H * .93 and (rand(wit[o - 1]) or donker[o - 1].mean() > .5): o -= 1
    t = 0
    while t < H * .05 and (rand(wit[t]) or donker[t].mean() > .5): t += 1
    r = max(r - 3, l + 10)
    uit = cv2.resize(c[t:o, l:r], (PW, PH), interpolation=cv2.INTER_AREA)
    if not met_omrekening: return uit
    def om(vak):
        x0, y0, x1, y1 = vak
        X = lambda x: int(round((x * W / PW - l) * PW / (r - l))); Y = lambda y: int(round((y * H / PH - t) * PH / (o - t)))
        return (max(0, X(x0)), max(0, Y(y0)), min(PW, X(x1)), min(PH, Y(y1)))
    return uit, om

# Wat er weg moet uit een portret, met een zoekvak (x0, y0, x1, y1) en het soort teken dat er staat.
# 'hoek' = de waarde en het teken linksboven (die tekent de app zelf, scherp en in de goede taal).
WEG = {
    ('kleur', 'B'): [('hoek', (0, 15, 85, 185)), ('k', (350, 80, 450, 175))],
    ('kleur', 'V'): [('hoek', (0, 15, 85, 185)), ('k', (370, 220, 450, 310)), ('k', (390, 455, 455, 550))],
    ('kleur', 'H'): [('hoek', (0, 10, 90, 190)), ('h', (340, 290, 420, 360))],
    ('grijs', 'B'): [('hoek', (0, 15, 85, 185)), ('s', (355, 110, 445, 205)), ('s', (205, 55, 260, 100))],
    ('grijs', 'V'): [('hoek', (0, 15, 85, 185)), ('s', (355, 195, 435, 290)), ('s', (220, 55, 270, 105))],
    ('grijs', 'H'): [('hoek', (0, 10, 90, 190)), ('s', (40, 150, 115, 275)), ('s', (340, 285, 415, 360))],
}
import numpy as np
def teken_masker(img, soort, vak):
    x0, y0, x1, y1 = vak
    reg = img[y0:y1, x0:x1]
    lab = cv2.cvtColor(reg, cv2.COLOR_BGR2LAB).astype(float)
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    if soort == 'hoek': m = (L < 150) | (np.hypot(A - 128, B - 128) > 30)   # niet het lichtgrijze zwaard van de heer
    elif soort == 'k': m = L < 120
    elif soort == 'h': m = (A > 150)
    else: m = (L < 135) & (np.hypot(A - 128, B - 128) < 22)
    m = m.astype(np.uint8)
    n, l, st, c = cv2.connectedComponentsWithStats(m)
    if n < 2: return None, None
    if soort == 'hoek': keep = np.isin(l, [i for i in range(1, n) if st[i][4] > 30])
    else: keep = l == 1 + np.argmax(st[1:, 4])
    vol = np.zeros(img.shape[:2], np.uint8); vol[y0:y1, x0:x1] = keep
    ys, xs = np.where(vol > 0)
    return vol, (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
