# maak_hout.py (13 nov 2026) - tekent kaarten/hout.webp: het houten tafelblad onder Koningsjacht (kaartspel-hulp.js,
# optie ondergrond: 'hout'). Geen foto: alles wordt hier berekend (planken met nerven, knoesten en wat slijtage),
# dus er zit geen auteursrecht van iemand anders op.   python3 tests/gen/maak_hout.py
# Verander je het plaatje, verhoog dan ?v= van hout.webp in kaartspel-hulp.js.
import numpy as np
from PIL import Image, ImageFilter
import os

B, H = 720, 1280
rng = np.random.default_rng(1306)
y, x = np.mgrid[0:H, 0:B].astype(np.float32)


def ruis(schaal_x, schaal_y, octaven=4):
    """Zachte ruis: een paar lagen vergrote willekeurige rasters."""
    uit = np.zeros((H, B), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaven):
        gx, gy = max(2, int(B / schaal_x * 2 ** o)), max(2, int(H / schaal_y * 2 ** o))
        r = Image.fromarray((rng.random((gy, gx)) * 255).astype(np.uint8)).resize((B, H), Image.BICUBIC)
        uit += amp * (np.asarray(r, np.float32) / 255.0)
        tot += amp
        amp *= 0.5
    return uit / tot


PLANK = 180                      # vier planken van boven naar beneden (staand blad)
plank = (x // PLANK).astype(int)
lx = x - plank * PLANK
golf = ruis(200, 500, 3) * 90 + ruis(50, 260, 2) * 14
# nerven: lange, golvende jaarringen van boven naar beneden, met per plank een ander hart (de ringen buigen erom)
fase = np.array([0.0, 2.1, 4.7, 1.3])[np.clip(plank, 0, 3)]
hart = np.array([40.0, 130.0, 70.0, 150.0])[np.clip(plank, 0, 3)] + ruis(300, 900, 2) * 60
afstand = np.sqrt((lx - hart) ** 2 + ((y + fase * 300) % 2600 - 1300) ** 2 * 0.0004 + 1)
nerf = np.sin((afstand + golf) * 0.11 + fase * 7) * 0.5 + 0.5
nerf = (nerf ** 4) * (0.5 + 0.5 * ruis(80, 400, 2))
fijn = ruis(3, 160, 3)
streep = ruis(1.5, 90, 2)
# knoesten: ringen rond een paar punten
knoest = np.zeros((H, B), np.float32)
for _ in range(3):
    kx, ky = rng.uniform(40, B - 40), rng.uniform(80, H - 80)
    d = np.sqrt(((x - kx) * 1.6) ** 2 + ((y - ky) * 0.55) ** 2)
    knoest += np.exp(-d / 22) * (np.sin(d * 0.5) * 0.4 + 0.6)
licht = 0.55 + 0.25 * ruis(400, 700, 2) + 0.08 * (np.array([0.0, 0.6, -0.4, 0.3])[np.clip(plank, 0, 3)])
toon = np.clip(licht - 0.2 * nerf - 0.18 * fijn - 0.1 * streep - 0.3 * np.clip(knoest, 0, 1), 0, 1)

# warm eiken: van donker naar licht
donker, helder = np.array([58, 32, 15], np.float32), np.array([168, 112, 62], np.float32)
rgb = donker + (helder - donker) * toon[..., None]
# naden tussen de planken
naad = np.clip(1 - np.minimum(lx, PLANK - lx) / 3.0, 0, 1)
rgb *= (1 - 0.65 * naad)[..., None]
glans = np.clip(1 - np.minimum(lx, PLANK - lx) / 9.0, 0, 1) * (lx > PLANK / 2)
rgb += 18 * glans[..., None]
# kleine krasjes
for _ in range(60):
    x0, y0 = rng.uniform(0, B), rng.uniform(0, H)
    lengte, hoek = rng.uniform(20, 90), rng.uniform(-0.5, 0.5) + np.pi / 2 * rng.integers(0, 2)
    t = np.linspace(0, 1, 120)
    px = (x0 + np.cos(hoek) * lengte * t).astype(int); py = (y0 + np.sin(hoek) * lengte * t).astype(int)
    ok = (px >= 0) & (px < B) & (py >= 0) & (py < H)
    rgb[py[ok], px[ok]] *= 1.08
img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
uit = os.path.join(os.path.dirname(__file__), '..', '..', 'kaarten', 'hout.webp')
img.save(uit, 'WEBP', quality=72, method=6)
print('kaarten/hout.webp', os.path.getsize(uit) // 1024, 'kB')
