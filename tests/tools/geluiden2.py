# geluiden2.py - de 12 eigen geluiden van stickervel 1 (v161), met code gemaakt (numpy/scipy), als mp3.
# Anders dan geluiden.py (die neemt de code-geluiden uit stickerfx.js op) staan deze geluiden alleen als mp3 in de
# app; in stickerfx.js hebben ze mp3: true en een terug-geluid voor als de mp3 niet lukt.
# Vaste toevalsreeks: zelfde uitkomst bij elke run (de volgorde van de geluiden hieronder hoort daarbij).
# Elk geluid: stilte eraf, 12 ms uitfaden, even hard als de andere (RMS -21 dB, piek hoogstens -1 dB), ffmpeg
# libmp3lame 128 kbps mono, zonder ID3-tag. Op het oog nagekeken met een spectrogram, beluisterd door Marcel
# (luisterpagina 'Geluiden stickervel 1', 16 okt 2026).
# python3 -I geluiden2.py <uitmap>        (bijv. <map>/geluiden; verhoog daarna MP3_VERSIE in stickerfx.js)
import sys, os, math, subprocess, json
import numpy as np
from scipy import signal

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
rng = np.random.default_rng(20261016)

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

# 1 Tranen van het lachen: een giechelende lach, ha-ha-ha-ha-haaa
def lach():
    uit = np.zeros(int(1.5 * SR)); op = 0.02
    toon = [360, 345, 330, 318, 305, 292]
    for k, f in enumerate(toon + [280]):
        lang = 0.105 if k < len(toon) else 0.32
        n = int(lang * SR); t = np.arange(n) / SR
        f0 = f * (1.06 - 0.12 * t / lang) * (1 + 0.02 * np.sin(2 * np.pi * 7 * t))
        stem = glottis(f0) * omhul(n, 0.012, lang * 0.55, 1.5)
        h = ruis(0.035) * omhul(int(0.035 * SR), 0.004, 0.03)
        klank = formanten(stem, (900, 1450, 2900), gains=(1.0, 0.7, 0.35))
        hh = 0.5 * formanten(h, (900, 1450, 2900)); klank[:len(hh)] += hh[:len(klank)]
        zet(uit, klank * (0.9 if k < len(toon) else 0.8), op)
        op += lang + 0.045 + 0.035 - 0.006 * k
    return uit
G['lach'] = (lach, 'Lachen', 'Laughing')

# 2 Ssst: ssssst
def ssst():
    s = hp(lp(ruis(0.75), 10500), 4200) * omhul(int(0.75 * SR), 0.1, 0.28, 1.6)
    s *= 1 + 0.12 * np.sin(2 * np.pi * 9 * tijd(0.75))
    t = bp(ruis(0.03), 2500, 6500) * omhul(int(0.03 * SR), 0.002, 0.025) * 1.6
    uit = np.zeros(int(0.9 * SR)); zet(uit, s, 0.0); zet(uit, t, 0.8)
    return uit
G['ssst'] = (ssst, 'Ssst', 'Shh')

# 3 Slaap lekker: snurken (in) en uitblazen, twee keer
def snurk():
    def keer():
        n = int(0.85 * SR); t = np.arange(n) / SR
        flap = (signal.sawtooth(2 * np.pi * 30 * t, 0.15) + 1) / 2
        r = lp(ruis(0.85), 700) * (0.35 + 0.65 * flap ** 3)
        stem = glottis(np.full(n, 95.0)) * 0.6
        klank = formanten(r + stem, (420, 900, 2300), gains=(1.0, 0.5, 0.15))
        klank *= np.sin(np.pi * np.minimum(1, t / 0.85)) ** 1.2
        uitblaas = lp(hp(ruis(0.6), 300), 1800) * omhul(int(0.6 * SR), 0.12, 0.4, 1.3) * 0.35
        uit = np.zeros(int(1.6 * SR)); zet(uit, klank, 0); zet(uit, uitblaas, 0.95)
        return uit
    uit = np.zeros(int(2.2 * SR)); zet(uit, keer() * 1.0, 0)
    return uit[:int(1.75 * SR)]
G['snurk'] = (snurk, 'Snurken', 'Snoring')

# 4 Kapot: een lange, moeie zucht (haaaah)
def zucht2():
    n = int(1.4 * SR); t = np.arange(n) / SR
    adem = lp(ruis(1.4), 3800)  # donkerder: adem, geen sis
    f0 = 135 - 45 * t / 1.4
    stem = glottis(f0) * 0.18
    klank = formanten_glijdend(adem * 0.9 + stem, (750, 1250, 2600), (380, 850, 2300), bws=(160, 200, 260))
    return klank * omhul(n, 0.18, 1.05, 1.8)
G['moe'] = (zucht2, 'Moeie zucht', 'Tired sigh')

# 5 Huilen: buaaah, met snikjes
def huil():
    uit = np.zeros(int(1.7 * SR))
    n = int(0.95 * SR); t = np.arange(n) / SR
    f0 = (500 - 120 * t / 0.95) * (1 + 0.035 * np.sin(2 * np.pi * 7.5 * t))
    stem = glottis(f0)
    klank = formanten_glijdend(stem, (850, 1300, 2800), (450, 900, 2500)) * omhul(n, 0.06, 0.4, 1.4)
    klank *= 1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t))
    zet(uit, klank, 0.0)
    for k in range(3):
        m = int(0.11 * SR); tt = np.arange(m) / SR
        snik = formanten(glottis(np.full(m, 430.0 - 15 * k)), (700, 1150, 2600)) * omhul(m, 0.01, 0.08)
        h = formanten(ruis(0.05), (700, 1150, 2600)) * omhul(int(0.05 * SR), 0.003, 0.045) * 0.6
        zet(uit, snik * 0.7, 1.05 + k * 0.17); zet(uit, h, 1.02 + k * 0.17)
    return uit
G['huil'] = (huil, 'Huilen', 'Crying')

# 6 Verliefd: hartklop (boem-boem, twee keer) en een paar fonkelende belletjes
def hartklop():
    def klop(f1, f2, sterk):
        n = int(0.16 * SR); t = np.arange(n) / SR
        f = f1 * (f2 / f1) ** (t / 0.16)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)
        x = np.tanh(3 * x)  # boventonen, zodat een telefoonluidspreker hem ook laat horen
        tik = lp(ruis(0.012), 900) * omhul(int(0.012 * SR), 0.001, 0.01) * 0.4
        uit = np.zeros(n); zet(uit, tik, 0); return (uit + x) * sterk
    uit = np.zeros(int(1.7 * SR))
    for k in range(2):
        zet(uit, klop(220, 95, 1.0), 0.02 + k * 0.6); zet(uit, klop(250, 110, 0.7), 0.22 + k * 0.6)
    for i, f in enumerate([1568, 1976, 2349, 3136]):
        n = int(0.5 * SR); t = np.arange(n) / SR
        b = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t)) * np.exp(-t * 9) * 0.22
        zet(uit, b, 1.05 + i * 0.07)
    return uit
G['hartklop'] = (hartklop, 'Hartklop', 'Heartbeat')

# 7 Boos: grommen en dan stoom uit de oren
def grom():
    n = int(0.85 * SR); t = np.arange(n) / SR
    f0 = 92 + 10 * np.sin(2 * np.pi * 1.3 * t)
    bron = glottis(f0) + 0.7 * glottis(f0 * 1.03)
    ruw = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * 33 * t))
    g = formanten(bron * ruw, (520, 1250, 2500), gains=(1.0, 0.8, 0.4))
    g = np.tanh(4 * g / (np.max(np.abs(g)) + 1e-9)) * omhul(n, 0.12, 0.3, 1.5)
    m = int(0.75 * SR); tt = np.arange(m) / SR
    stoom = bp(ruis(0.75), 2200, 5200) * omhul(m, 0.03, 0.45, 1.6) * 0.55
    fluit = np.sin(2 * np.pi * np.cumsum(2600 + 700 * tt / 0.75) / SR) * omhul(m, 0.08, 0.35, 1.6) * 0.18
    uit = np.zeros(int(1.65 * SR)); zet(uit, g, 0); zet(uit, stoom + fluit, 0.82)
    return uit
G['grom'] = (grom, 'Grommen', 'Growl')

# 8 Geschrokken: een snelle hap naar adem (hhh!) en een schrikakkoord
def schrik():
    n = int(0.16 * SR)
    hap = formanten_glijdend(ruis(0.16), (700, 1200, 2600), (350, 2300, 3000), bws=(150, 200, 250), stukken=8) * omhul(n, 0.1, 0.03, 1.0)
    m = int(0.75 * SR); t = np.arange(m) / SR
    akkoord = sum(signal.sawtooth(2 * np.pi * f * t) for f in (233.1, 329.6, 466.2, 659.3)) / 4
    open_ = 300 + 3500 * np.exp(-t * 7)
    a = np.zeros(m)
    for k in range(0, m, 512):  # filter dat dichtgaat: koperachtige stoot
        a[k:k + 512] = lp(akkoord[max(0, k - 2048):k + 512], float(open_[k]), 2)[-len(akkoord[k:k + 512]):]
    a *= omhul(m, 0.008, 0.5, 2.0)
    uit = np.zeros(int(1.0 * SR)); zet(uit, hap * 1.2, 0); zet(uit, a, 0.15)
    return uit
G['schrik'] = (schrik, 'Schrik', 'Startle')

# 9 Offline: uitvallen (bwoooop), hapering en een klik
def uitval():
    n = int(0.95 * SR); t = np.arange(n) / SR
    f = 950 * (55 / 950) ** (t / 0.95)
    x = 0.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * signal.square(2 * np.pi * np.cumsum(f) / SR)
    stap = np.maximum(1, (t / 0.95 * 18).astype(int))
    houd = np.repeat(x[::6], 6)[:n]  # lagere bemonstering: digitaal
    x = np.round(houd * 12) / 12
    x *= omhul(n, 0.005, 0.25, 1.4) * (1 - 0.4 * (0.5 + 0.5 * signal.square(2 * np.pi * (14 - 10 * t) * t)))
    klik = hp(ruis(0.006), 1500) * 0.8
    stat = bp(ruis(0.12), 1500, 7000) * omhul(int(0.12 * SR), 0.003, 0.1) * 0.25
    uit = np.zeros(int(1.2 * SR)); zet(uit, x, 0); zet(uit, klik, 0.96); zet(uit, stat, 0.97)
    return uit
G['uitval'] = (uitval, 'Uitvallen', 'Power down')

# 10 Druk: tikken op een toetsenbord en een rinkelende telefoon
def druk():
    uit = np.zeros(int(1.45 * SR)); op = 0.0
    for k in range(11):
        tik = hp(ruis(0.012), 1800) * np.exp(-np.arange(int(0.012 * SR)) / SR * 400) * (0.6 + 0.4 * rng.random())
        zet(uit, tik, op); op += 0.055 + 0.05 * rng.random()
    for k in range(2):
        n = int(0.32 * SR); t = np.arange(n) / SR
        bel = (np.sin(2 * np.pi * 1180 * t) + 0.8 * np.sin(2 * np.pi * 1420 * t)) * (0.5 + 0.5 * signal.square(2 * np.pi * 22 * t)) * omhul(n, 0.005, 0.08)
        zet(uit, lp(bel, 5000) * 0.45, 0.62 + k * 0.42)
    return uit
G['druk'] = (druk, 'Druk druk', 'Busy busy')

# 11 Spookje: oeoeoeOEoeoe (zwevend, met galm)
def spook():
    n = int(1.45 * SR); t = np.arange(n) / SR
    glij = np.interp(t, [0, 0.35, 0.8, 1.45], [380, 560, 640, 360])
    f0 = glij * (1 + 0.03 * np.sin(2 * np.pi * 5.5 * t))
    fase = 2 * np.pi * np.cumsum(f0) / SR
    x = np.sin(fase) + 0.25 * np.sin(2 * fase) + 0.08 * np.sin(3 * fase)
    x = formanten(x, (400, 800, 2400), gains=(1.0, 0.4, 0.1)) + 0.2 * x
    x += 0.04 * lp(ruis(1.45), 2000)
    x *= omhul(n, 0.25, 0.45, 1.5)
    return galm(x, nat=0.45)[:int(2.1 * SR)]
G['spook'] = (spook, 'Spookgeluid', 'Ghostly')

# 12 Sluw: sluipende tokkels (dum, dum, dum-dum-dum) en een stiekem belletje
def sluw():
    uit = np.zeros(int(1.6 * SR))
    noten = [(196.0, 0.0), (233.1, 0.24), (246.9, 0.48), (261.6, 0.6), (277.2, 0.72)]
    for f, op in noten:
        zet(uit, pluk(f, 0.45, 0.993) * 0.9, op)
    n = int(0.6 * SR); t = np.arange(n) / SR
    tink = (np.sin(2 * np.pi * 2093 * t) + 0.3 * np.sin(2 * np.pi * 2.76 * 2093 * t)) * np.exp(-t * 7) * 0.25
    zet(uit, tink, 0.98)
    return uit
G['sluw'] = (sluw, 'Sluipen', 'Sneaky')

def schrijf_wav(pad, v):
    import struct
    d = np.clip(np.round(v * 32767), -32767, 32767).astype('<i2').tobytes()
    with open(pad, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(d)) + b'WAVE' + b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(d)) + d)

verslag = {}
for naam, (f, nl, en) in G.items():
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
    verslag[naam] = {'nl': nl, 'en': en, 'sec': round(len(v) / SR, 2), 'kB': round(os.path.getsize(m) / 1024, 1)}
print(json.dumps(verslag))
