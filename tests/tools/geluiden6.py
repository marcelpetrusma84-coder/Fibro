# geluiden6.py - de meme-, montage- en emotiegeluiden van v209-v214, met code gemaakt (numpy/scipy), als mp3.
# Op 24 okt 2026 waren er 48 proefgeluiden (een luisterpagina); Marcel koos er 35 (KEUZE). De andere 13 staan hier nog
# wel in, want ze gebruiken dezelfde toevalsreeks (20261024): zonder hen klinken de gekozen geluiden anders.
# Naar geluiden5.py: zelfde hulpjes en afwerking (stilte eraf, 12 ms uitfaden, RMS -21 dB, piek hoogstens -1 dB, ffmpeg
# libmp3lame mono, zonder ID3-tag), maar 64 kbps (was 128): niet te horen op een telefoon en de helft kleiner (Fibro haalt
# alle stickergeluiden op na de eerste tik). Eigen geluiden in de stijl van bekende meme- en montagegeluiden; geen
# opnames of melodieen van anderen. In stickerfx.js: mp3: true en een terug-geluid (het 4e veld).
# python3 -I geluiden6.py <uitmap> [alle]      (bijv. <map>/geluiden; 'alle' = ook de 13 die niet gekozen zijn)
import sys, os, math, subprocess, json
import numpy as np
from scipy import signal

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
ALLE = len(sys.argv) > 2 and sys.argv[2] == 'alle'
KEUZE = ['hoorn', 'badumtss', 'kras', 'spanning', 'glijfluit', 'pijp', 'zoefweg', 'gameover', 'levelup', 'fout', 'ooh', 'aww', 'bruh',
         'viool', 'tadaa', 'bling', 'clown', 'piep', 'kazoo', 'uitglijden', 'slowmo', 'storing', 'roffel', 'woesj', 'woehoe', 'bang',
         'verrast', 'ieuw', 'giechel', 'trots', 'geeuw', 'bluergh', 'argh', 'ontroerd', 'dankbaar']
KBPS = 64
rng = np.random.default_rng(20261024)

# ---------- hulpjes (zoals geluiden5.py) ----------
def ruis(sec): return rng.standard_normal(int(sec * SR))
def bp(x, lo, hi, orde=4): return signal.sosfilt(signal.butter(orde, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, orde=4): return signal.sosfilt(signal.butter(orde, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, orde=4): return signal.sosfilt(signal.butter(orde, f, 'highpass', fs=SR, output='sos'), x)
def reso(x, f, bw):
    r = math.exp(-math.pi * bw / SR); th = 2 * math.pi * f / SR
    return signal.lfilter([1 - r], [1, -2 * r * math.cos(th), r * r], x)
def formanten(x, fs, bws=(90, 110, 160), gains=(1.0, 0.6, 0.3)):
    return sum(g * reso(x, f, b) for f, b, g in zip(fs, bws, gains))
def formanten_glijdend(x, f_van, f_naar, bws=(90, 110, 160), gains=(1.0, 0.6, 0.3), stukken=24):
    n = len(x); uit = np.zeros(n); st = n // stukken + 1; venster = np.hanning(2 * st)
    for k in range(stukken):
        a = max(0, k * st - st // 2); b = min(n, a + 2 * st); w = k / max(1, stukken - 1)
        fs = [fv + (fn - fv) * w for fv, fn in zip(f_van, f_naar)]
        uit[a:b] += formanten(x[a:b], fs, bws, gains) * venster[:b - a]
    return uit
def glottis(f0):
    fase_ = np.cumsum(f0 / SR) % 1.0
    return lp(2 * fase_ - 1, 3500, 2)
def omhul(n, aan, uit, vorm=2.0):
    e = np.ones(n); a = min(n, int(aan * SR)); u = min(n, int(uit * SR))
    if a: e[:a] = np.linspace(0, 1, a) ** 1.5
    if u: e[-u:] *= np.linspace(1, 0, u) ** vorm
    return e
def zet(doel, x, op):
    i = int(op * SR)
    if i >= len(doel): return doel
    j = min(len(doel), i + len(x)); doel[i:j] += x[:j - i]; return doel
def galm(x, nat=0.35, tijden=(0.0297, 0.0371, 0.0411, 0.0437), ap=(0.005, 0.0017), terug=0.8):
    y = np.zeros(len(x) + int(1.6 * SR)); xx = np.concatenate([x, np.zeros(len(y) - len(x))])
    som = np.zeros_like(y)
    for d in tijden:
        n = int(d * SR); a = np.zeros(n + 1); a[0] = 1; a[n] = -terug
        som += signal.lfilter([1], a, xx)
    for d in ap:
        n = int(d * SR); g = 0.7; b = np.zeros(n + 1); b[0] = -g; b[n] = 1; a = np.zeros(n + 1); a[0] = 1; a[n] = -g
        som = signal.lfilter(b, a, som)
    return (1 - nat) * xx + nat * som / len(tijden)

# ---------- nieuwe hulpjes ----------
def t_(sec): return np.arange(int(sec * SR)) / SR
def fase(f): return 2 * np.pi * np.cumsum(np.asarray(f, float)) / SR
def lijn(punten, sec):
    ts, vs = zip(*punten); return np.interp(t_(sec), ts, vs)
def vol(f, sec): return np.full(int(sec * SR), float(f))
def zaag(f): return signal.sawtooth(fase(f))
def vierkant(f, duty=0.5): return signal.square(fase(f), duty)
def driehoek(f): return signal.sawtooth(fase(f), 0.5)
def trillen(n, sterkte, snel=30):
    j = lp(rng.standard_normal(n), snel, 2); return 1 + sterkte * j / (np.std(j) or 1)
def reso_glij(x, f, bw):
    # tweede-orde resonator waarvan de toonhoogte meeschuift (f per sample)
    n = len(x); f = np.broadcast_to(np.asarray(f, float), (n,))
    r = math.exp(-math.pi * bw / SR); c = 2 * r * np.cos(2 * np.pi * f / SR); g = 1 - r; rr = r * r
    y = np.zeros(n); y1 = y2 = 0.0
    for i in range(n):
        v = g * x[i] + c[i] * y1 - rr * y2; y[i] = v; y2 = y1; y1 = v
    return y
KLINKER = {'a': (800, 1200, 2600), 'aa': (750, 1150, 2500), 'e': (500, 1800, 2500), 'i': (300, 2300, 3000), 'o': (500, 850, 2500),
           'oe': (320, 800, 2400), 'u': (350, 1700, 2300), 'uh': (620, 1180, 2400), 'eu': (450, 1500, 2400), 'm': (250, 1200, 2400)}
def stem(f0, klinkers, adem=0.06, jitter=0.0, schaal=1.0, gains=(1.0, 0.5, 0.2)):
    # een stem: stembanden (glottis) door formanten; meerdere klinkers = er geleidelijk doorheen glijden
    f0 = np.asarray(f0, float); n = len(f0)
    if jitter: f0 = f0 * trillen(n, jitter)
    bron = glottis(f0) + adem * bp(rng.standard_normal(n), 700, 7000)
    K = [tuple(v * schaal for v in KLINKER[k]) for k in klinkers]
    if len(K) == 1: return formanten(bron, K[0], gains=gains)
    delen = len(K) - 1; grens = np.linspace(0, n, delen + 1).astype(int); ov = min(int(0.02 * SR), n // (4 * delen))
    uit = np.zeros(n)
    for k in range(delen):
        a = max(0, grens[k] - ov); b = min(n, grens[k + 1] + ov)
        stuk = formanten_glijdend(bron[a:b], K[k], K[k + 1], gains=gains, stukken=8)
        w = np.ones(b - a)
        if k > 0: w[:2 * ov] = np.linspace(0, 1, 2 * ov)
        if k < delen - 1: w[-2 * ov:] = np.linspace(1, 0, 2 * ov)
        uit[a:b] += stuk * w
    return uit
def norm(x, niveau=1.0):
    # een stuk op een vaste luidheid (RMS 0,1 x niveau): een stem is bij de ene toonhoogte veel sterker dan bij de andere
    r = math.sqrt(np.mean(np.asarray(x) ** 2)); return x * (0.1 * niveau / r) if r > 0 else x
def effen(x, win=0.04):
    # de luidheid gelijk maken (daarna zelf een verloop erop zetten)
    k = int(win * SR); e = np.sqrt(np.convolve(x ** 2, np.ones(k) / k, 'same')); e = np.maximum(e, e.max() * 0.05)
    return x / e * 0.1
def adem_klank(sec, klinker, lo=700):
    return formanten(hp(ruis(sec), lo), KLINKER[klinker])
def snare(sec=0.25, f=190, toon=0.5):
    t = t_(sec); return bp(ruis(sec), 1200, 7000) * np.exp(-t * 25) + toon * np.sin(2 * np.pi * f * t) * np.exp(-t * 30)
def kick(sec=0.45, f0=130, f1=45):
    t = t_(sec); return np.sin(fase(f1 + (f0 - f1) * np.exp(-t * 25))) * np.exp(-t * 8)
def tom(sec, f0, f1):
    t = t_(sec); return np.sin(fase(f1 + (f0 - f1) * np.exp(-t * 15))) * np.exp(-t * 7) + 0.15 * bp(ruis(sec), 300, 3000) * np.exp(-t * 40)
def bekken(sec=1.2):
    t = t_(sec); return hp(ruis(sec), 5000) * np.exp(-t * 3.5) + 0.5 * bp(ruis(sec), 3000, 9000) * np.exp(-t * 6)
def tik(sec=0.03, lo=1500, hi=6000):
    t = t_(sec); return bp(ruis(sec), lo, hi) * np.exp(-t * 150)
def bel(f, sec, d=4.0, delen=((1, 1.0), (2.76, 0.4), (5.4, 0.2))):
    t = t_(sec); return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d * r ** 0.5) for r, a in delen)

G = {}  # code: (functie, nl, en, terug, groep, uitleg)
def geluid(code, nl, en, terug, groep, uitleg):
    def deco(f): G[code] = (f, nl, en, terug, groep, uitleg); return f
    return deco

# ================= Dramatisch =================
@geluid('dreun', 'Diepe boem', 'Deep boom', 'boem', 'Dramatisch', 'Een zware dreun met galm, voor een plot twist')
def dreun():
    n = int(2.2 * SR); t = t_(2.2)
    f = 38 + 44 * np.exp(-t * 2.2)
    uit = np.tanh(2.4 * np.sin(fase(f)) * np.exp(-t * 1.6)) * 0.8
    uit += lp(zaag(f * 2), 420) * np.exp(-t * 3) * 0.3
    zet(uit, lp(ruis(0.08), 900) * np.exp(-t_(0.08) * 60) * 0.8, 0)
    return galm(uit * omhul(n, 0.003, 0.4), nat=0.25)[:int(2.4 * SR)]

@geluid('hoorn', 'Luchthoorn', 'Air horn', 'alarm', 'Dramatisch', 'Drie keer toeteren, voor iets epics')
def hoorn():
    uit = np.zeros(int(1.6 * SR))
    for op, lang in ((0, 0.16), (0.22, 0.16), (0.44, 0.9)):
        n = int(lang * SR); t = t_(lang); buig = 1 + 0.04 * (1 - np.exp(-t * 30))
        s = sum(a * zaag(vol(f, lang) * buig) for f, a in ((466.2, 1.0), (587.3, 0.8), (698.5, 0.6)))
        zet(uit, np.tanh(1.8 * bp(s, 250, 3500)) * omhul(n, 0.008, 0.05) * 0.5, op)
    return galm(uit, nat=0.15)[:int(1.7 * SR)]

@geluid('badumtss', 'Ba-dum-tss', 'Ba dum tss', 'klets', 'Dramatisch', 'Drumpje na een slechte grap')
def badumtss():
    uit = np.zeros(int(1.8 * SR))
    zet(uit, snare(0.25) * 0.6 + tom(0.25, 170, 125) * 0.7, 0.0)
    zet(uit, tom(0.4, 120, 85) * 0.9 + kick(0.4) * 0.4, 0.16)
    zet(uit, snare(0.2) * 0.4, 0.45); zet(uit, kick(0.45) * 0.7, 0.45); zet(uit, bekken(1.3) * 0.55, 0.45)
    return galm(uit, nat=0.12)[:int(1.9 * SR)]

@geluid('kras', 'Platenkras', 'Record scratch', 'error', 'Dramatisch', 'De muziek stopt: wacht even...')
def kras():
    bron_t = 1.0
    bron = lp(sum(zaag(vol(f, bron_t)) for f in (130.8, 196.0, 261.6, 329.6)) * 0.3 + bp(ruis(bron_t), 500, 4000) * 0.4, 5000)
    zet(bron, kick(0.3) * 0.8, 0.0); zet(bron, kick(0.3) * 0.8, 0.25)
    T = 0.95; t = t_(T)
    pos = np.interp(t, [0, 0.33, 0.40, 0.48, 0.55, 0.63, 0.70, T], [0, 0.33, 0.17, 0.38, 0.19, 0.36, 0.33, 0.33])
    pos = lp(np.concatenate([np.zeros(200), pos]), 60, 2)[200:]
    snel = np.abs(np.gradient(pos) * SR)
    sterk = np.clip(snel, 0, 1.6) ** 0.6
    uit = bron[np.clip((pos * SR).astype(int), 0, len(bron) - 1)] * sterk
    return uit * omhul(len(uit), 0.01, 0.05)

@geluid('spanning', 'Spanningsakkoord', 'Suspense sting', 'drama', 'Dramatisch', 'Duuuuun... vlak voor een onthulling')
def spanning():
    T = 2.0; n = int(T * SR); t = t_(T)
    s = sum(zaag(vol(f, T) * (1 + 0.003 * np.sin(2 * np.pi * (5 + 0.4 * k) * t + k))) for k, f in enumerate((65.4, 98.0, 130.8, 155.6, 185.0)))
    s = s * (1 + 0.25 * np.sin(2 * np.pi * 7 * t))
    mix = np.linspace(0, 1, n) ** 2
    uit = np.zeros(int(2.6 * SR))
    zet(uit, (lp(s, 500) * (1 - mix) + lp(s, 2500) * mix) * omhul(n, 1.6, 0.05, 1.0) * 0.25, 0)
    m = int(0.6 * SR); tt = t_(0.6)
    hit = lp(sum(zaag(vol(f, 0.6)) for f in (65.4, 130.8, 155.6, 196.0)), 1500) * np.exp(-tt * 5) * 0.3
    zet(uit, hit + kick(0.6, 90, 35) * 0.9 + bekken(0.6) * 0.2, T)
    return galm(uit, nat=0.3)[:int(2.6 * SR)]

# ================= Cartoon =================
@geluid('bonk', 'Bonk', 'Bonk', 'klets', 'Cartoon', 'Houten klap op het hoofd')
def bonk():
    t = t_(0.7)
    uit = (np.sin(2 * np.pi * 310 * t) * np.exp(-t * 28) + 0.6 * np.sin(2 * np.pi * 830 * t) * np.exp(-t * 45) + 0.3 * np.sin(2 * np.pi * 1450 * t) * np.exp(-t * 70)) * 0.8
    uit += bp(ruis(0.7), 1500, 6000) * np.exp(-t * 200) * 0.6
    uit += np.sin(fase(90 + 60 * np.exp(-t * 20))) * np.exp(-t * 18) * 0.7
    for k, f in enumerate((2093, 2637, 3136)): zet(uit, bel(f, 0.25, d=10) * 0.12, 0.25 + 0.08 * k)
    return uit

@geluid('glijfluit', 'Glijfluit', 'Slide whistle', 'fluit', 'Cartoon', 'Omhoog en weer omlaag, voor iets raars')
def glijfluit():
    T = 1.3; n = int(T * SR); t = t_(T)
    f = lijn([(0, 520), (0.5, 1900), (0.62, 1900), (1.25, 420), (T, 420)], T) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    s = np.sin(fase(f)) + 0.15 * np.sin(fase(2 * f)) + 0.06 * bp(ruis(T), 1500, 6000)
    return s * omhul(n, 0.04, 0.12)

@geluid('pijp', 'Vallende pijp', 'Falling pipe', 'boem', 'Cartoon', 'Een metalen pijp valt op de grond: klang!')
def pijp():
    uit = np.zeros(int(2.6 * SR))
    def klang(f, sec, sterk):
        t = t_(sec)
        s = sum(a * np.sin(2 * np.pi * f * r * t + rng.random() * 6) * np.exp(-t * d) for r, a, d in ((1, 1, 2.2), (2.76, 0.8, 3.0), (5.40, 0.6, 4.5), (8.93, 0.4, 6), (13.3, 0.25, 9)))
        return (s + bp(ruis(sec), 2000, 9000) * np.exp(-t * 60) * 1.5) * sterk
    zet(uit, klang(620, 2.2, 1.0), 0); zet(uit, klang(620, 1.6, 0.45), 0.32); zet(uit, klang(620, 1.0, 0.2), 0.52); zet(uit, klang(632, 0.8, 0.1), 0.66)
    return galm(uit, nat=0.3)[:int(2.6 * SR)]

@geluid('zoefweg', 'Zoef weg', 'Run away', 'fluit', 'Cartoon', 'Trappelende voetjes en weg is ie')
def zoefweg():
    uit = np.zeros(int(1.5 * SR)); op = 0.0; afst = 0.09; k = 0
    while op < 0.6:
        zet(uit, tik(0.03, 700 + 500 * (k % 2), 4000) * 0.8, op); op += afst; afst *= 0.88; k += 1
    n = int(0.6 * SR)
    zet(uit, reso_glij(ruis(0.6), lijn([(0, 2600), (0.6, 500)], 0.6), 500) * omhul(n, 0.05, 0.4) * 0.9, 0.62)
    m = int(0.3 * SR)
    zet(uit, np.sin(fase(lijn([(0, 1800), (0.3, 600)], 0.3))) * omhul(m, 0.01, 0.12) * 0.3, 0.62)
    return uit

# ================= Game =================
@geluid('gameover', 'Game over', 'Game over', 'zucht', 'Game', 'Een eigen 8-bit deuntje dat afloopt')
def gameover():
    uit = np.zeros(int(1.8 * SR)); op = 0.0
    for f, lang in ((523.3, 0.16), (392.0, 0.16), (311.1, 0.16), (261.6, 0.85)):
        n = int(lang * SR); t = t_(lang)
        ff = vol(f, lang) * (1 + 0.02 * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.15) / 0.2, 0, 1) * (lang > 0.5))
        s = vierkant(ff, 0.25) * 0.5 + driehoek(ff / 2) * 0.4
        zet(uit, s * omhul(n, 0.003, 0.05 if lang < 0.5 else 0.45), op); op += lang + 0.02
    return uit

@geluid('levelup', 'Level up', 'Level up', 'sprong', 'Game', 'Muntje en een stijgend toontje')
def levelup():
    uit = np.zeros(int(1.4 * SR))
    zet(uit, vierkant(vol(987.8, 0.07), 0.5) * 0.35, 0.0)
    zet(uit, vierkant(vol(1318.5, 0.35), 0.5) * np.exp(-t_(0.35) * 6) * 0.35, 0.07)
    for k, f in enumerate((523.3, 659.3, 784.0, 1046.5, 1318.5, 1568.0, 2093.0)):
        n = int(0.14 * SR); zet(uit, (vierkant(vol(f, 0.14), 0.125) * 0.3 + driehoek(vol(f, 0.14)) * 0.3) * omhul(n, 0.002, 0.06), 0.42 + 0.07 * k)
    return uit

@geluid('fout', 'Fout antwoord', 'Wrong answer', 'zoemer', 'Game', 'Quizbuzzer: eeh-eeh')
def fout():
    uit = np.zeros(int(1.1 * SR))
    for op in (0, 0.42):
        n = int(0.34 * SR)
        s = zaag(vol(138.0, 0.34)) + zaag(vol(146.8, 0.34)) + 0.5 * vierkant(vol(277.2, 0.34), 0.3)
        zet(uit, np.tanh(2 * bp(s, 150, 3000)) * omhul(n, 0.006, 0.03) * 0.5, op)
    return uit

# ================= Publiek en stem =================
def publiek(T, kromme, klinkers, stemmen=14, spreiding=0.07):
    uit = np.zeros(int((T + 0.2) * SR))
    for k in range(stemmen):
        vrouw = k % 2 == 1; hoog = rng.uniform(1.5, 1.9) if vrouw else rng.uniform(0.8, 1.1)
        lang = T * rng.uniform(0.85, 1.0); m = int(lang * SR); tt = t_(lang)
        f0 = kromme(tt, lang) * hoog * (1 + 0.01 * np.sin(2 * np.pi * rng.uniform(4, 6.5) * tt + rng.random() * 6))
        s = stem(f0, klinkers, adem=0.15, schaal=1.15 if vrouw else 1.0)
        zet(uit, s * omhul(m, 0.08, 0.3) * rng.uniform(0.6, 1.0), rng.uniform(0, spreiding))
    return uit

@geluid('ooh', 'Ooooh!', 'Ooooh!', 'huh', 'Publiek en stem', 'Een verbaasd publiek')
def ooh():
    return galm(publiek(1.6, lambda tt, L: np.interp(tt, [0, 0.35 * L, L], [130, 200, 150]), ['o', 'oe']), nat=0.35)

@geluid('aww', 'Awww', 'Awww', 'zucht', 'Publiek en stem', 'Een publiek dat het zielig vindt')
def aww():
    return galm(publiek(1.7, lambda tt, L: np.interp(tt, [0, 0.25 * L, L], [150, 165, 105]), ['a', 'aa', 'o']), nat=0.35)

@geluid('bruh', 'Bruh', 'Bruh', 'zucht', 'Publiek en stem', 'Lage, verveelde brom')
def bruh():
    uit = np.zeros(int(1.0 * SR))
    zet(uit, lp(ruis(0.03), 600) * np.exp(-t_(0.03) * 90) * 0.6, 0)
    m = int(0.62 * SR); tt = t_(0.62)
    s = stem(np.interp(tt, [0, 0.1, 0.62], [105, 98, 82]), ['uh', 'uh', 'o'], adem=0.05, jitter=0.02)
    r = 1 - 0.6 * (tt < 0.09) * (0.5 + 0.5 * np.sin(2 * np.pi * 28 * tt))
    zet(uit, s * r * omhul(m, 0.015, 0.2), 0.02)
    k = int(0.18 * SR); zet(uit, adem_klank(0.18, 'uh') * omhul(k, 0.02, 0.12) * 0.15, 0.6)
    return uit

# ================= Muziekjes =================
@geluid('viool', 'Treurige viool', 'Sad violin', 'zucht', 'Muziekjes', 'Een eigen treurig melodietje')
def viool():
    uit = np.zeros(int(2.6 * SR)); op = 0.0
    for f, lang in ((440.0, 0.45), (392.0, 0.45), (349.2, 0.45), (329.6, 1.1)):
        n = int(lang * SR); t = t_(lang); vib = 1 + 0.007 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.25, 0, 1)
        s = formanten(zaag(vol(f, lang) * vib), (480, 1500, 2900), bws=(150, 300, 500), gains=(1, 0.7, 0.4)) + 0.04 * bp(ruis(lang), 2000, 8000)
        zet(uit, norm(s * omhul(n, 0.08, 0.15 if lang < 1 else 0.5)), op); op += lang - 0.03
    return galm(uit, nat=0.35)[:int(2.6 * SR)]

@geluid('tadaa', 'Ta-daa!', 'Ta-da!', 'ting', 'Muziekjes', 'Voor iets wat gelukt is')
def tadaa():
    uit = np.zeros(int(1.6 * SR))
    for op, lang, toon in ((0, 0.13, (392.0, 493.9, 587.3)), (0.17, 1.0, (523.3, 659.3, 784.0, 1046.5))):
        n = int(lang * SR); t = t_(lang); vib = 1 + 0.006 * np.sin(2 * np.pi * 5.8 * t) * np.clip((t - 0.2) / 0.3, 0, 1)
        s = sum(zaag(vol(f, lang) * vib) for f in toon)
        zet(uit, norm(lp(s, 3000) * omhul(n, 0.015, 0.05 if lang < 0.5 else 0.4), 0.9 if lang < 0.5 else 1.0), op)
    zet(uit, norm(bekken(1.2), 0.25), 0.17)
    return galm(uit, nat=0.2)[:int(1.8 * SR)]

# ================= Montage-effecten =================
@geluid('zoom', 'Dramatische zoom', 'Dramatic zoom', 'boem', 'Montage-effecten', 'Een woesj en een harde klap')
def zoom():
    uit = np.zeros(int(1.6 * SR)); t = t_(0.45)
    zet(uit, reso_glij(ruis(0.45), lijn([(0, 300), (0.45, 3500)], 0.45), 400) * (t / 0.45) ** 2 * 0.8, 0)
    tt = t_(1.0)
    hit = lp(sum(zaag(vol(f, 1.0)) for f in (73.4, 110, 146.8, 220)), 2000) * np.exp(-tt * 4) * 0.25 + lp(ruis(1.0), 3000) * np.exp(-tt * 12) * 0.6
    zet(uit, hit + kick(1.0, 110, 38), 0.45)
    return galm(uit, nat=0.25)[:int(1.8 * SR)]

@geluid('bassdrop', 'Bass drop', 'Bass drop', 'boem', 'Montage-effecten', 'Opbouwen... en dan een diepe woooomp')
def bassdrop():
    uit = np.zeros(int(2.4 * SR)); t = t_(0.6)
    r = reso_glij(ruis(0.6), lijn([(0, 400), (0.6, 5000)], 0.6), 600) * (t / 0.6) ** 2 * 0.6 + np.sin(fase(lijn([(0, 200), (0.6, 1600)], 0.6))) * (t / 0.6) ** 2 * 0.25
    zet(uit, r, 0)
    m = int(1.6 * SR); tt = t_(1.6)
    f = 38 + 140 * np.exp(-tt * 5)
    wob = 0.5 + 0.5 * np.sin(fase(np.interp(tt, [0, 1.6], [5, 2])))
    zet(uit, (np.tanh(2.5 * np.sin(fase(f))) * 0.8 + lp(zaag(f * 2), 700) * wob * 0.5) * omhul(m, 0.005, 0.5), 0.6)
    return uit

@geluid('bling', 'Bling', 'Bling', 'ting', 'Montage-effecten', 'Glinsteren, voor als iemand er cool uitziet')
def bling():
    uit = np.zeros(int(1.3 * SR))
    zet(uit, bel(2637, 1.0) * 0.4, 0.0); zet(uit, bel(3951, 0.9) * 0.3, 0.0)
    for k in range(9): zet(uit, bel(rng.uniform(3000, 7500), 0.35, d=12) * rng.uniform(0.06, 0.14), rng.uniform(0.02, 0.55))
    zet(uit, hp(ruis(0.8), 7000) * np.exp(-t_(0.8) * 5) * 0.08, 0.0)
    return galm(uit, nat=0.3)[:int(1.5 * SR)]

@geluid('clown', 'Clowntoeter', 'Clown horn', 'pop', 'Montage-effecten', 'Toet toet!')
def clown():
    uit = np.zeros(int(0.9 * SR))
    for op in (0, 0.3):
        n = int(0.22 * SR); t = t_(0.22); f = np.interp(t, [0, 0.05, 0.22], [300, 345, 335])
        s = formanten(vierkant(f, 0.35) + 0.5 * zaag(f * 2), (700, 1500, 3000), bws=(200, 300, 400), gains=(1, 0.6, 0.3))
        zet(uit, np.tanh(1.5 * s / np.max(np.abs(s))) * omhul(n, 0.01, 0.04) * 0.6, op)
        k = int(0.05 * SR); zet(uit, np.sin(fase(vol(2400, 0.05))) * omhul(k, 0.005, 0.03) * 0.05, op + 0.2)
    return uit

@geluid('piep', 'Piepbeestje', 'Squeaky toy', 'pling', 'Montage-effecten', 'Knijpspeelgoed: piep piep')
def piep():
    uit = np.zeros(int(1.0 * SR))
    for op, (a, b, c) in ((0, (1500, 2600, 2000)), (0.38, (1400, 2400, 1700))):
        lang = 0.3; n = int(lang * SR); t = t_(lang); f = np.interp(t, [0, 0.1, 0.3], [a, b, c])
        s = np.sin(fase(f)) + 0.3 * np.sin(fase(2 * f)) + 0.1 * vierkant(f, 0.5) + 0.25 * bp(ruis(lang), 2000, 8000) * np.exp(-t * 8)
        zet(uit, s * omhul(n, 0.02, 0.08) * 0.5, op)
    return uit

@geluid('kazoo', 'Kazoo', 'Kazoo', 'zucht', 'Montage-effecten', 'Een zoemend deuntje dat mislukt')
def kazoo():
    uit = np.zeros(int(1.7 * SR)); op = 0.0
    for f0s, lang in (((392, 392), 0.15), ((392, 392), 0.15), ((523.3, 523.3), 0.18), ((493.9, 370.0), 0.9)):
        n = int(lang * SR); t = t_(lang); f0 = np.interp(t, [0, 0.25 * lang if lang > 0.5 else 0, lang], [f0s[0], f0s[0], f0s[1]]) * (1 + 0.01 * np.sin(2 * np.pi * 5 * t))
        s = glottis(f0); zoem = hp(np.tanh(4 * s), 800) * 0.7 + formanten(s, KLINKER['oe']) * 0.5
        zet(uit, norm(zoem * omhul(n, 0.02, 0.05 if lang < 0.5 else 0.3)), op); op += lang + 0.04
    return uit

@geluid('uitglijden', 'Uitglijden', 'Slip and fall', 'boem', 'Montage-effecten', 'Wieee... boem!')
def uitglijden():
    uit = np.zeros(int(1.9 * SR))
    n = int(0.15 * SR); zet(uit, np.sin(fase(lijn([(0, 1800), (0.15, 2600)], 0.15))) * omhul(n, 0.01, 0.03) * 0.3, 0)
    m = int(0.7 * SR); zet(uit, (np.sin(fase(lijn([(0, 1700), (0.7, 350)], 0.7))) + 0.1 * bp(ruis(0.7), 1000, 5000)) * omhul(m, 0.03, 0.05) * 0.45, 0.17)
    zet(uit, kick(0.6, 90, 40), 0.9); zet(uit, lp(ruis(0.4), 1500) * np.exp(-t_(0.4) * 12) * 0.7, 0.9)
    for j in range(6): zet(uit, tik(0.04, 1000, 6000) * rng.uniform(0.2, 0.45), 1.0 + rng.uniform(0, 0.5))
    return uit

@geluid('slowmo', 'Slow motion', 'Slow motion', 'drama', 'Montage-effecten', 'Een nooooo dat langzaam en diep wordt')
def slowmo():
    T = 2.2; n = int(T * SR); t = t_(T); f0 = np.interp(t, [0, T], [130, 62])
    s = effen(stem(f0, ['m', 'o', 'o', 'oe'], adem=0.1)) * np.interp(t, [0, 0.15, T], [0.3, 1.0, 0.6]) * omhul(n, 0.1, 0.5)
    drone = norm(lp(zaag(f0 / 2) + zaag(f0 * 0.75), 600), 0.35) * omhul(n, 0.3, 0.5)
    return galm(s + drone, nat=0.45)[:int(2.6 * SR)]

@geluid('storing', 'Glitch', 'Glitch', 'error', 'Montage-effecten', 'Haperend en vervormd')
def storing():
    uit = np.zeros(int(1.1 * SR)); op = 0.0
    for k in range(12):
        f = float(rng.choice([165, 220, 440, 880, 1320]))
        stuk = vierkant(vol(f, 0.08), 0.5) * 0.4 + ruis(0.08) * 0.3
        stuk = np.round(stuk * float(rng.choice([3, 5, 8]))) / 8
        for h in range(int(rng.integers(1, 4))):
            lang = rng.uniform(0.02, 0.06); m = int(lang * SR)
            zet(uit, stuk[:m] * omhul(m, 0.001, 0.002) * 0.7, op); op += lang
        op += rng.uniform(0, 0.03)
        if op > 0.95: break
    return uit

@geluid('roffel', 'Tromgeroffel', 'Drum roll', 'boem', 'Montage-effecten', 'Roffelen en een bekkenslag')
def roffel():
    uit = np.zeros(int(2.6 * SR)); op = 0.0
    while op < 1.4:
        zet(uit, snare(0.08, 200, 0.3) * (0.15 + 0.85 * (op / 1.4) ** 1.5) * 0.6 * rng.uniform(0.85, 1.0), op); op += 1 / 24 + rng.uniform(-0.003, 0.003)
    zet(uit, kick(0.6), 1.45); zet(uit, bekken(1.1) * 0.7, 1.45); zet(uit, snare(0.3) * 0.6, 1.45)
    return galm(uit, nat=0.15)[:int(2.6 * SR)]

@geluid('woesj', 'Woesj', 'Whoosh', 'fluit', 'Montage-effecten', 'Voor een overgang')
def woesj():
    T = 0.75; t = t_(T)
    s = reso_glij(ruis(T), lijn([(0, 500), (0.35, 2600), (T, 700)], T), 700) + 0.4 * lp(ruis(T), 800)
    return s * np.sin(np.pi * t / T) ** 2

@geluid('scheet', 'Scheet', 'Fart', 'slurp', 'Montage-effecten', 'De klassieker')
def scheet():
    T = 0.85; n = int(T * SR); t = t_(T)
    f0 = np.interp(t, [0, 0.3, 0.6, T], [95, 80, 110, 140]) * trillen(n, 0.15, 20)
    s = formanten(vierkant(f0, 0.15), (280, 700, 1500), bws=(120, 200, 300), gains=(1, 0.4, 0.15))
    s += 0.2 * lp(ruis(T), 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * t)) * np.max(np.abs(s))
    return s * omhul(n, 0.02, 0.15)

@geluid('flits', 'Camera-flits', 'Camera flash', 'pop', 'Montage-effecten', 'Klik, met een flits')
def flits():
    uit = np.zeros(int(1.3 * SR))
    zet(uit, tik(0.02, 2000, 8000) * 0.8, 0); zet(uit, tik(0.025, 800, 5000) * 0.7, 0.045)
    zet(uit, lp(ruis(0.05), 2000) * np.exp(-t_(0.05) * 80) * 0.4, 0.045)
    n = int(0.8 * SR); zet(uit, np.sin(fase(lijn([(0, 2500), (0.8, 7500)], 0.8))) * omhul(n, 0.1, 0.05) * 0.08, 0.3)
    return uit

# ================= Emoties =================
@geluid('woehoe', 'Woehoe!', 'Woohoo!', 'sprong', 'Emoties', 'Superblij, met een feestfluitje')
def woehoe():
    uit = np.zeros(int(1.6 * SR))
    m = int(0.3 * SR); zet(uit, norm(stem(np.interp(t_(0.3), [0, 0.3], [260, 300]), ['oe'], adem=0.05) * omhul(m, 0.03, 0.05)), 0)
    k = int(0.06 * SR); zet(uit, norm(adem_klank(0.06, 'oe') * omhul(k, 0.01, 0.01), 0.3), 0.32)
    m2 = int(0.5 * SR); zet(uit, norm(stem(np.interp(t_(0.5), [0, 0.15, 0.5], [420, 560, 520]), ['oe', 'u'], adem=0.05) * omhul(m2, 0.02, 0.15), 1.15), 0.36)
    p = int(0.5 * SR); f = np.interp(t_(0.5), [0, 0.5], [620, 690])
    zet(uit, norm(formanten(vierkant(f, 0.3), (1200, 2500, 4000), bws=(300, 400, 600)) * omhul(p, 0.02, 0.1), 0.7), 0.95)
    return uit

@geluid('bang', 'Bang', 'Scared', 'alarm', 'Emoties', 'Bibberend ieieie met een snelle hartslag')
def bang():
    uit = np.zeros(int(1.6 * SR))
    for k in range(6):
        t = t_(0.12); zet(uit, np.sin(2 * np.pi * 60 * t) * np.exp(-t * 30) * 0.7, 0.26 * k); zet(uit, np.sin(2 * np.pi * 55 * t) * np.exp(-t * 35) * 0.5, 0.11 + 0.26 * k)
    for k, (op, lang) in enumerate(((0.1, 0.28), (0.45, 0.28), (0.8, 0.55))):
        m = int(lang * SR); tt = t_(lang); f0 = (380 + 30 * k) * (1 + 0.06 * np.sin(2 * np.pi * 9 * tt))
        zet(uit, stem(f0, ['i'], adem=0.1) * omhul(m, 0.02, 0.08) * 0.8, op)
    return uit

@geluid('verrast', 'Oh!', 'Oh!', 'ting', 'Emoties', 'Verrast, met een glinstering')
def verrast():
    uit = np.zeros(int(1.2 * SR))
    k = int(0.08 * SR); zet(uit, adem_klank(0.08, 'o') * omhul(k, 0.02, 0.02) * 0.25, 0)
    m = int(0.35 * SR); zet(uit, stem(np.interp(t_(0.35), [0, 0.12, 0.35], [240, 400, 360]), ['o'], adem=0.08) * omhul(m, 0.015, 0.12), 0.08)
    zet(uit, bel(2093, 0.8) * 0.2, 0.4); zet(uit, bel(3136, 0.6) * 0.15, 0.4)
    for j in range(5): zet(uit, bel(rng.uniform(3500, 6500), 0.3, d=12) * 0.06, 0.45 + 0.06 * j)
    return galm(uit, nat=0.2)[:int(1.4 * SR)]

@geluid('ieuw', 'Ieuw!', 'Eww!', 'slurp', 'Emoties', 'Walging, met een kokhalsje')
def ieuw():
    uit = np.zeros(int(1.3 * SR))
    m = int(0.6 * SR); zet(uit, norm(effen(stem(np.interp(t_(0.6), [0, 0.6], [360, 250]), ['i', 'i', 'eu', 'oe'], adem=0.08, jitter=0.03)) * omhul(m, 0.02, 0.1)), 0)
    k = int(0.3 * SR); t2 = t_(0.3)
    g = stem(np.interp(t2, [0, 0.3], [130, 100]), ['uh'], adem=0.3, jitter=0.08) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t2))
    zet(uit, norm(g * omhul(k, 0.01, 0.1), 0.85), 0.75)
    return uit

@geluid('giechel', 'Giechel', 'Giggle', 'pling', 'Emoties', 'Verlegen: een giecheltje en oei')
def giechel():
    uit = np.zeros(int(1.5 * SR)); op = 0.0
    for k in range(6):
        h = int(0.03 * SR); zet(uit, norm(adem_klank(0.03, 'i') * omhul(h, 0.005, 0.01), 0.35), op)
        m = int(0.07 * SR); tt = t_(0.07)
        zet(uit, norm(stem(np.full(m, 460.0 - 15 * k) * (1 + 0.03 * tt / 0.07), ['i'], adem=0.15) * omhul(m, 0.01, 0.03), 0.9), op + 0.025)
        op += 0.13
    m = int(0.45 * SR); zet(uit, norm(effen(stem(np.interp(t_(0.45), [0, 0.45], [380, 300]), ['oe', 'i'], adem=0.1)) * omhul(m, 0.03, 0.12), 0.8), op + 0.08)
    return uit

@geluid('trots', 'Trots', 'Proud', 'ting', 'Emoties', 'Kort koper, borst vooruit')
def trots():
    uit = np.zeros(int(1.8 * SR))
    zet(uit, tom(0.8, 90, 70) * 0.8, 0)
    for op, lang, toon in ((0.0, 0.18, (196.0, 246.9, 293.7)), (0.24, 1.1, (261.6, 329.6, 392.0, 523.3))):
        n = int(lang * SR); t = t_(lang); vib = 1 + 0.004 * np.sin(2 * np.pi * 5 * t)
        s = formanten(sum(zaag(vol(f, lang) * vib) for f in toon), (500, 1200, 2500), bws=(200, 300, 400), gains=(1, 0.5, 0.25))
        zet(uit, s * omhul(n, 0.03, 0.06 if lang < 0.5 else 0.45) * 0.3, op)
    zet(uit, tom(0.8, 80, 60) * 0.8, 0.24); zet(uit, bekken(1.0) * 0.2, 0.24)
    return galm(uit, nat=0.25)[:int(1.9 * SR)]

@geluid('jaloers', 'Jaloers', 'Jealous', 'huh', 'Emoties', 'Een sluw hmmm met een grommetje')
def jaloers():
    uit = np.zeros(int(1.5 * SR))
    m = int(0.9 * SR); tt = t_(0.9)
    zet(uit, norm(stem(np.interp(tt, [0, 0.3, 0.6, 0.9], [170, 150, 165, 140]) * (1 + 0.02 * np.sin(2 * np.pi * 4 * tt)), ['m'], adem=0.02) * omhul(m, 0.05, 0.2), 0.8), 0)
    k = int(0.45 * SR); t2 = t_(0.45)
    grr = formanten(lp(zaag(vol(85.0, 0.45)), 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * t2)), KLINKER['uh'])
    zet(uit, norm(grr * omhul(k, 0.03, 0.12), 0.9), 0.95)
    return uit

@geluid('geeuw', 'Geeuw', 'Yawn', 'zucht', 'Emoties', 'Verveeld: een grote geeuw')
def geeuw():
    T = 1.9; n = int(T * SR)
    t = t_(T)
    return effen(stem(np.interp(t, [0, 0.5, 1.0, T], [170, 290, 220, 110]), ['a', 'aa', 'o', 'oe', 'm'], adem=0.35)) * np.interp(t, [0, 0.35, 0.6, 1.2, T], [0.2, 0.7, 1.0, 0.7, 0.3]) * omhul(n, 0.25, 0.5)

@geluid('gulp', 'Gulp', 'Gulp', 'pop', 'Emoties', 'Zenuwachtig slikken')
def gulp():
    uit = np.zeros(int(0.8 * SR))
    n = int(0.12 * SR); zet(uit, np.sin(fase(np.interp(t_(0.12), [0, 0.12], [500, 180]))) * omhul(n, 0.005, 0.05) * 0.6, 0.0)
    tt = t_(0.2)
    s = formanten(np.sin(fase(np.interp(tt, [0, 0.05, 0.2], [220, 650, 140]))) * np.exp(-tt * 10), (300, 900, 2000), gains=(1, 0.3, 0.1)) * 3
    zet(uit, s * 0.8, 0.18)
    zet(uit, lp(ruis(0.04), 1200) * np.exp(-t_(0.04) * 80) * 0.4, 0.38)
    return uit

@geluid('pfoeh', 'Pfoeh', 'Phew', 'zucht', 'Emoties', 'Opgelucht: een grote zucht')
def pfoeh():
    uit = np.zeros(int(1.6 * SR))
    zet(uit, bp(ruis(0.05), 300, 3000) * np.exp(-t_(0.05) * 40) * 0.6, 0)
    T = 1.2; n = int(T * SR)
    zet(uit, (formanten(ruis(T), KLINKER['oe']) + 0.3 * bp(ruis(T), 1500, 5000)) * omhul(n, 0.05, 0.8) * 0.6, 0.03)
    m = int(0.5 * SR); zet(uit, stem(np.interp(t_(0.5), [0, 0.5], [200, 140]), ['oe'], adem=0.4) * omhul(m, 0.05, 0.3) * 0.5, 0.05)
    return uit

@geluid('hap', 'Naar adem happen', 'Gasp', 'huh', 'Emoties', 'Geschokt: hap!')
def hap():
    uit = np.zeros(int(0.9 * SR)); T = 0.35; t = t_(T)
    aan = np.clip(t / 0.08, 0, 1)
    adem = formanten_glijdend(ruis(T), KLINKER['a'], KLINKER['o']) * aan * np.exp(-np.maximum(t - 0.2, 0) * 15)
    zet(uit, adem * 0.9 + hp(ruis(T), 2500) * 0.2 * aan, 0)
    m = int(0.12 * SR); zet(uit, stem(np.interp(t_(0.12), [0, 0.12], [480, 560]), ['a'], adem=0.4) * omhul(m, 0.02, 0.05) * 0.4, 0.22)
    return uit

@geluid('relax', 'Relaxed', 'Relaxed', 'ting', 'Emoties', 'Zachte golven en aaah')
def relax():
    T = 2.5; n = int(T * SR); t = t_(T)
    golf = lp(ruis(T), 900) * (0.3 + 0.7 * np.sin(np.pi * t / T) ** 2) + hp(lp(ruis(T), 4000), 1500) * 0.3 * np.sin(np.pi * t / T) ** 4
    uit = golf * 0.5 * omhul(n, 0.5, 0.8)
    m = int(1.6 * SR); zet(uit, stem(np.interp(t_(1.6), [0, 1.6], [160, 118]), ['a', 'aa', 'o'], adem=0.35) * omhul(m, 0.3, 0.8) * 0.8, 0.5)
    return uit

@geluid('bluergh', 'Misselijk', 'Queasy', 'slurp', 'Emoties', 'Bluergh')
def bluergh():
    uit = np.zeros(int(1.3 * SR))
    zet(uit, lp(ruis(0.03), 500) * 0.5, 0)
    n = int(1.0 * SR); t = t_(1.0)
    s = stem(np.interp(t, [0, 0.2, 1.0], [150, 120, 90]), ['uh', 'eu', 'oe', 'uh'], adem=0.25, jitter=0.12) * (0.55 + 0.45 * np.sin(fase(np.interp(t, [0, 1], [14, 22]))))
    zet(uit, s * omhul(n, 0.03, 0.25), 0.02)
    return uit

@geluid('argh', 'Argh!', 'Argh!', 'zoemer', 'Emoties', 'Gefrustreerd, met een klap op tafel')
def argh():
    uit = np.zeros(int(1.5 * SR))
    m = int(0.7 * SR); tt = t_(0.7)
    s = stem(np.interp(tt, [0, 0.5, 0.7], [190, 250, 230]), ['a', 'a', 'uh'], adem=0.2, jitter=0.05)
    s = np.tanh(3 * s / np.max(np.abs(s))) * (0.7 + 0.3 * np.sin(2 * np.pi * 38 * tt))
    zet(uit, s * omhul(m, 0.06, 0.1) * 0.6, 0)
    zet(uit, kick(0.4, 140, 60) * 0.9, 0.78); zet(uit, bp(ruis(0.3), 400, 5000) * np.exp(-t_(0.3) * 25) * 0.6, 0.78)
    for j in range(5): zet(uit, tik(0.03, 2000, 7000) * 0.2, 0.82 + 0.04 * j + rng.uniform(0, 0.02))
    return uit

@geluid('ontroerd', 'Ontroerd', 'Touched', 'ting', 'Emoties', 'Zacht strijkje en gesnif')
def ontroerd():
    T = 2.3; n = int(T * SR); t = t_(T)
    s = sum(zaag(vol(f, T) * (1 + 0.004 * np.sin(2 * np.pi * (5 + 0.5 * k) * t + k))) for k, f in enumerate((261.6, 329.6, 392.0, 493.9)))
    uit = lp(s, 1800) * omhul(n, 0.7, 0.8) * 0.2
    for op in (0.9, 1.35):
        tt = t_(0.18); zet(uit, adem_klank(0.18, 'i', 1500) * np.clip(tt / 0.03, 0, 1) * np.exp(-tt * 18) * 0.5, op)
    return galm(uit, nat=0.3)[:int(2.6 * SR)]

@geluid('dankbaar', 'Dankbaar', 'Grateful', 'ting', 'Emoties', 'Een warm klokkenspel: dank-je-wel')
def dankbaar():
    uit = np.zeros(int(2.2 * SR))
    for op, f in ((0, 1318.5), (0.22, 1174.7), (0.44, 1046.5)): zet(uit, bel(f, 1.3, d=3) * 0.3, op)
    T = 1.6; n = int(T * SR); t = t_(T)
    zet(uit, sum(np.sin(2 * np.pi * f * t) for f in (261.6, 329.6, 392.0)) * omhul(n, 0.5, 0.7) * 0.12, 0.4)
    return galm(uit, nat=0.3)[:int(2.4 * SR)]

@geluid('eenzaam', 'Eenzaam', 'Lonely', 'ting', 'Emoties', 'Wind en een verloren toon')
def eenzaam():
    T = 2.5; t = t_(T)
    wind = reso_glij(ruis(T), 600 + 400 * np.sin(2 * np.pi * 0.35 * t) + 200 * np.sin(2 * np.pi * 0.9 * t), 250) * (0.4 + 0.6 * np.sin(np.pi * t / T))
    uit = wind * 0.6
    m = int(1.8 * SR); tt = t_(1.8)
    zet(uit, (np.sin(fase(vol(440.0, 1.8) * (1 + 0.005 * np.sin(2 * np.pi * 5 * tt)))) + 0.05 * bp(ruis(1.8), 400, 3000)) * omhul(m, 0.4, 1.0) * 0.35, 0.4)
    return galm(uit, nat=0.35)[:int(2.6 * SR)]

@geluid('muhaha', 'Muhaha', 'Muhaha', 'drama', 'Emoties', 'Ondeugend: een gemene lach')
def muhaha():
    uit = np.zeros(int(1.9 * SR))
    m = int(0.3 * SR); zet(uit, norm(stem(np.interp(t_(0.3), [0, 0.3], [115, 108]), ['m', 'oe'], adem=0.05) * omhul(m, 0.04, 0.05), 0.8), 0)
    op = 0.38
    for k, f in enumerate((128, 120, 110, 98)):
        h = int(0.05 * SR); zet(uit, norm(adem_klank(0.05, 'a') * omhul(h, 0.005, 0.01), 0.4), op)
        lang = 0.16 if k < 3 else 0.4; mm = int(lang * SR); t2 = t_(lang)
        zet(uit, norm(stem(np.full(mm, float(f)) * (1 - 0.05 * t2 / lang), ['a'], adem=0.12, jitter=0.02) * omhul(mm, 0.01, 0.05 if k < 3 else 0.25), 1.1), op + 0.04)
        op += 0.22
    return galm(uit, nat=0.35)[:int(2.2 * SR)]

# ---------- afwerken en schrijven (zoals geluiden5.py) ----------
def schrijf_wav(pad, v):
    import struct
    d = np.clip(np.round(v * 32767), -32767, 32767).astype('<i2').tobytes()
    with open(pad, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(d)) + b'WAVE' + b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(d)) + d)

verslag = {}
for nr, (naam, (f, nl, en, terug, groep, uitleg)) in enumerate(G.items(), 1):
    v = np.asarray(f(), dtype=float)  # ook als hij niet gekozen is: de toevalsreeks loopt door
    if not ALLE and naam not in KEUZE: continue
    v = v - np.mean(v)
    piek = np.max(np.abs(v)) or 1
    nz = np.nonzero(np.abs(v) > piek * 10 ** (-60 / 20))[0]
    v = v[nz[0]:min(len(v), nz[-1] + int(0.03 * SR))]
    fade = min(len(v), int(0.012 * SR)); v[-fade:] *= np.linspace(1, 0, fade)
    rms = math.sqrt(np.mean(v ** 2)) or 1e-9
    g_rms = 10 ** ((-21 - 20 * math.log10(rms)) / 20); g_piek = 10 ** (-1 / 20) / np.max(np.abs(v))
    if g_rms > g_piek * 10 ** (1.5 / 20):
        # een harde klap (pijp, roffel) houdt de rest te zacht: de klap zacht begrenzen (piek 0,85, ook na de mp3 onder 0,9)
        v = 0.85 * np.tanh(v * g_rms / 0.85); v *= min(1.0, 10 ** ((-21 - 20 * math.log10(math.sqrt(np.mean(v ** 2)))) / 20))
        v *= min(1.0, 0.85 / np.max(np.abs(v)))
    else:
        v *= min(g_rms, g_piek)
    w = os.path.join(UIT, naam + '.tmp.wav'); m = os.path.join(UIT, naam + '.mp3')
    schrijf_wav(w, v)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0',
                    '-codec:a', 'libmp3lame', '-b:a', '%dk' % KBPS, '-ac', '1', '-ar', str(SR), m], check=True)
    os.remove(w)
    verslag[naam] = {'nr': nr, 'nl': nl, 'en': en, 'terug': terug, 'groep': groep, 'uitleg': uitleg, 'sec': round(len(v) / SR, 2),
                     'db': round(20 * math.log10(math.sqrt(np.mean(v ** 2))), 1), 'kB': round(os.path.getsize(m) / 1024, 1)}
    print(nr, naam, verslag[naam]['sec'], 's', verslag[naam]['kB'], 'kB', flush=True)
if ALLE: json.dump(verslag, open(os.path.join(UIT, 'verslag.json'), 'w'), ensure_ascii=False, indent=1)
print('totaal', len(verslag), 'geluiden', round(sum(x['kB'] for x in verslag.values())), 'kB')
assert ALLE or sorted(verslag) == sorted(KEUZE)
