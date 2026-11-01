// camerafilters.js v2 (1 nov 2026): Oude film zwart-wit, Oude tv kapot met duidelijke lijnen, 3D-bril duidelijker,
// en FAKE NIEUWS: één balk met 50 grappige berichten over jou en wie je belt. Zelf tekst instellen kan niet meer.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { FILTERS, FAKE_NIEUWS, maakNieuwsBalk } = await import('../../camerafilters.js')
const cf = readFileSync(new URL('../../camerafilters.js', import.meta.url), 'utf8')
const bellen = readFileSync(new URL('../../bellen.js', import.meta.url), 'utf8')

// 1. FAKE NIEUWS: 50 verschillende berichten, elk met een naam
assert.equal(FAKE_NIEUWS.length, 50)
assert.equal(new Set(FAKE_NIEUWS).size, 50, 'geen dubbele berichten')
for (const b of FAKE_NIEUWS) { assert.match(b, /\{a\}/, 'met een naam: ' + b); assert.ok(b.length <= 80, 'niet te lang: ' + b) }
assert.ok(FAKE_NIEUWS.some(b => /bank/.test(b) && /overval/.test(b)), 'de bankoverval')
assert.ok(FAKE_NIEUWS.some(b => /grootste taart/.test(b)), 'de grootste taart')
assert.equal(FILTERS.find(f => f.id === 'nieuws').naam, 'Fake nieuws')

// 2. de balk: alle berichten, met de namen van jou en wie je belt, geen {a}/{b} meer over
let n = 0; const vast = () => ((n = (n * 9301 + 49297) % 233280) / 233280)
const balk = maakNieuwsBalk(['Marcel', 'Lazy Noodle'], vast)
assert.ok(!/\{[ab]\}/.test(balk))
assert.equal(balk.split('   ●   ').filter(Boolean).length, 50)
assert.ok(balk.includes('Marcel') && balk.includes('Lazy Noodle'), 'beide namen')
const alleen = maakNieuwsBalk(['Marcel'])
assert.ok(alleen.includes('de buurman') && !alleen.includes('undefined'), 'zonder gesprekspartner: de buurman')
assert.ok(maakNieuwsBalk([]).includes('Iemand'), 'zonder namen: Iemand')
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
assert.match(cf, /const logo = 'FAKE NIEUWS'/)

// 4. niets meer zelf in te stellen
assert.ok(!/zetNieuwsTekst|nieuwsTekst|fibro-nieuwsfilter|cf-nieuws/.test(cf), 'geen tekstvelden meer')
assert.ok(!/zetNieuwsfilterTekst|nieuwsTekst\(\)/.test(bellen))

// 5. bellen.js geeft de namen door (jij en wie je belt) en laadt de nieuwe versie
assert.match(bellen, /camerafilters\.js\?v=2/)
assert.match(bellen, /supabase\.from\('profiles'\)\.select\('id, username'\)\.in\('id', ontbreekt\)/)
assert.equal((bellen.match(/\n\s+werkNieuwsNamen\(\)\n/g) || []).length, 4, 'bij initBellen, belOp, een oproep en zetVriendId')
for (const f of ['chat.html', 'bellen.html', 'bel-luisteraar.js']) assert.match(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'), /bellen\.js\?v=158/, f)

console.log('ok: camerafilters v2 met FAKE NIEUWS (50 berichten)')
