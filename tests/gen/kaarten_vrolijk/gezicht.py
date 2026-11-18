# Het kleine gezichtje van de hartenaas weghalen: het nieuwe, grote lachende gezicht (zoals de ruitenaas) tekent de app
# zelf (vrGezicht in kaartspel-hulp.js), ook op de klaverenaas.
import cv2, numpy as np
def lichaam(rgba):
    a = rgba[..., 3] > 128
    m = cv2.erode(a.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=14)
    return a, m.astype(bool)
def oud_gezicht_weg(rgba):
    """Het kleine gezichtje van de hartenaas weg (donkere stipjes binnen het lichaam opvullen met de lichaamskleur)."""
    lab = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2LAB).astype(float)
    _, binnen = lichaam(rgba)
    med = np.median(lab[..., 0][binnen])
    ys, xs = np.where(binnen); zone = np.zeros_like(binnen)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    zone[int(y0 + .3 * (y1 - y0)):int(y0 + .7 * (y1 - y0)), int(x0 + .15 * (x1 - x0)):int(x0 + .85 * (x1 - x0))] = True
    m = (binnen & ((lab[..., 0] < med - 22) | (zone & (lab[..., 0] > med + 18)))).astype(np.uint8)
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    uit = rgba.copy(); uit[..., :3] = cv2.inpaint(rgba[..., :3], m, 9, cv2.INPAINT_TELEA)
    return uit
