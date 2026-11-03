// Dammen v148 (3 nov 2026): de nieuwe damcomputer, de bot, en het nieuwe speelscherm.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as Dammen from '../../dammen.js'
import { damKies, DAM_NIVEAUS, waardeer } from '../../dammen-computer.js'
import { damBot } from '../../dam-bot.js'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const isLegaal = (staat, keten) => Dammen.alleZetten(staat, staat.aanZet).ketens.some(k => zelfde(k, keten))

// 1. Elke computerzet is een legale zet, op elk niveau, een hele tijd lang
assert.deepEqual(DAM_NIVEAUS, ['makkelijk', 'normaal', 'moeilijk', 'expert'])
let rnd = 7
const willekeur = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 }
for (const niveau of DAM_NIVEAUS) {
    let staat = Dammen.nieuweSpelStaat()
    for (let i = 0; i < 30 && !Dammen.heeftGeenZetten(staat, staat.aanZet); i++) {
        const keten = damKies(Dammen, staat, niveau, { tijdFactor: 0.04, rnd: willekeur })
        assert.ok(keten && isLegaal(staat, keten), niveau + ': zet ' + i + ' is legaal')
        staat = Dammen.voerKetenUit({ bord: staat.bord, aanZet: staat.aanZet }, keten)
    }
}

// 2. Slaan is verplicht en de grootste slag gaat voor: de computer kiest dan altijd een slag
{
    const bord = Array.from({ length: 10 }, () => Array(10).fill(null))
    bord[5][4] = 'zS'; bord[6][5] = 'wS'; bord[0][1] = 'zS'; bord[9][8] = 'wS'
    const staat = { bord, aanZet: 'z' }
    const keten = damKies(Dammen, staat, 'expert', { tijdFactor: 0.05 })
    assert.ok(keten.some(s => s.geslagen), 'de computer slaat als het moet')
}

// 3. De waardering is symmetrisch: dezelfde stand vanuit de andere kant is precies andersom
{
    const s = Dammen.nieuweSpelStaat()
    assert.equal(waardeer({ bord: s.bord, aanZet: 'w' }), -waardeer({ bord: s.bord, aanZet: 'z' }))
    assert.equal(waardeer({ bord: s.bord, aanZet: 'w' }), 0, 'de beginstand is gelijk')
}

// 4. Hij ziet een gewonnen stand: met een dam tegen één schijf vlak voor promotie verliest hij niet zomaar
{
    const bord = Array.from({ length: 10 }, () => Array(10).fill(null))
    bord[4][5] = 'wS'; bord[3][4] = 'zS'; bord[9][0] = 'wS'
    const staat = { bord, aanZet: 'w' }
    const keten = damKies(Dammen, staat, 'moeilijk', { tijdFactor: 0.2 })
    assert.ok(keten[0].geslagen, 'wit slaat de zwarte schijf')
}

// 5. De bot (zonder worker, zoals in node) speelt na een zet van de mens, en niet meer als de partij voorbij is
{
    const verstuurd = []
    const bot = damBot({ stuur: (e, p) => verstuurd.push([e, p]), niveau: 'normaal', isDicht: () => false, motor: Dammen })
    let staat = Dammen.nieuweSpelStaat()
    const eerste = Dammen.alleZetten(staat, 'w').ketens[0]
    staat = Dammen.voerKetenUit(staat, eerste)
    bot.ontvang('zet', { keten: eerste, bord: staat.bord, aanZet: staat.aanZet, nr: 1, spelId: 0 })
    await new Promise(r => setTimeout(r, 1200))
    const antwoord = verstuurd.find(([e]) => e === 'zet')
    assert.ok(antwoord, 'de bot zet terug')
    assert.equal(antwoord[1].nr, 2)
    assert.equal(antwoord[1].aanZet, 'w')
    assert.ok(isLegaal(staat, antwoord[1].keten), 'de zet van de bot is legaal')

    verstuurd.length = 0
    const st2 = Dammen.voerKetenUit({ bord: antwoord[1].bord, aanZet: 'w' }, Dammen.alleZetten({ bord: antwoord[1].bord, aanZet: 'w' }, 'w').ketens[0])
    bot.ontvang('zet', { keten: [], bord: st2.bord, aanZet: st2.aanZet, nr: 3, spelId: 0, einde: true })
    await new Promise(r => setTimeout(r, 1100))
    assert.equal(verstuurd.filter(([e]) => e === 'zet').length, 0, 'na einde denkt de bot niet meer')
    bot.stop()
}

// 6. Het speelscherm: nieuw uiterlijk, remiseregels, instellingen, webcam alleen tegen een vriend
const ui = lees('dammen-ui.js')
assert.match(ui, /export function start\(\{ Dammen, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam \}\)/, 'zelfde aanroep als vroeger')
assert.match(ui, /stil >= 50/, 'remise na 25 zetten (50 halve zetten) met alleen dammen')
assert.match(ui, /herhaling\.get\(sleutel\(\)\) \|\| 0\) >= 3/, 'remise bij drie keer dezelfde stand')
assert.match(ui, /einde: true/, 'een zet die de partij beëindigt, zegt dat')
assert.match(ui, /if \(gameOver && id === spelId\) return/, 'na het einde geen oude zetten meer overnemen')
assert.match(ui, /fibro_dammen_inst/, 'instellingen bewaard op het toestel')
for (const stijl of ['hout', 'walnoot', 'marmer', 'fibro']) assert.match(ui, new RegExp("data-bord=\"" + stijl + "\"|\\['" + stijl + "'"), 'bordstijl ' + stijl)
assert.match(ui, /solo \? '' : '<button type="button" class="dm-knop dm-video"/, 'webcamknop alleen tegen een vriend')
assert.match(ui, /window\.FibroChessVideo/)
assert.match(ui, /r \* 5 \+ Math\.floor\(k \/ 2\) \+ 1/, 'veldnummers 1-50')
assert.ok(!/ctx\.filter/.test(ui), 'geen ctx.filter (werkt niet op de iPhone)')
// alle teksten hebben een Engelse vertaling
const en = lees('taal-en.js')
for (const m of ui.matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) assert.ok(en.includes(JSON.stringify(m[1]) + ':'), 'Engels voor: ' + m[1])

// 7. chat.html: webcams bij dammen als twee rondjes van 120 px bovenin
const chat = lees('chat.html')
assert.match(chat, /dammen-ui\.js\?v=1[45]\d/)
assert.match(chat, /const CAMERA_RONDJES = \{ dammen:'groot', botkaaseiren:'groot', vieroprij:'groot', pong:'klein', breakout:'klein' \}/)
assert.match(chat, /overlay\.classList\.toggle\('dam-video-modus', toon && rondjes === 'groot'\)/)
assert.match(chat, /overlay\.classList\.toggle\('klein-video-modus', toon && rondjes === 'klein'\)/)
assert.match(chat, /\.dam-video-modus \.spel-video-vak, [^{]*\{[^}]*width:120px; height:120px;[^}]*border-radius:50%/)
assert.match(chat, /classList\.remove\('sch-video-modus', 'dam-video-modus', 'klein-video-modus'\)/, 'rondjes weg bij ophangen')

// 8. spel.html en solo.js: de nieuwe bot met expert
const solo = lees('solo.js')
assert.match(solo, /import \{ damBot \} from '\.\/dam-bot\.js\?v=1'/)
assert.match(solo, /dammen-ui\.js\?v=1[45]\d',\s+niveaus:\[\.\.\.NIVEAUS, 'expert'\]/)
assert.match(lees('spel.html'), /expert: 'Expert'/)
assert.match(lees('dammen-worker.js'), /dammen-computer\.js\?v=1/)

console.log('dammen pro: ok')

// 9. De damsprong: een tweede schijf springt bovenop, daarna kroon, ring, vonkjes en 'Dam!'
const ui2 = lees('dammen-ui.js')
assert.match(ui2, /function damSprong\(el, kleur, \[r, k\], wacht, s, plek\)/)
assert.match(ui2, /vooraf\[1\] === 'S' && staat\.bord\[eind\[0\]\]\[eind\[1\]\]\?\.\[1\] === 'D'\) damSprong/, 'alleen als een schijf dam wordt')
assert.match(ui2, /dm-damring/); assert.match(ui2, /dm-vonk/); assert.match(ui2, /T\('Dam!'\)/)
assert.match(ui2, /const wacht = bezigTot - Date\.now\(\)/, 'een snel antwoord wacht tot de animatie klaar is')
console.log('damsprong: ok')

// 10. Wie praat, krijgt een gouden rand om zijn webcamrondje
const chat2 = lees('chat.html')
assert.match(chat2, /\.dam-video-modus \.spel-video-vak\.praat, /)
assert.match(chat2, /window\.fibroSpreekMeter\?\.volg\(toon && Boolean\(rondjes\)\)/)
assert.match(chat2, /spelVideoEigen: 'lokaalMedia', spelVideoAnder: 'remoteAudio'/)
assert.ok(!/analyser\.connect\(ac\.destination\)/.test(chat2), 'de meter speelt zelf geen geluid af')
assert.match(chat2, /b\.track\.enabled && b\.track\.readyState === 'live'/, 'microfoon op stil: geen rand')
console.log('spreekrand: ok')

// 11. Geslagen worden: het rondje van wie geslagen wordt, wordt even rood
assert.match(lees('dammen-ui.js'), /const wie = stuk\[0\] === mijnKleur \? 'ander' : 'ik'/)
assert.match(lees('dammen-ui.js'), /new CustomEvent\('fibro-dam-geslagen'/)
assert.match(lees('chat.html'), /\.dam-video-modus \.spel-video-vak\.geslagen, /)
assert.match(lees('chat.html'), /event\.detail\?\.wie === 'ik' \? 'spelVideoEigen' : 'spelVideoAnder'/)
console.log('rode rand: ok')

// 12. De emoji's staan op de spelbalk naast de stickers en gaan meteen naar je vriend
const chat3 = lees('chat.html')
assert.match(chat3, /emojiKnop\.id = 'spelEmojiKnop'/)
{ const i = chat3.indexOf('rij.appendChild(knop)'), j = chat3.indexOf('rij.appendChild(emojiKnop)'), k = chat3.indexOf('rij.appendChild(inp)'); assert.ok(i > 0 && i < j && j < k, 'emojiknop tussen de stickerknop en het tekstveld') }
assert.match(chat3, /await verstuurSpelChat\(e\)/)
assert.ok(lees('taal-en.js').includes('"Emoji\'s": "Emojis"'))
console.log('emoji op de balk: ok')

// 13. Een verstuurknop naast het tekstveld op de spelbalk
const chat4 = lees('chat.html')
assert.match(chat4, /stuurKnop\.id = 'spelChatStuur'/)
assert.match(chat4, /stuurKnop\.onclick = function \(\) \{ verstuurInvoer\(\) \}/)
assert.match(chat4, /if \(ev\.key !== 'Enter' \|\| ev\.isComposing\) return\n      ev\.preventDefault\(\)\n      verstuurInvoer\(\)/, 'Enter werkt nog steeds')
console.log('verstuurknop: ok')

// 14. Tijdens het typen schuiven de sticker- en emojiknop opzij
const chat5 = lees('chat.html')
assert.match(chat5, /inp\.addEventListener\('focus', function \(\) \{[\s\S]{0,140}zijKnoppen\(false\)/)
assert.match(chat5, /inp\.addEventListener\('blur', function \(\) \{ zijKnoppen\(true\) \}\)/)
console.log('opzij schuiven: ok')

// 15. Opzij schuiven alleen op een touchscherm, en daarna echt weg (anders houdt Safari de breedte vast)
const chat6 = lees('chat.html')
assert.match(chat6, /matchMedia\('\(hover: none\) and \(pointer: coarse\)'\)/)
assert.match(chat6, /if \(!opTouch\) return/)
assert.match(chat6, /b\.style\.display = 'none' \}, 240\)/)
console.log('balk op iPhone: ok')

// 16. Geslagen met de webcamrondjes: ook een geluidje
const ui3 = lees('dammen-ui.js')
assert.match(ui3, /dammen-geluid\.js\?v=2/)
assert.match(ui3, /if \(wie === 'ik' && overlay && overlay\.classList\.contains\('dam-video-modus'\)\) geluid\.geslagen\(geslagen\)/)
assert.match(lees('dammen-geluid.js'), /geslagen\(aantal = 1\) \{/)
console.log('geluidje bij geslagen: ok')

// 17. Webcam ook bij vier op een rij, boter-kaas-en-eieren, Neo Paddle en Block It
const chat7 = lees('chat.html')
assert.match(chat7, /bouwSpelCamKnop\(\) \/\/ v3 nov/)
assert.match(chat7, /if \(!CAMERA_RONDJES\[spelActief\] \|\| spelActief === 'dammen'\) return/, 'dammen houdt zijn eigen knop')
assert.match(chat7, /\.spel-overlay\.klein-video-modus \.spel-video-vak \{ top:6px; width:60px; height:60px;/)
assert.match(chat7, /document\.getElementById\('spelCamKnop'\)\?\.remove\(\)\n    if \(!wasFibroTest\) stopSpelBel\(\)/, 'knop weg bij sluiten')
console.log('webcam bij meer spellen: ok')
