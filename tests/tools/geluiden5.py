# geluiden5.py - de 12 eigen geluiden van stickervel 4 (v166, moderne handgebaren), met code gemaakt (numpy/scipy), als mp3.
# Naar geluiden2.py t/m geluiden4.py: zelfde hulpjes en afwerking (stilte eraf, 12 ms uitfaden, RMS -21 dB, piek
# hoogstens -1 dB, ffmpeg libmp3lame 128 kbps mono, zonder ID3-tag). Eigen vaste toevalsreeks (20261019); de volgorde
# hieronder (= f4-01 ... f4-12) hoort daarbij. In stickerfx.js: mp3: true en een terug-geluid (het 4e veld).
# python3 -I geluiden5.py <uitmap>        (bijv. <map>/geluiden)
import sys, os, math, subprocess, json
import numpy as np
from scipy import signal

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
rng = np.random.default_rng(20261019)

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

# Liefde: een harp die omhoog glijdt en een zacht hartje dat klopt
def liefde():
    uit = np.zeros(int(1.7 * SR))
    for k, f in enumerate((523.3, 659.3, 784.0, 987.8, 1174.7, 1568.0)):
        zet(uit, pluk(f, 1.0, 0.998) * 0.45, 0.06 * k)
    for op in (0.55, 0.78):
        n = int(0.18 * SR); t = np.arange(n) / SR
        zet(uit, np.sin(2 * np.pi * 70 * t) * np.exp(-t * 22) * 0.6, op)
    return galm(uit, nat=0.3)[:int(2.0 * SR)]
G['liefde'] = (liefde, 'Harp met hartje', 'Harp and heartbeat', 'pling')

# Chef's kiss: een smakkerd (mwah!) en een kort accordeonakkoord
def kus():
    uit = np.zeros(int(1.3 * SR))
    n = int(0.06 * SR); t = np.arange(n) / SR
    smak = bp(ruis(0.06), 800, 5000) * np.exp(-t * 80) + 0.5 * np.sin(2 * np.pi * np.interp(t, [0, 0.06], [900, 300]) * t) * np.exp(-t * 60)
    zet(uit, smak * 0.9, 0.0)
    m = int(0.2 * SR); tt = np.arange(m) / SR
    mwa = formanten_glijdend(glottis(np.interp(tt, [0, 0.2], [260, 220])) * omhul(m, 0.02, 0.08), (300, 900, 2300), (750, 1200, 2600))
    zet(uit, mwa * 0.8, 0.07)
    m = int(0.8 * SR); tt = np.arange(m) / SR
    acc = sum(signal.square(2 * np.pi * f * tt * (1 + 0.004 * np.sin(2 * np.pi * 6 * tt)), 0.3) for f in (349.2, 440.0, 523.3))
    zet(uit, lp(acc, 2500) * omhul(m, 0.04, 0.3) * 0.13, 0.35)
    return uit
G['kus'] = (kus, 'Smakkerd', 'Kiss smack', 'pop')

# High five: een harde klap van twee handen en glinsters eromheen
def vijf():
    uit = np.zeros(int(1.2 * SR))
    n = int(0.12 * SR); t = np.arange(n) / SR
    klap = bp(ruis(0.12), 900, 6000) * np.exp(-t * 45) + 0.3 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 40)
    zet(uit, klap * 0.35, 0.0)
    for k in range(6):
        m = int(0.4 * SR); tt = np.arange(m) / SR; f = 2400 + 400 * k
        zet(uit, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 10) * 0.2, 0.1 + 0.06 * k)
    return uit
G['vijf'] = (vijf, 'Handklap', 'High five', 'klets')

# Succes: een klavertje-vier-deuntje op een speeldoos (omhoog) met een glinster
def geluk():
    uit = np.zeros(int(1.7 * SR))
    for k, f in enumerate((784.0, 987.8, 1174.7, 1568.0)):
        m = int(0.9 * SR); tt = np.arange(m) / SR
        doos = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt * 12)) * np.exp(-tt * 4.5)
        zet(uit, doos * 0.32, 0.13 * k)
    m = int(0.6 * SR); tt = np.arange(m) / SR
    zet(uit, hp(ruis(0.6), 6000) * np.exp(-tt * 6) * 0.1, 0.55)
    return galm(uit, nat=0.25)[:int(1.9 * SR)]
G['geluk'] = (geluk, 'Speeldoos', 'Music box', 'ting')

# Alsjeblieft: een zacht koortje, 'aaah' (engelachtig), dat aanzwelt
def engel():
    n = int(1.7 * SR); t = np.arange(n) / SR; uit = np.zeros(n)
    for k, f in enumerate((261.6, 329.6, 392.0, 523.3)):
        f0 = f * (1 + 0.006 * np.sin(2 * np.pi * (5 + 0.3 * k) * t + k))
        stem = glottis(f0) * omhul(n, 0.4, 0.6, 1.5)
        uit += formanten(stem, (800, 1150, 2900), gains=(1.0, 0.5, 0.15)) * 0.25
    return galm(uit, nat=0.4)[:int(2.2 * SR)]
G['engel'] = (engel, 'Koortje', 'Choir', 'ting')

# Twijfel: een aarzelend 'hmm-hmm?' dat op en neer gaat, en een denkwolkje dat 'plop' doet
def twijfel():
    uit = np.zeros(int(1.3 * SR))
    for f0s, op, lang in (((200, 170), 0.0, 0.28), ((170, 230), 0.36, 0.38)):
        m = int(lang * SR); tt = np.arange(m) / SR
        f0 = np.interp(tt, [0, lang], f0s)
        zet(uit, formanten(glottis(f0), (250, 1300, 2400), bws=(70, 150, 200), gains=(1.0, 0.15, 0.05)) * omhul(m, 0.03, 0.08), op)
    n = int(0.1 * SR); t = np.arange(n) / SR
    plop = np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, 0.1], [300, 900])) / SR) * omhul(n, 0.005, 0.05)
    zet(uit, plop * 0.6, 0.9)
    return uit
G['twijfel'] = (twijfel, 'Twijfelen', 'Hesitant', 'huh')

# Boks: twee vuisten die tegen elkaar komen (doffe tik) en een klein knalletje met glitters
def boks():
    uit = np.zeros(int(1.3 * SR))
    n = int(0.2 * SR); t = np.arange(n) / SR
    tik = lp(ruis(0.2), 1500) * np.exp(-t * 35) + np.sin(2 * np.pi * np.interp(t, [0, 0.2], [180, 90]) * t) * np.exp(-t * 25)
    zet(uit, tik * 0.9, 0.0)
    m = int(0.5 * SR); tt = np.arange(m) / SR
    zet(uit, bp(ruis(0.5), 400, 4000) * np.exp(-tt * 10) * 0.5, 0.12)
    for k in range(5):
        mm = int(0.3 * SR); t3 = np.arange(mm) / SR
        zet(uit, np.sin(2 * np.pi * (2800 + 500 * rng.random()) * t3) * np.exp(-t3 * 12) * 0.1, 0.25 + 0.07 * k)
    return uit
G['boks'] = (boks, 'Boks', 'Fist bump', 'boem')

# Wat?: een verbaasde 'wat?' die omhoog schiet, en een schouderophaal-woesj
def wat():
    uit = np.zeros(int(1.0 * SR))
    m = int(0.42 * SR); tt = np.arange(m) / SR
    f0 = np.interp(tt, [0, 0.1, 0.42], [170, 190, 360])
    stem = glottis(f0) * omhul(m, 0.02, 0.1)
    klank = formanten_glijdend(stem, (350, 700, 2300), (750, 1150, 2500))  # w -> a
    t2 = hp(ruis(0.03), 2000) * 0.3; klank[-len(t2):] += t2  # -t
    zet(uit, klank, 0.0)
    n = int(0.3 * SR); t = np.arange(n) / SR
    zet(uit, bp(ruis(0.3), 500, 2500) * omhul(n, 0.12, 0.12) * 0.35, 0.5)
    return uit
G['wat'] = (wat, 'Wat?', 'What?', 'huh')

# Raak!: een speelgoedpistooltje (pieuw!) en daarna even blazen
def pieuw():
    uit = np.zeros(int(1.2 * SR))
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 2400 * np.exp(-t * 9) + 300
    fase = 2 * np.pi * np.cumsum(f) / SR
    zet(uit, (signal.square(fase) * 0.4 + np.sin(fase)) * omhul(n, 0.003, 0.1) * 0.4, 0.0)
    m = int(0.45 * SR); tt = np.arange(m) / SR
    zet(uit, bp(ruis(0.45), 300, 1800) * omhul(m, 0.08, 0.25) * 0.4, 0.5)
    return uit
G['pieuw'] = (pieuw, 'Pieuw!', 'Pew!', 'sprong')

# Momentje: een kuchje (ahum) en een helder belletje
def ahum():
    uit = np.zeros(int(1.3 * SR))
    n = int(0.12 * SR)
    zet(uit, formanten(ruis(0.12), (600, 1200, 2500)) * omhul(n, 0.005, 0.08) * 0.4, 0.0)
    m = int(0.3 * SR); tt = np.arange(m) / SR
    zet(uit, formanten(glottis(np.interp(tt, [0, 0.3], [150, 130])), (300, 1000, 2400), gains=(1.0, 0.2, 0.05)) * omhul(m, 0.03, 0.1), 0.14)
    k = int(0.9 * SR); t3 = np.arange(k) / SR
    zet(uit, (np.sin(2 * np.pi * 1760 * t3) + 0.4 * np.sin(2 * np.pi * 4.2 * 1760 * t3) * np.exp(-t3 * 15)) * np.exp(-t3 * 4) * 0.35, 0.5)
    return uit
G['ahum'] = (ahum, 'Ahum', 'Ahem', 'ting')

# Jij!: een orkestklap (DAM!) en een spotlight die aangaat (brom en ping)
def jij():
    uit = np.zeros(int(1.5 * SR))
    n = int(0.9 * SR); t = np.arange(n) / SR
    hit = sum(signal.sawtooth(2 * np.pi * f * t) for f in (98.0, 146.8, 196.0, 293.7)) * np.exp(-t * 4)
    hit += lp(ruis(0.9), 3000) * np.exp(-t * 15) * 1.5
    zet(uit, lp(hit, 2500) * omhul(n, 0.004, 0.3) * 0.22, 0.0)
    m = int(0.5 * SR); tt = np.arange(m) / SR
    zet(uit, np.sin(2 * np.pi * 2637 * tt) * np.exp(-tt * 7) * 0.2, 0.55)
    return uit
G['jij'] = (jij, 'Orkestklap', 'Orchestra hit', 'boem')

# Deal!: twee handen die elkaar pakken (woesj, klap) en een kassa: ka-tsjing
def deal():
    uit = np.zeros(int(1.5 * SR))
    n = int(0.2 * SR)
    zet(uit, bp(ruis(0.2), 500, 3000) * omhul(n, 0.12, 0.05) * 0.4, 0.0)
    m = int(0.08 * SR); tt = np.arange(m) / SR
    zet(uit, bp(ruis(0.08), 600, 4000) * np.exp(-tt * 50) * 0.3, 0.2)
    k = int(0.06 * SR)
    zet(uit, hp(ruis(0.06), 1500) * np.exp(-np.arange(k) / SR * 70) * 0.25, 0.45)
    j = int(0.9 * SR); t3 = np.arange(j) / SR
    bel = sum(a * np.sin(2 * np.pi * f * t3) for f, a in ((2093, 1.0), (2637, 0.7), (3136, 0.5), (4186, 0.3))) * np.exp(-t3 * 4)
    zet(uit, bel * 0.2, 0.52)
    return uit
G['deal'] = (deal, 'Kassa', 'Cash register', 'ting')

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
