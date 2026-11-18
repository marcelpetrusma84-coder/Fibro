# Hulpjes: een gedraaide rechthoek uit een bronplaatje recht en groot (S keer) uitknippen.
import cv2
S = 3
def recht(img, cx, cy, w, h, a, s=S, rand=0):
    """Knip de rechthoek (midden cx,cy, maat w x h, gedraaid a graden) recht uit, s keer zo groot."""
    W, H = int(round((w + 2 * rand) * s)), int(round((h + 2 * rand) * s))
    M = cv2.getRotationMatrix2D((cx, cy), a, s)
    M[0, 2] += W / 2 - cx; M[1, 2] += H / 2 - cy
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
def norm_hoek(a):
    return a + 180 if a < -90 else a
