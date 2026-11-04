// test-quiz.mjs (v265): de rekenstukjes van quiz.js en hoe de quiz meegaat naar vrienden (sync.js).
// Het maken en spelen in een echte browser: tests/tools/proef243.py.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
globalThis.window = {}
globalThis.document = { addEventListener() {} } // stickerfx.js zet bij het laden een luisteraar
const wacht = globalThis.setTimeout; globalThis.setTimeout = (f, ms) => ms >= 1000 ? 0 : wacht(f, ms) // geen mp3's ophalen
const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
// quiz.js importeert stickers en geluiden; die hebben hier niets nodig om in te laden
const Q = await import(new URL('../../quiz.js', import.meta.url)).catch(e => { console.error(e); process.exit(1) })

// normaliseer: kapot = null, grenzen, lege antwoorden eruit met het goede antwoord erbij
assert.equal(Q.normaliseer(null), null)
assert.equal(Q.normaliseer({ vragen: [] }), null)
assert.equal(Q.normaliseer({ vragen: [{ v: 'x', a: ['a'], g: 0 }] }), null, 'één antwoord is geen vraag')
const q = Q.normaliseer({ titel: '  Mijn   quiz ', vragen: [{ v: 'Vraag?', a: ['', 'ja', '', 'nee'], g: 3 }, { v: '', a: ['a', 'b'], g: 0 }] })
assert.equal(q.titel, 'Mijn quiz')
assert.deepEqual(q.vragen, [{ v: 'Vraag?', a: ['ja', 'nee'], g: 1 }], 'lege antwoorden weg, goede antwoord schuift mee; vraag zonder tekst weg')
assert.equal(q.direct, true); assert.equal(q.stickers, true); assert.equal(q.geluid, true)
const veel = Q.normaliseer({ vragen: Array.from({ length: 80 }, (_, i) => ({ v: 'v' + i + 'x'.repeat(500), a: ['a'.repeat(200), 'b', 'c', 'd', 'e'], g: 0 })) })
assert.equal(veel.vragen.length, Q.MAX_VRAGEN, 'hoogstens 50 vragen')
assert.ok(veel.vragen.every(r => r.v.length <= 150 && r.a.length <= 4 && r.a[0].length <= 60))
assert.ok(JSON.stringify(veel).length < 40000, 'een volle quiz past in het sync-pakketje')
const gek = Q.normaliseer({ vragen: [{ v: 'x', a: ['a', 'b'], g: 9 }] })
assert.equal(gek, null, 'goede antwoord bestaat niet: geen vraag')

// controleer: de eerste fout, met het nummer van de vraag
const leeg = { titel: 'T', vragen: [{ v: 'a', a: ['1', '2', '', ''], g: 0 }, { v: 'b', a: ['1', '', '', ''], g: 0 }] }
assert.match(Q.controleer(leeg), /^Vraag 2: vul minstens twee antwoorden in\.$/)
assert.match(Q.controleer({ ...leeg, titel: ' ' }), /titel/)
assert.match(Q.controleer({ titel: 'T', vragen: [{ v: 'a', a: ['1', '2', '', ''], g: 2 }] }), /kies het goede antwoord/)
assert.equal(Q.controleer({ titel: 'T', vragen: [{ v: 'a', a: ['1', '2', '', ''], g: 1 }] }), null)

// uitslag
const u = Q.uitslag({ vragen: [{ v: 'a', a: ['x', 'y'], g: 0 }, { v: 'b', a: ['x', 'y'], g: 1 }] }, [0, 0])
assert.deepEqual(u, { goed: 1, totaal: 2, fouten: [{ v: 'b', jij: 'x', goed: 'y' }] })

// sync.js: quiz en zijn achtergrond gaan mee, met een eigen grens
const sync = lees('sync.js')
assert.match(sync, /const KLEIN_WIDGETS = \['quote', 'aftel', 'optel', 'poll', 'quiz'\]/)
assert.match(sync, /\['poll','poll_'\],\['quiz','quiz_'\]/)
assert.match(sync, /const WBG_WIDGETS = \['poll', 'quote', 'aftel', 'optel', 'quiz'\]/)
assert.match(sync, /widgetbg_\(poll\|quote\|aftel\|optel\|quiz\)/)
assert.doesNotMatch(sync, /\['quote','aftel','optel','poll'\]/, 'nergens nog de oude lijst zonder quiz')

// de pagina's
assert.match(lees('index.html'), /\{ id:'quiz',\s+icon:'🧠', titel:'Quiz'/)
assert.match(lees('index.html'), /\} else if \(id === 'quiz'\) \{\n    renderQuiz\(c, window\._uid\)/)
assert.match(lees('profiel.html'), /id="widget-quiz" onclick="toggleWidget\('quiz'\)"/)
assert.match(lees('profiel.html'), /quiz:\s+\{ id:'quiz'/)
assert.match(lees('vriend-profiel.html'), /if \(w\.id === 'quiz'\) \{ \/\/ v265/)
const qjs = lees('quiz.js')
assert.doesNotMatch(qjs, /innerHTML/, 'teksten van vrienden nooit als html')
console.log('PASS: quiz.js normaliseert, controleert en telt; de quiz gaat mee naar vrienden en staat op alle pagina\'s')
