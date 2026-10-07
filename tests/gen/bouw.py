# bouw.py - maakt een maak-<naam>.py voor Fibro (zie overdracht: Generator)
import os, re, sys, json, zlib, base64, hashlib, binascii, difflib

SAMENVOEG = 3  # wijzigingen die hoogstens zoveel regels uit elkaar liggen: een stuk


def lees(p):
    with open(p, 'rb') as f:
        return f.read()


def md5(b):
    return hashlib.md5(b).hexdigest()


def regels(b):
    return b.count(b'\n')


def tel(hooi, naald):
    # ook overlappend tellen
    n, i = 0, hooi.find(naald)
    while i != -1:
        n += 1
        i = hooi.find(naald, i + 1)
    return n


def splits(s):
    return re.findall(r'[^\n]*\n|[^\n]+$', s)


def stukken(oud, nieuw):
    """Lijst van [anker_oud, vervanging] in volgorde, met genoeg context om uniek te zijn."""
    a, b = splits(oud), splits(nieuw)
    ops = [o for o in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes() if o[0] != 'equal']
    groepen = []
    for o in ops:
        if groepen and o[1] - groepen[-1][2] <= SAMENVOEG:
            g = groepen[-1]
            groepen[-1] = (g[0], g[1], o[2], g[3], o[4])
        else:
            groepen.append((o[0], o[1], o[2], o[3], o[4]))
    uit = []
    huidig = oud
    for k, (_, i1, i2, j1, j2) in enumerate(groepen):
        # grenzen: niet in het vorige of volgende stuk lopen
        ondergrens = groepen[k - 1][2] if k > 0 else 0
        bovengrens = groepen[k + 1][1] if k + 1 < len(groepen) else len(a)
        # tussen i2 van dit stuk en i1 van het volgende zit de 'equal'-strook; tussen de
        # vorige i2 en deze i1 ook. Context alleen daaruit.
        voor, na = 0, 0
        if i1 == i2:
            voor = 1 if i1 > ondergrens else 0
            na = 0 if voor else 1
        while True:
            s, e = i1 - voor, i2 + na
            anker = ''.join(a[s:e])
            if anker and tel(huidig, anker) == 1:
                break
            kan_voor = s > ondergrens
            kan_na = e < bovengrens
            if not kan_voor and not kan_na:
                raise SystemExit('Geen uniek ankerpunt te vinden voor stuk %d' % (k + 1))
            if kan_voor and (voor <= na or not kan_na):
                voor += 1
            else:
                na += 1
        vervang = ''.join(a[s:i1]) + ''.join(b[j1:j2]) + ''.join(a[i2:e])
        uit.append([anker, vervang])
        assert tel(huidig, anker) == 1
        huidig = huidig.replace(anker, vervang, 1)
    if huidig != nieuw:
        raise SystemExit('Stukken geven niet de nieuwe tekst')
    return uit


def lijst(naam, d):
    r = [naam + ' = {']
    for k in sorted(d):
        r.append('    %r: %r,' % (k, d[k]))
    r.append('}')
    return '\n'.join(r)


SJABLOON = r'''#!/usr/bin/env python3
# maak-@@NAAM@@.py - Fibro: @@BESCHRIJVING@@
# Gemaakt door Claude. Controleert eerst alles en schrijft pas als alles klopt.
# Uitvoeren in ~/Fibro:  python3 ~/maak-@@NAAM@@.py
import os, re, sys, json, zlib, base64, hashlib, binascii

NAAM = '@@NAAM@@'

@@OUD_MD5@@

@@NIEUW_MD5@@

@@REGELS@@

@@VEREIST@@

OUDE_V = [
@@OUDE_V@@
]

INHOUD_REGELS = @@INHOUD_REGELS@@
INHOUD = """
@@INHOUD@@
"""


def stop(tekst):
    print('FOUT: ' + tekst)
    print('Er is niets aangepast.')
    sys.exit(1)


def md5(b):
    return hashlib.md5(b).hexdigest()


def tel(hooi, naald):
    n, i = 0, hooi.find(naald)
    while i != -1:
        n += 1
        i = hooi.find(naald, i + 1)
    return n


def lees(p):
    with open(p, 'rb') as f:
        return f.read()


def main():
    assert NAAM and INHOUD_REGELS and OUDE_V is not None  # alle gegevens aanwezig
    # 1. De goede map
    if os.path.basename(os.getcwd()) != 'Fibro' or not os.path.isdir('.git'):
        stop('dit script moet in ~/Fibro draaien (met .git). Begin met: cd ~/Fibro')

    # 2. Is het script compleet?
    if not NIEUW_MD5 or set(NIEUW_MD5) != set(REGELS) or not set(OUD_MD5) <= set(NIEUW_MD5):
        stop('script onvolledig (gegevens ontbreken). Plaats het script opnieuw.')
    rijen = [r for r in INHOUD.split('\n') if r.strip()]
    if len(rijen) != INHOUD_REGELS:
        stop('inhoud onvolledig: %d van %d regels. Plaats het script opnieuw.' % (len(rijen), INHOUD_REGELS))
    stukjes = []
    for i, r in enumerate(rijen, 1):
        delen = r.strip().split(' ')
        if len(delen) != 2 or not re.fullmatch(r'[0-9a-f]{4}', delen[1]):
            stop('inhoudsregel %d is beschadigd. Plaats het script opnieuw.' % i)
        if '%04x' % (binascii.crc32(delen[0].encode('ascii')) & 0xffff) != delen[1]:
            stop('inhoudsregel %d is beschadigd (controlegetal). Plaats het script opnieuw.' % i)
        stukjes.append(delen[0])
    try:
        data = json.loads(zlib.decompress(base64.b64decode(''.join(stukjes))).decode('utf-8'))
    except Exception:
        stop('inhoud is niet te lezen. Plaats het script opnieuw.')
    gew, nw = data.get('gewijzigd', {}), data.get('nieuw', {})
    if set(gew) != set(OUD_MD5) or set(gew) | set(nw) != set(NIEUW_MD5) or set(gew) & set(nw):
        stop('script onvolledig (bestandenlijst klopt niet). Plaats het script opnieuw.')

    # 3. Bestanden die precies zo moeten zijn
    for p, m in sorted(VEREIST.items()):
        if not os.path.isfile(p):
            stop('%s ontbreekt (nodig voor deze aanpassing)' % p)
        if md5(lees(p)) != m:
            stop('%s is anders dan verwacht (nodig voor deze aanpassing)' % p)

    # 4. Al gedaan? Deels gedaan? Oude stand?
    stand = {}
    for p in sorted(NIEUW_MD5):
        if not os.path.exists(p):
            stand[p] = 'oud' if p in nw else 'mist'
        else:
            m = md5(lees(p))
            stand[p] = 'nieuw' if m == NIEUW_MD5[p] else ('oud' if p in gew and m == OUD_MD5[p] else 'anders')
    if all(s == 'nieuw' for s in stand.values()):
        print('AL GEDAAN: deze aanpassing (%s) staat er al. Er is niets veranderd.' % NAAM)
        sys.exit(1)
    for p, s in sorted(stand.items()):
        if s == 'mist':
            stop('%s ontbreekt' % p)
        if s == 'anders':
            stop('%s is anders dan verwacht (md5 %s)' % (p, md5(lees(p))) if p in gew else '%s bestaat al (en mag nog niet bestaan)' % p)
    if any(s == 'nieuw' for s in stand.values()):
        stop('deels gedaan: ' + ', '.join(p for p, s in sorted(stand.items()) if s == 'nieuw') + ' al aangepast, de rest niet')

    # 5. Aanpassen, eerst alleen in het geheugen
    uit = {}
    for p in sorted(gew):
        tekst = lees(p).decode('utf-8')
        for k, (anker, vervang) in enumerate(gew[p], 1):
            n = tel(tekst, anker)
            if n != 1:
                stop('ankerpunt %d in %s komt %d keer voor (verwacht: 1)' % (k, p, n))
            tekst = tekst.replace(anker, vervang, 1)
        uit[p] = tekst.encode('utf-8')
    for p in sorted(nw):
        uit[p] = nw[p].encode('utf-8')
    for p in sorted(uit):
        if md5(uit[p]) != NIEUW_MD5[p]:
            stop('uitkomst van %s klopt niet' % p)
        if uit[p].count(b'\n') != REGELS[p]:
            stop('aantal regels van %s klopt niet' % p)

    # 6. Laadt nog iets een oude versie?
    for wortel, mappen, bestanden in os.walk('.'):
        mappen[:] = [d for d in mappen if d not in ('.git', 'node_modules', 'tests')]
        for b in bestanden:
            if not (b.endswith('.js') or b.endswith('.html')):
                continue
            p = os.path.normpath(os.path.join(wortel, b))
            t = (uit[p] if p in uit else lees(p)).decode('utf-8', 'replace')
            for o in OUDE_V:
                if '?v=' in o:
                    patroon = r'(?<![\w.-])' + re.escape(o) + r'(?!\d)'
                else:
                    patroon = r'(?<![\w.-])' + re.escape(o) + r'(?!\?v=)'
                if re.search(patroon, t):
                    stop('%s laadt nog %s (oude verwijzing)' % (p, o))

    # 7. Schrijven: eerst alles naast het origineel, dan in een keer vervangen
    for p in sorted(nw):  # nieuwe bestanden in een nieuwe map (bijv. tests/gen/)
        d = os.path.dirname(p)
        while d:
            if os.path.exists(d) and not os.path.isdir(d):
                stop('%s bestaat al, maar is geen map' % d)
            d = os.path.dirname(d)
    if set(uit) != set(NIEUW_MD5):
        stop('script onvolledig (niet alle bestanden klaar)')
    for p in sorted(uit):
        if os.path.dirname(p):
            os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p + '.nieuw-tmp', 'wb') as f:
            f.write(uit[p])
    for p in sorted(uit):
        os.replace(p + '.nieuw-tmp', p)

    print('GOED: %s' % NAAM)
    for p in sorted(uit):
        print('  %-28s %s  %d regels%s' % (p, md5(lees(p)), REGELS[p], '  (nieuw)' if p in nw else ''))


main()
'''


def bouw(naam, oudmap, nieuwmap, gewijzigd, nieuwe, oude_v, beschrijving, vereist, uitpad):
    oud_md5, nieuw_md5, rg, data = {}, {}, {}, {'gewijzigd': {}, 'nieuw': {}}
    for p in gewijzigd:
        o, n = lees(os.path.join(oudmap, p)), lees(os.path.join(nieuwmap, p))
        oud_md5[p], nieuw_md5[p], rg[p] = md5(o), md5(n), regels(n)
        data['gewijzigd'][p] = stukken(o.decode('utf-8'), n.decode('utf-8'))
    for p in nieuwe:
        if os.path.exists(os.path.join(oudmap, p)):
            raise SystemExit('nieuw bestand bestaat al in oudmap: ' + p)
        n = lees(os.path.join(nieuwmap, p))
        nieuw_md5[p], rg[p] = md5(n), regels(n)
        data['nieuw'][p] = n.decode('utf-8')
    ver = {p: md5(lees(os.path.join(oudmap, p))) for p in vereist}
    blob = base64.b64encode(zlib.compress(json.dumps(data, ensure_ascii=True, sort_keys=True).encode('ascii'), 9)).decode('ascii')
    rijen = [blob[i:i + 60] for i in range(0, len(blob), 60)]
    inhoud = '\n'.join('%s %04x' % (r, binascii.crc32(r.encode('ascii')) & 0xffff) for r in rijen)
    s = SJABLOON
    for k, v in [('@@NAAM@@', naam), ('@@BESCHRIJVING@@', beschrijving),
                 ('@@OUD_MD5@@', lijst('OUD_MD5', oud_md5)), ('@@NIEUW_MD5@@', lijst('NIEUW_MD5', nieuw_md5)),
                 ('@@REGELS@@', lijst('REGELS', rg)), ('@@VEREIST@@', lijst('VEREIST', ver)),
                 ('@@OUDE_V@@', '\n'.join('    %r,' % o for o in oude_v)),
                 ('@@INHOUD_REGELS@@', str(len(rijen))), ('@@INHOUD@@', inhoud)]:
        s = s.replace(k, v)
    s.encode('ascii')  # puur ASCII
    with open(uitpad, 'w', encoding='ascii', newline='\n') as f:
        f.write(s)
    return {'nieuw_md5': nieuw_md5, 'regels': rg, 'inhoudsregels': len(rijen)}
