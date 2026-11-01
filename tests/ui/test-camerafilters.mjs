// camerafilters.js v2 (1 nov 2026): Oude film zwart-wit, Oude tv kapot met duidelijke lijnen, 3D-bril duidelijker,
// Beveiliging zoals in tekenfilms, en FAKE NEWS: één balk met 50 grappige Engelse berichten over jou en wie je belt. Zelf tekst instellen kan niet meer.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { FILTERS, FAKE_NIEUWS, maakNieuwsBalk } = await import('../../camerafilters.js')
const cf = readFileSync(new URL('../../camerafilters.js', import.meta.url), 'utf8')
const bellen = readFileSync(new URL('../../bellen.js', import.meta.url), 'utf8')

// 1. FAKE NIEUWS: 50 verschillende berichten, elk met een naam
assert.equal(FAKE_NIEUWS.length, 50)
assert.equal(new Set(FAKE_NIEUWS).size, 50, 'geen dubbele berichten')
for (const b of FAKE_NIEUWS) { assert.match(b, /\{a\}/, 'met een naam: ' + b); assert.ok(b.length <= 80, 'niet te lang: ' + b) }
assert.ok(FAKE_NIEUWS.some(b => /robs a bank/.test(b)), 'de bankoverval')
assert.ok(FAKE_NIEUWS.some(b => /biggest cake/.test(b)), 'de grootste taart')
for (const b of FAKE_NIEUWS) assert.ok(!/\b(het|een|en|met|van|niet)\b/.test(b.replace(/\{[ab]\}/g, '')), 'Engels: ' + b)
assert.equal(FILTERS.find(f => f.id === 'nieuws').naam, 'Fake nieuws')

// 2. de balk: alle berichten, met de namen van jou en wie je belt, geen {a}/{b} meer over
let n = 0; const vast = () => ((n = (n * 9301 + 49297) % 233280) / 233280)
const balk = maakNieuwsBalk(['Marcel', 'Lazy Noodle'], vast)
assert.ok(!/\{[ab]\}/.test(balk))
assert.equal(balk.split('   ●   ').filter(Boolean).length, 50)
assert.ok(balk.includes('Marcel') && balk.includes('Lazy Noodle'), 'beide namen')
const alleen = maakNieuwsBalk(['Marcel'])
assert.ok(alleen.includes('the neighbour') && !alleen.includes('undefined'), 'zonder gesprekspartner: the neighbour')
assert.ok(maakNieuwsBalk([]).includes('Someone'), 'zonder namen: Someone')
assert.ok(!maakNieuwsBalk(['x'.repeat(60)]).includes('x'.repeat(25)), 'lange namen worden ingekort')

// 3. de filters
assert.match(cf, /oudefilm\(w, h\) \{\n      const flikker[^\n]*\n      ctx\.filter = 'grayscale\(1\) contrast/, 'Oude film: echt zwart-wit')
assert.ok(!/sepia/.test(cf.slice(cf.indexOf('oudefilm(w, h)'), cf.indexOf('oudetv(w, h)'))), 'Oude film: geen sepia meer')
const tv = cf.slice(cf.indexOf('oudetv(w, h)'), cf.indexOf('anaglyph(w, h)'))
assert.match(tv, /scanlijnen\(0\.5, 3\)/, 'Oude tv: duidelijke lijnen')
assert.match(tv, /Math\.sin\(y \* 0\.045/, 'Oude tv: golvende vervorming')
assert.match(tv, /imageSmoothingEnabled = false/, 'Oude tv: grof beeld')
assert.match(cf, /const d = Math\.max\(4, Math\.round\(w \* 0\.03\)\)/, '3D-bril: duidelijk verschoven')
assert.match(cf, /if \(hulp\.width !== canvas\.width \|\| hulp\.height !== canvas\.height\)/, 'hulpvel altijd even groot (anders ingezoomd)')
assert.match(cf, /const logo = 'FAKE NEWS'/)
const bev = cf.slice(cf.indexOf('beveiliging(w, h)'), cf.indexOf('nieuws(w, h)'))
for (const stuk of ['scanlijnen(0.45, 4)', "'CAM 01'", "'REC'", 'createRadialGradient', 'ctx.stroke()']) assert.ok(bev.includes(stuk), 'Beveiliging: ' + stuk)

// 3b. 16-bit (v3): blokjes van ongeveer 6 pixels (±106 breed), 6 tinten per kleur met rasterstipjes, hartjes en 1UP
assert.ok(FILTERS.some(f => f.id === 'zestienbit' && f.naam === '16-bit'))
const zb = cf.slice(cf.indexOf('zestienbit(w, h)'), cf.indexOf('function stap(nu)'))
assert.match(zb, /const blok = Math\.max\(3, Math\.round\(w \/ 106\)\)/, 'herkenbaar: ongeveer 100 blokjes breed')
assert.match(zb, /BAYER4/, 'rasterstipjes')
assert.match(zb, /imageSmoothingEnabled = false/, 'scherpe blokjes')
assert.match(zb, /'1UP'/)
assert.match(cf, /zestienbit: vertaal\('16-bit'\)/)

// 4. niets meer zelf in te stellen
assert.ok(!/zetNieuwsTekst|nieuwsTekst|fibro-nieuwsfilter|cf-nieuws/.test(cf), 'geen tekstvelden meer')
assert.ok(!/zetNieuwsfilterTekst|nieuwsTekst\(\)/.test(bellen))

// 5. bellen.js geeft de namen door (jij en wie je belt) en laadt de nieuwe versie
assert.match(bellen, /camerafilters\.js\?v=3/)
assert.match(bellen, /supabase\.from\('profiles'\)\.select\('id, username'\)\.in\('id', ontbreekt\)/)
assert.equal((bellen.match(/\n\s+werkNieuwsNamen\(\)\n/g) || []).length, 4, 'bij initBellen, belOp, een oproep en zetVriendId')
for (const f of ['chat.html', 'bellen.html', 'bel-luisteraar.js']) assert.match(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'), /bellen\.js\?v=159/, f)

console.log('ok: camerafilters v2 met FAKE NEWS (50 Engelse berichten) en een tekenfilm-beveiligingscamera')
