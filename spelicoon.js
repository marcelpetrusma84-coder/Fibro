// spelicoon.js - de plaatjes van de spellen. v2 (31 okt 2026): alleen het losse speelstuk, op een doorzichtige
// achtergrond (de X, de gele schijf, het paard, de paddle, de vleermuis, ...). De plaatjes staan in
// spelicoon/<spel>.webp (128 x 128) en komen uit de spellen zelf: zie tests/tools/spelicoon/LEESMIJ.txt.
// Gebruikt in het spelmenu van de chat, de widgetlijst in Profiel, de spelwidget op Home en op het profiel van een vriend. Een nieuw plaatje voor een bestaand spel: verhoog VERSIE (ook in de html).
export const VERSIE = 2
export const SPELLEN = ['botkaaseiren', 'vieroprij', 'schaken', 'dammen', 'pong', 'pacman', 'pinball',
  'endlessrunner', 'breakout', 'swarm', 'shmup', 'flappybird', 'pesten', 'toepen', 'eenentwintigen',   // 11 nov 2026: kaartspellen uit de Store
  'koningsjacht']   // 13 nov 2026

export function spelIcoonSrc(spel) {
  return SPELLEN.includes(spel) ? 'spelicoon/' + spel + '.webp?v=' + VERSIE : null
}
// Een <img> van px bij px, of '' als het spel geen plaatje heeft (dan blijft de emoji staan)
export function spelIcoonHtml(spel, px) {
  const src = spelIcoonSrc(spel)
  if (!src) return ''
  const p = Math.round(Number(px) || 32)
  return '<img src="' + src + '" width="' + p + '" height="' + p + '" alt="" draggable="false" ' +
    'style="display:block;width:' + p + 'px;height:' + p + 'px;flex-shrink:0">'
}

const icoonFallbacks = Object.freeze({
  botkaaseiren:'⭕', vieroprij:'🔴', schaken:'♟️', dammen:'⚫', pong:'🏓',
  pacman:'👻', pinball:'🐍', flappybird:'🦇', breakout:'🟪', swarm:'🪲',
  endlessrunner:'🏃', shmup:'🚀', pesten:'🃏', toepen:'✊', eenentwintigen:'♠️', koningsjacht:'👑',
})
const fallbackRoots = new WeakMap()
const positieveMaat = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0

// Alleen de eigen spelplaatjes krijgen een reserve-icoon. Foto's, avatars en
// andere afbeeldingen blijven bij hun eigen foutafhandeling. De listener vangt
// ook fouten van later toegevoegde widgets; er is geen observer of retry nodig.
export function koppelSpelIcoonFallback(root = globalThis.document) {
  const doc = root?.ownerDocument || (root?.nodeType === 9 ? root : null)
  if (!doc?.createElement || !root?.addEventListener || !root?.querySelectorAll) return () => {}
  if (fallbackRoots.has(root)) return fallbackRoots.get(root)

  function spelVan(img) {
    if (img?.tagName !== 'IMG' || (root !== doc && root !== img && !root.contains?.(img))) return null
    try {
      const base = doc.baseURI || img.baseURI
      const url = new URL(img.getAttribute('src'), base)
      const naam = /\/spelicoon\/([a-z0-9]+)\.webp$/.exec(url.pathname)?.[1]
      if (!SPELLEN.includes(naam) || url.username || url.password || !['http:','https:','file:'].includes(url.protocol)) return null
      const verwacht = new URL('spelicoon/' + naam + '.webp', base)
      return url.origin === verwacht.origin && url.pathname === verwacht.pathname ? naam : null
    } catch { return null }
  }
  function vervang(img) {
    const spel = spelVan(img)
    if (!spel || !img.parentNode) return
    const rect = img.getBoundingClientRect?.()
    const breedte = positieveMaat(rect?.width) || positieveMaat(img.width) || positieveMaat(img.getAttribute('width')) || 32
    const hoogte = positieveMaat(rect?.height) || positieveMaat(img.height) || positieveMaat(img.getAttribute('height')) || breedte
    const reserve = doc.createElement('span')
    reserve.className = 'spelicoon-fallback'
    reserve.setAttribute('aria-hidden', 'true')
    reserve.setAttribute('data-spelicoon', spel)
    reserve.textContent = icoonFallbacks[spel]
    Object.assign(reserve.style, {
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:breedte + 'px', height:hoogte + 'px', flexShrink:'0',
      fontSize:Math.min(breedte, hoogte) * .72 + 'px', lineHeight:'1', verticalAlign:'middle',
    })
    img.replaceWith(reserve)
  }
  const onError = event => vervang(event.target)
  root.addEventListener('error', onError, true)
  let actief = true
  const opruimen = () => {
    if (!actief) return
    actief = false
    root.removeEventListener('error', onError, true)
    fallbackRoots.delete(root)
  }
  fallbackRoots.set(root, opruimen)
  const images = [...(root.tagName === 'IMG' ? [root] : []), ...root.querySelectorAll('img')]
  for (const img of images) if (img.complete === true && img.naturalWidth === 0) vervang(img)
  return opruimen
}
