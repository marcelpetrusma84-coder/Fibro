// Nep-paren: iedereen in de proef is met iedereen bevriend en online; berichten via de proefleider
let ik = null, vriendenLijst = []
const onlineL = new Set(), paginaL = new Set(), berichtL = new Map()
window.__paarBericht = (van, soort, data) => { const s = berichtL.get(soort); if (s) for (const fn of s) setTimeout(() => fn(data, van), 0) }
export async function startParen(uid) { ik = uid; vriendenLijst = window.__vrienden.filter(x => x !== uid); return vriendenLijst.slice() }
export function opOnline(fn) { onlineL.add(fn); return () => onlineL.delete(fn) }
export function opNieuwePagina(fn) { paginaL.add(fn); return () => paginaL.delete(fn) }
export function onlineVrienden() { return vriendenLijst.slice() }
export function vrienden() { return vriendenLijst.slice() }
export function isOnline(id) { return vriendenLijst.includes(id) }
export function opBericht(soort, fn) { if (!berichtL.has(soort)) berichtL.set(soort, new Set()); berichtL.get(soort).add(fn); return () => berichtL.get(soort).delete(fn) }
export async function stuurNaar(id, soort, data) { window.__stuur('paar', id, { soort, data }); return 'ok' }
export function zetKenmerk() {}
export function heeftKenmerk(id, naam) { return !window.__oud.includes(id) }
