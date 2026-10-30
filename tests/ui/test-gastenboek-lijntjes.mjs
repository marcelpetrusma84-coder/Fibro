// Gastenboek (v235): de tekst valt precies op de lijntjes, en je kunt kiezen voor een gastenboek zonder lijntjes
// (Profiel > Widgets). Home en het profiel van een vriend gebruiken allebei gastenboekstijl.js.
// In een echte browser nagemeten: elke regel begint op een veelvoud van 26 pixels, ook na scrollen.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const GB = await import(new URL('../../gastenboekstijl.js', import.meta.url))
const R = GB.REGEL

// 1. Elke regel is precies een lijntje hoog, en het lijntje ligt binnen elke regel op dezelfde plek
const papier = GB.containerStijl(true)
assert.match(papier, new RegExp(`transparent 0 ${R - 5}px,rgba\\(70,90,130,0\\.2\\) ${R - 5}px ${R - 4}px,transparent ${R - 4}px ${R}px`))
assert.match(papier, /padding:0 14px 0 26px/, 'geen witruimte boven: het eerste lijntje hoort bij de eerste regel')
const b = GB.berichtHtml({ papier: true, avSrc: null, avTekst: 'x', naam: 'Lotte', tijd: 'nu', tekst: 'hoi' })
assert.ok(b.includes(`height:${R}px`) && b.includes(`line-height:${R}px`), 'kopregel en tekstregels zijn een lijntje hoog')
assert.doesNotMatch(b, /padding:7px|border-bottom:1px solid rgba\(90,70,40/, 'geen extra ruimte tussen berichten op papier')
const binnen = GB.binnenHtml({ papier: true, lijstId: 'l', navId: 'n', invoerId: 'i', knopId: 'k', plaatsHouder: 'p', plaatsenTitel: 't' })
assert.match(binnen, /background-attachment:local,local/, 'bij scrollen gaan de lijntjes mee met de tekst')
assert.match(binnen, /overflow-y:auto/, 'een te volle bladzijde kun je scrollen (er valt nooit een bericht weg)')
assert.equal(GB.leegHtml(true, 'leeg').includes(`line-height:${R}px`), true)

// 2. De lijst wordt een heel aantal lijntjes hoog (met nep-elementen)
{
  globalThis.getComputedStyle = () => ({ paddingTop: '0px', paddingBottom: '0px' })
  globalThis.ResizeObserver = class { observe() {} }
  const lijst = { style: {}, scrollTop: 50 }, nav = { innerHTML: '', style: {} }
  const c = { isConnected: true, clientHeight: 330 }
  const pas = GB.houdOpDeLijntjes(c, lijst, nav, true)
  assert.equal(lijst.style.height, Math.floor((330 - R) / R) * R + 'px', 'zonder bladerknoppen')
  nav.innerHTML = '<button>›</button>'; pas(true)
  assert.equal(nav.style.height, R + 'px')
  assert.equal(lijst.style.height, Math.floor((330 - 2 * R) / R) * R + 'px', 'met bladerknoppen')
  assert.equal(lijst.scrollTop, 0, 'een nieuwe bladzijde begint bovenaan')
  const vrij = { style: {} }
  GB.houdOpDeLijntjes(c, vrij, { innerHTML: '', style: {} }, false)
  assert.equal(vrij.style.height, undefined, 'zonder lijntjes vult de lijst gewoon de ruimte')
}

// 3. Zonder lijntjes: je eigen kleuren, geen papier
const effen = GB.containerStijl(false)
assert.doesNotMatch(effen, /#f3ead6|Georgia|repeating-linear-gradient/)
assert.doesNotMatch(GB.binnenHtml({ papier: false, lijstId: 'l', navId: 'n', invoerId: 'i', knopId: 'k', plaatsHouder: 'p', plaatsenTitel: 't' }), /rgba\(170,60,60/, 'geen rode kantlijn')
{
  const m = new Map(); globalThis.localStorage = { getItem: k => m.get(k) ?? null }
  assert.equal(GB.papierAan('u1'), true, 'standaard: papier')
  m.set('fibro_widgets_profiel_u1', JSON.stringify([{ id: 'gastenboek', papier: false }]))
  assert.equal(GB.papierAan('u1'), false)
  m.set('fibro_widgets_profiel_u1', 'kapot')
  assert.equal(GB.papierAan('u1'), true, 'kapotte opslag: gewoon papier')
}

// 4. Profiel > Widgets: de keuze, en hij gaat mee in de indeling (ook naar vrienden)
const profiel = lees('profiel.html')
assert.match(profiel, /id="widget-gastenboek_effen" onclick="toggleWidget\('gastenboek_effen'\)"/)
assert.match(profiel, /d\.id === 'gastenboek' && actieveWidgets\.includes\('gastenboek_effen'\) \? \{ \.\.\.d, papier: false \}/)
for (const z of ['Gastenboek zonder lijntjes', 'Gewoon in je eigen kleuren, zonder lijntjespapier']) {
  assert.ok(profiel.includes(`data-t>${z}</div>`), z)
  assert.ok(profiel.includes(`'${z}': '`), z + ' in het Engels')
}

// 5. Home en het profiel van een vriend gebruiken allebei het gedeelde bestand, zonder oude kopie van het papier
const index = lees('index.html'), vriend = lees('vriend-profiel.html')
for (const [naam, s] of [['index.html', index], ['vriend-profiel.html', vriend]]) {
  assert.match(s, /import \* as GB from '\.\/gastenboekstijl\.js\?v=1'/, naam)
  assert.doesNotMatch(s, /repeating-linear-gradient\(transparent,transparent 25px/, naam + ': geen oude lijntjes meer')
  assert.match(s, /GB\.houdOpDeLijntjes\(c, .*, papier\)/, naam)
}
assert.match(index, /const papier = GB\.papierAan\(uid\)/)
assert.match(vriend, /renderGastenboekWidget\(el\.querySelector\('\.gbw-inhoud'\), vriendId, w\.papier !== false\)/)
console.log('test-gastenboek-lijntjes: alles goed')
