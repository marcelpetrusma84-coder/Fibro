// Own vector silhouettes: consistent on phones and desktops, without font outlines.
const vormen = {
  P: '<circle cx="32" cy="17" r="8"/><path d="M27 25h10l-2 13 7 9H22l7-9z"/><path d="M21 47h22l3 8H18z"/>',
  N: '<path d="M17 51c0-14 6-19 16-24l-12 5-8-6 9-13 10-3 5-7 3 8c13 6 14 24 9 40z"/><path d="m22 17 8-3M19 27l7-1M35 22c8 7 9 16 6 24" fill="none"/><circle cx="30" cy="18" r="2" fill="var(--sch-line)" stroke="none"/><path d="M16 51h35l2 7H13z"/>',
  B: '<circle cx="32" cy="7" r="3"/><path d="M32 11c-4 5-13 12-13 20 0 7 7 11 13 11s13-4 13-11c0-8-9-15-13-20z"/><path d="m34 16-7 13" fill="none" stroke-width="3"/><path d="M27 42h10l3 7H24zM21 49h22l3 7H18z"/>',
  R: '<path d="M17 10h7v7h5v-7h6v7h5v-7h7v16l-5 5 2 19H20l2-19-5-5z"/><path d="M20 27h24M23 33h18" fill="none"/><path d="M18 50h28l3 7H15z"/>',
  Q: '<path d="m15 19 6 23h22l6-23-11 12-6-16-6 16z"/><circle cx="14" cy="16" r="3"/><circle cx="32" cy="12" r="3"/><circle cx="50" cy="16" r="3"/><path d="M22 42h20l-2 7H24zM21 49h22l4 8H17z"/><path d="M23 37h18" fill="none"/>',
  K: '<path d="M29 5h6v6h6v6h-6v7h-6v-7h-6v-6h6z"/><path d="M32 26c-15-12-24 2-12 15l4 8h16l4-8c12-13 3-27-12-15z"/><path d="M32 26v16M23 43h18" fill="none"/><path d="M21 49h22l4 8H17z"/>',
}
export function stukSVG(stuk) {
  const vorm = vormen[stuk?.[1]]
  if (!vorm) return ''
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" class="sch-figuur ${stuk[0] === 'w' ? 'sch-ivoor' : 'sch-ebben'} sch-type-${stuk[1]}" fill="currentColor" stroke="var(--sch-line)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${vorm}</svg>`
}

export const STUKPUNTEN = Object.freeze({ P:1, N:3, B:3, R:5, Q:9, K:0 })
export function registreerSlag(staat, zet, veroverd) {
  const aanvaller = staat.bord[zet.van[0]][zet.van[1]]
  const slachtoffer = zet.type === 'enpassant'
    ? staat.bord[zet.van[0]][zet.naar[1]]
    : staat.bord[zet.naar[0]][zet.naar[1]]
  if (aanvaller && slachtoffer && aanvaller[0] !== slachtoffer[0]) veroverd[aanvaller[0]].push(slachtoffer)
}
export const veroverdePunten = stukken => stukken.reduce((som, stuk) => som + (STUKPUNTEN[stuk[1]] || 0), 0)
