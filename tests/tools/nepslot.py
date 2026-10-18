# nepslot.py - berichten versleutelen zoals crypto.js (v181, versleuteling v2) maar dan in Python, voor de proeven.
# Sinds v181 toont de chat een bericht zonder slot als gewone tekst met 'niet versleuteld' (nooit als sticker).
# Proeven die een binnenkomend bericht nabootsen, versleutelen het daarom zoals de echte app:
#   from nepslot import Sleutelpaar, versleutel
#   ik, vriend = Sleutelpaar(), Sleutelpaar()
#   localStorage 'fibro_privkey_<UID>' = ik.priv ; public_key van de vriend in profiles = vriend.pub
#   content = versleutel('fxsticker:f1-03', vriend.priv, ik.pub, van=FID, naar=UID)
# Zelfde formaat als crypto.js: 'e2e:2:<tijd36>:<sleutel-id>:<base64(iv + data + tag)>'.
# tijd_ms: de verzendtijd (standaard nu); de chat waarschuwt als die meer dan 15 min van created_at afwijkt.
# Nodig: python-pakket cryptography (staat in de werkmap van Claude).
import base64, os, time
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ZOUT = b'fibro-e2e-v2'


class Sleutelpaar:
    def __init__(self):
        k = ec.generate_private_key(ec.SECP256R1())
        self.priv = base64.b64encode(k.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8,
                                                     serialization.NoEncryption())).decode()
        self.pub = base64.b64encode(k.public_key().public_bytes(serialization.Encoding.DER,
                                                                serialization.PublicFormat.SubjectPublicKeyInfo)).decode()


def _sleutels(priv_b64, pub_b64):
    priv = serialization.load_der_private_key(base64.b64decode(priv_b64), None)
    pub = serialization.load_der_public_key(base64.b64decode(pub_b64))
    gedeeld = priv.exchange(ec.ECDH(), pub)
    aes = HKDF(hashes.SHA256(), 32, ZOUT, b'fibro-v2 berichtsleutel').derive(gedeeld)
    sid = HKDF(hashes.SHA256(), 6, ZOUT, b'fibro-v2 sleutel-id').derive(gedeeld).hex()
    return aes, sid


def _tijd36(ms):
    s, cijfers = '', '0123456789abcdefghijklmnopqrstuvwxyz'
    while True:
        ms, r = divmod(ms, 36); s = cijfers[r] + s
        if not ms: return s


def versleutel(tekst, priv_van, pub_naar, van, naar, tijd_ms=None, soort='bericht'):
    """Een bericht (naar = ontvanger) of reactie (soort='reactie', naar = id van het bericht)."""
    aes, sid = _sleutels(priv_van, pub_naar)
    t36 = _tijd36(int(time.time() * 1000) if tijd_ms is None else int(tijd_ms))
    iv = os.urandom(12)
    extra = '|'.join(['fibro-v2', soort, str(van), str(naar), t36]).encode()
    data = AESGCM(aes).encrypt(iv, tekst.encode('utf-8'), extra)
    return 'e2e:2:' + t36 + ':' + sid + ':' + base64.b64encode(iv + data).decode()


# ---- Voor proeven die oud en nieuw draaien ----
# Nep(map, uid, fid): twee sleutelparen (ik = uid, vriend = fid) en inhoud(van, tekst, created_at) die een bericht
# versleutelt zoals de app van de afzender dat doet. Op een map van voor v181 (crypto.js zonder ontsleutelBericht) laat
# inhoud() de tekst zoals hij is: zo blijft de oude code als controle precies zo getest als vroeger.
# Belregels, buzz, spel-uitnodigingen, 'verwijderd:' en wat al met e2e: begint blijven altijd zoals ze zijn.
OPEN = ('buzz:', 'verwijderd:', 'spelinvite:', 'oproep:', 'e2e:')


def heeft_v2(map):
    try:
        return 'ontsleutelBericht' in open(os.path.join(map, 'crypto.js'), encoding='utf-8').read()
    except OSError:
        return False


def ms_van(created_at):
    from datetime import datetime
    s = str(created_at).replace('Z', '+00:00').replace(' ', 'T')
    return int(datetime.fromisoformat(s).timestamp() * 1000)


class Nep:
    def __init__(self, map, uid, fid):
        self.v2 = heeft_v2(map)
        self.uid, self.fid = uid, fid
        self.ik, self.vriend = Sleutelpaar(), Sleutelpaar()

    def inhoud(self, van, tekst, created_at=None):
        if not self.v2 or not isinstance(tekst, str) or tekst.startswith(OPEN):
            return tekst
        tijd = ms_van(created_at) if created_at else None
        if van == self.uid:
            return versleutel(tekst, self.ik.priv, self.vriend.pub, self.uid, self.fid, tijd)
        return versleutel(tekst, self.vriend.priv, self.ik.pub, van, self.uid, tijd)
