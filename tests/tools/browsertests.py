# browsertests.py (27 nov 2026, Marcel: "snellere controles") - draait de browsertests uit browsertests.txt, verdeeld
# over een paar groepjes die op GitHub tegelijk draaien (.github/workflows/tests.yml). Zo duurt het ongeveer 8 minuten
# in plaats van 25.
#
# In gewone woorden:
#  - De proeven worden eerlijk verdeeld: de langste eerst, steeds naar het groepje met de minste tijd tot nu toe.
#  - Mislukt een proef, dan draait hij nog één keer. Lukt het dan wel, dan heet hij "wankel": de controle blijft groen,
#    maar hij staat met een waarschuwing in de samenvatting (zo zien we welke proeven gerepareerd moeten worden).
#    Mislukt hij twee keer, dan is het echt mis en wordt de controle rood.
#  - Op GitHub staat bij elke proef een uitklapbaar blok met zijn uitvoer, en onderaan een samenvatting.
#
#   python3 -I tests/tools/browsertests.py --groep 1 --van 4     groepje 1 van 4
#   python3 -I tests/tools/browsertests.py --lijst --van 4        alleen laten zien hoe het verdeeld wordt
#   python3 -I tests/tools/browsertests.py --alleen proef352      één proef
import os, sys, subprocess, time

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HIER, '..', '..'))
TIMEOUT = 600   # seconden per proef


def lees_lijst():
    proeven = []
    with open(os.path.join(HIER, 'browsertests.txt'), encoding='utf8') as f:
        for regel in f:
            regel = regel.strip()
            if not regel or regel.startswith('#'):
                continue
            delen = [d.strip() for d in regel.split('|', 2)]
            if len(delen) != 3 or not delen[0].startswith('proef') or not delen[1].isdigit():
                sys.exit('browsertests.txt: deze regel klopt niet: ' + regel)
            proeven.append({'proef': delen[0], 'duur': int(delen[1]), 'naam': delen[2]})
    return proeven


def verdeel(proeven, van):
    groepen = [{'tijd': 0, 'proeven': []} for _ in range(van)]
    for p in sorted(proeven, key=lambda x: -x['duur']):
        g = min(groepen, key=lambda x: x['tijd'])
        g['tijd'] += p['duur']
        g['proeven'].append(p)
    # binnen een groepje in de volgorde van de lijst (dan lijkt de uitvoer op die van vroeger)
    volgorde = {p['proef']: i for i, p in enumerate(proeven)}
    for g in groepen:
        g['proeven'].sort(key=lambda p: volgorde[p['proef']])
    return groepen


def draai(p):
    pad = os.path.join('tests', 'tools', p['proef'] + '.py')
    begin = time.time()
    try:
        r = subprocess.run([sys.executable, '-I', pad, '.'], cwd=REPO, capture_output=True, text=True, timeout=TIMEOUT)
        uit, ok = (r.stdout or '') + (r.stderr or ''), r.returncode == 0
    except subprocess.TimeoutExpired as e:
        uit, ok = ((e.stdout or b'').decode(errors='replace') if isinstance(e.stdout, bytes) else (e.stdout or '')) + '\nTE LANG: na %d seconden gestopt' % TIMEOUT, False
    return ok, uit, time.time() - begin


def main():
    a = sys.argv[1:]
    waarde = lambda naam, std=None: a[a.index(naam) + 1] if naam in a else std
    proeven = lees_lijst()
    van = int(waarde('--van', '1'))
    if '--lijst' in a:
        for i, g in enumerate(verdeel(proeven, van), 1):
            print('groepje %d: ongeveer %d s, %d proeven: %s' % (i, g['tijd'], len(g['proeven']), ' '.join(p['proef'] for p in g['proeven'])))
        return 0
    if waarde('--alleen'):
        mijn = [p for p in proeven if p['proef'] == waarde('--alleen')]
    else:
        groep = int(waarde('--groep', '1'))
        mijn = verdeel(proeven, van)[groep - 1]['proeven']
    op_github = os.environ.get('GITHUB_ACTIONS') == 'true'
    goed, wankel, mis = [], [], []
    for p in mijn:
        titel = '%s: %s' % (p['proef'], p['naam'])
        print(('::group::' if op_github else '== ') + titel, flush=True)
        ok, uit, duur = draai(p)
        print(uit.rstrip())
        if not ok:
            print('\n-- mislukt na %d s; nog een keer --\n' % duur, flush=True)
            ok, uit2, duur = draai(p)
            print(uit2.rstrip())
            (wankel if ok else mis).append(titel)
        else:
            goed.append(titel)
        print('%s (%d s)' % ('GOED' if ok else 'MIS', duur))
        if op_github:
            print('::endgroup::', flush=True)
            if titel in wankel: print('::warning title=Wankele browsertest::' + titel + ' lukte pas de tweede keer')
            if titel in mis: print('::error title=Browsertest mislukt::' + titel)
    print('\n%d goed, %d wankel (pas de tweede keer goed), %d mis' % (len(goed), len(wankel), len(mis)))
    for t in wankel: print('  WANKEL ' + t)
    for t in mis: print('  MIS    ' + t)
    samenvatting = os.environ.get('GITHUB_STEP_SUMMARY')
    if samenvatting:
        with open(samenvatting, 'a', encoding='utf8') as f:
            f.write('### Browsertests: %d goed, %d wankel, %d mis\n\n' % (len(goed), len(wankel), len(mis)))
            for t in mis: f.write('- ❌ ' + t + '\n')
            for t in wankel: f.write('- ⚠️ ' + t + ' (pas de tweede keer goed)\n')
    return 1 if mis else 0


if __name__ == '__main__':
    sys.exit(main())
