# Kleuren per soort (17 nov 2026, Marcel): harten rood, ruiten geel, klaveren groen, schoppen blauw, ook de kleren
# van boer, vrouw en heer. Gezichten, haar, baarden, kronen en zwaarden blijven zoals ze zijn (BESCHERM, in delen
# van het portret: x0, y0, x1, y1).
import cv2, numpy as np
DOEL = {'h': 0, 'r': 23, 'k': 72, 's': 108}           # tint (OpenCV, 0-180)
ROOD = lambda H, S, V: ((H <= 5) | (H >= 163)) & (S > 105) & (V < 225)     # niet huid en bruin haar (tint 6-16)
GROEN = lambda H, S, V: (H >= 27) & (H <= 115) & (S > 18) & (V < 225)     # olijfgroen en blauwgroen (niet het goud, tint < 27)
GRIJS = lambda H, S, V: ((S < 16) | ((H >= 95) & (H < 165))) & (V > 30) & (V < 205)     # niet de creme achtergrond
MANTEL = lambda H, S, V: ((H >= 150) | (H <= 5)) & (S > 30) & (V < 145)   # alleen donker (huid en wangen zijn lichter)     # de donkerrode mantel van de grijze heer
BRON = {'h': [GROEN], 'k': [ROOD], 'r': [GRIJS, MANTEL], 's': [GRIJS, MANTEL]}
BESCHERM = {   # hoofd (haar, gezicht, baard), en bij de grijze set de kroon en de scepter; gemeten op het rooster
    'B_kleur': [(.26, .17, .82, .51)],
    'V_kleur': [(.25, .17, .72, .53)],
    'H_kleur': [(.28, .19, .93, .63), (.08, .25, .28, .95)],
    'B_grijs': [(.25, .17, .80, .51)],
    'V_grijs': [(.23, .17, .77, .58), (.33, .02, .70, .20)],
    'H_grijs': [(.22, .17, .95, .66), (.30, .01, .95, .23), (.12, .18, .26, 1.0)],
}
def herkleur(img, kl, soort_set=None, figuur=False, alpha=None):
    """img: BGR. kl: soort. soort_set: 'B_kleur' enz. voor hofkaarten; figuur=True voor aas/2/3."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(float)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    Hh, Ww = H.shape
    m = np.zeros(H.shape, bool)
    if figuur:
        # de figuurtjes: het lichaam (rood bij ruiten, grijs bij schoppen); niet de witte tandjes en zwarte lijntjes
        if kl == 'r': m = (((H <= 14) | (H >= 160)) & (S > 50) & (V > 60)) & ~((V > 195) & (S < 90))   # niet de schaduw
        elif kl == 's': m = (S < 60) & (V > 45) & (V < 170)
        if alpha is not None: m &= alpha > 128
    else:
        for f in BRON[kl]: m |= f(H, S, V)
    w = m.astype(float)
    if kl == 'h' and not figuur:   # het grijzige blauwgroen van de boer: geleidelijk (anders wordt het vlekkerig)
        w = np.maximum(w, ((H >= 27) & (H <= 135) & (V < 225)) * np.clip((S - 5) / 14, 0, 1))
    if not figuur:
        bes = np.zeros(H.shape, np.uint8)
        for x0, y0, x1, y1 in BESCHERM.get(soort_set, []):   # zachte ovalen (geen rechte randen)
            cv2.ellipse(bes, (int((x0 + x1) / 2 * Ww), int((y0 + y1) / 2 * Hh)), (int((x1 - x0) / 2 * Ww * 1.1), int((y1 - y0) / 2 * Hh * 1.1)), 0, 0, 360, 1, -1)
        w = w * (1 - cv2.GaussianBlur(bes.astype(float), (0, 0), 6))
        if soort_set and soort_set.endswith('grijs'):   # lichtgrijs (zwaard, baard, bont, kroon) blijft
            w = w * (1 - np.clip((V - 150) / 30, 0, 1) * (S < 22))
    w = cv2.GaussianBlur(w, (0, 0), 1.2)
    nH = np.full_like(H, DOEL[kl])
    grijs = S < 75
    if kl == 'r' and figuur:   # de rand en de schaduwkant blijven donker (bruin), het lichaam wordt goudgeel
        licht = np.clip((V - 95) / 50, 0, 1)
        nH = np.where(licht > .5, DOEL['r'], 16).astype(float)
        nS = np.maximum(S, 185); nV = np.minimum(255, (V * .45 + 140) * licht + V * .8 * (1 - licht))
    elif kl == 'r':
        nS = np.where(grijs, 200, np.maximum(S, 190)); nV = np.minimum(255, V * .45 + 140)
    elif kl == 's':
        nS = np.where(grijs, 150, np.maximum(S, 150)); nV = np.minimum(255, V * .9 + 20)
    elif kl == 'h':
        nS = np.maximum(S, 140); nV = V
    else:
        nS = np.maximum(S, 120); nV = V * .95
    if figuur:   # zachter: het figuurtje houdt zijn glans
        nS = np.where(kl == 's', np.clip(S * 0 + 120 + (200 - V) * .3, 0, 255), nS)
    uit = np.stack([nH, nS, nV], -1).clip(0, [179, 255, 255]).astype(np.uint8)
    rgb = cv2.cvtColor(uit, cv2.COLOR_HSV2BGR).astype(float)
    return (img.astype(float) * (1 - w[..., None]) + rgb * w[..., None]).clip(0, 255).astype(np.uint8)
