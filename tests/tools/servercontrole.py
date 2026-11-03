# servercontrole.py (3 nov 2026): draait de eigen STUN/TURN-server van Fibro (coturn bij TransIP, server/LEESMIJ.txt)?
# Die regelt bellen, sync en foto's als twee toestellen niet rechtstreeks met elkaar kunnen praten. Valt hij uit, dan
# merkt niemand dat totdat bellen ergens niet lukt. Drie proeven, elk tot 3 keer:
#   1. STUN over UDP (de "spiegel"): antwoord met het buitenadres van deze computer
#   2. STUN over TCP
#   3. TURN over TCP: een aanvraag zonder pasje moet netjes 401 (pasje nodig) terugkrijgen; dan draait de postbode
# Exit 0 als alles goed is, anders 1 (GitHub Actions kleurt dan rood en stuurt een mail).
# python3 -I servercontrole.py [adres] [poort]
import os, socket, struct, sys, time

ADRES = sys.argv[1] if len(sys.argv) > 1 else '136.144.154.200'
POORT = int(sys.argv[2]) if len(sys.argv) > 2 else 3478
MAGIC = 0x2112A442

def aanvraag(soort, attrs=b''):
    tid = os.urandom(12)
    return tid, struct.pack('!HHI12s', soort, len(attrs), MAGIC, tid) + attrs

def ontleed(data, tid):
    if len(data) < 20: return None
    soort, lengte, magic, t = struct.unpack('!HHI12s', data[:20])
    if magic != MAGIC or t != tid: return None
    attrs, i = {}, 20
    while i + 4 <= 20 + lengte and i + 4 <= len(data):
        a, l = struct.unpack('!HH', data[i:i + 4])
        attrs[a] = data[i + 4:i + 4 + l]
        i += 4 + l + ((4 - l % 4) % 4)
    return soort, attrs

def buitenadres(attrs):
    w = attrs.get(0x0020)
    if not w or len(w) < 8 or w[1] != 1: return None
    poort = struct.unpack('!H', w[2:4])[0] ^ (MAGIC >> 16)
    ip = struct.unpack('!I', w[4:8])[0] ^ MAGIC
    return socket.inet_ntoa(struct.pack('!I', ip)) + ':' + str(poort)

def tcp_vraag(bericht, tid):
    with socket.create_connection((ADRES, POORT), timeout=5) as s:
        s.sendall(bericht)
        data = b''
        while len(data) < 20: 
            d = s.recv(2048)
            if not d: break
            data += d
        nodig = 20 + struct.unpack('!H', data[2:4])[0] if len(data) >= 4 else 0
        while len(data) < nodig:
            d = s.recv(2048)
            if not d: break
            data += d
    return ontleed(data, tid)

def stun_udp():
    tid, b = aanvraag(0x0001)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.settimeout(3)
        s.sendto(b, (ADRES, POORT))
        r = ontleed(s.recv(2048), tid)
    return r and r[0] == 0x0101 and buitenadres(r[1])

def stun_tcp():
    tid, b = aanvraag(0x0001)
    r = tcp_vraag(b, tid)
    return r and r[0] == 0x0101 and buitenadres(r[1])

def turn_tcp():
    tid, b = aanvraag(0x0003, struct.pack('!HHI', 0x0019, 4, 17 << 24))  # Allocate, REQUESTED-TRANSPORT = UDP
    r = tcp_vraag(b, tid)
    if not r or r[0] != 0x0113: return False
    fout = r[1].get(0x0009)
    code = (fout[2] & 7) * 100 + fout[3] if fout and len(fout) >= 4 else None
    return code == 401 and 'pasje nodig (401), dus de postbode draait'

goed = True
for naam, proef in (('STUN over UDP', stun_udp), ('STUN over TCP', stun_tcp), ('TURN over TCP', turn_tcp)):
    uitslag, laatste = None, ''
    for poging in range(3):
        try:
            uitslag = proef()
            if uitslag: break
            laatste = 'geen goed antwoord'
        except Exception as e:
            laatste = type(e).__name__ + ': ' + str(e)
        time.sleep(5)
    print(('OK    ' if uitslag else 'FOUT  ') + naam + ' (' + ADRES + ':' + str(POORT) + ')  ' + (str(uitslag) if uitslag else laatste), flush=True)
    goed = goed and bool(uitslag)
print('De server van Fibro is bereikbaar.' if goed else 'De server van Fibro reageert niet goed: bellen via de tussenserver werkt dan niet. Zie server/LEESMIJ.txt.')
sys.exit(0 if goed else 1)
