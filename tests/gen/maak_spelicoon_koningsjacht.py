# maak_spelicoon_koningsjacht.py (13 nov 2026) - spelicoon/koningsjacht.webp: de perkament-achterkant en de heer van
# harten uit kaarten/perkament/, schuin over elkaar op 128 x 128 (doorzichtig).   python3 tests/gen/maak_spelicoon_koningsjacht.py
from PIL import Image, ImageDraw, ImageFilter
import os
R = os.path.join(os.path.dirname(__file__), '..', '..')
GROOT = 512                                                  # eerst groot tekenen, dan netjes verkleinen
doek = Image.new('RGBA', (GROOT, GROOT), (0, 0, 0, 0))
def kaart(naam, hoek, midden):
    k = Image.open(os.path.join(R, 'kaarten', 'perkament', naam + '.webp')).convert('RGBA')
    k = k.resize((int(GROOT * 0.5), int(GROOT * 0.5 * 1.4)), Image.LANCZOS)
    masker = Image.new('L', k.size, 0); ImageDraw.Draw(masker).rounded_rectangle((0, 0, k.size[0] - 1, k.size[1] - 1), radius=int(k.size[0] * 0.07), fill=255)
    k.putalpha(Image.composite(k.getchannel('A'), Image.new('L', k.size, 0), masker))
    k = k.rotate(hoek, resample=Image.BICUBIC, expand=True)
    schaduw = Image.new('RGBA', k.size, (0, 0, 0, 0)); schaduw.putalpha(k.getchannel('A').point(lambda a: a * 0.45))
    schaduw = schaduw.filter(ImageFilter.GaussianBlur(10))
    x, y = midden[0] - k.size[0] // 2, midden[1] - k.size[1] // 2
    doek.alpha_composite(schaduw, (x + 6, y + 12)); doek.alpha_composite(k, (x, y))
kaart('achterkant', 14, (int(GROOT * 0.37), int(GROOT * 0.5)))
kaart('hH', -10, (int(GROOT * 0.63), int(GROOT * 0.5)))
uit = os.path.join(R, 'spelicoon', 'koningsjacht.webp')
doek.resize((128, 128), Image.LANCZOS).save(uit, 'WEBP', quality=88, method=6)
print('spelicoon/koningsjacht.webp', os.path.getsize(uit), 'bytes')
