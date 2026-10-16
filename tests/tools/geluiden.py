# geluiden.py - maakt de mp3's van de stickergeluiden (v160) uit de code in stickerfx.js.
# Chromium speelt elk geluid af in een OfflineAudioContext (zelfde ketting als in de app: versterker 0,8 en
# compressor, 44,1 kHz mono), met een vaste toevalsreeks (zelfde popcorn en vuur bij elke run). Stilte aan het eind
# eraf (onder -66 dB) met 10 ms uitfaden; begin op 0 (geen stilte vooraan). Luidheid: in de app waren ze erg zacht
# en ongelijk (gemiddeld -20 tot -45 dB, Slurp kwam niet boven -28 dB). Elk geluid gaat naar dezelfde gemiddelde
# luidheid (RMS -21 dB), maar nooit boven -1 dB piek (dan minder hard, zonder vervorming). Daarna ffmpeg
# (libmp3lame, 128 kbps, mono, zonder ID3-tag) naar <uitmap>/<naam>.mp3. (128: kleiner script; bij deze korte
# mono-geluidjes geen hoorbaar verschil met 192.)
# Verander je een geluid in stickerfx.js: dit opnieuw draaien en MP3_VERSIE ophogen.
# python3 -I geluiden.py <map met stickerfx.js> <uitmap>
import sys, os, json, struct, subprocess, tempfile, socket, time, shutil, math
from playwright.sync_api import sync_playwright

MAP = os.path.abspath(sys.argv[1]); UIT = os.path.abspath(sys.argv[2])
os.makedirs(UIT, exist_ok=True)
SR = 44100
bron = open(os.path.join(MAP, 'stickerfx.js'), encoding='utf-8').read()
BEGIN = '\n/* ---------- geluiden (Web Audio) ---------- */\n'
EIND = '\n/* ---------- afspelen ---------- */\n'
assert bron.count(BEGIN) == 1 and bron.count(EIND) == 1, 'merktekens in stickerfx.js niet gevonden'
deel = bron[bron.index(BEGIN):bron.index(EIND)].replace('export const GELUIDEN', 'const GELUIDEN')

JS = """async ([namen, sr]) => {
  let zaad = 20261016
  const rng = () => { zaad = (zaad * 1664525 + 1013904223) >>> 0; return zaad / 4294967296 }
  const Math = Object.assign(Object.create(globalThis.Math), { random: rng })
""" + deel + """
  const uit = {}
  for (const naam of namen) {
    zaad = 20261016
    ctx = new OfflineAudioContext(1, sr * 3, sr)
    master = ctx.createGain(); master.gain.value = 0.8
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp); comp.connect(ctx.destination)
    ruis = ctx.createBuffer(1, sr * 2, sr)
    const d = ruis.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1
    GELUIDEN[naam].f(master, 0)
    const buf = await ctx.startRendering()
    uit[naam] = Array.from(buf.getChannelData(0))
  }
  return uit
}"""

def wav(pad, samples):
    data = b''.join(struct.pack('<h', max(-32767, min(32767, int(round(x * 32767))))) for x in samples)
    with open(pad, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVE')
        f.write(b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16))
        f.write(b'data' + struct.pack('<I', len(data)) + data)

www = tempfile.mkdtemp(); os.symlink(MAP, www + '/Fibro')
s0 = socket.socket(); s0.bind(('127.0.0.1', 0)); poort = s0.getsockname()[1]; s0.close()
srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(poort), '--bind', '127.0.0.1', '--directory', www], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--no-proxy-server'])
        p = br.new_page(); p.goto('http://127.0.0.1:%d/Fibro/manifest.json' % poort)
        namen = p.evaluate("async () => Object.keys((await import('./stickerfx.js?v=' + Date.now())).GELUIDEN).filter(n => n !== 'geen')")
        ruw = p.evaluate(JS, [namen, SR])
        br.close()
finally:
    srv.terminate(); shutil.rmtree(www, ignore_errors=True)

DOEL_RMS_DB = -21.0
MAX_PIEK = 10 ** (-1 / 20)
verslag = {}
tmp = tempfile.mkdtemp()
for naam in namen:
    v = ruw[naam]
    drempel = 10 ** (-66 / 20) * max(abs(x) for x in v)  # stilte ten opzichte van het geluid zelf
    eind = max([i for i, x in enumerate(v) if abs(x) > drempel] or [0])
    eind = min(len(v), eind + int(0.02 * SR))
    v = v[:eind]
    rms = math.sqrt(sum(x * x for x in v) / max(1, len(v))) or 1e-9
    piek = max(abs(x) for x in v) or 1e-9
    winst = min(10 ** ((DOEL_RMS_DB - 20 * math.log10(rms)) / 20), MAX_PIEK / piek)
    v = [x * winst for x in v]
    fade = int(0.01 * SR)
    for k in range(min(fade, len(v))):
        v[len(v) - 1 - k] *= k / fade
    w = os.path.join(tmp, naam + '.wav'); m = os.path.join(UIT, naam + '.mp3')
    wav(w, v)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0',
                    '-codec:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', '-ar', str(SR), m], check=True)
    verslag[naam] = {'sec': round(len(v) / SR, 3), 'winst_dB': round(20 * math.log10(winst), 1), 'piek': round(max(abs(x) for x in v), 3), 'kB': round(os.path.getsize(m) / 1024, 1)}
shutil.rmtree(tmp, ignore_errors=True)
print(json.dumps({'totaal_kB': round(sum(x['kB'] for x in verslag.values()), 1), 'geluiden': verslag}))
