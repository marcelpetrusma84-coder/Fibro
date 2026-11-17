# Hulpje: een figuurtje van de cremekleurige kaart losmaken (doorzichtige achtergrond).
# 1. ruwe voorgrond: donker of duidelijk gekleurd; 2. de achtergrond = de rest, uitgesmeerd over de gaten (dat volgt
# ook de zachte lichtvlek op de kaart); 3. hoe ver een pixel van die achtergrond af ligt = hoe ondoorzichtig;
# 4. gaten binnen een figuur (witte tanden, glimlichtjes) worden dicht; losse spikkels, de hoekjes en (bij 2 en 3) het
# losse teken bovenaan gaan weg.
import cv2, numpy as np
HOEKEN = [(0, 0, .26, .24), (.74, .76, 1, 1)]
def vul_gaten(m):
    h, w = m.shape; f = m.copy(); z = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(f, z, (0, 0), 1)
    return m | (1 - f)
def los(img, zonder_boventeken=False, t0=9, t1=26, hoeken=None):
    hoeken = HOEKEN if hoeken is None else hoeken
    H, W = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(float)
    ref = np.median(lab[int(H * .05):int(H * .2), int(W * .3):int(W * .7)].reshape(-1, 3), 0)
    chroma = np.hypot(lab[..., 1] - ref[1], lab[..., 2] - ref[2])
    fg0 = ((lab[..., 0] < ref[0] - 30) | (chroma > 14)).astype(np.uint8)
    fg0 = cv2.dilate(fg0, np.ones((15, 15), np.uint8))
    keep = (1 - fg0).astype(float)
    sig = 0.06 * W
    num = cv2.GaussianBlur(lab * keep[..., None], (0, 0), sig); den = cv2.GaussianBlur(keep, (0, 0), sig)[..., None]
    lbg = num / np.maximum(den, 1e-4)
    w8 = np.minimum(den[..., 0] * 4, 1)
    for _ in range(3):   # waar alles voorgrond was: verder uitsmeren
        lbg2 = cv2.GaussianBlur(lbg * w8[..., None], (0, 0), sig * 2) / np.maximum(cv2.GaussianBlur(w8, (0, 0), sig * 2), 1e-4)[..., None]
        lbg = lbg * w8[..., None] + lbg2 * (1 - w8[..., None])
    d = np.linalg.norm(lab - lbg, axis=2)
    a = np.clip((d - t0) / (t1 - t0), 0, 1)
    rand = int(0.04 * W); a[:rand] = a[-rand:] = 0; a[:, :rand] = a[:, -rand:] = 0
    for x0, y0, x1, y1 in hoeken: a[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 0
    m = (a > 0.5).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, labm, st, c = cv2.connectedComponentsWithStats(m)
    houd = np.zeros_like(m)
    for i in range(1, n):
        x, y, w, h, opp = st[i]
        if opp < 0.004 * H * W: continue
        if w < 0.05 * W and h > 0.12 * H: continue          # een lijntje van de kaart eronder
        if zonder_boventeken and y + h < 0.42 * H and opp < 0.05 * H * W: continue
        houd[labm == i] = 1
    houd = vul_gaten(houd)
    a = np.where(houd > 0, 1.0, a * cv2.dilate(houd, np.ones((7, 7), np.uint8)))
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    bg = cv2.cvtColor(np.clip(lbg, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(float)
    al = np.maximum(a, 0.05)[..., None]
    fg = np.clip(bg + (img.astype(float) - bg) / al, 0, 255)
    fg = np.where(a[..., None] > 0.9, img.astype(float), fg)
    return np.dstack([fg.astype(np.uint8), (a * 255).astype(np.uint8)])
