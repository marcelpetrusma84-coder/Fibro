# geluiden8.py - twaalf geluiden voor stickervel 7, Sinterklaas (13 nov 2026, voor de Stekky Store). Alles met code
# gemaakt (geen opnames), afwerking zoals geluiden7.py: stilte eraf, 12 ms uitfaden, RMS -21 dB, piek hoogstens -1 dB,
# ffmpeg libmp3lame mono 64 kbps zonder ID3-tag. In stickerfx.js: mp3: true en een terug-geluid.
# python3 -I geluiden8.py <uitmap>      (bijv. <map>/geluiden)
import sys, os, math, subprocess
import numpy as np

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
KBPS = 64
rng = np.random.default_rng(5122026)   # vast zaadje: elke keer dezelfde mp3

def t_(sec): return np.arange(int(sec * SR)) / SR
def leeg(sec): return np.zeros(int(sec * SR))
def zet(uit, v, begin, sterk=1.0):
    i = int(begin * SR); n = min(len(v), len(uit) - i)
    if n > 0: uit[i:i + n] += v[:n] * sterk
def omhul(n, aan, uit):
    e = np.ones(n); a = max(1, int(aan * SR)); u = max(1, int(uit * SR))
    e[:a] = np.linspace(0, 1, a); e[-u:] = np.minimum(e[-u:], np.linspace(1, 0, u)); return e
def verval(sec, tau): return np.exp(-t_(sec) / tau)
def ruis(sec): return rng.standard_normal(int(sec * SR))
def laagdoorlaat(v, f):   # eenvoudige eerste-orde filter
    a = math.exp(-2 * math.pi * f / SR); uit = np.empty_like(v); y = 0.0
    for i, x in enumerate(v): y = (1 - a) * x + a * y; uit[i] = y
    return uit
def hoogdoorlaat(v, f): return v - laagdoorlaat(v, f)
def bandje(v, lo, hi): return hoogdoorlaat(laagdoorlaat(v, hi), lo)
def noot(f, sec, tau=0.35, boven=((2, 0.35), (3, 0.12)), aan=0.004):
    t = t_(sec); v = np.sin(2 * np.pi * f * t)
    for k, s in boven: v += s * np.sin(2 * np.pi * f * k * t)
    return v * verval(sec, tau) * omhul(len(t), aan, 0.02)
def klokje(f, sec=0.9, tau=0.4):   # metalen klank (glockenspiel/bel): niet-harmonische boventonen
    t = t_(sec)
    v = sum(s * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (tau / (1 + k / 3))) for k, s in ((1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)))
    return v * omhul(len(t), 0.002, 0.02)
def belletjes(sec, dicht=28):   # sleebelletjes: veel korte hoge klokjes door elkaar
    uit = leeg(sec)
    for _ in range(int(sec * dicht)):
        zet(uit, klokje(rng.uniform(2400, 3600), 0.18, 0.06), rng.uniform(0, sec - 0.18), rng.uniform(0.25, 0.6))
    return uit
def tik(sec=0.05, f=1800, tau=0.008):
    return bandje(ruis(sec), f * 0.5, f * 2) * verval(sec, tau)
HZ = lambda n: 440 * 2 ** ((n - 69) / 12)   # midi-nummer naar Hz

def sintklok():   # Sinterklaas: twee plechtige kerkklokken (laag), met een zacht belletje erachteraan
    uit = leeg(1.9)
    for begin, f in ((0.0, 196.0), (0.55, 146.8)):
        t = t_(1.3)
        v = sum(s * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.9 / k ** 0.4)) for k, s in ((0.5, 0.6), (1, 1), (1.19, 0.5), (1.5, 0.35), (2, 0.4), (2.52, 0.2)))
        zet(uit, v * omhul(len(t), 0.003, 0.05), begin)
    zet(uit, belletjes(0.6, 18), 1.15, 0.5)
    return uit
def pietsprong():   # Piet: een vrolijk sprongetje omhoog (glijdende toon) met belletjes
    uit = leeg(0.9); t = t_(0.32)
    f = 300 + 900 * (t / 0.32) ** 1.5
    zet(uit, np.sin(2 * np.pi * np.cumsum(f) / SR) * omhul(len(t), 0.005, 0.06), 0.0, 0.7)
    zet(uit, belletjes(0.7, 30), 0.12, 0.8)
    return uit
def haardvuur():   # schoentje bij de haard: knisperend vuur en een klein tingeltje
    uit = leeg(1.4)
    zet(uit, laagdoorlaat(ruis(1.4), 500) * 0.25 * omhul(int(1.4 * SR), 0.15, 0.3), 0.0)
    for _ in range(26): zet(uit, tik(0.03, rng.uniform(1500, 4500), rng.uniform(0.002, 0.006)), rng.uniform(0, 1.3), rng.uniform(0.3, 1.0))
    zet(uit, klokje(HZ(88), 0.6, 0.25), 0.85, 0.35); zet(uit, klokje(HZ(93), 0.5, 0.2), 0.98, 0.3)
    return uit
def chocokrak():   # chocoladeletter: krak! (een stuk afbreken) en dan mmm (een tevreden bromtoon)
    uit = leeg(1.15)
    for i, d in enumerate((0.0, 0.018, 0.04, 0.07)):
        zet(uit, bandje(ruis(0.06), 900, 6000) * verval(0.06, 0.012), d, 1.0 - 0.18 * i)
    t = t_(0.6); f = 180 + 25 * np.sin(2 * np.pi * 3 * t)   # mmm: neusklank met een golfje
    v = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR)
    zet(uit, laagdoorlaat(v, 900) * omhul(len(t), 0.08, 0.2), 0.42, 0.55)
    return uit
def stoomfluit():   # pakjesboot: twee keer de scheepstoeter (laag, met boventonen) en een puf stoom
    uit = leeg(1.9)
    for begin, lang in ((0.0, 0.5), (0.7, 0.95)):
        t = t_(lang); f = 116 * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
        fase = 2 * np.pi * np.cumsum(f) / SR
        v = sum(s * np.sin(k * fase) for k, s in ((1, 1), (2, 0.7), (3, 0.5), (4, 0.3), (5, 0.18), (6, 0.1)))
        zet(uit, laagdoorlaat(v, 1400) * omhul(len(t), 0.05, 0.12), begin)
    zet(uit, bandje(ruis(0.35), 1500, 7000) * omhul(int(0.35 * SR), 0.02, 0.25), 1.5, 0.35)
    return uit
def pakpapier():   # cadeautjes: ritselend papier, dan ta-daa op de klokjes
    uit = leeg(1.5)
    for _ in range(14):
        d = rng.uniform(0.04, 0.12); zet(uit, bandje(ruis(d), 2000, 9000) * omhul(int(d * SR), 0.005, 0.03), rng.uniform(0, 0.55), rng.uniform(0.25, 0.6))
    for i, n in enumerate((79, 84, 88, 91)): zet(uit, klokje(HZ(n), 0.7, 0.3), 0.7 + 0.09 * i, 0.55)
    return uit
def zakbonk():   # zak van de Sint: zware zak die neergezet wordt (ritsel + doffe bons) en wat rammelende pakjes
    uit = leeg(1.1)
    zet(uit, bandje(ruis(0.3), 600, 4000) * omhul(int(0.3 * SR), 0.05, 0.1), 0.0, 0.4)
    t = t_(0.4); f = 95 * np.exp(-t / 0.08) + 45
    zet(uit, np.sin(2 * np.pi * np.cumsum(f) / SR) * verval(0.4, 0.12), 0.28, 1.0)
    zet(uit, laagdoorlaat(ruis(0.08), 900) * verval(0.08, 0.02), 0.28, 0.6)
    for _ in range(6): zet(uit, tik(0.04, rng.uniform(1200, 2500), 0.01), rng.uniform(0.38, 0.75), 0.35)
    return uit
def hoefslag():   # Ozosnel: galop over het dak (klip-klop-klop, drie keer) en een hinnik-achtige toon
    uit = leeg(1.6)
    def hoef(f): return (bandje(ruis(0.06), f * 0.6, f * 2.5) + 0.6 * np.sin(2 * np.pi * f * t_(0.06))) * verval(0.06, 0.012)
    for r in range(3):
        for j, (d, f) in enumerate(((0.0, 900), (0.09, 700), (0.16, 800))):
            zet(uit, hoef(f), r * 0.32 + d, 0.9 - 0.1 * j)
    t = t_(0.55); f = 700 + 250 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.4) - 250 * t   # hinnik: snel trillende, dalende toon
    v = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    zet(uit, v * omhul(len(t), 0.03, 0.15), 1.0, 0.45)
    return uit
def pepernoten():   # strooigoed: een regen van pepernoten die op de vloer stuiteren
    uit = leeg(1.3)
    for _ in range(70):
        b = rng.uniform(0, 0.9) ** 1.4
        zet(uit, tik(0.035, rng.uniform(1800, 5000), rng.uniform(0.003, 0.008)), b, rng.uniform(0.2, 0.8))
        if rng.random() < 0.4: zet(uit, tik(0.03, rng.uniform(2000, 5000), 0.004), b + rng.uniform(0.06, 0.15), 0.3)
    return uit
def dakwind():   # Piet op het dak: 'hoor de wind waait door de bomen' (huilende wind) en een belletje
    uit = leeg(1.8); n = int(1.6 * SR); t = t_(1.6)
    v = ruis(1.6); wind = np.zeros(n)
    for f0, s in ((420, 1.0), (640, 0.6)):   # twee 'fluitende' banden die op en neer gaan
        f = f0 * (1 + 0.35 * np.sin(2 * np.pi * 0.7 * t + s))
        wind += np.sin(2 * np.pi * np.cumsum(f) / SR) * s * 0.18
    wind += laagdoorlaat(v, 700) * 0.6
    zet(uit, wind * omhul(n, 0.35, 0.5), 0.0)
    zet(uit, klokje(HZ(86), 0.5, 0.2), 1.1, 0.35)
    return uit
def klopklop():   # Sint & Piet: 'hoor wie klopt daar' - drie keer kloppen op de deur, dan belletjes
    uit = leeg(1.5)
    def klop(): return (laagdoorlaat(ruis(0.08), 1100) * 1.5 + np.sin(2 * np.pi * 180 * t_(0.08))) * verval(0.08, 0.018)
    for d in (0.0, 0.2, 0.4): zet(uit, klop(), d, 1.0)
    zet(uit, belletjes(0.8, 26), 0.62, 0.7)
    return uit
def mijterglans():   # mijter & staf: tik van de staf op de grond en een glinsterend loopje omhoog
    uit = leeg(1.4)
    zet(uit, (laagdoorlaat(ruis(0.06), 1500) + 0.5 * np.sin(2 * np.pi * 260 * t_(0.06))) * verval(0.06, 0.015), 0.0, 1.0)
    for i, n in enumerate((84, 88, 91, 96, 100, 103)): zet(uit, klokje(HZ(n), 0.6, 0.22), 0.12 + 0.07 * i, 0.45)
    return uit

def schrijf_wav(pad, v):
    import struct
    d = np.clip(np.round(v * 32767), -32767, 32767).astype('<i2').tobytes()
    with open(pad, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(d)) + b'WAVE' + b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(d)) + d)

ALLE = (('sintklok', sintklok), ('pietsprong', pietsprong), ('haardvuur', haardvuur), ('chocokrak', chocokrak),
        ('stoomfluit', stoomfluit), ('pakpapier', pakpapier), ('zakbonk', zakbonk), ('hoefslag', hoefslag),
        ('pepernoten', pepernoten), ('dakwind', dakwind), ('klopklop', klopklop), ('mijterglans', mijterglans))
for naam, f in ALLE:
    if len(sys.argv) > 2 and naam not in sys.argv[2:]: continue
    v = np.asarray(f(), dtype=float); v = v - np.mean(v)
    piek = np.max(np.abs(v)) or 1
    nz = np.nonzero(np.abs(v) > piek * 10 ** (-60 / 20))[0]
    v = v[nz[0]:min(len(v), nz[-1] + int(0.03 * SR))]
    fade = min(len(v), int(0.012 * SR)); v[-fade:] *= np.linspace(1, 0, fade)
    rms = math.sqrt(np.mean(v ** 2)) or 1e-9
    v *= min(10 ** ((-21 - 20 * math.log10(rms)) / 20), 10 ** (-1 / 20) / np.max(np.abs(v)))
    w = os.path.join(UIT, naam + '.tmp.wav'); m = os.path.join(UIT, naam + '.mp3')
    schrijf_wav(w, v)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0',
                    '-codec:a', 'libmp3lame', '-b:a', '%dk' % KBPS, '-ac', '1', '-ar', str(SR), m], check=True)
    os.remove(w)
    print(naam, round(len(v) / SR, 2), 's', round(os.path.getsize(m) / 1024, 1), 'kB')
