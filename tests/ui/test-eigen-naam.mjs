// v270: je eigen naam bij het registreren (verplicht), een keer vragen aan wie er nog geen heeft, en in pushmeldingen
// "eigen naam aka gebruikersnaam" (alleen als de telefoon van de ontvanger die naam kent).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
function maakLs(begin = {}) {
  const m = new Map(Object.entries(begin))
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }
}

// ── registratie.js: controle en bewaren ──
{
  const ls = maakLs({ fibro_profiel_u1: JSON.stringify({ bio: 'hoi', widgets: ['mood'] }) })
  const ctx = { window: { localStorage: ls }, console }
  vm.runInNewContext(lees('registratie.js'), ctx)
  const R = ctx.window.FibroRegistratie
  assert.equal(R.schoonEigenNaam('  Sanne   de  Vries '), 'Sanne de Vries')
  assert.equal(R.schoonEigenNaam('x'.repeat(60)).length, 40, 'hoogstens 40 tekens (zoals sync en postbus)')
  assert.equal(R.eigenNaamFout(''), 'Vul je eigen naam in, zodat je vrienden weten wie je bent.', 'verplicht')
  assert.equal(R.eigenNaamFout('   '), 'Vul je eigen naam in, zodat je vrienden weten wie je bent.')
  assert.equal(R.eigenNaamFout('A'), 'Je eigen naam is te kort.')
  assert.equal(R.eigenNaamFout('Bo'), null)
  assert.equal(R.heeftEigenNaam('u1', ls), false)
  assert.equal(R.bewaarEigenNaam('u1', ' Sanne de Vries ', ls), true)
  const p = JSON.parse(ls.getItem('fibro_profiel_u1'))
  assert.deepEqual(p, { bio: 'hoi', widgets: ['mood'], naam: 'Sanne de Vries' }, 'naam erbij, de rest van het profiel blijft')
  assert.equal(R.heeftEigenNaam('u1', ls), true)
  assert.equal(R.bewaarEigenNaam('', 'Sanne', ls), false)
  const ls2 = maakLs({ fibro_profiel_u2: 'kapot{' })
  assert.equal(R.bewaarEigenNaam('u2', 'Bram', ls2), true, 'kapot lokaal profiel: gewoon opnieuw')
  assert.equal(JSON.parse(ls2.getItem('fibro_profiel_u2')).naam, 'Bram')
}

// ── login.html en invite.html: verplicht vakje, voor het account gemaakt wordt; bewaard op het toestel, niet op de server ──
for (const [pagina, veld] of [['login.html', 'reg-eigennaam'], ['invite.html', 'eigennaam']]) {
  const html = lees(pagina)
  assert.match(html, new RegExp('<label for="' + veld + '" data-t>Je eigen naam</label>'), pagina + ': vakje Je eigen naam')
  assert.match(html, new RegExp('id="' + veld + '"[^>]*maxlength="40"'), pagina + ': hoogstens 40 tekens')
  assert.match(html, /<script src="registratie\.js\?v=3"><\/script>/, pagina + ': nieuwe registratie.js')
  const controle = html.indexOf('FibroRegistratie.eigenNaamFout(eigenNaam)')
  const aanmaken = html.indexOf('supabase.auth.signUp(')
  assert.ok(controle > 0 && controle < aanmaken, pagina + ': eerst de naam controleren, dan pas het account maken')
  assert.match(html, /FibroRegistratie\.bewaarEigenNaam\(data\.user\.id, eigenNaam\)/, pagina + ': naam op het toestel bewaard')
  const upsert = html.slice(html.indexOf("supabase.from('profiles').upsert({"), html.indexOf("supabase.from('profiles').upsert({") + 300)
  assert.ok(!/eigenNaam|display_name/.test(upsert), pagina + ': de eigen naam gaat NIET naar de server')
}

// ── eigennaam.js: een keer vragen ──
{
  const ls = maakLs()
  globalThis.localStorage = ls
  const m = await import('../../eigennaam.js')
  assert.equal(m.moetVragen('u1', ls), true, 'geen naam: vragen')
  m.overslaan('u1', ls)
  assert.equal(m.moetVragen('u1', ls), false, 'overgeslagen: niet meer vragen')
  assert.equal(m.moetVragen('u3', ls), true)
  assert.equal(m.bewaarNaam('u3', 'K', ls), false, 'te kort')
  assert.equal(m.bewaarNaam('u3', '  Kim  Jansen ', ls), true)
  assert.equal(JSON.parse(ls.getItem('fibro_profiel_u3')).naam, 'Kim Jansen')
  assert.equal(m.moetVragen('u3', ls), false)
  const ls4 = maakLs({ fibro_profiel_u4: JSON.stringify({ naam: 'Tijn' }) })
  assert.equal(m.moetVragen('u4', ls4), false, 'heeft al een naam: niet vragen')
  const index = lees('index.html')
  assert.match(index, /import\('\.\/eigennaam\.js\?v=1'\)\.then\(m => m\.vraagEigenNaam\(session\.user\.id,/, 'Home vraagt het')
}

// ── pushnamen.js: "eigen naam aka gebruikersnaam" ──
{
  const ctx = { console, globalThis: null }
  ctx.globalThis = ctx
  vm.runInNewContext(lees('pushnamen.js'), ctx)
  const P = ctx.FibroPushNamen
  const lijst = { ChonkyCapibara404: 'Sanne de Vries', Bram: 'Bram de Boer' }
  assert.equal(P.naamInMelding('📞 ChonkyCapibara404 belt je', lijst), '📞 Sanne de Vries aka ChonkyCapibara404 belt je')
  assert.equal(P.naamInMelding('🎮 Bram daagt je uit voor Chess!', lijst), '🎮 Bram de Boer aka Bram daagt je uit voor Chess!')
  assert.equal(P.naamInMelding('🎮 Brammetje daagt je uit', lijst), '🎮 Brammetje daagt je uit', 'alleen een hele gebruikersnaam')
  assert.equal(P.naamInMelding('📞 Onbekend404 belt je', lijst), '📞 Onbekend404 belt je', 'naam niet bekend: alleen de gebruikersnaam')
  assert.equal(P.naamInMelding('Je hebt een nieuw bericht 💬', lijst), 'Je hebt een nieuw bericht 💬', 'geen naam in de melding: niets erbij')
  assert.equal(P.naamInMelding('📞 Sanne de Vries aka ChonkyCapibara404 belt je', lijst), '📞 Sanne de Vries aka ChonkyCapibara404 belt je', 'niet dubbel')
  assert.equal(P.naamInMelding('📞 X belt je', null), '📞 X belt je')
  const ls = maakLs({ vriend_naam_v1_ik: 'Sanne de Vries', vriend_naam_v2_ik: 'Bram', vriend_naam_v3_iemand: 'Geheim' })
  const namen = P.maakNamenLijst('ik', [{ id: 'v1', username: 'ChonkyCapibara404' }, { id: 'v2', username: 'Bram' }, { id: 'v3', username: 'Kim' }, { id: 'v4' }], ls)
  assert.deepEqual(JSON.parse(JSON.stringify(namen)), { ChonkyCapibara404: 'Sanne de Vries' }, 'alleen echte eigen namen van MIJN vrienden')
  const sw = lees('service-worker.js')
  assert.match(sw, /importScripts\('\.\/pushnamen\.js\?v=1'\)/, 'de portier laadt pushnamen.js')
  assert.match(sw, /body = self\.FibroPushNamen\.naamInMelding\(body, await self\.FibroPushNamen\.lees\(\)\)/, 'en gebruikt het voor de tekst')
  assert.match(lees('chat.html'), /window\.FibroPushNamen\?\.bewaar\(huidigeUser\?\.id, data\)/, 'Chat zet de namen klaar')
}
console.log('eigen naam: alles goed')
