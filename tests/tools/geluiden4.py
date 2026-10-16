# geluiden4.py - de 12 eigen geluiden van stickervel 3 (v165, handgebaren), met code gemaakt (numpy/scipy), als mp3.
# Naar geluiden2.py en geluiden3.py: zelfde hulpjes en afwerking (stilte eraf, 12 ms uitfaden, RMS -21 dB, piek
# hoogstens -1 dB, ffmpeg libmp3lame 128 kbps mono, zonder ID3-tag). Eigen vaste toevalsreeks (20261018); de volgorde
# hieronder (= f3-01 ... f3-12) hoort daarbij. In stickerfx.js: mp3: true en een terug-geluid (het 4e veld).
# python3 -I geluiden4.py <uitmap>        (bijv. <map>/geluiden)
import sys, os, math, subprocess, json
import numpy as np
from scipy import signal

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
rng = np.random.default_rng(20261018)

def tijd(sec): return np.arange(int(sec * SR)) / SR
def ruis(sec): return rng.standard_normal(int(sec * SR))
def bp(x, lo, hi, orde=4): return signal.sosfilt(signal.butter(orde, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, orde=4): return signal.sosfilt(signal.butter(orde, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, orde=4): return signal.sosfilt(signal.butter(orde, f, 'highpass', fs=SR, output='sos'), x)
def reso(x, f, bw):
    # tweede-orde resonator (formant)
    r = math.exp(-math.pi * bw / SR); th = 2 * math.pi * f / SR
    return signal.lfilter([1 - r], [1, -2 * r * math.cos(th), r * r], x)
def formanten(x, fs, bws=(90, 110, 160), gains=(1.0, 0.6, 0.3)):
    return sum(g * reso(x, f, b) for f, b, g in zip(fs, bws, gains))
def formanten_glijdend(x, f_van, f_naar, bws=(90, 110, 160), gains=(1.0, 0.6, 0.3), stukken=24):
    # formanten die verschuiven: in stukjes filteren met overlap
    n = len(x); uit = np.zeros(n); st = n // stukken + 1; venster = np.hanning(2 * st)
    for k in range(stukken):
        a = max(0, k * st - st // 2); b = min(n, a + 2 * st); w = k / max(1, stukken - 1)
        fs = [fv + (fn - fv) * w for fv, fn in zip(f_van, f_naar)]
        stuk = formanten(x[a:b], fs, bws, gains)
        uit[a:b] += stuk * venster[:b - a]
    return uit
def glottis(f0):
    # stembandtrillingen: zaagtand met de gegeven toonhoogte per sample (array), zacht gemaakt
    fase = np.cumsum(f0 / SR) % 1.0
    zaag = 2 * fase - 1
    return lp(zaag, 3500, 2)
def omhul(n, aan, uit, vorm=2.0):
    e = np.ones(n); a = int(aan * SR); u = int(uit * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 1.5
    if u: e[-u:] *= np.linspace(1, 0, u) ** vorm
    return e
def zet(doel, x, op):
    i = int(op * SR); j = min(len(doel), i + len(x)); doel[i:j] += x[:j - i]; return doel
def galm(x, nat=0.35, tijden=(0.0297, 0.0371, 0.0411, 0.0437), ap=(0.005, 0.0017), terug=0.8):
    y = np.zeros(len(x) + int(1.6 * SR)); xx = np.concatenate([x, np.zeros(len(y) - len(x))])
    som = np.zeros_like(y)
    for d in tijden:
        n = int(d * SR); b = np.zeros(n + 1); b[0] = 1; a = np.zeros(n + 1); a[0] = 1; a[n] = -terug
        som += signal.lfilter([1], a, xx)
    for d in ap:
        n = int(d * SR); g = 0.7; b = np.zeros(n + 1); b[0] = -g; b[n] = 1; a = np.zeros(n + 1); a[0] = 1; a[n] = -g
        som = signal.lfilter(b, a, som)
    return (1 - nat) * xx + nat * som / len(tijden)
def pluk(f, sec, demping=0.996):
    # Karplus-Strong: getokkelde snaar
    n = int(sec * SR); p = int(SR / f); buf = rng.uniform(-1, 1, p); uit = np.zeros(n)
    for i in range(n):
        v = buf[i % p]; uit[i] = v
        buf[i % p] = demping * 0.5 * (v + buf[(i + 1) % p])
    return lp(uit, 4000, 2)

G = {}

# Duim omhoog: een woesj (de hand schiet omhoog) en een blij belletje, twee tonen omhoog
def duimop():
    uit = np.zeros(int(1.3 * SR))
    n = int(0.3 * SR); t = np.arange(n) / SR
    fc = np.interp(t, [0, 0.3], [600, 3000]); r = ruis(0.3); w = np.zeros(n); st = n // 10
    for k in range(10):
        a, b = k * st, min(n, (k + 1) * st); w[a:b] = bp(r, fc[a] * 0.6, fc[a] * 1.5)[a:b]
    zet(uit, w * omhul(n, 0.15, 0.1) * 0.5, 0.0)
    for f, op in ((1318.5, 0.26), (1975.5, 0.4)):
        m = int(0.8 * SR); tt = np.arange(m) / SR
        bel = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) + 0.15 * np.sin(2 * np.pi * 3.01 * f * tt)) * np.exp(-tt * 5)
        zet(uit, bel * 0.3, op)
    return uit
G['duimop'] = (duimop, 'Top!', 'Great!', 'pling')

# Boe: een zaaltje dat 'boeoeoe' roept (een paar lage stemmen door elkaar)
def boe():
    n = int(1.6 * SR); t = np.arange(n) / SR; uit = np.zeros(n)
    for k, f in enumerate((118, 132, 104, 145, 126)):
        op = 0.04 * k; m = n - int(op * SR); tt = np.arange(m) / SR
        f0 = f * np.interp(tt, [0, 0.3, tt[-1]], [1.08, 1.0, 0.86]) * (1 + 0.02 * np.sin(2 * np.pi * (4 + k) * tt))
        stem = glottis(f0) * omhul(m, 0.12, 0.45, 1.5)
        zet(uit, formanten(stem, (330, 700, 2400), gains=(1.0, 0.5, 0.12)) * (0.5 + 0.1 * k % 2), op)
    uit += 0.05 * bp(ruis(1.6), 200, 1500) * omhul(n, 0.1, 0.4)
    return uit
G['boe'] = (boe, 'Boe!', 'Boo!', 'zoemer')

# Die kant op: een glijfluitje omhoog en een 'pling' op het eind (de pijl komt aan)
def pijl():
    uit = np.zeros(int(1.2 * SR))
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = np.interp(t, [0, 0.5], [500, 1500]) * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    fase = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(fase) + 0.12 * bp(ruis(0.5), 800, 3000)
    zet(uit, x * omhul(n, 0.03, 0.05) * 0.45, 0.0)
    m = int(0.6 * SR); tt = np.arange(m) / SR
    zet(uit, (np.sin(2 * np.pi * 2093 * tt) + 0.3 * np.sin(2 * np.pi * 5.4 * 2093 * tt)) * np.exp(-tt * 9) * 0.3, 0.5)
    return uit
G['pijl'] = (pijl, 'Die kant op', 'This way', 'fluit')

# Stop: een klap op tafel en een korte, lage 'toet' (stoppen!)
def halt():
    uit = np.zeros(int(1.0 * SR))
    n = int(0.25 * SR); t = np.arange(n) / SR
    klap = bp(ruis(0.25), 300, 5000) * np.exp(-t * 30) + 0.8 * np.sin(2 * np.pi * np.interp(t, [0, 0.25], [140, 60]) * t) * np.exp(-t * 18)
    zet(uit, np.tanh(2 * klap) * 0.8, 0.0)
    m = int(0.45 * SR); tt = np.arange(m) / SR
    toet = lp(signal.square(2 * np.pi * 233 * tt) + signal.square(2 * np.pi * 277 * tt), 1800) * omhul(m, 0.01, 0.06)
    zet(uit, toet * 0.22, 0.3)
    return uit
G['halt'] = (halt, 'Halt!', 'Halt!', 'zoemer')

# Peace: zachte getokkelde akkoorden en een windgong (rustig)
def vrede():
    uit = np.zeros(int(2.0 * SR))
    for k, f in enumerate((196.0, 246.9, 293.7, 392.0, 493.9)):
        zet(uit, pluk(f, 1.4, 0.997) * 0.5, 0.05 * k)
    for k in range(5):
        m = int(1.0 * SR); tt = np.arange(m) / SR; f = (1568, 1760, 2093, 2349, 2637)[k]
        zet(uit, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3.5) * 0.08, 0.45 + 0.13 * k + 0.03 * rng.random())
    return galm(uit, nat=0.3)[:int(2.3 * SR)]
G['vrede'] = (vrede, 'Vrede', 'Peace', 'ting')

# Oke: een knipoog-klikje en een vrolijke marimba (o-kee!)
def oke():
    uit = np.zeros(int(1.1 * SR))
    zet(uit, hp(ruis(0.01), 3000) * np.exp(-np.arange(int(0.01 * SR)) / SR * 500) * 0.6, 0.0)
    for f, op in ((523.3, 0.08), (784.0, 0.24)):
        m = int(0.6 * SR); tt = np.arange(m) / SR
        mar = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt * 30)) * np.exp(-tt * 7)
        zet(uit, mar * 0.45, op)
    return uit
G['oke'] = (oke, 'Oké!', 'Okay!', 'pop')

# Rock on: een vervormde gitaar, twee powerakkoorden (dun-DUNNN) met galm
def rock():
    uit = np.zeros(int(1.9 * SR))
    for (f, op, lang) in ((82.4, 0.0, 0.22), (82.4, 0.25, 0.22), (110.0, 0.5, 1.2)):
        n = int(lang * SR); t = np.arange(n) / SR
        x = sum(pluk(ff, lang, 0.998)[:n] for ff in (f, f * 1.498, f * 2))
        x = np.tanh(9 * x) * omhul(n, 0.003, 0.08 if lang < 0.5 else 0.5)
        zet(uit, lp(x, 3200) * 0.4, op)
    return galm(uit, nat=0.25)[:int(2.2 * SR)]
G['rock'] = (rock, 'Rockgitaar', 'Rock guitar', 'boem')

# Power: een vuist die dichtknijpt (knars) en een opladend geluid dat omhoog schiet
def kracht():
    uit = np.zeros(int(1.4 * SR))
    knars = bp(ruis(0.18), 300, 2500) * (0.5 + 0.5 * signal.square(2 * np.pi * 40 * np.arange(int(0.18 * SR)) / SR)) * omhul(int(0.18 * SR), 0.02, 0.05)
    zet(uit, knars * 0.5, 0.0)
    n = int(0.8 * SR); t = np.arange(n) / SR
    f = 150 * 2 ** (t / 0.8 * 3)
    fase = 2 * np.pi * np.cumsum(f) / SR
    x = signal.sawtooth(fase) * (0.6 + 0.4 * signal.square(2 * np.pi * 18 * t))
    zet(uit, lp(x, 4000) * omhul(n, 0.05, 0.08) * 0.35, 0.2)
    m = int(0.35 * SR); tt = np.arange(m) / SR
    zet(uit, (np.sin(2 * np.pi * 1200 * tt) + np.sin(2 * np.pi * 1800 * tt)) * np.exp(-tt * 8) * 0.25, 1.0)
    return uit
G['kracht'] = (kracht, 'Opladen', 'Power up', 'sprong')

# Hallo: een deurbel, ding-dong
def hallo():
    uit = np.zeros(int(1.8 * SR))
    for f, op in ((659.3, 0.0), (523.3, 0.42)):
        m = int(1.3 * SR); tt = np.arange(m) / SR
        bel = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * 2.01 * f * tt) * np.exp(-tt * 3) + 0.25 * np.sin(2 * np.pi * 3.0 * f * tt) * np.exp(-tt * 6)) * np.exp(-tt * 2.6)
        zet(uit, bel * 0.4 * omhul(m, 0.002, 0.05), op)
    return uit
G['hallo'] = (hallo, 'Ding dong', 'Ding dong', 'ting')

# Klap klap: twee duidelijke klappen en dan een kort applaus
def applaus():
    uit = np.zeros(int(1.8 * SR))
    def klap(): return bp(ruis(0.05), 700, 4500) * np.exp(-np.arange(int(0.05 * SR)) / SR * 90)
    zet(uit, klap() * 0.9, 0.0); zet(uit, klap() * 0.9, 0.28)
    for k in range(70):
        op = 0.55 + 1.0 * rng.random()
        zet(uit, klap() * (0.25 + 0.3 * rng.random()) * (1 - (op - 0.55) / 1.1), op)
    return uit
G['applaus'] = (applaus, 'Applaus', 'Applause', 'klets')

# Yes!: een vuist die de lucht in gaat (woesj) en een korte, blije blazersstoot
def yes():
    uit = np.zeros(int(1.3 * SR))
    n = int(0.22 * SR); t = np.arange(n) / SR
    zet(uit, bp(ruis(0.22), 500, 3000) * omhul(n, 0.12, 0.06) * 0.5, 0.0)
    for f, op, lang in ((392.0, 0.2, 0.12), (523.3, 0.33, 0.6)):
        m = int(lang * SR); tt = np.arange(m) / SR
        x = sum(signal.sawtooth(2 * np.pi * ff * tt) for ff in (f, f * 1.26, f * 1.5))
        zet(uit, lp(x, 3000) * omhul(m, 0.015, min(0.15, lang * 0.5)) * 0.2, op)
    return uit
G['yes'] = (yes, 'Yes!', 'Yes!', 'sprong')

# Live long & prosper: een zwevend ruimteschipgeluid, een glinsterende toon die aanzwelt en wegsterft
def warp():
    n = int(1.9 * SR); t = np.arange(n) / SR
    f = np.interp(t, [0, 0.9, 1.9], [220, 440, 330])
    fase = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(fase) + 0.5 * np.sin(2 * fase + 0.5 * np.sin(2 * np.pi * 5 * t)) + 0.3 * np.sin(3.01 * fase)
    x += 0.15 * bp(ruis(1.9), 3000, 8000) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t))
    x *= omhul(n, 0.5, 0.7, 1.5)
    return galm(x, nat=0.4)[:int(2.3 * SR)]
G['warp'] = (warp, 'Ruimteschip', 'Starship', 'ting')

def schrijf_wav(pad, v):
    import struct
    d = np.clip(np.round(v * 32767), -32767, 32767).astype('<i2').tobytes()
    with open(pad, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(d)) + b'WAVE' + b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(d)) + d)

verslag = {}
for naam, (f, nl, en, terug) in G.items():
    v = np.asarray(f(), dtype=float)
    v = v - np.mean(v)
    piek = np.max(np.abs(v)) or 1
    drempel = piek * 10 ** (-60 / 20)
    nz = np.nonzero(np.abs(v) > drempel)[0]
    v = v[nz[0]:min(len(v), nz[-1] + int(0.03 * SR))]
    fade = min(len(v), int(0.012 * SR)); v[-fade:] *= np.linspace(1, 0, fade)
    rms = math.sqrt(np.mean(v ** 2)) or 1e-9
    winst = min(10 ** ((-21 - 20 * math.log10(rms)) / 20), 10 ** (-1 / 20) / np.max(np.abs(v)))
    v *= winst
    w = os.path.join(UIT, naam + '.tmp.wav'); m = os.path.join(UIT, naam + '.mp3')
    schrijf_wav(w, v)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0',
                    '-codec:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', '-ar', str(SR), m], check=True)
    os.remove(w)
    verslag[naam] = {'nl': nl, 'en': en, 'terug': terug, 'sec': round(len(v) / SR, 2), 'kB': round(os.path.getsize(m) / 1024, 1)}
print(json.dumps(verslag))
