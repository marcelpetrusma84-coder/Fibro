// eenendertigen-ui.js - Eenendertigen, een kaartspel uit Stekky Studio (v1, 25 nov 2026; spellen/eenendertigen.md).
// v2 (25 nov 2026): 2 tot 6 spelers via groepspel.js (één gastheer heeft de stand; lege zetels speelt de computer).
// Tegen de computer kies je eerst met hoeveel computers (1 tot 5). In de chat met z'n tweeën; met een groep komt
// start() met spelers en mijnZetel.
//
// In gewone woorden: de regels staan in eenendertigen.js, de tafel in kaartspel-hulp.js (BLAUWDRUK-KAARTSPEL.md).
// Midden op tafel liggen 3 open kaarten. Kies een kaart uit je hand (tik) en tik op een kaart op tafel om te ruilen;
// of veeg je kaart omhoog en kies dan met welke tafelkaart. Knoppen: "Alle 3 ruilen", "Kloppen" en ❓ (de regels).
// Boven de tafel: je punten en de levens. Na een ronde zie je de kaarten van de ander; speler 1 deelt dan vanzelf de
// volgende ronde. v3: knop "⏭️ Passen" (past iedereen een rondgang, dan 3 nieuwe tafelkaarten). Over het spelkanaal: zie groepspel.js ('actie', 'stand', 'opnieuw', 'vraag-stand', 'weg'), plus 'kaartreactie'.
import * as P from './eenendertigen.js?v=3'
import { maakKaartTafel, kaartSvg, kaartNaam, REACTIES } from './kaartspel-hulp.js?v=22'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'
import { maakGroepSpel } from './groepspel.js?v=2'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Kies een kaart uit je hand en tik op een kaart op tafel om te ruilen. Of: alle 3 ruilen.': 'Choose a card from your hand and tap a card on the table to swap. Or: swap all 3.',
  'Kies een kaart uit je hand en tik op een kaart op tafel. Of klop als je genoeg hebt.': 'Choose a card from your hand and tap a card on the table. Or knock if you have enough.',
  '{naam} klopte: je mag nog één keer ruilen.': '{naam} knocked: you may swap one more time.',
  'Je klopte. Nu mag {naam} nog één keer.': 'You knocked. Now {naam} gets one more turn.',
  '⏭️ Passen': '⏭️ Pass', '{naam} past': '{naam} passes', 'Je past': 'You pass', 'Iedereen paste: 3 nieuwe kaarten op tafel': 'Everyone passed: 3 new cards on the table',
  'Wil je niets ruilen, dan mag je passen. Past iedereen een hele rondgang, dan gaan de 3 tafelkaarten weg en komen er 3 nieuwe van de stapel.': "Don't want to swap? Then you may pass. If everyone passes for a whole round, the 3 table cards are replaced by 3 new ones from the deck.",
  '🔄 Alle 3 ruilen': '🔄 Swap all 3', '✊ Kloppen': '✊ Knock', 'Met welke kaart van tafel ruilen?': 'Swap with which card on the table?',
  'Kies eerst een kaart uit je hand.': 'Choose a card from your hand first.', 'Jij: {n}': 'You: {n}', 'Klop!': 'Knock!', '{naam} klopt!': '{naam} knocks!',
  '{naam} ruilt': '{naam} swaps', '{naam} ruilt alles': '{naam} swaps all', '31!': '31!',
  'Jullie verliezen allebei een leven': 'You both lose a life', 'Jij verliest een leven': 'You lose a life', '{naam} verliest een leven': '{naam} loses a life',
  'Niemand verliest een leven': 'Nobody loses a life', 'Jij {a} · {naam} {b}': 'You {a} · {naam} {b}', 'De volgende ronde wordt gedeeld...': 'Dealing the next round...',
  'Wachten tot {naam} de volgende ronde deelt...': 'Waiting for {naam} to deal the next round...', '🤝 Allebei af: gelijkspel!': '🤝 Both out: a draw!',
  'Ronde {n}': 'Round {n}', 'Tafel': 'Table', 'Terug': 'Back',
  'Spelregels van Eenendertigen': 'Rules of Thirty-One',
  'Tegen hoeveel computers wil je spelen?': 'How many computer players?', 'Computer {n}': 'Computer {n}', 'Je ligt eruit. Kijk nog even mee!': "You're out. Keep watching!",
  '{naam} is aan de beurt': "It's {naam}'s turn", '{namen} verliezen een leven': '{namen} lose a life', '{naam} ligt eruit': '{naam} is out',
  '{naam} klopte: je mag nog één keer.': '{naam} knocked: you get one more turn.', 'Je klopte. De anderen mogen nog één keer.': 'You knocked. The others get one more turn.',
  'Heb je precies 31, dan laat je meteen je kaarten zien. Alle anderen verliezen dan een leven.': 'If you have exactly 31, you show your cards right away. Everyone else then loses a life.',
  'Klop je, dan mogen de anderen nog één keer ruilen. Daarna laat iedereen zijn kaarten zien.': 'If you knock, the others may swap one more time. Then everyone shows their cards.',
  'Wie de minste punten heeft, verliest een leven. Hebben meer spelers evenveel, dan verliezen ze allemaal een leven. Ook wie klopte verliest maar één leven.': 'Whoever has the fewest points loses a life. If several players have the same, they all lose a life. Whoever knocked also loses only one life.',
  'Iedereen begint met 3 levens. Wie geen levens meer heeft, ligt eruit. Wie als laatste over is, wint.': 'Everyone starts with 3 lives. Whoever has no lives left is out. The last one left wins.',
  'Jij {a}': 'You {a}', 'aan de beurt': 'to play', 'Het spel is gestopt.': 'The game has stopped.', '{naam} heeft het spel verlaten.': '{naam} has left the game.',
  'Elke speler krijgt 3 kaarten. Er liggen ook 3 kaarten open op tafel. Wie begint, wisselt per ronde.': 'Each player gets 3 cards. There are also 3 face-up cards on the table. Who starts alternates every round.',
  'Om de beurt doe je één ding: één kaart ruilen met de tafel, alle drie je kaarten ruilen met de tafel, of kloppen. Kloppen mag pas als iedereen één keer aan de beurt is geweest.': 'Taking turns, you do one thing: swap one card with the table, swap all three of your cards with the table, or knock. You may only knock once everyone has had a turn.',
  'Je punten tel je alleen op bij kaarten van dezelfde kleur: aas is 11, heer, vrouw en boer zijn 10, de andere kaarten hun eigen waarde. Je beste kleur telt. Het hoogste is 31.': 'Only cards of the same suit add up: an ace is 11, king, queen and jack are 10, the other cards their own value. Your best suit counts. The highest is 31.',
  'Drie kaarten met dezelfde waarde (bijvoorbeeld drie vrouwen) zijn 30½ waard.': 'Three cards of the same value (for example three queens) are worth 30½.',
  'Klop je, dan mag de ander nog één keer ruilen. Daarna laten jullie je kaarten zien.': 'If you knock, the other player may swap one more time. Then you both show your cards.',
  'Heb je precies 31, dan laat je meteen je kaarten zien en win je de ronde.': 'If you have exactly 31, you show your cards right away and win the round.',
  'Wie de minste punten heeft, verliest een leven. Hebben jullie evenveel, dan verliezen jullie allebei een leven. Ook wie klopte verliest maar één leven.': 'Whoever has the fewest points loses a life. If you have the same, you both lose a life. Whoever knocked also loses only one life.',
  'Iedereen begint met 3 levens. Wie geen levens meer heeft, heeft verloren.': 'Everyone starts with 3 lives. Whoever has no lives left has lost.',
})
const BEURT_SECONDEN = 30
const VOLGENDE_MS = 3500
const wacht = ms => new Promise(k => setTimeout(k, ms))
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const REGELS = ['Elke speler krijgt 3 kaarten. Er liggen ook 3 kaarten open op tafel. Wie begint, wisselt per ronde.',
  'Om de beurt doe je één ding: één kaart ruilen met de tafel, alle drie je kaarten ruilen met de tafel, of kloppen. Kloppen mag pas als iedereen één keer aan de beurt is geweest.',
  'Wil je niets ruilen, dan mag je passen. Past iedereen een hele rondgang, dan gaan de 3 tafelkaarten weg en komen er 3 nieuwe van de stapel.',
  'Je punten tel je alleen op bij kaarten van dezelfde kleur: aas is 11, heer, vrouw en boer zijn 10, de andere kaarten hun eigen waarde. Je beste kleur telt. Het hoogste is 31.',
  'Drie kaarten met dezelfde waarde (bijvoorbeeld drie vrouwen) zijn 30½ waard.',
  'Klop je, dan mogen de anderen nog één keer ruilen. Daarna laat iedereen zijn kaarten zien.',
  'Heb je precies 31, dan laat je meteen je kaarten zien. Alle anderen verliezen dan een leven.',
  'Wie de minste punten heeft, verliest een leven. Hebben meer spelers evenveel, dan verliezen ze allemaal een leven. Ook wie klopte verliest maar één leven.',
  'Iedereen begint met 3 levens. Wie geen levens meer heeft, ligt eruit. Wie als laatste over is, wint.']

// spelers/mijnZetel: met een groep (groepschat of Home); anders met z'n tweeën in de chat, of tegen de computer.
export function start({ spelKanaal, benIkSpeler1, vriendNaam, spelers: groep, mijnZetel }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🎲 ' + T('Eenendertigen')
  const solo = Boolean(spelKanaal && spelKanaal.isSolo)
  const niveau = (spelKanaal && spelKanaal.niveau) || 'normaal'
  let spelers, ik
  if (Array.isArray(groep) && groep.length >= 2) { spelers = groep.slice(0, P.MAX_SPELERS).map((s, i) => ({ zetel: i + 1, naam: s.naam, id: s.id, computer: Boolean(s.computer) })); ik = mijnZetel || 1 }
  else if (solo) { spelers = null; ik = 1 }        // eerst kiezen hoeveel computers
  else { ik = benIkSpeler1 ? 1 : 2; spelers = [{ zetel: 1, naam: benIkSpeler1 ? T('Jij') : (vriendNaam || T('vriend')) }, { zetel: 2, naam: benIkSpeler1 ? (vriendNaam || T('vriend')) : T('Jij') }] }
  const naamVan = z => z === ik ? T('Jij') : ((spelers || []).find(s => s.zetel === z) || {}).naam || '?'
  const multi = () => spelers && spelers.length > 2
  // met z'n tweeën: "de ander"; met meer: de naam van wie het is
  const hij = () => (ik === 1 ? 2 : 1)

  let staat = null, spel = null
  let bezig = 0
  let rij = Promise.resolve()
  const score = {}
  const geteld = new Set(), getoond = new Set()
  let klokVoor = ''

  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[eenendertigen]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: solo ? T('Computer') : (vriendNaam || T('vriend')),
    groep: id => id,                                    // je kiest één kaart tegelijk
    magSpelen: ids => !bezig && ids.length === 1 && P.magRuilen(staat, ik),
    onSpeel: ids => kiesTafelkaart(ids[0]),             // vegen of dubbeltik: met welke kaart van tafel?
    onPak() {},
    onSelectie: () => tekenInfo(),
    onReactie: emoji => { if (!solo) spelKanaal.send({ type: 'broadcast', event: 'kaartreactie', payload: { emoji, zetel: ik } }) },
  })

  // De 3 tafelkaarten en de pilletjes in een eigen vak midden op tafel (het info-vak van de tafel laat geen tikken door);
  // de stapel staat er niet (die gebruik je in dit spel niet)
  const middenEl = document.createElement('div')
  middenEl.className = 'eed-midden'
  middenEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2'
  tafel.element.querySelector('.kt-midden').appendChild(middenEl)
  for (const e of tafel.element.querySelectorAll('.kt-stapel-groep, .kt-stapel')) e.style.display = 'none'
  // de aflegstapel alleen als de ronde klaar is bij twee spelers (daar komen de kaarten van de ander)
  const aflegEl = tafel.element.querySelector('.kt-afleg')
  const toonAfleg = aan => { if (aflegEl) aflegEl.style.display = aan && !multi() ? '' : 'none' }

  // ── Wat de tafel laat zien ──
  const rondeOver = s => s && s.fase !== 'spel'
  const hand = s => (s && s.handen[ik]) || []
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.fase === 'uitslag') return spel && spel.gastheer ? T('De volgende ronde wordt gedeeld...') : T('Wachten tot {naam} de volgende ronde deelt...', { naam: naamVan(1) })
    if (s.fase === 'klaar') return ''
    if (!(s.levens[ik] > 0)) return T('Je ligt eruit. Kijk nog even mee!')
    if (s.aanZet !== ik) {
      if (s.geklopt === ik) return multi() ? T('Je klopte. De anderen mogen nog één keer.') : T('Je klopte. Nu mag {naam} nog één keer.', { naam: naamVan(hij()) })
      if (multi()) return T('{naam} is aan de beurt', { naam: naamVan(s.aanZet) })
      return solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam: naamVan(s.aanZet) })
    }
    if (s.geklopt && s.geklopt !== ik) return multi() ? T('{naam} klopte: je mag nog één keer.', { naam: naamVan(s.geklopt) }) : T('{naam} klopte: je mag nog één keer ruilen.', { naam: naamVan(s.geklopt) })
    return P.magKloppen(s, ik) ? T('Kies een kaart uit je hand en tik op een kaart op tafel. Of klop als je genoeg hebt.') : T('Kies een kaart uit je hand en tik op een kaart op tafel om te ruilen. Of: alle 3 ruilen.')
  }
  function beeld(s, extra = {}) {
    const mag = P.magRuilen(s, ik)
    const ander = multi() ? 0 : (rondeOver(s) ? 0 : (s.handen[hij()] || []).length)
    return { hand: hand(s), anderAantal: ander, stapelAantal: s.stapel.length, afleg: rondeOver(s) && !multi() ? (s.handen[hij()] || []) : [],
      mijnBeurt: mag, speelbaar: mag ? hand(s) : [], status: statusTekst(s), ...extra }
  }
  const harten = n => '❤️'.repeat(Math.max(0, n)) + '🤍'.repeat(Math.max(0, P.LEVENS - n))
  // de anderen in de rondte, te beginnen na mij
  const anderen = s => P.zetels(s).map((_, i) => ((ik - 1 + i + 1) % s.n) + 1).filter(z => z !== ik)
  function tekenTegenstanders(s) {
    if (!multi()) { tafel.tegenstanders(null); return }
    tafel.tegenstanders(anderen(s).map(z => {
      const p = rondeOver(s) && s.uitslag && s.uitslag.punten[z] !== undefined ? P.toonPunten(s.uitslag.punten[z]) + ' ' : ''
      return { zetel: z, naam: naamVan(z), icoon: (spelers.find(x => x.zetel === z) || {}).computer ? '🤖' : '', info: p + (s.levens[z] > 0 ? harten(s.levens[z]) : '✖'), beurt: s.fase === 'spel' && s.aanZet === z, uit: !(s.levens[z] > 0) }
    }))
  }
  // Midden: de 3 tafelkaarten (tikbaar), en de pilletjes met je punten en de levens
  function tekenInfo(s = staat) {
    if (!s) { middenEl.innerHTML = ''; return }
    const pil = (t, k) => '<span style="padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:14px;white-space:nowrap' + (k ? ';color:' + k : '') + '">' + t + '</span>'
    const mijn = hand(s).length ? P.punten(hand(s)) : 0
    const gekozen = tafel.selectie()[0]
    const mag = P.magRuilen(s, ik)
    const kaarten = s.tafel.map(id => '<button type="button" class="eed-tk" data-id="' + id + '" aria-label="' + esc(T('Tafel') + ': ' + kaartNaam(id)) + '" style="width:62px;padding:0;border:0;background:none;cursor:' + (mag ? 'pointer' : 'default') + ';border-radius:8px;'
      + (mag && gekozen ? 'box-shadow:0 0 0 2px #c084fc,0 0 14px #c084fcb0;' : '') + '">' + kaartSvg(id) + '</button>').join('')
    const levensPillen = multi() ? pil(T('Jij') + ' ' + harten(s.levens[ik])) : pil(T('Jij') + ' ' + harten(s.levens[ik])) + pil(esc(naamVan(hij())) + ' ' + harten(s.levens[hij()]))
    middenEl.innerHTML = '<div class="eed-pillen" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:94vw">' + pil(T('Ronde {n}', { n: s.ronde }))
      + (hand(s).length ? pil(T('Jij: {n}', { n: P.toonPunten(mijn) }), mijn === P.DOEL ? '#86efac' : '') : '') + levensPillen
      + (s.geklopt && s.fase === 'spel' ? pil(s.geklopt === ik ? T('Klop!') : T('{naam} klopt!', { naam: esc(naamVan(s.geklopt)) }), '#fcd34d') : '') + '</div>'
      + '<div class="eed-tafel" style="display:flex;gap:8px;justify-content:center">' + kaarten + '</div>'
    for (const b of middenEl.querySelectorAll('.eed-tk')) b.onclick = () => tikTafel(b.dataset.id)
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); toonAfleg(false); return }
    toonAfleg(rondeOver(staat))
    tafel.toon(beeld(staat))
    tekenTegenstanders(staat)
    const mag = P.magRuilen(staat, ik)   // (de knoppen gaan weg tijdens een animatie: zie doe)
    tafel.knoppen([
      ...(mag ? [{ naam: 'alles', tekst: T('🔄 Alle 3 ruilen'), opKlik: allesRuilen }] : []),
      ...(mag ? [{ naam: 'pas', tekst: T('⏭️ Passen'), opKlik: passen }] : []),
      ...(mag && !staat.geklopt ? [{ naam: 'klop', tekst: T('✊ Kloppen'), nadruk: true, uit: !P.magKloppen(staat, ik), opKlik: kloppen }] : []),
      { naam: 'uitleg', tekst: '❓', opKlik: toonRegels },
    ])
    tekenInfo(staat)
    const klok = staat.fase !== 'spel' ? '' : staat.ronde + ':' + staat.beurten
    if (klok !== klokVoor) {
      klokVoor = klok
      tafel.beurtKlok(staat.fase !== 'spel' ? null : staat.aanZet === ik ? 'ik' : multi() ? 'zetel:' + staat.aanZet : 'ander', BEURT_SECONDEN)
    }
  }
  function toonRegels() {
    tafel.element.querySelector('.eed-regels')?.remove()
    const d = document.createElement('div'); d.className = 'kt-keuze eed-regels'
    d.innerHTML = '<div class="kt-keuzekaart" role="dialog" aria-modal="true" style="max-width:440px;text-align:left;max-height:80vh;overflow:auto">'
      + '<div style="font-weight:800;font-size:17px;margin-bottom:8px">' + esc(T('Spelregels van Eenendertigen')) + '</div>'
      + '<ul style="margin:0 0 12px;padding-left:18px;line-height:1.45;font-size:14px">' + REGELS.map(t => '<li>' + esc(T(t)) + '</li>').join('') + '</ul>'
      + '<button type="button" class="kt-knop kt-nadruk">' + esc(T('Terug')) + '</button></div>'
    d.querySelector('button').onclick = () => d.remove()
    tafel.element.appendChild(d)
  }

  // ── Jij speelt ──
  function doe(stap) {
    if (bezig || !spel || !P.magRuilen(staat, ik)) return
    tafel.wisSelectie()
    if (spel.doe(stap)) tafel.knoppen([])
  }
  function tikTafel(id) {
    if (bezig || !P.magRuilen(staat, ik)) return
    const h = tafel.selectie()[0]
    if (!h) { tafel.effect(T('Kies eerst een kaart uit je hand.'), { gloed: false, geluid: false }); return }
    doe({ soort: 'ruil', hand: h, tafel: id })
  }
  async function kiesTafelkaart(h) {
    if (bezig || !P.magRuilen(staat, ik)) return
    const id = await tafel.kiesUit(T('Met welke kaart van tafel ruilen?'), [
      ...staat.tafel.map(t => ({ html: '<span style="display:block;width:56px">' + kaartSvg(t) + '</span>', waarde: t, label: kaartNaam(t) })),
      { html: '✕', waarde: null, label: T('Terug') }])
    if (id) doe({ soort: 'ruil', hand: h, tafel: id })
  }
  const allesRuilen = () => doe({ soort: 'alles' })
  const kloppen = () => doe({ soort: 'klop' })
  const passen = () => doe({ soort: 'pas' })

  // ── Een nieuwe stand (van jezelf, de gastheer of de computer) ──
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    if (l.soort === 'deel' || !oud || oud.ronde !== nieuw.ronde) {
      tafel.sluitEinde()
      toonAfleg(false)
      tafel.toon(beeld(nieuw, { mijnBeurt: false, afleg: [], status: '' }))
      tekenTegenstanders(nieuw)
      await tafel.deelAnimatie({ mijnKaarten: hand(nieuw), anderAantal: multi() ? 0 : 3, open: null })
    } else if (l.soort === 'klop' && l.wie !== ik) {
      tafel.effect(T('{naam} klopt!', { naam: naamVan(l.wie) })); tafel.tril(30); await wacht(600)
    } else if (l.soort === 'klop') {
      tafel.effect(T('Klop!')); tafel.tril(30); await wacht(500)
    } else if (l.soort === 'pas') {
      tekenInfo(nieuw)
      tafel.effect(l.wie === ik ? T('Je past') : T('{naam} past', { naam: naamVan(l.wie) }), { gloed: false, geluid: false }); await wacht(450)
      if (l.nieuweTafel) {
        tafel.effect(T('Iedereen paste: 3 nieuwe kaarten op tafel'), { gloed: false })
        for (const b of middenEl.querySelectorAll('.eed-tk')) b.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 450 })
        await wacht(700)
      }
    } else if (l.wie === ik && (l.soort === 'ruil' || l.soort === 'alles')) {
      if (l.soort === 'alles') { tafel.effect('🔄', { gloed: false }); await wacht(400) }
    } else if (l.soort === 'ruil' || l.soort === 'alles') {
      tekenInfo(nieuw)
      tafel.effect(l.soort === 'alles' ? T('{naam} ruilt alles', { naam: naamVan(l.wie) }) : T('{naam} ruilt', { naam: naamVan(l.wie) }), { gloed: false, geluid: false })
      for (const b of middenEl.querySelectorAll('.eed-tk')) if (l.kaarten.includes(b.dataset.id)) b.animate([{ transform: 'translateY(-14px) scale(1.08)' }, { transform: 'none' }], { duration: 500 })
      await wacht(600)
    }
    if (nieuw.fase !== 'spel') await rondeUitslag(nieuw)
  }
  // Einde van een ronde: de kaarten van de ander (met z'n tweeën) of de punten bij iedereen, en wie een leven verliest
  async function rondeUitslag(s) {
    const sleutel = s.ronde + ':' + (spel ? 1 : 0) + ':' + JSON.stringify(s.uitslag && s.uitslag.verliezers)
    if (getoond.has(sleutel)) return
    getoond.add(sleutel)
    tafel.beurtKlok(null)
    toonAfleg(true)
    tafel.toon(beeld(s, { afleg: [], anderAantal: 0, mijnBeurt: false, speelbaar: [], status: '' }))
    tekenTegenstanders(s)
    if (!multi()) await tafel.anderSpeeltAnimatie(s.handen[hij()] || [])
    const u = s.uitslag
    if (u.reden === '31') { tafel.effect(T('31!')); await wacht(700) }
    const ikVerlies = u.verliezers.includes(ik), anderen_ = u.verliezers.filter(z => z !== ik)
    let tekst
    if (!multi()) tekst = ikVerlies && anderen_.length ? T('Jullie verliezen allebei een leven') : ikVerlies ? T('Jij verliest een leven') : anderen_.length ? T('{naam} verliest een leven', { naam: naamVan(anderen_[0]) }) : T('Niemand verliest een leven')
    else if (u.verliezers.length === 1) tekst = ikVerlies ? T('Jij verliest een leven') : T('{naam} verliest een leven', { naam: naamVan(u.verliezers[0]) })
    else tekst = u.verliezers.length ? T('{namen} verliezen een leven', { namen: u.verliezers.map(naamVan).join(', ') }) : T('Niemand verliest een leven')
    tafel.effect(tekst, { gloed: !ikVerlies })
    if (ikVerlies) { meldGeslagen('ik', 1, { geluid: false }); tafel.tril([40, 60, 40]) } else if (anderen_.length && !multi()) meldGeslagen('ander', 1, { geluid: false })
    await wacht(900)
    for (const z of (u.eruit || []).filter(z => z !== ik)) { tafel.effect(T('{naam} ligt eruit', { naam: naamVan(z) }), { gloed: false }); await wacht(700) }
  }
  function controleerEinde() {
    if (!staat || staat.fase !== 'klaar') return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(staat)) { geteld.add(staat); if (staat.winnaar) score[staat.winnaar] = (score[staat.winnaar] || 0) + 1 }
    const u = staat.uitslag, p = z => (u.punten[z] !== undefined ? P.toonPunten(u.punten[z]) : '-')
    const sub = multi()
      ? P.zetels(staat).map(z => naamVan(z) + ' ' + (score[z] || 0)).join(' · ')
      : T('Jij {a} · {naam} {b}', { a: p(ik), b: p(hij()), naam: naamVan(hij()) }) + '  ·  ' + T('Stand: jij {a} - {b} {naam}', { a: score[ik] || 0, b: score[hij()] || 0, naam: naamVan(hij()) })
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint!') : staat.winnaar ? T('😢 {naam} wint!', { naam: naamVan(staat.winnaar) }) : T('🤝 Allebei af: gelijkspel!'),
      sub, opnieuw: spel && spel.gastheer ? nieuwSpelStarten : null })
  }
  function naStand(oud) {
    teken()
    if (staat.fase === 'klaar') controleerEinde()
    else if (staat.fase === 'spel' && staat.aanZet === ik && (!oud || oud.aanZet !== ik || oud.ronde !== staat.ronde)) { tafel.geluid.beurt(); tafel.tril(15) }
  }

  spelKanaal.on('broadcast', { event: 'kaartreactie' }, msg => {
    const e = msg.payload && msg.payload.emoji, z = Number(msg.payload && msg.payload.zetel)
    if (REACTIES.includes(e)) tafel.reactie(e, multi() && z ? 'zetel:' + z : 'ander')
  })

  function nieuwSpelStarten() {
    if (!spel || !spel.gastheer) return
    const begint = staat ? (staat.begint % spelers.length) + 1 : 1   // wie begint, schuift één plek op
    spel.start(P.nieuwSpel({ begint, spelers: spelers.length }))
  }
  function begin() {
    spel = maakGroepSpel({ kanaal: spelKanaal, zetel: ik, spelers, niveau, beurtMs: BEURT_SECONDEN * 1000, rondePauze: VOLGENDE_MS,
      regels: { aanZet: s => (s && s.fase === 'spel' ? s.aanZet : 0), doeStap: P.doeStap, computerStap: P.computerStap, geldigeStand: P.geldigeStand,
        volgendeRonde: s => (s && s.fase === 'uitslag' ? P.volgendeRonde(s) : null) },
      onStand: (oud, nieuw) => { staat = nieuw; inRij(async () => { await verwerk(oud, nieuw); naStand(oud) }) },
      // de gastheer ging weg: het spel stopt (er is niemand meer die de stand heeft)
      onGastheerWeg: () => { tafel.beurtKlok(null); tafel.knoppen([]); tafel.einde({ gewonnen: false, titel: T('Het spel is gestopt.'), sub: T('{naam} heeft het spel verlaten.', { naam: naamVan(1) }) }) } })
    // weg: het spel is dicht (de overlay sloot)
    const weg = setInterval(() => { if (!tafel.element.isConnected) { clearInterval(weg); spel.stop() } }, 1000)
    teken()
    if (spel.gastheer) nieuwSpelStarten()
  }
  if (spelers) begin()
  else {
    // tegen de computer: eerst kiezen met hoeveel computers
    tafel.status('')
    tafel.kiesUit(T('Tegen hoeveel computers wil je spelen?'), [1, 2, 3, 4, 5].map(n => ({ html: String(n), waarde: n, label: String(n) }))).then(n => {
      spelers = [{ zetel: 1, naam: T('Jij') }, ...Array.from({ length: n }, (_, i) => ({ zetel: i + 2, naam: n === 1 ? T('Computer') : T('Computer {n}', { n: i + 1 }), computer: true }))]
      tafel.tegenstanders(null)
      begin()
    })
  }
}
