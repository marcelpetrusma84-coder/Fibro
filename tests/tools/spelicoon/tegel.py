from PIL import Image
import os; R = os.environ.get('SPELICOON_RAW', './raw/')
PIXEL = {'swarm', 'endlessrunner'}
def bijsnijden(im):
    a = im.getchannel('A').point(lambda v: 255 if v > 8 else 0)
    return im.crop(a.getbbox())
def bron(spel):
    if spel == 'swarm': return bijsnijden(Image.open(R + 'swarm_24.png').convert('RGBA'))
    if spel == 'endlessrunner':
        a, b = [bijsnijden(Image.open(R + f'endlessrunner_{k}.png').convert('RGBA')) for k in ('kRunner', 'kGunner')]
        h = max(a.height, b.height); o = Image.new('RGBA', (a.width + b.width + 2, h), (0, 0, 0, 0))
        o.alpha_composite(a, (0, h - a.height)); o.alpha_composite(b, (a.width + 2, h - b.height)); return o
    if spel == 'shmup': return bijsnijden(Image.open(R + 'shmup_schip.png').convert('RGBA'))
    return bijsnijden(Image.open(R + spel + '.png').convert('RGBA'))
RUIMTE = {'breakout': 18, 'dammen': 10, 'vieroprij': 8}   # vierkante en ronde stukken iets kleiner, zodat ze niet groter lijken
def tegel(spel, maat=128, ruimte=6):
    ruimte = RUIMTE.get(spel, ruimte)
    im = bron(spel); doel = maat - 2 * ruimte
    s = doel / max(im.size)
    if spel in PIXEL:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    else:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    o = Image.new('RGBA', (maat, maat), (0, 0, 0, 0))
    o.alpha_composite(im, ((maat - im.width) // 2, (maat - im.height) // 2))
    return o
if __name__ == '__main__':
    import sys
    SPELLEN = ['botkaaseiren','vieroprij','schaken','dammen','pong','pacman','pinball','endlessrunner','breakout','swarm','shmup','flappybird']
    uit = sys.argv[1] if len(sys.argv) > 1 else None
    vel = Image.new('RGBA', (12 * 140, 300), (0, 0, 0, 255))
    for x in range(12 * 140):
        for y in range(150, 300): vel.putpixel((x, y), (236, 233, 245, 255))
    for i, s in enumerate(SPELLEN):
        t = tegel(s)
        vel.alpha_composite(t, (i * 140 + 6, 11)); vel.alpha_composite(t, (i * 140 + 6, 161))
        if uit: t.save(f'{uit}/{s}.webp', 'WEBP', quality=90, method=6)
    vel.convert('RGB').save(R + 'vel.png')
