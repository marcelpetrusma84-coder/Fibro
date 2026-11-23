// Chatlijst (23 nov 2026, Marcel): online bovenaan, daaronder wie het laatst een bericht wisselde (chatvolgorde.js).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { startLaatste, noteerLaatste, noteerUitBerichten, laatsteTijden, sorteerVrienden } from '../../chatvolgorde.js'

const lees = f => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')
const nepOpslag = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }
const IK = 'ik', T0 = Date.parse('2026-11-23T12:00:00Z'), min = n => T0 - n * 60000

// 1. de volgorde: online eerst; binnen een groep het laatste bericht eerst; zonder bericht blijft de laadvolgorde
{
  const basis = ['daan', 'sanne', 'lotte', 'bram', 'eva']
  const tijden = new Map([['eva', min(20)], ['bram', min(180)], ['lotte', min(10)], ['sanne', min(60)]])
  const online = new Set(['bram', 'eva'])
  assert.deepEqual(sorteerVrienden(basis, { online, laatste: tijden, basis }), ['eva', 'bram', 'lotte', 'sanne', 'daan'], 'online (nieuwste eerst), dan de rest (nieuwste eerst), dan zonder bericht')
  assert.deepEqual(sorteerVrienden(basis, { online: new Set(), laatste: tijden, basis }), ['lotte', 'eva', 'sanne', 'bram', 'daan'], 'niemand online: alleen op laatste bericht')
  assert.deepEqual(sorteerVrienden(basis, { online: new Set(), laatste: new Map(), basis }), basis, 'geen berichten: de laadvolgorde blijft')
  assert.deepEqual(sorteerVrienden(['x', 'daan', 'sanne'], { online: new Set(), laatste: new Map(), basis }), ['daan', 'sanne', 'x'], 'een vriend die niet in de basis staat komt achteraan')
  assert.deepEqual(sorteerVrienden([], { basis }), [], 'lege lijst')
  const invoer = ['a', 'b']; sorteerVrienden(invoer, { laatste: new Map([['b', 5]]), basis: invoer }); assert.deepEqual(invoer, ['a', 'b'], 'de invoer wordt niet veranderd')
}

// 2. berichten van de server: per vriend het nieuwste, van jou of van hem
{
  startLaatste(IK, nepOpslag())
  const rijen = [
    { sender_id: 'lotte', receiver_id: IK, created_at: new Date(min(10)).toISOString() },
    { sender_id: IK, receiver_id: 'lotte', created_at: new Date(min(50)).toISOString() },
    { sender_id: IK, receiver_id: 'eva', created_at: new Date(min(20)).toISOString() },
    { sender_id: 'eva', receiver_id: IK, created_at: new Date(min(90)).toISOString() },
    { sender_id: 'vreemd', receiver_id: 'ander', created_at: new Date(min(1)).toISOString() },
    { sender_id: IK, receiver_id: IK, created_at: new Date(min(2)).toISOString() },
    null, { sender_id: 'kapot', receiver_id: IK, created_at: 'geen datum' },
  ]
  assert.equal(noteerUitBerichten(rijen, IK), true)
  assert.equal(laatsteTijden().get('lotte'), min(10), 'het nieuwste bericht van Lotte (van haar)')
  assert.equal(laatsteTijden().get('eva'), min(20), 'het nieuwste bericht met Eva (van jou)')
  assert.equal(laatsteTijden().has('vreemd') || laatsteTijden().has('ander') || laatsteTijden().has(IK) || laatsteTijden().has('kapot'), false, 'berichten van anderen, aan jezelf of zonder datum tellen niet')
  assert.equal(noteerUitBerichten(rijen, IK), false, 'dezelfde berichten nog eens: niets nieuws')
  assert.equal(noteerUitBerichten('geen lijst', IK), false)
  assert.equal(noteerUitBerichten(rijen, null), false, 'zonder jezelf te kennen: niets')
}

// 3. een nieuw bericht: alleen als het nieuwer is; het wordt onthouden voor de volgende keer
{
  const ruimte = nepOpslag()
  startLaatste(IK, ruimte)
  assert.equal(noteerLaatste('lotte', min(30)), true)
  assert.equal(noteerLaatste('lotte', min(40)), false, 'een ouder bericht verandert niets')
  assert.equal(noteerLaatste('lotte', min(30)), false, 'hetzelfde tijdstip ook niet')
  assert.equal(noteerLaatste('lotte', min(5)), true)
  assert.equal(noteerLaatste('', min(5)), false); assert.equal(noteerLaatste(null, min(5)), false); assert.equal(noteerLaatste('x', 'kapot'), false)
  assert.equal(noteerLaatste('daan'), true, 'zonder tijd telt het als nu')
  assert.ok(Math.abs(laatsteTijden().get('daan') - Date.now()) < 5000)
  assert.deepEqual(Object.keys(JSON.parse(ruimte.m.get('fibro_chatlaatste_' + IK))).sort(), ['daan', 'lotte'], 'bewaard onder fibro_chatlaatste_<id>, alleen id en tijd')
  assert.ok(!/bericht|content|tekst/.test(ruimte.m.get('fibro_chatlaatste_' + IK)), 'wat er in het bericht stond wordt nooit bewaard')

  // volgende keer (een nieuwe start): de tijden zijn er meteen weer, ook zonder internet
  startLaatste(IK, ruimte)
  assert.equal(laatsteTijden().get('lotte'), min(5)); assert.ok(laatsteTijden().has('daan'))
  // een ander account op dit toestel ziet niets van dit account
  startLaatste('ander', ruimte)
  assert.equal(laatsteTijden().size, 0)
  // kapotte of vreemde inhoud geeft een lege lijst, geen fout
  for (const slecht of ['{kapot', 'null', '[1,2]', '"tekst"', '{"x":"geen tijd","y":-5}']) {
    const r = nepOpslag(); r.setItem('fibro_chatlaatste_' + IK, slecht)
    startLaatste(IK, r)
    assert.equal(laatsteTijden().size, 0, 'slechte inhoud: ' + slecht)
  }
  // zonder opslag (privévenster) werkt het gewoon in het geheugen
  startLaatste(IK, { getItem() { throw new Error('dicht') }, setItem() { throw new Error('dicht') } })
  assert.equal(noteerLaatste('lotte', min(3)), true); assert.equal(laatsteTijden().get('lotte'), min(3))
}

// 4. chat.html gebruikt het: de lijst wordt herschikt bij laden, bij het online-seintje, en bij elk nieuw bericht
{
  const chat = lees('chat.html')
  assert.match(chat, /import \{[^}]*sorteerVrienden[^}]*\} from '\.\/chatvolgorde\.js\?v=\d+'/, 'chat.html laadt chatvolgorde.js')
  assert.match(chat, /function werkOnlineBij[\s\S]*?herschikLijst\(\)\s*\n\s*\}/, 'de online-stand herschikt de lijst')
  assert.match(chat, /function tekenVriendenLijst[\s\S]*?herschikLijst\(\)/, 'ook de bewaarde lijst staat meteen in volgorde')
  assert.match(chat, /startLaatste\(huidigeUser\.id\)/, 'de tijden van de vorige keer worden eerst opgehaald')
  assert.match(chat, /select\('sender_id, receiver_id, created_at'\)/, 'van de server alleen afzender, ontvanger en tijd, nooit de berichten zelf')
  assert.match(chat, /pling\) stuurPling\(data\.id\)\s*\n\s*bijBericht\(vriendId\)/, 'een verstuurd bericht zet de vriend bovenaan')
  assert.match(chat, /fibro-nieuw-bericht', e => bijBericht\(/, 'een nieuw bericht terwijl je de lijst ziet')
  assert.match(chat, /bijBericht\(msg\.sender_id === huidigeUser\.id \? msg\.receiver_id : msg\.sender_id, msg\.created_at\)/, 'een bericht in het open gesprek')
}
console.log('OK   chatvolgorde')
