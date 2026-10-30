# knip_spelicoon.py <uitmap> : de plaatjes van de spellen (spelicoon/<spel>.webp, 30 okt 2026).
# Elk plaatje is een stukje uit het spel zelf: een schermafbeelding van spel.html?spel=<spel> in een browser van
# 400 x 720 punten op 3x (device_scale_factor=3), gemaakt met Playwright, met per spel een paar zetten zodat het
# goede element in beeld is (Tic-Tac-Toe: een X en een O; Four in a Row: drie schijven; Neo Paddle: midden in een
# potje; The Swarm: na het starten van Story; enz.). De schermafbeeldingen staan niet in de repo.
# KNIP: per spel het bestand en een vierkant (links, boven, zijde) in punten. Uit: 128 x 128, ronde hoeken, WebP 86.
# Een nieuw plaatje voor een bestaand spel: verhoog VERSIE in spelicoon.js en ?v= in chat.html en profiel.html.
import sys
from PIL import Image, ImageDraw
D = './'  # de map met de schermafbeeldingen (draai het script daar)
KNIP = {  # spel: (bestand, links, boven, zijde) in punten
  'botkaaseiren':  ('x_botkaaseiren.png', 150, 317, 195),
  'vieroprij':     ('x_vieroprij.png', 125, 430, 150),
  'schaken':       ('x_schaken.png', 74, 534, 60),
  'dammen':        ('x_dammen.png', 125, 310, 150),
  'pong':          ('x_pong_30.png', 78, 238, 150),
  'pacman':        ('x_pacman.png', 146, 305, 84),
  'pinball':       ('x_pinball2.png', 270, 170, 120),
  'endlessrunner': ('x_endlessrunner.png', 118, 311, 46),
  'breakout':      ('x_breakout.png', 100, 215, 185),
  'swarm':         ('sw_s1.png', 258, 212, 52),
  'shmup':         ('nr.png', 165, 590, 75),
  'flappybird':    ('fl.png', 85, 267, 60),
}
UIT = sys.argv[1]
vel = Image.new('RGB', (12 * 140, 150), (30, 20, 50))
for i, (spel, (f, x, y, z)) in enumerate(KNIP.items()):
    im = Image.open(D + f).convert('RGB').crop((x * 3, y * 3, (x + z) * 3, (y + z) * 3)).resize((128, 128), Image.LANCZOS)
    masker = Image.new('L', (128, 128), 0); ImageDraw.Draw(masker).rounded_rectangle((0, 0, 127, 127), 26, fill=255)
    rgba = im.convert('RGBA'); rgba.putalpha(masker)
    rgba.save(f'{UIT}/{spel}.webp', 'WEBP', quality=86, method=6)
    vel.paste(rgba, (i * 140 + 6, 11), rgba)
vel.save(D + 'iconen_vel.png')
