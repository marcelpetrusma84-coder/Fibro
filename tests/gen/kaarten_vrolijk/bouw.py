# Bouw de vrolijke kaarten (17 nov 2026, Marcel) -> kaarten/vrolijk/ en vakken.json (waar de app tekens tekent).
# De kaart zelf (rand, hoekjes, de tekens van 4 t/m 10, de naam onder de boer/vrouw/heer) tekent de app scherp;
# hier komen alleen de tekeningen vandaan: de figuurtjes van aas, 2 en 3 (doorzichtig), de portretten van boer, vrouw
# en heer, de joker en de achterkant.
import cv2, numpy as np, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from uitknip import recht, norm_hoek
from vrijstaand import los
from gezicht import oud_gezicht_weg
from hof import portret, WEG, teken_masker, PW, PH
from kleuren import herkleur   # 17 nov 2026: harten rood, ruiten geel, klaveren groen, schoppen blauw
APP = '../../../kaarten/vrolijk'; os.makedirs(APP, exist_ok=True)
VOORBEELD = 'voorbeeld'; os.makedirs(VOORBEELD, exist_ok=True)   # png's om te bekijken (niet bewaren)
FW, FH = 474, 678          # figuurtjes: zelfde verhouding als het binnenvlak van de kaart (232 x 332)
def bewaar(naam, img, q=84):
    cv2.imwrite(f'{APP}/{naam}.webp', img, [cv2.IMWRITE_WEBP_QUALITY, q])
    cv2.imwrite(f'{VOORBEELD}/{naam}.png', img)
# 1. de kaarten zoeken (zoals knip.py), dan aas, 2 en 3 per kleur
def zoek(naam):
    img = cv2.imread('bron/' + naam + '.jpg'); f = img.astype(int)
    r, g, b = f[:, :, 2], f[:, :, 1], f[:, :, 0]
    m = ((r - b > 14) & (r > 185) & (g > 170)).astype(np.uint8) * 255
    m = cv2.morphologyEx(cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    k = []
    for i in range(1, n):
        if st[i][4] < 6000: continue
        pts = np.column_stack(np.where(lab == i)[::-1]).astype(np.float32)
        (cx, cy), (w, h), a = cv2.minAreaRect(pts)
        if w > h: w, h, a = h, w, a - 90
        if cy < 384: k.append((cx, cy, w, h, norm_hoek(a)))
    return img, sorted(k)[:3]     # bovenste rij, van links: aas, 2, 3
BRON = {'h': 'harten', 'r': 'ruiten', 's': 'schoppen', 'k': 'klaveren'}
for kl, naam in BRON.items():
    img, rij = zoek(naam)
    for (cx, cy, w, h, a), wa in zip(rij, 'A23'):
        c = recht(img, cx, cy, w, h, a, s=3)
        r = los(c, zonder_boventeken=wa in '23')
        if kl + wa == 'hA': r = oud_gezicht_weg(r)          # het nieuwe gezicht tekent de app
        if kl in 'rs': r[..., :3] = herkleur(r[..., :3], kl, figuur=True, alpha=r[..., 3])
        bewaar(kl + wa, cv2.resize(r, (FW, FH), interpolation=cv2.INTER_AREA))
# 2. boer, vrouw, heer: hoekje en verkeerde tekens weg; waar een teken weg is tekent de app het goede teken
SET = {'k': 'kleur', 'h': 'kleur', 's': 'grijs', 'r': 'grijs'}
VERVANG = {'k': {'h'}, 'h': {'k'}, 's': set(), 'r': {'s'}}     # welke tekens in de tekening verkeerd zijn
vakken = {}
def rand_schoon(img):
    """Witte rand van de kaart ernaast (die lag er half overheen) wegwerken."""
    f = img.astype(int); r, b = f[..., 2], f[..., 0]
    m = ((r - b < 9) & (r > 222)).astype(np.uint8)
    band = np.zeros_like(m); band[:, -34:] = 1; band[:, :12] = 1; band[:12] = 1
    m = cv2.dilate(m * band, np.ones((5, 5), np.uint8))
    return cv2.inpaint(img, m, 7, cv2.INPAINT_TELEA)
for kl, set_ in SET.items():
    for wa in 'BVH':
        img, om = portret(set_, wa, True)
        gat = np.zeros(img.shape[:2], np.uint8); lijst = []
        for soort, vak in WEG[(set_, wa)]:
            if soort != 'hoek' and soort not in VERVANG[kl]: continue
            m, bb = teken_masker(img, soort, om(vak))
            if m is None: print('niet gevonden', kl, wa, soort, vak); continue
            if soort != 'hoek':
                x0, y0, x1, y1 = bb; w_, h_ = x1 - x0, y1 - y0; maat = min(w_, h_) * 1.1
                if h_ > 1.6 * w_:      # een teken bovenop een lange scepter: alleen het teken bovenaan weg
                    m = m.copy(); m[int(y0 + w_ * 1.15):] = 0
                    lijst.append([round((x0 + x1) / 2), round(y0 + maat / 2 - 2), round(maat)])
                else:
                    lijst.append([round((x0 + x1) / 2), round((y0 + y1) / 2), round(maat)])
                m = cv2.dilate(m, np.ones((11, 11), np.uint8))
            else: m = cv2.dilate(m, np.ones((7, 7), np.uint8))
            gat |= m
        gat = cv2.dilate(gat, np.ones((9, 9), np.uint8))
        img = cv2.inpaint(img, gat, 9, cv2.INPAINT_TELEA)
        img = herkleur(img, kl, wa + '_' + set_)            # de kleren in de kleur van de soort
        bewaar(kl + wa, img, 82)
        if lijst: vakken[kl + wa] = lijst
# 3. joker (alleen het figuurtje) en achterkant
j = cv2.imread('bron/ruiten-joker.jpg')
jk = los(recht(j, 1012, 512, 140, 200, 12, s=3), hoeken=[(0, 0, .22, .36), (.84, .84, 1, 1)])
bewaar('joker', cv2.resize(jk, (FW, int(FW * jk.shape[0] / jk.shape[1])), interpolation=cv2.INTER_AREA))
ak = recht(j, 1162.6, 571.6, 145.3, 212.9, 90 - 72.68, s=3)
bewaar('achterkant', ak, 82)
json.dump({'portret': [PW, PH], 'figuur': [FW, FH], 'joker': list(jk.shape[1::-1]), 'achterkant': list(ak.shape[1::-1]), 'tekens': vakken},
          open('vakken.json', 'w'), indent=1)
print(json.dumps(vakken))
