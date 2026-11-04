// test-wachtwoord-reset.mjs (v265): een moderator geeft een tijdelijk wachtwoord; daarna kiest de
// gebruiker zelf een nieuw (supabase/functions/wachtwoord-reset, moderatie.html, login.html).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const lees = p => readFile(new URL('../../' + p, import.meta.url), 'utf8')

// ── 1. De serverfunctie ──
const fn = await lees('supabase/functions/wachtwoord-reset/index.ts')
assert.match(fn, /auth\.getUser\(pas\)/, 'alleen met een geldige inlogpas')
assert.match(fn, /select\("is_moderator"\)\.eq\("id", uid\)/, 'controleert of de vrager moderator is')
assert.match(fn, /is_moderator !== true\) return antwoord\(\{ ok: false, reden: "geen moderator" \}, 403\)/)
assert.match(fn, /doel\.is_moderator === true\) return antwoord\(\{ ok: false, reden: "moderator" \}, 403\)/,
  'het wachtwoord van een moderator kan zo niet veranderd worden')
assert.match(fn, /\.\.\.\(huidig\.user\.user_metadata \|\| \{\}\), tijdelijk_wachtwoord: true/,
  'bestaande gegevens blijven, het seintje gaat aan')
assert.doesNotMatch(fn, /console\.\w+\([^)]*,\s*wachtwoord\s*[,)]/, 'het wachtwoord komt nooit in de logboeken')
assert.doesNotMatch(fn, /Math\.random/, 'geen voorspelbaar toeval')

// maakTijdelijkWachtwoord los draaien (types eraf)
const begin = fn.indexOf('const TEKENS')
const eind = fn.indexOf('// Gebruikersnaam zoals')
const code = fn.slice(begin, eind).replace('export ', '').replace('(lengte = 12): string', '(lengte = 12)')
const maak = vm.runInNewContext(code + '; maakTijdelijkWachtwoord', { crypto: globalThis.crypto, Uint8Array })
const gezien = new Set()
for (let i = 0; i < 200; i++) {
  const w = maak()
  assert.equal(w.length, 12)
  assert.match(w, /^[abcdefghjkmnpqrstuvwxyz23456789]+$/, 'geen tekens die je kunt verwarren')
  gezien.add(w)
}
assert.equal(gezien.size, 200, 'elk tijdelijk wachtwoord is anders')

// ── 2. Moderatiepagina ──
const mod = await lees('moderatie.html')
assert.match(mod, /supabase\.functions\.invoke\('wachtwoord-reset', \{ body: \{ gebruikersnaam: naam \} \}\)/)
assert.match(mod, /confirm\(T\('Het wachtwoord van \{naam\} vervangen/, 'eerst bevestigen')
const modFn = mod.slice(mod.indexOf('window.resetWachtwoord'), mod.indexOf("document.getElementById('zoekNaam').addEventListener"))
assert.doesNotMatch(modFn, /localStorage|sessionStorage|innerHTML/, 'niet bewaren, en tekst nooit als html')

// ── 3. Inlogscherm: eerst zelf een nieuw wachtwoord ──
const login = await lees('login.html')
assert.match(login, /id="panel-nieuwwachtwoord"/)
assert.match(login, /id="vergeten-link"/)
assert.equal((login.match(/await eerstNieuwWachtwoord\(data\.user\)/g) || []).length, 3,
  'gewoon inloggen, herstel met sleutel en met Face ID')
assert.match(login, /eerstNieuwWachtwoord\(session\.user\)\.then/, 'ook bij een bestaande sessie')

const s = login.indexOf('  async function eerstNieuwWachtwoord(user)')
const e = login.indexOf('\n  function toonBericht(', s)
assert(s > 0 && e > s)
const bron = login.slice(s, e)

function maakDom() {
  const els = {}
  const maak = (id, extra = {}) => {
    const set = new Set(extra.actief ? ['active'] : [])
    els[id] = {
      id, value: '', disabled: false, onclick: null, style: {}, className: '', textContent: '',
      classList: { add: c => set.add(c), remove: c => set.delete(c), has: c => set.has(c) },
      ...extra,
    }
    return els[id]
  }
  const panelen = [maak('panel-inloggen', { actief: true }), maak('panel-nieuwwachtwoord')]
  const tabs = maak('tabs')
  for (const id of ['nieuw-msg', 'nieuw-btn', 'nieuw-wachtwoord', 'nieuw-wachtwoord2']) maak(id)
  const document = {
    getElementById: id => els[id],
    querySelector: sel => sel === '.tabs' ? tabs : sel === '.panel.active' ? panelen.find(p => p.classList.has('active')) : null,
    querySelectorAll: sel => sel === '.panel' ? panelen : [],
  }
  return { els, document }
}

async function draai(user, stappen = []) {
  const { els, document } = maakDom()
  const updates = []
  const ctx = {
    document,
    T: t => t,
    toonBericht: (el, type, tekst) => { el.className = type; el.textContent = tekst },
    supabase: { auth: { updateUser: async u => { updates.push(u); return { error: null } } } },
  }
  vm.runInNewContext(bron + '\nthis.f = eerstNieuwWachtwoord', ctx)
  const p = ctx.f(user)
  let klaar = false
  p.then(() => { klaar = true })
  await new Promise(r => setImmediate(r))
  const tussen = []
  for (const [w1, w2] of stappen) {
    els['nieuw-wachtwoord'].value = w1
    els['nieuw-wachtwoord2'].value = w2
    await els['nieuw-btn'].onclick()
    await new Promise(r => setImmediate(r))
    tussen.push({ type: els['nieuw-msg'].className, klaar })
  }
  return { els, updates, klaar, tussen }
}

// Geen tijdelijk wachtwoord: niets te doen
let r = await draai({ id: 'a', user_metadata: {} })
assert.equal(r.klaar, true)
assert.equal(r.updates.length, 0)
assert(r.els['panel-inloggen'].classList.has('active'))
r = await draai(null)
assert.equal(r.klaar, true)

// Wel: eerst te kort, dan niet gelijk, dan goed
r = await draai({ id: 'b', user_metadata: { tijdelijk_wachtwoord: true } },
  [['kort', 'kort'], ['langgenoeg1', 'langgenoeg2'], ['langgenoeg1', 'langgenoeg1']])
assert.deepEqual(r.tussen.map(t => t.type), ['error', 'error', 'success'])
assert.deepEqual(r.tussen.map(t => t.klaar), [false, false, true], 'pas verder na een goed nieuw wachtwoord')
assert.deepEqual(JSON.parse(JSON.stringify(r.updates)), [{ password: 'langgenoeg1', data: { tijdelijk_wachtwoord: false } }])
assert(r.els['panel-inloggen'].classList.has('active'), 'daarna gaat het inloggen gewoon verder')
assert(!r.els['panel-nieuwwachtwoord'].classList.has('active'))
assert.equal(r.els.tabs.style.display, '')

// ── 4. Vertalingen ──
const en = await lees('taal-en.js')
for (const t of ['Wachtwoord vergeten?', 'Wachtwoord resetten', 'Nieuw wachtwoord opgeslagen ✓',
  'Tijdelijk wachtwoord voor {naam}:', 'De twee wachtwoorden zijn niet hetzelfde.']) {
  assert(en.includes(JSON.stringify(t) + ':'), 'Engels ontbreekt: ' + t)
}

console.log('PASS: alleen een moderator reset (niet bij een andere moderator), het tijdelijke wachtwoord is willekeurig en duidelijk, en na inloggen kiest de gebruiker zelf een nieuw wachtwoord.')
