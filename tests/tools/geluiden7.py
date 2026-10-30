# geluiden7.py - het geluid 'censuur' voor stickervel 6 (30 okt 2026): de piep die op tv over een scheldwoord gaat,
# voor de sticker 'Vloeken' (het boze gezicht met $#&% voor zijn mond). Een eigen toon van 1000 Hz, met code gemaakt.
# Afwerking zoals geluiden6.py: stilte eraf, 12 ms uitfaden, RMS -21 dB, piek hoogstens -1 dB, ffmpeg libmp3lame mono,
# 64 kbps, zonder ID3-tag. In stickerfx.js: mp3: true en een terug-geluid.
# python3 -I geluiden7.py <uitmap>      (bijv. <map>/geluiden)
import sys, os, math, subprocess
import numpy as np

SR = 44100
UIT = sys.argv[1]; os.makedirs(UIT, exist_ok=True)
KBPS = 64

def t_(sec): return np.arange(int(sec * SR)) / SR
def omhul(n, aan, uit):
    e = np.ones(n); a = max(1, int(aan * SR)); u = max(1, int(uit * SR))
    e[:a] = np.linspace(0, 1, a); e[-u:] = np.minimum(e[-u:], np.linspace(1, 0, u)); return e
def piep(sec, f=1000.0):
    t = t_(sec)
    # een zuivere toon met een klein beetje boventoon, zoals een oude tv-piep; zachte randen (geen klik)
    return (np.sin(2 * np.pi * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)) * omhul(len(t), 0.006, 0.012)

def censuur():
    # piiiiep - piep: twee woorden weggepiept
    uit = np.zeros(int(0.62 * SR))
    for begin, lang in ((0.0, 0.34), (0.42, 0.18)):
        p = piep(lang); i = int(begin * SR); uit[i:i + len(p)] += p
    return uit

def schrijf_wav(pad, v):
    import struct
    d = np.clip(np.round(v * 32767), -32767, 32767).astype('<i2').tobytes()
    with open(pad, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(d)) + b'WAVE' + b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(d)) + d)

for naam, f in (('censuur', censuur),):
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
