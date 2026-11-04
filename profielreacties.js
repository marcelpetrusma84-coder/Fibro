// profielreacties.js (v258, 4 nov 2026): likes en reacties onder foto's, muziek en video's op een profiel.
//
// LIKES. Bij een vriend tik je op 🤍 onder een foto (groot bekijken, fotoviewer.js), een nummer of een video: dan wordt
// het ❤️. Vinger erop houden = een andere emoji kiezen (😂 🔥 😍 😮 👏). Iedereen die het profiel kan zien, ziet
// hoeveel likes er zijn; alleen de eigenaar ziet wie (sql/profiel-likes.sql). De server bewaart alleen wie, bij wie,
// welke emoji en een vingerafdruk van het stuk (itemVan, dezelfde rekensom als sync.js), nooit de foto of het nummer.
// Een nieuwe foto op dezelfde plek heeft een andere vingerafdruk en begint dus weer bij 0.
//
// REACTIES. 💬 Reageer = een gewoon versleuteld chatbericht aan de eigenaar, met een klein plaatje van de foto of video
// (of de naam van het nummer) erbij. Alleen jullie twee kunnen het lezen. In de chat wordt het een kaartje
// (tekenReactieKaart, chat.html). Inhoud: 'profielreactie:' + JSON { v, s: soort, t: tekst, k: titel, p: plaatje }.
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

export const EMOJI = ['❤️', '😂', '🔥', '😍', '😮', '👏'] // dezelfde lijst als in sql/profiel-likes.sql en stuur-push
export const SOORTEN = ['foto', 'muziek', 'video']
export const PREFIX = 'profielreactie:'
const MAX_TEKST = 500
const MAX_PLAATJE = 40000
const GELDIG_PLAATJE = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/
const ITEM = /^[0-9a-f]{1,16}$/

// De vingerafdruk: precies hashString uit sync.js, over de tekst (data:...) die via sync meegaat
export function itemVan(data) {
  const s = String(data || '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}
const sleutel = (soort, item) => soort + ':' + item
export const watTekst = soort => soort === 'muziek' ? T('nummer') : soort === 'video' ? T('video') : T('foto')

// ── Server ──
export async function haalTellers(supabase, eigenaar) {
  const uit = new Map()
  try {
    const { data, error } = await supabase.rpc('profiel_like_tellers', { p_eigenaar: eigenaar })
    if (error || !Array.isArray(data)) return uit
    for (const r of data) {
      if (!SOORTEN.includes(r.soort) || !EMOJI.includes(r.emoji) || !ITEM.test(String(r.item))) continue
      const k = sleutel(r.soort, r.item), t = uit.get(k) || { totaal: 0, emoji: {} }
      const n = Math.max(0, Number(r.aantal) || 0)
      t.totaal += n; t.emoji[r.emoji] = (t.emoji[r.emoji] || 0) + n
      uit.set(k, t)
    }
  } catch (e) { console.warn('[likes] tellers ophalen mislukt', e) }
  return uit
}
async function haalMijnLikes(supabase, eigenaar, ik) {
  const uit = new Map()
  try {
    const { data, error } = await supabase.from('profiel_likes').select('soort, item, emoji').eq('eigenaar', eigenaar).eq('liker', ik)
    if (!error && Array.isArray(data)) for (const r of data) uit.set(sleutel(r.soort, r.item), r.emoji)
  } catch (e) {}
  return uit
}
export async function haalWieLikete(supabase, ik) {
  try {
    const { data, error } = await supabase.from('profiel_likes').select('liker, soort, item, emoji, created_at')
      .eq('eigenaar', ik).order('created_at', { ascending: false }).limit(300)
    return !error && Array.isArray(data) ? data : []
  } catch (e) { return [] }
}

// ── Een profiel: alle tellers in een keer, de balkjes werken zichzelf bij ──
// opties: { supabase, eigenaar, ik, isEigen, naam (van de eigenaar), opReageer({ soort, item, titel, plaatje }), naamVan(id) }
export function maakProfielLikes(opties) {
  const { supabase, eigenaar, ik, isEigen } = opties
  let tellers = new Map(), mijn = new Map(), geladen = null
  const balken = new Set()
  const p = {
    opties,
    laad() {
      if (!geladen) geladen = Promise.all([haalTellers(supabase, eigenaar), isEigen ? new Map() : haalMijnLikes(supabase, eigenaar, ik)])
        .then(([t, m]) => { tellers = t; mijn = m; p.tekenAlles() })
      return geladen
    },
    teller: (soort, item) => tellers.get(sleutel(soort, item)) || { totaal: 0, emoji: {} },
    heeftSoort: soort => [...tellers.keys()].some(k => k.startsWith(soort + ':')),
    mijn: (soort, item) => mijn.get(sleutel(soort, item)) || null,
    tekenAlles() { for (const b of balken) if (b.isConnected || (b._hart && b._hart.isConnected)) b._teken(); else balken.delete(b) },
    async zet(soort, item, emoji) {
      const k = sleutel(soort, item), oud = mijn.get(k) || null
      const t = tellers.get(k) || { totaal: 0, emoji: {} }
      const pas = (van, naar) => {
        if (van) { t.totaal--; t.emoji[van] = Math.max(0, (t.emoji[van] || 1) - 1) }
        if (naar) { t.totaal++; t.emoji[naar] = (t.emoji[naar] || 0) + 1 }
        tellers.set(k, t); if (naar) mijn.set(k, naar); else mijn.delete(k)
      }
      pas(oud, emoji); p.tekenAlles() // meteen laten zien, daarna de server
      let error = null
      try {
        ;({ error } = emoji
          ? await supabase.from('profiel_likes').upsert({ eigenaar, liker: ik, soort, item, emoji }, { onConflict: 'eigenaar,soort,item,liker' })
          : await supabase.from('profiel_likes').delete().eq('eigenaar', eigenaar).eq('liker', ik).eq('soort', soort).eq('item', item))
      } catch (e) { error = e }
      if (error) { console.warn('[likes] opslaan mislukt', error); pas(emoji, oud); p.tekenAlles(); toon(T('Dat lukte niet. Probeer het zo nog eens.')) }
    },
    balk(soort, item, extra = {}) {
      const b = maakBalk(p, soort, String(item), extra)
      balken.add(b)
      return b
    },
    // Op je eigen profiel: alle likes van een soort bij elkaar (bijvoorbeeld al je nummers), tik = wie
    som(soort, items, extra = {}) {
      const b = maakBalk(p, soort, '', Object.assign({}, extra, { items: items.map(String) }))
      balken.add(b)
      return b
    },
  }
  return p
}

// ── Het balkje: bij een vriend 🤍/❤️ + aantal en 💬 Reageer; op je eigen profiel het aantal (tik = wie) ──
function knopStijl(licht, klein) {
  if (klein) return 'display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:3px 10px;border-radius:15px;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;line-height:1;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation;background:rgba(255,255,255,0.12);color:#fff;'
  return 'display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:5px 12px;border-radius:17px;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;line-height:1;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation;'
    + (licht ? 'background:rgba(255,255,255,0.16);color:#fff;' : 'background:rgba(0,0,0,0.55);color:#fff;')
}
function emojiRij(t) {
  return EMOJI.filter(e => t.emoji[e] > 0).sort((a, b) => t.emoji[b] - t.emoji[a]).slice(0, 3).join('')
}
function maakBalk(p, soort, item, extra) {
  const { isEigen } = p.opties
  const b = document.createElement('div')
  b.className = 'pr-balk'
  b.dataset.soort = soort; b.dataset.item = item
  b.style.cssText = 'display:flex;align-items:center;justify-content:' + (extra.midden ? 'center' : 'flex-start') + ';gap:8px;flex-wrap:wrap;' + (extra.stijl || '')
  // tikken mogen niet doorgaan naar wat eronder ligt (de foto, de video, de pagina)
  for (const ev of ['click', 'pointerdown', 'touchstart']) b.addEventListener(ev, e => e.stopPropagation())
  const stop = el => { for (const ev of ['click', 'pointerdown', 'touchstart']) el.addEventListener(ev, e => e.stopPropagation()) }
  const hart = document.createElement('button')
  hart.type = 'button'; hart.className = 'pr-hart'
  hart.style.cssText = knopStijl(extra.licht, extra.klein)
  stop(hart)
  b.appendChild(hart)
  b._hart = hart
  let reageer = null
  if (!isEigen) {
    reageer = document.createElement('button')
    reageer.type = 'button'; reageer.className = 'pr-reageer'
    reageer.style.cssText = knopStijl(extra.licht, extra.klein)
    reageer.textContent = T('💬 Reageer')
    stop(reageer)
    reageer.onclick = () => p.opties.opReageer && p.opties.opReageer({ soort, item, titel: extra.titel || '', plaatje: extra.plaatje || null })
    b.appendChild(reageer)
  }
  const som = Array.isArray(extra.items)
  b._teken = () => {
    const t = som ? optellen(extra.items.map(i => p.teller(soort, i))) : p.teller(soort, item)
    if (isEigen) {
      hart.style.display = t.totaal > 0 ? '' : 'none'
      hart.textContent = (emojiRij(t) || '❤️') + ' ' + t.totaal
      hart.setAttribute('aria-label', T('{n} likes. Tik om te zien van wie.', { n: t.totaal }))
    } else {
      const m = p.mijn(soort, item)
      hart.textContent = (m || '🤍') + (t.totaal > 0 ? ' ' + t.totaal : '')
      hart.setAttribute('aria-pressed', m ? 'true' : 'false')
      hart.setAttribute('aria-label', m ? T('Je vindt dit leuk. Tik om het weg te halen, houd vast voor een andere emoji.') : T('Leuk vinden. Houd vast voor een andere emoji.'))
    }
  }
  if (isEigen) {
    hart.onclick = () => openWieScherm(p, { soort, item, items: som ? extra.items : null })
  } else {
    // tik = ❤️ aan of uit; vasthouden = een andere emoji kiezen
    let houd = null, gekozen = false
    const stopHoud = () => { if (houd) { clearTimeout(houd); houd = null } }
    hart.addEventListener('pointerdown', () => { gekozen = false; stopHoud(); houd = setTimeout(() => { houd = null; gekozen = true; openEmojiKeuze(p, hart, soort, item) }, 450) })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hart.addEventListener(ev, stopHoud)
    hart.addEventListener('contextmenu', e => e.preventDefault())
    hart.onclick = () => {
      if (gekozen) { gekozen = false; return }
      p.zet(soort, item, p.mijn(soort, item) ? null : '❤️')
    }
  }
  b._teken()
  p.laad()
  return b
}

function optellen(lijst) {
  const uit = { totaal: 0, emoji: {} }
  for (const t of lijst) { uit.totaal += t.totaal; for (const e in t.emoji) uit.emoji[e] = (uit.emoji[e] || 0) + t.emoji[e] }
  return uit
}

function openEmojiKeuze(p, bij, soort, item) {
  document.getElementById('pr-emojikeuze')?.remove()
  const r = bij.getBoundingClientRect()
  const k = document.createElement('div')
  k.id = 'pr-emojikeuze'
  k.setAttribute('role', 'menu')
  k.style.cssText = 'position:fixed;z-index:100002;display:flex;gap:4px;padding:6px;border-radius:24px;background:#2a1745;border:1px solid rgba(192,132,252,0.5);box-shadow:0 8px 24px rgba(0,0,0,0.5);'
  const huidig = p.mijn(soort, item)
  for (const e of EMOJI) {
    const knop = document.createElement('button')
    knop.type = 'button'; knop.textContent = e
    knop.setAttribute('aria-label', e)
    knop.style.cssText = 'width:40px;height:40px;border-radius:50%;border:none;font-size:22px;cursor:pointer;background:' + (e === huidig ? 'rgba(192,132,252,0.45)' : 'transparent')
    knop.onclick = ev => { ev.stopPropagation(); k.remove(); p.zet(soort, item, e === huidig ? null : e) }
    k.appendChild(knop)
  }
  for (const ev of ['click', 'pointerdown', 'touchstart']) k.addEventListener(ev, e => e.stopPropagation())
  document.body.appendChild(k)
  const w = k.offsetWidth || 270
  k.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px'
  k.style.top = Math.max(8, r.top - 58) + 'px'
  const weg = e => { if (!k.contains(e.target)) { k.remove(); document.removeEventListener('pointerdown', weg, true) } }
  setTimeout(() => document.addEventListener('pointerdown', weg, true), 0)
}

// ── Schermpjes (onderaan, boven alles, ook boven de grote foto) ──
function onderScherm(titel) {
  const achter = document.createElement('div')
  achter.className = 'pr-scherm'
  achter.setAttribute('data-geen-swipe', '')
  achter.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center'
  const kaart = document.createElement('div')
  kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-modal', 'true'); kaart.setAttribute('aria-label', titel)
  kaart.style.cssText = 'width:100%;max-width:480px;max-height:85vh;overflow-y:auto;background:#1a0a2e;border:0.5px solid rgba(192,132,252,0.35);border-radius:20px 20px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));color:#f3e8ff;font-family:inherit;box-sizing:border-box'
  const kop = document.createElement('div')
  kop.style.cssText = 'font-size:16px;font-weight:700;margin-bottom:12px;color:var(--accent,#c084fc)'
  kop.textContent = titel
  kaart.appendChild(kop)
  achter.appendChild(kaart)
  const sluit = () => achter.remove()
  achter.addEventListener('click', e => { if (e.target === achter) sluit() })
  for (const ev of ['pointerdown', 'touchstart']) achter.addEventListener(ev, e => e.stopPropagation())
  document.body.appendChild(achter)
  return { achter, kaart, sluit }
}
function toon(tekst) {
  const t = document.createElement('div')
  t.className = 'pr-toast'
  t.setAttribute('role', 'status')
  t.style.cssText = 'position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100003;background:#2a1745;color:#fff;border:1px solid rgba(192,132,252,0.5);border-radius:16px;padding:10px 16px;font-size:14px;max-width:90vw;text-align:center'
  t.textContent = tekst
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2800)
}

function voorbeeld(soort, titel, plaatje) {
  const rij = document.createElement('div')
  rij.className = 'pr-voorbeeld'
  rij.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px'
  if (plaatje && GELDIG_PLAATJE.test(plaatje)) {
    const img = document.createElement('img')
    img.src = plaatje; img.alt = ''
    img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0'
    rij.appendChild(img)
  } else {
    const ic = document.createElement('div')
    ic.textContent = soort === 'muziek' ? '🎵' : soort === 'video' ? '🎬' : '🖼️'
    ic.style.cssText = 'width:56px;height:56px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:26px;background:linear-gradient(135deg,var(--accent,#c084fc),var(--accent2,#f0abfc))'
    rij.appendChild(ic)
  }
  if (titel) {
    const tt = document.createElement('div')
    tt.style.cssText = 'font-size:14px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
    tt.textContent = titel
    rij.appendChild(tt)
  }
  return rij
}

// 💬 Reageer: opVerstuur(tekst) => Promise<boolean>; chatAdres = de chat met de eigenaar
export function openReageerScherm({ soort, titel, plaatje, naam, opVerstuur, chatAdres }) {
  const { kaart, sluit } = onderScherm(T('Reageer op de {wat} van {naam}', { wat: watTekst(soort), naam: naam || T('je vriend') }))
  kaart.appendChild(voorbeeld(soort, titel, plaatje))
  const veld = document.createElement('textarea')
  veld.className = 'pr-tekst'
  veld.maxLength = MAX_TEKST; veld.rows = 3
  veld.placeholder = T('Schrijf iets…')
  veld.style.cssText = 'width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgba(192,132,252,0.4);background:rgba(255,255,255,0.06);color:#fff;font-family:inherit;font-size:16px;padding:10px;resize:none'
  const uitleg = document.createElement('div')
  uitleg.style.cssText = 'font-size:12px;opacity:0.7;margin:6px 0 12px'
  uitleg.textContent = T('🔒 Komt in jullie chat. Alleen jullie twee kunnen het lezen.')
  const knoppen = document.createElement('div')
  knoppen.style.cssText = 'display:flex;gap:8px'
  const terug = document.createElement('button')
  terug.type = 'button'; terug.textContent = T('Annuleren')
  terug.style.cssText = 'flex:1;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#fff;font-family:inherit;font-size:15px;cursor:pointer'
  const stuur = document.createElement('button')
  stuur.type = 'button'; stuur.className = 'pr-verstuur'; stuur.textContent = T('Verstuur')
  stuur.disabled = true
  stuur.style.cssText = 'flex:2;min-height:44px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--accent,#c084fc),var(--accent2,#f0abfc));color:#1a0a2e;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer'
  veld.addEventListener('input', () => { stuur.disabled = !veld.value.trim(); stuur.style.opacity = stuur.disabled ? '0.5' : '' })
  stuur.style.opacity = '0.5'
  terug.onclick = sluit
  stuur.onclick = async () => {
    const tekst = veld.value.trim()
    if (!tekst) return
    stuur.disabled = true; stuur.textContent = T('Versturen…')
    let ok = false
    try { ok = await opVerstuur(tekst) } catch (e) { console.warn('[reactie] versturen mislukt', e) }
    if (!ok) { stuur.disabled = false; stuur.textContent = T('Verstuur'); uitleg.textContent = T('⚠️ Versturen lukte niet. Probeer het zo nog eens.'); return }
    kaart.replaceChildren()
    const klaar = document.createElement('div')
    klaar.className = 'pr-klaar'
    klaar.style.cssText = 'text-align:center;padding:10px 0 4px;font-size:15px'
    klaar.textContent = T('✅ Verstuurd naar je chat met {naam}', { naam: naam || T('je vriend') })
    kaart.appendChild(klaar)
    if (chatAdres) {
      const open = document.createElement('a')
      open.href = chatAdres; open.textContent = T('Open de chat')
      open.style.cssText = 'display:block;text-align:center;margin-top:12px;color:var(--accent,#c084fc);font-weight:700'
      kaart.appendChild(open)
    }
    setTimeout(sluit, 3500)
  }
  knoppen.append(terug, stuur)
  kaart.append(veld, uitleg, knoppen)
  setTimeout(() => { try { veld.focus() } catch (e) {} }, 50)
}

// Wie vond het leuk (alleen op je eigen profiel). namen(ids) => Promise<Map id->naam>; beschrijf(soort, item) =>
// { titel } (de naam van een nummer, als het om meerdere stukken gaat)
async function openWieScherm(p, { soort, item, items }) {
  const { supabase, ik, namen, beschrijf } = p.opties
  const { kaart } = onderScherm(T('Wie vond je {wat} leuk', { wat: watTekst(soort) }))
  const lijst = document.createElement('div')
  lijst.className = 'pr-wielijst'
  lijst.textContent = T('Even laden…')
  kaart.appendChild(lijst)
  const rijen = (await haalWieLikete(supabase, ik)).filter(r => r.soort === soort && (items ? items.includes(r.item) : !item || r.item === item))
  let naamMap = new Map()
  try { if (namen && rijen.length) naamMap = await namen([...new Set(rijen.map(r => r.liker))]) } catch (e) {}
  lijst.replaceChildren()
  if (!rijen.length) { lijst.textContent = T('Nog niemand.'); return }
  for (const r of rijen) {
    const rij = document.createElement('div')
    rij.className = 'pr-wie'
    rij.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.08)'
    const e = document.createElement('span'); e.style.cssText = 'font-size:22px;width:30px;text-align:center'; e.textContent = EMOJI.includes(r.emoji) ? r.emoji : '❤️'
    const n = document.createElement('span'); n.style.cssText = 'flex:1;min-width:0;font-weight:600'
    n.textContent = naamMap.get(r.liker) || T('Een vriend')
    rij.append(e, n)
    const extra = beschrijf && items ? beschrijf(r.soort, r.item) : null
    if (extra && extra.titel) { const t = document.createElement('span'); t.style.cssText = 'font-size:12px;opacity:0.7;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; t.textContent = extra.titel; rij.appendChild(t) }
    lijst.appendChild(rij)
  }
}

// ── Het chatbericht ──
export function maakReactieBericht({ soort, tekst, titel, plaatje }) {
  const o = { v: 1, s: SOORTEN.includes(soort) ? soort : 'foto', t: String(tekst || '').slice(0, MAX_TEKST) }
  if (titel) o.k = String(titel).slice(0, 80)
  if (plaatje && GELDIG_PLAATJE.test(plaatje) && plaatje.length <= MAX_PLAATJE) o.p = plaatje
  return PREFIX + JSON.stringify(o)
}
export function leesReactieBericht(inhoud) {
  if (typeof inhoud !== 'string' || !inhoud.startsWith(PREFIX)) return null
  let o
  try { o = JSON.parse(inhoud.slice(PREFIX.length)) } catch (e) { return null }
  if (!o || typeof o !== 'object' || !SOORTEN.includes(o.s) || typeof o.t !== 'string' || !o.t.trim()) return null
  return {
    soort: o.s,
    tekst: o.t.slice(0, MAX_TEKST),
    titel: typeof o.k === 'string' ? o.k.slice(0, 80) : '',
    plaatje: typeof o.p === 'string' && o.p.length <= MAX_PLAATJE && GELDIG_PLAATJE.test(o.p) ? o.p : null,
  }
}
export const reactieKort = r => '\u{1F4AC} ' + r.tekst

// Een klein plaatje (voor in het chatbericht): hoogstens 'max' pixels, JPEG; null als het niet lukt
export function maakKleinPlaatje(src, max = 160) {
  return new Promise(klaar => {
    if (!src || !/^data:image\//.test(src)) { klaar(null); return }
    const img = new Image()
    img.onload = () => {
      try {
        const s = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        let uit = c.toDataURL('image/jpeg', 0.72)
        if (uit.length > MAX_PLAATJE) uit = c.toDataURL('image/jpeg', 0.45)
        klaar(uit.length <= MAX_PLAATJE && GELDIG_PLAATJE.test(uit) ? uit : null)
      } catch (e) { klaar(null) }
    }
    img.onerror = () => klaar(null)
    img.src = src
  })
}

// Het kaartje in de chat (alleen DOM en textContent: niets uit het bericht wordt als html gelezen)
export function tekenReactieKaart(r, { isMijn }) {
  const kaart = document.createElement('div')
  kaart.className = 'pr-kaart'
  const kop = document.createElement('div')
  kop.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px'
  kop.appendChild(voorbeeld(r.soort, '', r.plaatje).firstChild)
  const st = kop.firstChild
  st.style.width = '46px'; st.style.height = '46px'; st.style.fontSize = '22px'
  const tekst = document.createElement('div')
  tekst.style.cssText = 'min-width:0;font-size:12px;opacity:0.85;line-height:1.35'
  const wat = document.createElement('div')
  wat.textContent = isMijn ? T('Je reageerde op een {wat}', { wat: watTekst(r.soort) }) : T('Reageerde op je {wat}', { wat: watTekst(r.soort) })
  tekst.appendChild(wat)
  if (r.titel) { const t = document.createElement('div'); t.style.cssText = 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; t.textContent = r.titel; tekst.appendChild(t) }
  kop.appendChild(tekst)
  const inhoud = document.createElement('span')
  inhoud.className = 'bubble-content'
  inhoud.textContent = r.tekst
  kaart.append(kop, inhoud)
  return kaart
}
