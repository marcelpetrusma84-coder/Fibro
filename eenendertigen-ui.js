// eenendertigen-ui.js - Eenendertigen, een kaartspel uit Stekky Studio (v1, 25 nov 2026; spellen/eenendertigen.md).
//
// In gewone woorden: de regels staan in eenendertigen.js, de tafel in kaartspel-hulp.js (BLAUWDRUK-KAARTSPEL.md).
// Midden op tafel liggen 3 open kaarten. Kies een kaart uit je hand (tik) en tik op een kaart op tafel om te ruilen;
// of veeg je kaart omhoog en kies dan met welke tafelkaart. Knoppen: "Alle 3 ruilen", "Kloppen" en ❓ (de regels).
// Boven de tafel: je punten en de levens. Na een ronde zie je de kaarten van de ander; speler 1 deelt dan vanzelf de
// volgende ronde. Over het spelkanaal precies zoals Black Jack: 'zet', 'vraag-stand'/'stand', 'opnieuw', 'kaartreactie'.
import * as P from './eenendertigen.js?v=1'
import { maakKaartTafel, kaartSvg, kaartNaam, REACTIES } from './kaartspel-hulp.js?v=18'
import { meldGeslagen } from './beurtspel-hulp.js?v=1'

const T = (s, v) => (window.T || ((x, w) => String(x).replace(/\{(\w+)\}/g, (m, k) => (w && k in w) ? w[k] : m)))(s, v)
Object.assign(window.FIBRO_EN ||= {}, {
  'Kies een kaart uit je hand en tik op een kaart op tafel om te ruilen. Of: alle 3 ruilen.': 'Choose a card from your hand and tap a card on the table to swap. Or: swap all 3.',
  'Kies een kaart uit je hand en tik op een kaart op tafel. Of klop als je genoeg hebt.': 'Choose a card from your hand and tap a card on the table. Or knock if you have enough.',
  '{naam} klopte: je mag nog één keer ruilen.': '{naam} knocked: you may swap one more time.',
  'Je klopte. Nu mag {naam} nog één keer.': 'You knocked. Now {naam} gets one more turn.',
  '🔄 Alle 3 ruilen': '🔄 Swap all 3', '✊ Kloppen': '✊ Knock', 'Met welke kaart van tafel ruilen?': 'Swap with which card on the table?',
  'Kies eerst een kaart uit je hand.': 'Choose a card from your hand first.', 'Jij: {n}': 'You: {n}', 'Klop!': 'Knock!', '{naam} klopt!': '{naam} knocks!',
  '{naam} ruilt': '{naam} swaps', '{naam} ruilt alles': '{naam} swaps all', '31!': '31!',
  'Jullie verliezen allebei een leven': 'You both lose a life', 'Jij verliest een leven': 'You lose a life', '{naam} verliest een leven': '{naam} loses a life',
  'Niemand verliest een leven': 'Nobody loses a life', 'Jij {a} · {naam} {b}': 'You {a} · {naam} {b}', 'De volgende ronde wordt gedeeld...': 'Dealing the next round...',
  'Wachten tot {naam} de volgende ronde deelt...': 'Waiting for {naam} to deal the next round...', '🤝 Allebei af: gelijkspel!': '🤝 Both out: a draw!',
  'Ronde {n}': 'Round {n}', 'Tafel': 'Table', 'Terug': 'Back',
  'Spelregels van Eenendertigen': 'Rules of Thirty-One',
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
  'Je punten tel je alleen op bij kaarten van dezelfde kleur: aas is 11, heer, vrouw en boer zijn 10, de andere kaarten hun eigen waarde. Je beste kleur telt. Het hoogste is 31.',
  'Drie kaarten met dezelfde waarde (bijvoorbeeld drie vrouwen) zijn 30½ waard.',
  'Klop je, dan mag de ander nog één keer ruilen. Daarna laten jullie je kaarten zien.',
  'Heb je precies 31, dan laat je meteen je kaarten zien en win je de ronde.',
  'Wie de minste punten heeft, verliest een leven. Hebben jullie evenveel, dan verliezen jullie allebei een leven. Ook wie klopte verliest maar één leven.',
  'Iedereen begint met 3 levens. Wie geen levens meer heeft, heeft verloren.']

export function start({ spelKanaal, benIkSpeler1, vriendNaam }) {
  const inhoud = document.getElementById('spelInhoud')
  const titel = document.getElementById('spelTitelBar')
  if (titel) titel.textContent = '🎲 ' + T('Eenendertigen')
  const ik = benIkSpeler1 ? 1 : 2, hij = ik === 1 ? 2 : 1
  const solo = Boolean(spelKanaal && spelKanaal.isSolo)
  const naam = solo ? T('Computer') : (vriendNaam || T('vriend'))
  const naamHtml = esc(naam)

  let staat = null, spelId = -1, nr = 0
  let bezig = 0
  let rij = Promise.resolve()
  const score = { [ik]: 0, [hij]: 0 }
  const geteld = new Set(), getoond = new Set()
  let klokVoor = '', volgendeTimer = null

  const stuur = (event, payload) => { try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
  const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)
  const inRij = fn => { rij = rij.then(async () => { bezig++; try { await fn() } finally { bezig-- } }).catch(e => console.error('[eenendertigen]', e)); return rij }

  const tafel = maakKaartTafel(inhoud, {
    solo, naamAnder: naam,
    groep: id => id,                                    // je kiest één kaart tegelijk
    magSpelen: ids => !bezig && ids.length === 1 && P.magRuilen(staat, ik),
    onSpeel: ids => kiesTafelkaart(ids[0]),             // vegen of dubbeltik: met welke kaart van tafel?
    onPak() {},
    onSelectie: () => tekenInfo(),
    onReactie: emoji => { if (!solo) stuur('kaartreactie', { emoji }) },
  })

  // De 3 tafelkaarten en de pilletjes in een eigen vak midden op tafel (het info-vak van de tafel laat geen tikken door);
  // de stapel staat er niet (die gebruik je in dit spel niet)
  const middenEl = document.createElement('div')
  middenEl.className = 'eed-midden'
  middenEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2'
  tafel.element.querySelector('.kt-midden').appendChild(middenEl)
  for (const e of tafel.element.querySelectorAll('.kt-stapel-groep, .kt-stapel')) e.style.display = 'none'
  // de aflegstapel alleen als de ronde klaar is (daar komen de kaarten van de ander); anders staat de tafel scheef
  const aflegEl = tafel.element.querySelector('.kt-afleg')
  const toonAfleg = aan => { if (aflegEl) aflegEl.style.display = aan ? '' : 'none' }

  // ── Wat de tafel laat zien ──
  const rondeOver = s => s && s.fase !== 'spel'
  function statusTekst(s) {
    if (!s) return T('De kaarten worden geschud...')
    if (s.fase === 'uitslag') return ik === 1 ? T('De volgende ronde wordt gedeeld...') : T('Wachten tot {naam} de volgende ronde deelt...', { naam })
    if (s.fase === 'klaar') return ''
    if (s.aanZet !== ik) return s.geklopt === ik ? T('Je klopte. Nu mag {naam} nog één keer.', { naam }) : solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam })
    if (s.geklopt === hij) return T('{naam} klopte: je mag nog één keer ruilen.', { naam })
    return P.magKloppen(s, ik) ? T('Kies een kaart uit je hand en tik op een kaart op tafel. Of klop als je genoeg hebt.') : T('Kies een kaart uit je hand en tik op een kaart op tafel om te ruilen. Of: alle 3 ruilen.')
  }
  function beeld(s, extra = {}) {
    const mag = P.magRuilen(s, ik)
    return { hand: s.handen[ik], anderAantal: rondeOver(s) ? 0 : 3, stapelAantal: s.stapel.length, afleg: rondeOver(s) ? s.handen[hij] : [],
      mijnBeurt: mag, speelbaar: mag ? s.handen[ik] : [], status: statusTekst(s), ...extra }
  }
  const harten = n => '❤️'.repeat(n) + '🤍'.repeat(P.LEVENS - n)
  // Midden: de 3 tafelkaarten (tikbaar), en de pilletjes met je punten en de levens
  function tekenInfo(s = staat) {
    if (!s) { middenEl.innerHTML = ''; return }
    const pil = (t, k) => '<span style="padding:3px 10px;border-radius:999px;background:#000a;border:1px solid #c084fc;font-weight:800;font-size:14px;white-space:nowrap' + (k ? ';color:' + k : '') + '">' + t + '</span>'
    const mijn = P.punten(s.handen[ik])
    const gekozen = tafel.selectie()[0]
    const mag = P.magRuilen(s, ik)
    const kaarten = s.tafel.map(id => '<button type="button" class="eed-tk" data-id="' + id + '" aria-label="' + esc(T('Tafel') + ': ' + kaartNaam(id)) + '" style="width:62px;padding:0;border:0;background:none;cursor:' + (mag ? 'pointer' : 'default') + ';border-radius:8px;'
      + (mag && gekozen ? 'box-shadow:0 0 0 2px #c084fc,0 0 14px #c084fcb0;' : '') + '">' + kaartSvg(id) + '</button>').join('')
    middenEl.innerHTML = '<div class="eed-pillen" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:94vw">' + pil(T('Ronde {n}', { n: s.ronde })) + pil(T('Jij: {n}', { n: P.toonPunten(mijn) }), mijn === P.DOEL ? '#86efac' : '')
      + pil(T('Jij') + ' ' + harten(s.levens[ik])) + pil(naamHtml + ' ' + harten(s.levens[hij])) + (s.geklopt && s.fase === 'spel' ? pil(s.geklopt === ik ? T('Klop!') : T('{naam} klopt!', { naam: naamHtml }), '#fcd34d') : '') + '</div>'
      + '<div class="eed-tafel" style="display:flex;gap:8px;justify-content:center">' + kaarten + '</div>'
    for (const b of middenEl.querySelectorAll('.eed-tk')) b.onclick = () => tikTafel(b.dataset.id)
  }
  function teken() {
    if (!staat) { tafel.status(statusTekst(null)); toonAfleg(false); return }
    toonAfleg(rondeOver(staat))
    tafel.toon(beeld(staat))
    const mag = P.magRuilen(staat, ik)   // (de knoppen gaan weg tijdens een animatie: zie zet)
    tafel.knoppen([
      ...(mag ? [{ naam: 'alles', tekst: T('🔄 Alle 3 ruilen'), opKlik: allesRuilen }] : []),
      ...(mag && !staat.geklopt ? [{ naam: 'klop', tekst: T('✊ Kloppen'), nadruk: true, uit: !P.magKloppen(staat, ik), opKlik: kloppen }] : []),
      { naam: 'uitleg', tekst: '❓', opKlik: toonRegels },
    ])
    tekenInfo(staat)
    const klok = staat.fase !== 'spel' ? '' : spelId + ':' + staat.ronde + ':' + staat.beurten
    if (klok !== klokVoor) { klokVoor = klok; tafel.beurtKlok(staat.fase !== 'spel' ? null : (staat.aanZet === ik ? 'ik' : 'ander'), BEURT_SECONDEN) }
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
  function tikTafel(id) {
    if (bezig || !P.magRuilen(staat, ik)) return
    const h = tafel.selectie()[0]
    if (!h) { tafel.effect(T('Kies eerst een kaart uit je hand.'), { gloed: false, geluid: false }); return }
    ruilMet(h, id)
  }
  async function kiesTafelkaart(h) {
    if (bezig || !P.magRuilen(staat, ik)) return
    const id = await tafel.kiesUit(T('Met welke kaart van tafel ruilen?'), [
      ...staat.tafel.map(t => ({ html: '<span style="display:block;width:56px">' + kaartSvg(t) + '</span>', waarde: t, label: kaartNaam(t) })),
      { html: '✕', waarde: null, label: T('Terug') }])
    if (id) ruilMet(h, id)
  }
  function ruilMet(h, t) {
    const n = P.ruil(staat, ik, h, t)
    if (!n) return
    tafel.wisSelectie()
    zet(n, async () => { tafel.geluid.tik?.(); if (n.fase !== 'spel') await rondeUitslag(n) })
  }
  function allesRuilen() {
    if (bezig) return
    const n = P.ruilAlles(staat, ik)
    if (n) { tafel.wisSelectie(); zet(n, async () => { tafel.effect('🔄', { gloed: false }); await wacht(400); if (n.fase !== 'spel') await rondeUitslag(n) }) }
  }
  function kloppen() {
    if (bezig) return
    const n = P.klop(staat, ik)
    if (n) { tafel.wisSelectie(); zet(n, async () => { tafel.effect(T('Klop!')); tafel.tril(30); await wacht(500) }) }
  }

  // ── Einde van een ronde: de kaarten van de ander, en wie een leven verliest ──
  async function rondeUitslag(s) {
    const sleutel = spelId + ':' + s.ronde
    if (getoond.has(sleutel)) return
    getoond.add(sleutel)
    tafel.beurtKlok(null)
    toonAfleg(true)
    tafel.toon(beeld(s, { afleg: [], anderAantal: 0, mijnBeurt: false, speelbaar: [], status: '' }))
    await tafel.anderSpeeltAnimatie(s.handen[hij])
    const u = s.uitslag
    if (u.reden === '31') { tafel.effect(T('31!')); await wacht(700) }
    const ikVerlies = u.verliezers.includes(ik), hijVerliest = u.verliezers.includes(hij)
    tafel.effect(ikVerlies && hijVerliest ? T('Jullie verliezen allebei een leven') : ikVerlies ? T('Jij verliest een leven') : hijVerliest ? T('{naam} verliest een leven', { naam }) : T('Niemand verliest een leven'), { gloed: !ikVerlies })
    if (ikVerlies) { meldGeslagen('ik', 1, { geluid: false }); tafel.tril([40, 60, 40]) } else if (hijVerliest) meldGeslagen('ander', 1, { geluid: false })
    await wacht(900)
  }
  function controleerEinde() {
    if (!staat) return
    clearTimeout(volgendeTimer)
    if (staat.fase === 'uitslag') {
      // speler 1 deelt de volgende ronde (tegen de computer ben jij dat altijd)
      if (ik === 1) volgendeTimer = setTimeout(() => {
        if (!staat || staat.fase !== 'uitslag' || !tafel.element.isConnected) return
        const n = P.volgendeRonde(staat)
        if (n) zet(n, async () => { toonAfleg(false); tafel.toon(beeld(n, { mijnBeurt: false })); await tafel.deelAnimatie({ mijnKaarten: n.handen[ik], anderAantal: 3, open: null }); if (n.fase !== 'spel') await rondeUitslag(n) })
      }, VOLGENDE_MS)
      return
    }
    if (staat.fase !== 'klaar') return
    const gewonnen = staat.winnaar === ik
    if (!geteld.has(spelId)) { geteld.add(spelId); if (staat.winnaar) score[staat.winnaar]++ }
    const u = staat.uitslag
    tafel.einde({ gewonnen,
      titel: gewonnen ? T('🎉 Jij wint!') : staat.winnaar ? T('😢 {naam} wint!', { naam }) : T('🤝 Allebei af: gelijkspel!'),
      sub: T('Jij {a} · {naam} {b}', { a: P.toonPunten(u.punten[ik]), b: P.toonPunten(u.punten[hij]), naam }) + '  ·  ' + T('Stand: jij {a} - {b} {naam}', { a: score[ik], b: score[hij], naam }),
      opnieuw: nieuwSpelStarten })
  }
  function naZet(oud) {
    teken()
    if (staat.fase !== 'spel') controleerEinde()
    else if (staat.aanZet === ik && (!oud || oud.aanZet !== ik || oud.ronde !== staat.ronde)) { tafel.geluid.beurt(); tafel.tril(15) }
  }
  function zet(nieuw, animatie) {
    const oud = staat
    staat = nieuw; nr++
    stuur('zet', { staat, nr, spelId })
    tafel.knoppen([])
    inRij(async () => { if (animatie) await animatie(); naZet(oud) })
  }

  // ── Een stand van de ander ──
  async function verwerk(oud, nieuw) {
    const l = nieuw.laatste || {}
    if (l.soort === 'deel' || !oud || oud.ronde !== nieuw.ronde) {
      tafel.sluitEinde()
      toonAfleg(false)
      tafel.toon(beeld(nieuw, { mijnBeurt: false, afleg: [], anderAantal: 3, status: '' }))
      await tafel.deelAnimatie({ mijnKaarten: nieuw.handen[ik], anderAantal: 3, open: null })
    } else if (l.wie === hij && l.soort === 'klop') {
      tafel.effect(T('{naam} klopt!', { naam })); tafel.tril(30); await wacht(600)
    } else if (l.wie === hij && (l.soort === 'ruil' || l.soort === 'alles')) {
      tekenInfo(nieuw)
      tafel.effect(l.soort === 'alles' ? T('{naam} ruilt alles', { naam }) : T('{naam} ruilt', { naam }), { gloed: false, geluid: false })
      for (const b of tafel.element.querySelectorAll('.eed-tk')) if (l.kaarten.includes(b.dataset.id)) b.animate([{ transform: 'translateY(-14px) scale(1.08)' }, { transform: 'none' }], { duration: 500 })
      await wacht(600)
    }
    if (nieuw.fase !== 'spel') await rondeUitslag(nieuw)
  }
  function ontvang(p, alsNieuwSpel) {
    if (!p || !P.geldigeStand(p.staat)) return
    const id = p.spelId ?? spelId, n = p.nr ?? 0
    if (!(alsNieuwSpel ? id > spelId : nieuwer(id, n))) return
    const oud = id === spelId ? staat : null
    spelId = id; nr = n; staat = p.staat
    inRij(async () => { await verwerk(oud, p.staat); naZet(oud) })
  }

  spelKanaal.on('broadcast', { event: 'zet' }, msg => ontvang(msg.payload, false))
  spelKanaal.on('broadcast', { event: 'stand' }, msg => ontvang(msg.payload, false))
  spelKanaal.on('broadcast', { event: 'opnieuw' }, msg => ontvang(msg.payload, true))
  spelKanaal.on('broadcast', { event: 'vraag-stand' }, msg => {
    const p = msg.payload || {}
    if (staat && (spelId > (p.spelId ?? -1) || (spelId === (p.spelId ?? -1) && nr > (p.nr ?? 0)))) stuur('stand', { staat, nr, spelId })
  })
  spelKanaal.on('broadcast', { event: 'kaartreactie' }, msg => {
    const e = msg.payload && msg.payload.emoji
    if (REACTIES.includes(e)) tafel.reactie(e, 'ander')
  })

  function nieuwSpelStarten() {
    const begint = staat ? (staat.begint === 1 ? 2 : 1) : 1
    const id = Math.max(Date.now(), spelId + 1)
    const nieuw = P.nieuwSpel({ begint })
    spelId = id; nr = 0; staat = nieuw
    stuur('opnieuw', { staat, nr, spelId })
    inRij(async () => { await verwerk(null, nieuw); naZet(null) })
  }

  const timer = setInterval(() => {
    if (!tafel.element.isConnected) { clearInterval(timer); clearTimeout(volgendeTimer); return }
    if (!staat || (staat.fase === 'spel' && staat.aanZet !== ik) || (staat.fase === 'uitslag' && ik === 2)) stuur('vraag-stand', { spelId, nr })
  }, 3000)

  teken()
  if (ik === 1) nieuwSpelStarten()
  else stuur('vraag-stand', { spelId, nr })
}
