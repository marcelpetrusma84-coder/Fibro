// quiz.js (v1, Fibro v265, 4 november 2026) - de quiz-widget.
// Je maakt zelf een quiz (tot 50 meerkeuzevragen) als widget op je profiel. Vrienden spelen hem op je profiel,
// beeldvullend, met de geluiden van de stickers en (als je dat wilt) de stickers 'Yes!' en 'Nee!' bij goed of fout.
// Twee manieren: meteen zien of het goed is, of pas aan het eind je score (met een overzicht van je fouten).
// De achtergrond van de quiz is de achtergrondfoto van de widget (🖼-knop op Home, zoals bij de poll).
//
// Opslag: localStorage 'quiz_<uid>' (JSON). Vrienden krijgen hem via sync.js ('klein:quiz'), net als de poll;
// de achtergrond als 'widgetbg_quiz'. Er gaat niets naar de server: de scores blijven op het toestel van de speler.
//
// Gebruik:
//   tekenQuizWidget(el, { quiz, eigen, achtergrond, bewerk })   de kaart in de widget
//   openMaker(quiz, opslaan)                                     het maak-scherm (beeldvullend)
//   speelQuiz(quiz, { achtergrond })                             spelen (beeldvullend)
import { zoekSticker } from './stickervellen.js?v=236'
import { speel, speelGeluid } from './stickerfx.js?v=235'

Object.assign(window.FIBRO_EN ||= {}, {
  'Quiz': 'Quiz', 'Nog geen quiz': 'No quiz yet', '✏️ Maak een quiz': '✏️ Make a quiz', '✏️ Bewerken': '✏️ Edit',
  '▶ Spelen': '▶ Play', '{n} vragen': '{n} questions', '1 vraag': '1 question',
  'Quiz maken': 'Make a quiz', 'Titel van je quiz': 'Title of your quiz', 'Vraag {n}': 'Question {n}',
  'Typ je vraag': 'Type your question', 'Antwoord {n}': 'Answer {n}', 'Antwoord {n} (mag leeg)': 'Answer {n} (optional)',
  'Tik op het rondje bij het goede antwoord.': 'Tap the circle next to the right answer.',
  '+ Vraag erbij': '+ Add question', '🗑 Weg': '🗑 Remove', 'Opslaan ✓': 'Save ✓', 'Annuleren': 'Cancel',
  'Meteen zien of het goed is': 'See right away if it is right', 'Pas aan het eind de score': 'Only the score at the end',
  'Yes!- en Nee!-sticker': 'Yes! and No! sticker', 'Geluid': 'Sound',
  'De achtergrond kies je met de 🖼-knop op de widget.': 'Choose the background with the 🖼 button on the widget.',
  'Geef je quiz een titel.': 'Give your quiz a title.', 'Maak minstens één vraag.': 'Make at least one question.',
  'Vraag {n}: typ een vraag.': 'Question {n}: type a question.',
  'Vraag {n}: vul minstens twee antwoorden in.': 'Question {n}: fill in at least two answers.',
  'Vraag {n}: kies het goede antwoord.': 'Question {n}: choose the right answer.',
  'Maximaal {n} vragen.': 'At most {n} questions.',
  'Vraag {nu} van {totaal}': 'Question {nu} of {totaal}', 'Sluiten': 'Close', 'Opnieuw': 'Again',
  'Goed!': 'Right!', 'Fout': 'Wrong', 'Het goede antwoord: {a}': 'The right answer: {a}',
  '{goed} van {totaal} goed': '{goed} out of {totaal} right', 'Jouw fouten': 'Your mistakes',
  'Alles goed! 🎉': 'All right! 🎉', 'Jij: {a}': 'You: {a}', 'Goed: {a}': 'Right: {a}', 'Volgende ›': 'Next ›',
  'Quiz stoppen?': 'Stop the quiz?',
})
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const MAX_VRAGEN = 50
export const MAX_ANTWOORDEN = 4
const MAX_VRAAG = 150, MAX_ANTWOORD = 60, MAX_TITEL = 60
const YES = 'f3-11', NEE = 'f5-06' // de stickers 'Yes!' en 'Nee!' (stickervellen.js)

const tekst = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)

// Een quiz uit opslag of van een vriend: altijd netjes en binnen de grenzen. Kapot = null.
export function normaliseer(q) {
  if (!q || typeof q !== 'object' || !Array.isArray(q.vragen)) return null
  const vragen = []
  for (const r of q.vragen.slice(0, MAX_VRAGEN)) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.a)) continue
    const v = tekst(r.v, MAX_VRAAG)
    const goedTekst = tekst(r.a[r.g], MAX_ANTWOORD)
    const a = r.a.slice(0, MAX_ANTWOORDEN).map(x => tekst(x, MAX_ANTWOORD)).filter(Boolean)
    const g = a.indexOf(goedTekst)
    if (!v || a.length < 2 || !goedTekst || g < 0) continue
    vragen.push({ v, a, g })
  }
  if (!vragen.length) return null
  return {
    id: tekst(q.id, 24) || maakId(),
    titel: tekst(q.titel, MAX_TITEL) || T('Quiz'),
    vragen,
    direct: q.direct !== false,
    stickers: q.stickers !== false,
    geluid: q.geluid !== false,
  }
}
function maakId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

// Controle bij opslaan in het maak-scherm: de eerste fout als tekst, of null als alles klopt.
export function controleer(concept) {
  if (!tekst(concept.titel, MAX_TITEL)) return T('Geef je quiz een titel.')
  if (!concept.vragen.length) return T('Maak minstens één vraag.')
  if (concept.vragen.length > MAX_VRAGEN) return T('Maximaal {n} vragen.', { n: MAX_VRAGEN })
  for (let i = 0; i < concept.vragen.length; i++) {
    const r = concept.vragen[i], n = i + 1
    if (!tekst(r.v, MAX_VRAAG)) return T('Vraag {n}: typ een vraag.', { n })
    if (r.a.filter(x => tekst(x, MAX_ANTWOORD)).length < 2) return T('Vraag {n}: vul minstens twee antwoorden in.', { n })
    if (!(r.g >= 0) || !tekst(r.a[r.g], MAX_ANTWOORD)) return T('Vraag {n}: kies het goede antwoord.', { n })
  }
  return null
}

// Score en fouten na het spelen (antwoorden = gekozen index per vraag)
export function uitslag(quiz, antwoorden) {
  let goed = 0
  const fouten = []
  quiz.vragen.forEach((r, i) => {
    if (antwoorden[i] === r.g) goed++
    else fouten.push({ v: r.v, jij: antwoorden[i] == null ? '—' : r.a[antwoorden[i]], goed: r.a[r.g] })
  })
  return { goed, totaal: quiz.vragen.length, fouten }
}

// ── kleine hulpjes voor de schermen ──
function el(tag, stijl, inhoud) {
  const e = document.createElement(tag)
  if (stijl) e.style.cssText = stijl
  if (inhoud != null) e.textContent = inhoud
  return e
}
const KNOP = 'border:none;border-radius:12px;padding:12px 16px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit'
const HOOFDKNOP = KNOP + ';background:linear-gradient(135deg,var(--accent,#c084fc),var(--accent2,#60a5fa));color:#1a0a2e'
const GRIJSKNOP = KNOP + ';background:rgba(255,255,255,0.12);color:#fff'
const VELD = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:10px 12px;color:#fff;font-size:15px;font-family:inherit;outline:none'

function scherm(achtergrond) {
  const s = el('div', 'position:fixed;inset:0;z-index:10050;display:flex;flex-direction:column;color:#fff;' +
    'background:#14081f;overflow:hidden;font-family:inherit;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)')
  s.setAttribute('role', 'dialog')
  if (achtergrond) {
    s.style.backgroundImage = 'linear-gradient(rgba(10,4,20,0.62),rgba(10,4,20,0.78)),url(' + achtergrond + ')'
    s.style.backgroundSize = 'cover'
    s.style.backgroundPosition = 'center'
  }
  document.body.appendChild(s)
  const oudeOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  s._sluit = () => { s.remove(); document.body.style.overflow = oudeOverflow; try { if (document.fullscreenElement) document.exitFullscreen() } catch (e) {} }
  return s
}

// ── De kaart in de widget ──
export function tekenQuizWidget(c, { quiz, eigen = false, achtergrond = null, bewerk = null } = {}) {
  const q = normaliseer(quiz)
  c.querySelectorAll('.quizkaart').forEach(x => x.remove())
  const kaart = el('div', 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;text-align:center;position:relative')
  kaart.className = 'quizkaart'
  if (!q) {
    kaart.appendChild(el('div', 'font-size:30px', '🧠'))
    kaart.appendChild(el('div', 'font-size:13px;color:rgba(255,255,255,0.75)', T('Nog geen quiz')))
    if (eigen && bewerk) {
      const k = el('button', HOOFDKNOP + ';padding:8px 14px;font-size:13px', T('✏️ Maak een quiz'))
      k.onclick = e => { e.stopPropagation(); bewerk() }
      kaart.appendChild(k)
    }
    c.appendChild(kaart)
    return
  }
  kaart.appendChild(el('div', 'font-size:16px;font-weight:700;line-height:1.25;word-break:break-word', q.titel))
  kaart.appendChild(el('div', 'font-size:12px;color:rgba(255,255,255,0.75)', q.vragen.length === 1 ? T('1 vraag') : T('{n} vragen', { n: q.vragen.length })))
  const rij = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center')
  const speelKnop = el('button', HOOFDKNOP + ';padding:8px 16px;font-size:14px', T('▶ Spelen'))
  speelKnop.onclick = async e => {
    e.stopPropagation()
    let bg = achtergrond
    try { if (typeof achtergrond === 'function') bg = await achtergrond() } catch (x) { bg = null }
    speelQuiz(q, { achtergrond: bg })
  }
  rij.appendChild(speelKnop)
  if (eigen && bewerk) {
    const b = el('button', GRIJSKNOP + ';padding:8px 12px;font-size:13px', T('✏️ Bewerken'))
    b.onclick = e => { e.stopPropagation(); bewerk() }
    rij.appendChild(b)
  }
  kaart.appendChild(rij)
  c.appendChild(kaart)
}

// ── Het maak-scherm ──
export function openMaker(quiz, opslaan) {
  const bestaand = normaliseer(quiz)
  const concept = bestaand
    ? { ...bestaand, vragen: bestaand.vragen.map(r => ({ v: r.v, a: [...r.a, '', '', ''].slice(0, MAX_ANTWOORDEN), g: r.g })) }
    : { id: maakId(), titel: '', vragen: [], direct: true, stickers: true, geluid: true }
  if (!concept.vragen.length) concept.vragen.push({ v: '', a: ['', '', '', ''], g: 0 })

  const s = scherm(null)
  s.classList.add('quiz-maker')
  const kop = el('div', 'display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.1)')
  kop.appendChild(el('div', 'flex:1;font-size:18px;font-weight:700', T('Quiz maken')))
  const sluit = el('button', GRIJSKNOP + ';padding:8px 12px', '✕')
  sluit.setAttribute('aria-label', T('Annuleren'))
  sluit.onclick = () => s._sluit()
  kop.appendChild(sluit)
  s.appendChild(kop)

  const lijf = el('div', 'flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;max-width:640px;width:100%;margin:0 auto;box-sizing:border-box')
  s.appendChild(lijf)

  const titel = el('input', VELD + ';font-size:17px;font-weight:600')
  titel.placeholder = T('Titel van je quiz'); titel.maxLength = MAX_TITEL; titel.value = concept.titel
  titel.oninput = () => { concept.titel = titel.value }
  lijf.appendChild(titel)

  // instellingen
  const opties = el('div', 'display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.05);border-radius:12px;padding:12px')
  const keuze = (label, aan, zet, naam) => {
    const l = el('label', 'display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer')
    const i = el('input'); i.type = naam ? 'radio' : 'checkbox'; if (naam) i.name = naam
    i.checked = aan; i.onchange = () => zet(i.checked)
    i.style.cssText = 'width:20px;height:20px;accent-color:#c084fc'
    l.append(i, document.createTextNode(label))
    return l
  }
  opties.append(
    keuze(T('Meteen zien of het goed is'), concept.direct, v => { if (v) concept.direct = true }, 'quizmodus'),
    keuze(T('Pas aan het eind de score'), !concept.direct, v => { if (v) concept.direct = false }, 'quizmodus'),
    keuze(T('Yes!- en Nee!-sticker'), concept.stickers, v => { concept.stickers = v }),
    keuze(T('Geluid'), concept.geluid, v => { concept.geluid = v }),
    el('div', 'font-size:12px;color:rgba(255,255,255,0.6)', T('De achtergrond kies je met de 🖼-knop op de widget.'))
  )
  lijf.appendChild(opties)

  const vragenVak = el('div', 'display:flex;flex-direction:column;gap:14px')
  lijf.appendChild(vragenVak)
  const plus = el('button', GRIJSKNOP, T('+ Vraag erbij'))
  lijf.appendChild(plus)
  const melding = el('div', 'font-size:14px;color:#fca5a5;min-height:1em')
  lijf.appendChild(melding)

  function tekenVragen() {
    vragenVak.textContent = ''
    concept.vragen.forEach((r, i) => {
      const blok = el('div', 'display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,0.05);border-radius:12px;padding:12px')
      blok.className = 'quiz-vraagblok'
      const kopje = el('div', 'display:flex;align-items:center;justify-content:space-between')
      kopje.appendChild(el('div', 'font-weight:700;font-size:14px', T('Vraag {n}', { n: i + 1 })))
      if (concept.vragen.length > 1) {
        const weg = el('button', GRIJSKNOP + ';padding:6px 10px;font-size:12px', T('🗑 Weg'))
        weg.onclick = () => { concept.vragen.splice(i, 1); tekenVragen() }
        kopje.appendChild(weg)
      }
      blok.appendChild(kopje)
      const v = el('textarea', VELD + ';min-height:54px;resize:vertical')
      v.placeholder = T('Typ je vraag'); v.maxLength = MAX_VRAAG; v.value = r.v
      v.oninput = () => { r.v = v.value }
      blok.appendChild(v)
      for (let j = 0; j < MAX_ANTWOORDEN; j++) {
        const rij = el('label', 'display:flex;align-items:center;gap:8px')
        const goed = el('input'); goed.type = 'radio'; goed.name = 'goed_' + i; goed.checked = r.g === j
        goed.style.cssText = 'width:22px;height:22px;flex:none;accent-color:#4ade80'
        goed.onchange = () => { if (goed.checked) r.g = j }
        const a = el('input', VELD + ';padding:8px 10px;font-size:14px')
        a.placeholder = j < 2 ? T('Antwoord {n}', { n: j + 1 }) : T('Antwoord {n} (mag leeg)', { n: j + 1 })
        a.maxLength = MAX_ANTWOORD; a.value = r.a[j] || ''
        a.oninput = () => { r.a[j] = a.value }
        rij.append(goed, a)
        blok.appendChild(rij)
      }
      blok.appendChild(el('div', 'font-size:11px;color:rgba(255,255,255,0.55)', T('Tik op het rondje bij het goede antwoord.')))
      vragenVak.appendChild(blok)
    })
    plus.hidden = concept.vragen.length >= MAX_VRAGEN
  }
  plus.onclick = () => {
    if (concept.vragen.length >= MAX_VRAGEN) return
    concept.vragen.push({ v: '', a: ['', '', '', ''], g: 0 })
    tekenVragen()
    const laatste = vragenVak.lastElementChild
    if (laatste) { laatste.scrollIntoView({ block: 'center' }); const t = laatste.querySelector('textarea'); if (t) t.focus() }
  }
  tekenVragen()

  const voet = el('div', 'display:flex;gap:10px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.1);max-width:640px;width:100%;margin:0 auto;box-sizing:border-box')
  const annuleer = el('button', GRIJSKNOP + ';flex:1', T('Annuleren'))
  annuleer.onclick = () => s._sluit()
  const bewaar = el('button', HOOFDKNOP + ';flex:2', T('Opslaan ✓'))
  bewaar.className = 'quiz-opslaan'
  bewaar.onclick = () => {
    const fout = controleer(concept)
    if (fout) { melding.textContent = fout; melding.scrollIntoView({ block: 'nearest' }); return }
    // lege antwoorden eruit; het goede antwoord schuift mee
    const schoon = normaliseer({ ...concept, vragen: concept.vragen.map(r => ({ v: r.v, a: r.a, g: r.g })) })
    if (!schoon) { melding.textContent = T('Maak minstens één vraag.'); return }
    s._sluit()
    opslaan(schoon)
  }
  voet.append(annuleer, bewaar)
  s.appendChild(voet)
  setTimeout(() => { if (!concept.titel) titel.focus() }, 50)
  return s
}

// ── Spelen ──
export function speelQuiz(quizIn, { achtergrond = null } = {}) {
  const quiz = normaliseer(quizIn)
  if (!quiz) return null
  const s = scherm(achtergrond)
  s.classList.add('quiz-speler')
  try { if (s.requestFullscreen && !document.fullscreenElement) s.requestFullscreen().catch(() => {}) } catch (e) {}
  const geluid = naam => { if (quiz.geluid) { try { speelGeluid(naam) } catch (e) {} } }
  let nr = 0, antwoorden = [], bezig = false

  const kop = el('div', 'display:flex;align-items:center;gap:10px;padding:14px 16px')
  const titel = el('div', 'flex:1;font-size:15px;font-weight:700;opacity:0.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', quiz.titel)
  const teller = el('div', 'font-size:13px;opacity:0.8;white-space:nowrap')
  const sluit = el('button', GRIJSKNOP + ';padding:8px 12px', '✕')
  sluit.setAttribute('aria-label', T('Sluiten'))
  sluit.onclick = () => {
    if (nr > 0 && nr < quiz.vragen.length && !confirm(T('Quiz stoppen?'))) return
    s._sluit()
  }
  kop.append(titel, teller, sluit)
  const balk = el('div', 'height:4px;background:rgba(255,255,255,0.12);margin:0 16px;border-radius:2px;overflow:hidden')
  const vulling = el('div', 'height:100%;width:0;background:linear-gradient(90deg,#c084fc,#60a5fa);transition:width .3s')
  balk.appendChild(vulling)
  const lijf = el('div', 'flex:1;overflow-y:auto;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:20px 16px;max-width:640px;width:100%;margin:0 auto;box-sizing:border-box;position:relative')
  s.append(kop, balk, lijf)

  function stickerPop(code) {
    if (!quiz.stickers) return false
    const st = zoekSticker(code)
    if (!st) return false
    const img = el('img', 'position:absolute;left:50%;top:50%;width:min(46vw,220px);height:auto;transform:translate(-50%,-50%);z-index:5;pointer-events:none;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5))')
    img.src = st.src; img.alt = ''
    img.className = 'quiz-sticker'
    s.appendChild(img)
    try { speel(img, st, quiz.geluid) } catch (e) {}
    setTimeout(() => img.remove(), 1300)
    return true
  }

  function toonVraag() {
    bezig = false
    const r = quiz.vragen[nr]
    teller.textContent = T('Vraag {nu} van {totaal}', { nu: nr + 1, totaal: quiz.vragen.length })
    vulling.style.width = (nr / quiz.vragen.length * 100) + '%'
    lijf.textContent = ''
    const vraag = el('div', 'font-size:clamp(20px,5.5vw,30px);font-weight:700;line-height:1.3;text-align:center;word-break:break-word;text-shadow:0 2px 8px rgba(0,0,0,.4)', r.v)
    vraag.className = 'quiz-vraag'
    lijf.appendChild(vraag)
    const knoppen = el('div', 'display:flex;flex-direction:column;gap:10px')
    const lijst = r.a.map((a, j) => {
      const k = el('button', 'text-align:left;border:2px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.10);color:#fff;border-radius:14px;padding:14px 16px;font-size:17px;font-weight:600;cursor:pointer;font-family:inherit;word-break:break-word;transition:background .15s,border-color .15s')
      k.className = 'quiz-antwoord'
      k.textContent = String.fromCharCode(65 + j) + '.  ' + a
      k.onclick = () => kies(j, lijst)
      knoppen.appendChild(k)
      return k
    })
    lijf.appendChild(knoppen)
  }

  function kies(j, lijst) {
    if (bezig) return
    bezig = true
    const r = quiz.vragen[nr]
    antwoorden[nr] = j
    const goed = j === r.g
    if (quiz.direct) {
      lijst.forEach((k, i) => {
        k.style.cursor = 'default'
        if (i === r.g) { k.style.background = 'rgba(74,222,128,0.35)'; k.style.borderColor = '#4ade80' }
        else if (i === j) { k.style.background = 'rgba(248,113,113,0.35)'; k.style.borderColor = '#f87171' }
        else k.style.opacity = '0.55'
      })
      const uitleg = el('div', 'text-align:center;font-size:16px;font-weight:700', goed ? T('Goed!') : T('Fout') + ' — ' + T('Het goede antwoord: {a}', { a: r.a[r.g] }))
      uitleg.className = 'quiz-uitleg'
      uitleg.style.color = goed ? '#86efac' : '#fca5a5'
      lijf.appendChild(uitleg)
      if (!stickerPop(goed ? YES : NEE)) geluid(goed ? 'ting' : 'fout')
      if (goed) setTimeout(volgende, 1100)
      else {
        // fout: zelf verder, zodat je rustig het goede antwoord kunt lezen
        const verder = el('button', HOOFDKNOP + ';align-self:center;min-width:160px', T('Volgende ›'))
        verder.className = 'quiz-verder'
        verder.onclick = volgende
        lijf.appendChild(verder)
      }
    } else {
      lijst[j].style.background = 'rgba(192,132,252,0.35)'; lijst[j].style.borderColor = '#c084fc'
      geluid('pop')
      setTimeout(volgende, 280)
    }
  }

  function volgende() {
    nr++
    if (nr < quiz.vragen.length) toonVraag()
    else einde()
  }

  function einde() {
    const u = uitslag(quiz, antwoorden)
    teller.textContent = ''
    vulling.style.width = '100%'
    lijf.textContent = ''
    lijf.style.justifyContent = 'flex-start'
    const top = el('div', 'text-align:center;margin-top:min(8vh,60px)')
    top.appendChild(el('div', 'font-size:56px;line-height:1', u.goed === u.totaal ? '🏆' : u.goed * 2 >= u.totaal ? '🎉' : '💪'))
    const score = el('div', 'font-size:clamp(26px,7vw,40px);font-weight:800;margin-top:10px', T('{goed} van {totaal} goed', u))
    score.className = 'quiz-score'
    top.appendChild(score)
    lijf.appendChild(top)
    geluid(u.goed === u.totaal ? 'winnaar' : u.goed * 2 >= u.totaal ? 'tadaa' : 'aww')
    if (!quiz.direct) {
      if (!u.fouten.length) lijf.appendChild(el('div', 'text-align:center;font-size:16px', T('Alles goed! 🎉')))
      else {
        lijf.appendChild(el('div', 'font-size:15px;font-weight:700;margin-top:6px', T('Jouw fouten')))
        for (const f of u.fouten) {
          const b = el('div', 'background:rgba(0,0,0,0.3);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:4px')
          b.className = 'quiz-fout'
          b.appendChild(el('div', 'font-weight:600;font-size:14px', f.v))
          b.appendChild(el('div', 'font-size:13px;color:#fca5a5', T('Jij: {a}', { a: f.jij })))
          b.appendChild(el('div', 'font-size:13px;color:#86efac', T('Goed: {a}', { a: f.goed })))
          lijf.appendChild(b)
        }
      }
    }
    const rij = el('div', 'display:flex;gap:10px;justify-content:center;margin:12px 0 20px')
    const nog = el('button', GRIJSKNOP, T('Opnieuw'))
    nog.onclick = () => { nr = 0; antwoorden = []; lijf.style.justifyContent = 'center'; toonVraag() }
    const klaar = el('button', HOOFDKNOP, T('Sluiten'))
    klaar.className = 'quiz-klaar'
    klaar.onclick = () => s._sluit()
    rij.append(nog, klaar)
    lijf.appendChild(rij)
  }

  toonVraag()
  return s
}
