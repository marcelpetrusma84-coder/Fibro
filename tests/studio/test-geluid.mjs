// Stekky Studio: een eigen geluid opruimen en er een mp3 van maken (studio-geluid.js)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as G from '../../studio-geluid.js'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const SR = G.SAMPLERATE
const sinus = (sec, hz = 440, amp = 0.1) => Float32Array.from({ length: Math.round(SR * sec) }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / SR))
const stilte = sec => new Float32Array(Math.round(SR * sec))
const plak = (...delen) => { const u = new Float32Array(delen.reduce((n, d) => n + d.length, 0)); let p = 0; for (const d of delen) { u.set(d, p); p += d.length } return u }
const dichtbij = (a, b, tol, wat) => assert.ok(Math.abs(a - b) <= tol, wat + ': ' + a + ' is niet binnen ' + tol + ' van ' + b)

// ── stereo wordt mono ──
const l = Float32Array.from([1, 0.5, 0]), r = Float32Array.from([0, 0.5, 1])
assert.deepEqual([...G.naarMono([l, r])], [0.5, 0.5, 0.5])
assert.equal(G.naarMono([l]).length, 3); assert.equal(G.naarMono([]).length, 0)

// ── de stilte eraf ──
const stuk = plak(stilte(0.3), sinus(0.5), stilte(0.2))
const kaal = G.knipStilte(stuk, SR)
dichtbij(kaal.length / SR, 0.5 + 0.01, 0.01, 'na het knippen blijft het geluid met 5 ms ruimte over')
assert.equal(G.knipStilte(stilte(1), SR).length, 0, 'alleen stilte = niets over')
assert.equal(G.knipStilte(sinus(0.2), SR).length, sinus(0.2).length, 'zonder stilte verandert er niets')

// ── fade ──
const f = G.fade(Float32Array.from({ length: 4410 }, () => 1), SR)
assert.equal(f[0], 0); assert.ok(f[f.length - 1] < 0.01); assert.equal(f[2205], 1, 'in het midden niets veranderd')

// ── even hard ──
const { rmsDb, piekDb } = G.meet(G.maakEvenHard(sinus(0.5, 440, 0.05)))
dichtbij(rmsDb, -21, 0.2, 'een zacht geluid wordt harder, tot -21 dB')
assert.ok(piekDb <= -1 + 0.01, 'de piek blijft onder -1 dB (' + piekDb + ')')
const luid = G.meet(G.maakEvenHard(sinus(0.5, 440, 0.95)))
dichtbij(luid.rmsDb, -21, 0.2, 'een hard geluid wordt zachter, tot -21 dB')
// een geluid met een korte, felle piek: eerst de piek begrenzen, dus de RMS blijft lager dan -21
const tik = sinus(0.5, 440, 0.02); tik[1000] = 0.9
const tikMeting = G.meet(G.maakEvenHard(tik))
assert.ok(tikMeting.piekDb <= -0.99 && tikMeting.rmsDb < -21, 'een piek gaat voor: ' + JSON.stringify(tikMeting))
assert.deepEqual([...G.maakEvenHard(stilte(0.1))], [...stilte(0.1)], 'stilte blijft stilte')

// ── alles samen ──
const klaar = G.verwerk(plak(stilte(0.3), sinus(0.5), stilte(0.4)), SR)
assert.ok(!klaar.fout && !klaar.ingekort)
dichtbij(klaar.duur, 0.51, 0.02, 'duur na opruimen'); dichtbij(klaar.rmsDb, -21, 0.5, 'rms'); assert.ok(klaar.piekDb <= -0.99)
assert.equal(klaar.samples[0], 0, 'begint zacht (fade)')
const lang = G.verwerk(sinus(5), SR)
assert.ok(lang.ingekort && lang.duur <= G.MAX_SEC + 0.001 && lang.duur > G.MAX_SEC - 0.01, 'een geluid van 5 seconden wordt 3 seconden')
assert.ok(Math.abs(lang.samples[lang.samples.length - 1]) < 0.001, 'en eindigt zacht')
assert.ok(G.verwerk(stilte(1), SR).fout.includes('stil'), 'stilte is een fout in gewoon Nederlands')
assert.ok(G.verwerk(sinus(0.02), SR).fout, 'te kort is een fout')
assert.ok(G.verwerk(new Float32Array(0), SR).fout.includes('geen geluid'))

// ── mp3 ──
assert.deepEqual([...G.naarInt16(Float32Array.from([0, 1, -1, 2, -2, 0.5]))], [0, 32767, -32768, 32767, -32768, 16384])
const lamejs = new Function(readFileSync(path.join(REPO, 'lame.min.js'), 'utf8') + '\nreturn lamejs')()
const mp3 = G.codeerMp3(klaar.samples, lamejs)
assert.ok(mp3 instanceof Uint8Array && mp3.length > 1000, 'mp3 gemaakt: ' + mp3.length + ' bytes')
assert.ok(mp3[0] === 0xFF && (mp3[1] & 0xE0) === 0xE0, 'begint met een mp3-blok')
assert.ok(mp3.length < 0.51 * 8000 * 1.6, '64 kbps = ongeveer 8 kB per seconde (' + mp3.length + ' bytes voor 0,5 s)')
const lang3 = G.codeerMp3(lang.samples, lamejs)
assert.ok(lang3.length < 40 * 1024, 'drie seconden blijft onder 40 kB (' + lang3.length + ')')

console.log('studio-geluid ok')
