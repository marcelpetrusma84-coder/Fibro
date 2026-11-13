// De sessielader bepaalt alleen de weergave; authenticatie blijft bij Supabase.
// Controleer bereikbaarheid van het formulier met een deterministische klok, zonder netwerk.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const bron = readFileSync(new URL('../../login-sessie.js', import.meta.url), 'utf8')
const sessie = JSON.stringify({ access_token: 'fictieve-testpas', user: { id: 'testgebruiker' } })

function element() {
  const attrs = new Map()
  return {
    inert: false,
    setAttribute: (naam, waarde) => attrs.set(naam, waarde),
    getAttribute: naam => attrs.get(naam) ?? null,
    hasAttribute: naam => attrs.has(naam),
    removeAttribute: naam => attrs.delete(naam)
  }
}

function omgeving({ opgeslagen = null, hash = '', search = '', formulierAlAanwezig = true, opslagFout = false } = {}) {
  const root = element()
  let formulier = formulierAlAanwezig ? element() : null
  const documentEvents = new Map()
  const windowEvents = new Map()
  const timers = new Map()
  let tijd = 0
  let volgendeTimer = 0
  const context = {
    document: {
      documentElement: root,
      getElementById: id => id === 'login-inhoud' ? formulier : null,
      addEventListener: (naam, functie) => documentEvents.set(naam, functie)
    },
    window: { addEventListener: (naam, functie) => windowEvents.set(naam, functie) },
    location: { hash, search },
    localStorage: { getItem: () => { if (opslagFout) throw new Error('Opslag niet beschikbaar'); return opgeslagen } },
    URLSearchParams,
    setTimeout: (functie, vertraging) => { const id = ++volgendeTimer; timers.set(id, { functie, op: tijd + vertraging }); return id },
    clearTimeout: id => timers.delete(id),
    fetch: () => { throw new Error('De weergavehelper mag geen netwerk gebruiken') }
  }
  vm.runInNewContext(bron, context)
  return {
    root,
    api: context.window.FibroLoginSessie,
    get formulier() { return formulier },
    laadDOM() { formulier ??= element(); documentEvents.get('DOMContentLoaded')?.() },
    veranderHash(nieuw) { context.location.hash = nieuw; windowEvents.get('hashchange')?.() },
    wacht(ms) {
      tijd += ms
      for (const [id, timer] of [...timers]) {
        if (timer.op <= tijd) { timers.delete(id); timer.functie() }
      }
    }
  }
}

{
  const o = omgeving({ opgeslagen: sessie, formulierAlAanwezig: false })
  assert.equal(o.root.getAttribute('data-login-sessie'), 'laden', 'Een eerder ingelogde browser krijgt de laadweergave vóór het formulier bestaat')
  o.laadDOM()
  assert.equal(o.formulier.inert, true, 'Formuliervelden onder de laadweergave zijn niet bedienbaar')
  assert.equal(o.formulier.getAttribute('aria-hidden'), 'true', 'Het verborgen formulier wordt niet dubbel voorgelezen')
  o.api.toonFormulier()
  assert.equal(o.root.hasAttribute('data-login-sessie'), false)
  assert.equal(o.formulier.inert, false, 'Bij een benodigde aanmelding wordt het formulier direct bereikbaar')
  assert.equal(o.formulier.hasAttribute('aria-hidden'), false)
  o.wacht(12000)
  assert.equal(o.api.isVerlopen(), false, 'De afgebroken controle laat geen oude timer achter')
}

for (const opgeslagen of [null, 'ongeldige json', '{}', JSON.stringify({ user: { id: 'u1' } }), JSON.stringify({ access_token: 'x' })]) {
  const o = omgeving({ opgeslagen })
  o.laadDOM()
  assert.equal(o.root.hasAttribute('data-login-sessie'), false, 'Zonder leesbare eerdere sessie blijft normaal aanmelden bereikbaar')
  assert.equal(o.formulier.inert, false)
}
assert.equal(omgeving({ opgeslagen: sessie, opslagFout: true }).root.hasAttribute('data-login-sessie'), false, 'Geblokkeerde browseropslag blokkeert het aanmeldscherm niet')

for (const route of [{ hash: '#herstellen' }, { hash: '#registreren' }, { search: '?logout=1' }, { search: '?logout' }]) {
  const o = omgeving({ opgeslagen: sessie, ...route })
  o.laadDOM()
  assert.equal(o.root.hasAttribute('data-login-sessie'), false, 'Een expliciete herstel-, registratie- of uitlogroute krijgt geen sessieoverlay')
  assert.equal(o.formulier.inert, false)
}

{
  const o = omgeving({ opgeslagen: sessie })
  o.wacht(11999)
  assert.equal(o.root.getAttribute('data-login-sessie'), 'laden')
  o.wacht(1)
  assert.equal(o.api.isVerlopen(), true)
  assert.equal(o.root.hasAttribute('data-login-sessie'), false, 'Bij een vastgelopen module of netwerkstoring verdwijnt de overlay na twaalf seconden')
  assert.equal(o.formulier.inert, false)
  assert.equal(o.formulier.hasAttribute('aria-hidden'), false)
  o.api.toonLaden()
  assert.equal(o.root.hasAttribute('data-login-sessie'), false, 'Een laat antwoord kan het formulier na de nooduitgang niet weer blokkeren')
}

{
  const o = omgeving({ opgeslagen: sessie, formulierAlAanwezig: false })
  o.wacht(12000)
  o.laadDOM()
  assert.equal(o.formulier.inert, false, 'Ook een langzaam opgebouwde pagina blijft na de nooduitgang bruikbaar')
}

for (const hash of ['#herstellen', '#registreren']) {
  const o = omgeving({ opgeslagen: sessie })
  o.veranderHash(hash)
  assert.equal(o.root.hasAttribute('data-login-sessie'), false, 'Een herstel- of registratiekeuze tijdens laden opent het formulier')
  assert.equal(o.formulier.inert, false)
}

// 13 nov 2026 (Marcel kon niet uitloggen): na Uitloggen (login.html?logout=1) haalt de lader een overgebleven
// inlogpas weg, zodat je niet vanzelf weer binnenkomt. Zonder ?logout blijft hij staan.
for (const [search, blijft] of [['?logout=1', false], ['', true]]) {
  const opslag = new Map([['sb-qmgatbphiplrfxrljtbe-auth-token', sessie], ['fibro_taal', 'nl']])
  const ls = { get length() { return opslag.size }, key: i => [...opslag.keys()][i] ?? null, getItem: k => opslag.get(k) ?? null, removeItem: k => opslag.delete(k) }
  const root = element()
  vm.runInNewContext(bron, { document: { documentElement: root, getElementById: () => element(), addEventListener() {} }, window: { addEventListener() {} },
    location: { hash: '', search }, localStorage: ls, URLSearchParams, setTimeout: () => 0, clearTimeout() {} })
  assert.equal(opslag.has('sb-qmgatbphiplrfxrljtbe-auth-token'), blijft, search ? 'na uitloggen is de inlogpas weg' : 'gewoon openen: de inlogpas blijft')
  assert.equal(opslag.get('fibro_taal'), 'nl', 'andere instellingen blijven')
}
const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const uit = home.slice(home.indexOf('window.uitloggen = async function'), home.indexOf('// v119: profiel van de vorige keer'))
assert.match(uit, /Promise\.race\(\[supabase\.auth\.signOut\(\{ scope: 'local' \}\), new Promise\(r => setTimeout\(r, 4000\)\)\]\)/, 'uitloggen wacht niet eindeloos')
assert.match(uit, /k\.startsWith\('sb-'\) && k\.endsWith\('-auth-token'\)\) localStorage\.removeItem\(k\)/, 'uitloggen haalt de inlogpas altijd zelf weg')
assert.match(uit, /window\.location\.href = 'login\.html\?logout=1'/, 'en gaat naar het aanmeldscherm zonder sessielader')

console.log('ok: sessielader, expliciete routes, formulierbereikbaarheid en twaalfseconden-nooduitgang')
