# geluiden3.py - de 12 eigen geluiden van stickervel 2 (v164), met code gemaakt (numpy/scipy), als mp3.
# Naar geluiden2.py (vel 1): zelfde hulpjes en zelfde afwerking (stilte eraf, 12 ms uitfaden, RMS -21 dB, piek
# hoogstens -1 dB, ffmpeg libmp3lame 128 kbps mono, zonder ID3-tag). Andere vaste toevalsreeks (20261017); de volgorde
# van de geluiden hieronder hoort daarbij (zelfde volgorde als de stickers f2-01 ... f2-12).
# In stickerfx.js hebben ze mp3: true en een terug-geluid (het 4e veld) voor als de mp3 niet lukt.
# python3 -I geluiden3.py <uitmap>        (bijv. <map>/geluiden)
import sys, os, math, subprocess, json
import numpy as np
from scipy import signal

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
rng = np.random.default_rng(20261017)

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

# Ik denk na: een nadenkende 'hmmmm' (neuriend, toonhoogte zweeft) en twee tikjes van een vinger tegen de kin
def peins():
    uit = np.zeros(int(1.6 * SR))
    m = int(1.3 * SR); tt = np.arange(m) / SR
    f0 = np.interp(tt, [0, 0.3, 0.8, 1.3], [165, 150, 158, 172]) * (1 + 0.012 * np.sin(2 * np.pi * 4.5 * tt))
    stem = glottis(f0) * omhul(m, 0.08, 0.35, 1.5)
    zet(uit, formanten(stem, (260, 1150, 2350), bws=(70, 150, 200), gains=(1.0, 0.18, 0.06)) * 0.9, 0.0)
    for op in (0.45, 0.85):
        n = int(0.04 * SR); t = np.arange(n) / SR
        tok = (np.sin(2 * np.pi * 330 * t) + 0.5 * bp(ruis(0.04), 600, 2500)) * np.exp(-t * 90)
        zet(uit, tok * 0.35, op)
    return uit
G['peins'] = (peins, 'Nadenken', 'Pondering', 'huh')

# Even denken...: een computer die laadt (stijgende piepjes), hapert en vastloopt (zoem + kraak)
def laden():
    uit = np.zeros(int(1.6 * SR))
    for k in range(6):
        n = int(0.07 * SR); t = np.arange(n) / SR
        f = 520 * 2 ** (k / 6)
        piep = signal.square(2 * np.pi * f * t) * omhul(n, 0.003, 0.02)
        zet(uit, lp(piep, 3000) * 0.3, k * 0.11)
    n = int(0.12 * SR); t = np.arange(n) / SR
    zet(uit, lp(signal.square(2 * np.pi * 523 * t), 3000) * omhul(n, 0.003, 0.02) * 0.3, 0.7)
    zet(uit, lp(signal.square(2 * np.pi * 523 * t), 3000) * omhul(n, 0.003, 0.02) * 0.3, 0.86)
    n = int(0.55 * SR); t = np.arange(n) / SR
    zoem = signal.sawtooth(2 * np.pi * 62 * t) + 0.7 * signal.sawtooth(2 * np.pi * 93 * t)
    kraak = bp(ruis(0.55), 1500, 6000) * (rng.random(n) > 0.985) * 3
    zet(uit, (lp(zoem, 1200) * 0.35 + kraak * 0.3) * omhul(n, 0.005, 0.15), 1.02)
    return uit
G['laden'] = (laden, 'Vastloper', 'Crash', 'error')

# Ik wacht...: een klok die tikt (tik, tak) en vingers die ongeduldig op tafel trommelen
def tiktak():
    uit = np.zeros(int(1.7 * SR))
    for k in range(4):
        f = 2600 if k % 2 == 0 else 2050
        n = int(0.05 * SR); t = np.arange(n) / SR
        tik = (bp(ruis(0.05), f - 700, f + 900) + 0.6 * np.sin(2 * np.pi * f * t)) * np.exp(-t * 160)
        zet(uit, tik * 0.55, 0.02 + k * 0.4)
    for k, op in enumerate([0.2, 0.27, 0.34, 0.41, 0.6, 0.67, 0.74, 0.81, 1.0, 1.07, 1.14, 1.21]):
        n = int(0.06 * SR); t = np.arange(n) / SR
        f = [210, 190, 175, 160][k % 4]
        klop = (np.sin(2 * np.pi * f * t) + lp(ruis(0.06), 900) * 0.6) * np.exp(-t * 70)
        zet(uit, klop * 0.5, op)
    return uit
G['tiktak'] = (tiktak, 'Tik tak', 'Tick tock', 'fluit')

# Zzz: snurken (inademen met geronk, uitademen met een fluitje) en een kwijlbelletje dat knapt
def zzz():
    uit = np.zeros(int(2.0 * SR))
    n = int(0.75 * SR); t = np.arange(n) / SR
    ronk = (0.5 + 0.5 * np.sin(2 * np.pi * 28 * t)) ** 2
    in_ = lp(ruis(0.75), 900) * ronk + 0.4 * lp(signal.sawtooth(2 * np.pi * 56 * t), 600) * ronk
    zet(uit, in_ * omhul(n, 0.25, 0.15) * 0.9, 0.0)
    n = int(0.6 * SR); t = np.arange(n) / SR
    fluit = np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, 0.6], [1300, 900])) / SR) * 0.25 + bp(ruis(0.6), 600, 2400) * 0.5
    zet(uit, fluit * omhul(n, 0.08, 0.3), 0.85)
    n = int(0.12 * SR); t = np.arange(n) / SR
    bel = np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, 0.12], [500, 1400])) / SR) * omhul(n, 0.01, 0.03)
    zet(uit, bel * 0.35, 1.55)
    pop = bp(ruis(0.02), 1500, 6000) * np.exp(-np.arange(int(0.02 * SR)) / SR * 250)
    zet(uit, pop * 0.9, 1.67)
    return uit
G['zzz'] = (zzz, 'Snurken met belletje', 'Snore and bubble', 'ting')

# Huh?: een vragende 'hm?' die omhoog gaat
def hmm():
    uit = np.zeros(int(1.0 * SR))
    m = int(0.18 * SR); tt = np.arange(m) / SR
    f0 = np.full(m, 190.0)
    zet(uit, formanten(glottis(f0), (250, 1500, 2500), gains=(1.0, 0.1, 0.05)) * omhul(m, 0.03, 0.04) * 0.8, 0.0)
    m = int(0.5 * SR); tt = np.arange(m) / SR
    f0 = np.interp(tt, [0, 0.12, 0.5], [180, 200, 380])
    stem = glottis(f0) * omhul(m, 0.03, 0.15, 1.5)
    klank = formanten_glijdend(stem, (300, 1600, 2500), (560, 1700, 2600))
    zet(uit, klank, 0.24)
    return uit
G['hmm'] = (hmm, 'Hm?', 'Hm?', 'huh')

# Idee: het klikje van een lamp, een zoemend lampje en een twinkelende reeks omhoog
def idee():
    uit = np.zeros(int(1.5 * SR))
    klik = hp(ruis(0.015), 2000) * np.exp(-np.arange(int(0.015 * SR)) / SR * 300)
    zet(uit, klik * 0.25, 0.0)
    n = int(0.35 * SR); t = np.arange(n) / SR
    zet(uit, lp(signal.sawtooth(2 * np.pi * 100 * t), 800) * omhul(n, 0.01, 0.1) * 0.12, 0.02)
    for k, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0, 2637.0)):
        m = int(0.6 * SR); tt = np.arange(m) / SR
        bel = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2.76 * f * tt)) * np.exp(-tt * 6)
        zet(uit, bel * 0.22, 0.3 + k * 0.08)
    x = galm(uit, nat=0.3)[:int(1.5 * SR)]
    return x * np.concatenate([np.ones(int(1.2 * SR)), np.linspace(1, 0, len(x) - int(1.2 * SR)) ** 2])
G['idee'] = (idee, 'Idee!', 'Idea!', 'ting')

# Pas op: een sirene, twee keer wie-woe, en een rinkel
def sirene():
    n = int(1.4 * SR); t = np.arange(n) / SR
    f = np.where((t % 0.7) < 0.35, 960, 740).astype(float)
    f = lp(f, 40, 2)
    fase = 2 * np.pi * np.cumsum(f) / SR
    x = signal.square(fase, 0.5) * 0.5 + np.sin(fase)
    x = lp(x, 3500) * omhul(n, 0.02, 0.1)
    return x
G['sirene'] = (sirene, 'Sirene', 'Siren', 'alarm')

# Ugh: een klets (hand tegen het hoofd) en een lage, geergerde 'uuugh'
def facepalm():
    uit = np.zeros(int(1.4 * SR))
    n = int(0.12 * SR); t = np.arange(n) / SR
    klets = bp(ruis(0.12), 400, 4000) * np.exp(-t * 45) + 0.5 * np.sin(2 * np.pi * 120 * t) * np.exp(-t * 30)
    zet(uit, klets * 0.9, 0.0)
    m = int(0.8 * SR); tt = np.arange(m) / SR
    f0 = np.interp(tt, [0, 0.15, 0.8], [150, 135, 100]) * (1 + 0.02 * np.sin(2 * np.pi * 5 * tt))
    stem = glottis(f0) * omhul(m, 0.05, 0.4, 1.5)
    stem += 0.15 * lp(ruis(0.8), 1500) * omhul(m, 0.05, 0.4)  # hees
    klank = formanten_glijdend(stem, (640, 1190, 2390), (450, 1000, 2300))
    gg = lp(ruis(0.12), 2500) * omhul(int(0.12 * SR), 0.01, 0.08) * 0.3  # -gh aan het eind
    klank[-len(gg):] += gg
    zet(uit, klank, 0.2)
    return uit
G['facepalm'] = (facepalm, 'Facepalm', 'Facepalm', 'zucht')

# Krekels: stilte, een zacht windje en krekels die tsjirpen
def krekels():
    n = int(1.9 * SR); t = np.arange(n) / SR
    uit = 0.05 * lp(ruis(1.9), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t))
    for f, start, tempo in ((4500, 0.05, 0.42), (5200, 0.25, 0.5)):
        op = start
        while op < 1.7:
            for p in range(3):
                m = int(0.018 * SR); tt = np.arange(m) / SR
                puls = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / 0.018)
                zet(uit, puls * 0.35, op + p * 0.03)
            op += tempo
    return uit
G['krekels'] = (krekels, 'Krekels', 'Crickets', 'tsjirp')

# Mind blown: een opzwellend gesis en een grote klap die nadreunt
def ontploft():
    uit = np.zeros(int(2.0 * SR))
    n = int(0.45 * SR); t = np.arange(n) / SR
    zet(uit, hp(ruis(0.45), 1500) * (t / 0.45) ** 3 * 0.35, 0.0)
    m = int(1.5 * SR); tt = np.arange(m) / SR
    klap = lp(ruis(1.5), 900) * np.exp(-tt * 3.2) + 0.9 * np.sin(2 * np.pi * np.interp(tt, [0, 0.4], [70, 38]) * tt) * np.exp(-tt * 4)
    klap += bp(ruis(1.5), 2000, 6000) * np.exp(-tt * 12) * 0.4
    zet(uit, np.tanh(2 * klap) * 0.9, 0.45)
    for k in range(6):
        sp = bp(ruis(0.03), 2500, 7000) * np.exp(-np.arange(int(0.03 * SR)) / SR * 150) * 0.3
        zet(uit, sp, 0.8 + 0.12 * k + 0.05 * rng.random())
    return galm(uit, nat=0.35)[:int(2.4 * SR)]
G['ontploft'] = (ontploft, 'Ontploffing', 'Mind blown', 'boem')

# Winnaar: een fanfare (ta-ta-ta-taaa), glinstertjes en een kort applaus
def winnaar():
    uit = np.zeros(int(2.2 * SR))
    def koper(f, lang):
        n = int(lang * SR); t = np.arange(n) / SR
        f0 = f * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * (t > 0.15))
        fase = 2 * np.pi * np.cumsum(f0) / SR
        x = signal.sawtooth(fase)
        helder = np.interp(t, [0, 0.04, lang], [600, 3500, 2200])
        y = np.zeros(n); st = max(1, n // 8)
        for k in range(0, n, st):
            y[k:k + st] = lp(x, helder[k])[k:k + st]
        return y * omhul(n, 0.02, 0.08)
    for f, op, lang in ((523.3, 0.0, 0.13), (659.3, 0.15, 0.13), (784.0, 0.30, 0.13), (1046.5, 0.45, 0.7)):
        zet(uit, koper(f, lang) * 0.4 + koper(f / 2, lang) * 0.25, op)
    for k in range(7):
        m = int(0.4 * SR); tt = np.arange(m) / SR
        f = 2500 + 2500 * rng.random()
        zet(uit, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 12) * 0.12, 0.5 + 0.09 * k)
    for k in range(40):
        klap = bp(ruis(0.03), 800, 5000) * np.exp(-np.arange(int(0.03 * SR)) / SR * 120) * (0.3 + 0.4 * rng.random())
        zet(uit, klap * 0.5, 0.9 + 1.0 * rng.random())
    return uit
G['winnaar'] = (winnaar, 'Fanfare', 'Fanfare', 'ting')

# Loser: een treurige trombone (wah, wah, wah, waaaah) die op het eind beverig wegzakt
def loser():
    uit = np.zeros(int(2.4 * SR))
    for f, op, lang, bibber in ((293.7, 0.0, 0.32, 0), (277.2, 0.38, 0.32, 0), (261.6, 0.76, 0.32, 0), (247.0, 1.14, 1.0, 1)):
        n = int(lang * SR); t = np.arange(n) / SR
        f0 = f * np.ones(n) * (1 - (0.03 * t if bibber else 0)) * (1 + (0.03 * np.sin(2 * np.pi * 6 * t) * np.clip(t * 3, 0, 1) if bibber else 0))
        fase = 2 * np.pi * np.cumsum(f0) / SR
        x = signal.sawtooth(fase) + 0.5 * signal.sawtooth(2 * fase)
        wah = np.interp(t, [0, 0.08, lang], [400, 1400, 500])  # demper: wah
        y = np.zeros(n); st = max(1, n // 10)
        for k in range(0, n, st):
            y[k:k + st] = lp(x, wah[k])[k:k + st]
        zet(uit, y * omhul(n, 0.03, 0.12 if not bibber else 0.5) * 0.5, op)
    return uit
G['loser'] = (loser, 'Treurige trombone', 'Sad trombone', 'zucht')

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
