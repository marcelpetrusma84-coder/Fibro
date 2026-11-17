// profielbundel.js (17 nov 2026, stap 3 van docs/profiel-via-vrienden.md)
//
// In gewone woorden: bij het gewone synchroniseren (sync.js) stuurt je telefoon nu ook een ondertekend lijstje mee
// van je profielonderdelen (profielhandtekening.js). Je vriend controleert de handtekening met jouw publieke sleutel
// en bewaart het lijstje naast je profiel ('vriend_<jij>_handtekening'). In stap 4 kan hij je profiel daarmee aan een
// gezamenlijke vriend doorgeven, die dan precies kan nagaan dat er niets aan veranderd is.
//
// - Ondertekenen gebeurt alleen als er iets veranderd is: hetzelfde profiel houdt hetzelfde lijstje en dezelfde
//   versie. De SHA-256 van een groot onderdeel (muziek) wordt onthouden bij zijn snelle controlegetal (sync.js
//   hashString), zodat hij niet bij elke verbinding opnieuw berekend wordt.
// - Bewaren gebeurt alleen als de handtekening klopt, de sleutel past bij wat je van die vriend onthouden hebt
//   (dezelfde vingerafdruk als de chat) en het lijstje nieuwer is dan wat er al lag.
// - Video gaat niet mee (te groot, en hij gaat alleen op aanvraag).

import { ondertekenLijst, controleerProfiel, isNieuwer, inhoudHash } from './profielhandtekening.js?v=2'

const EIGEN = uid => 'fibro_profielhandtekening_' + uid      // het laatst ondertekende lijstje (eigen profiel)
const SHA_CACHE = uid => 'fibro_profielsha_' + uid           // { "<lengte>:<snel>": sha256 }
const VERTROUWD = (uid, id) => 'fibro_vriendsleutel_' + uid + '_' + id // dezelfde als chat.html en postbus.js
export const VRIEND_SLEUTEL = id => 'vriend_' + id + '_handtekening'
const MAX_CACHE = 800

function lees(ls, k, standaard) { try { const v = JSON.parse(ls.getItem(k) || 'null'); return v ?? standaard } catch (e) { return standaard } }
function zet(ls, k, v) { try { ls.setItem(k, JSON.stringify(v)) } catch (e) {} }
const zelfdeItems = (a, b) => {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {})
  return ka.length === kb.length && ka.every(k => a[k] === b[k])
}

// onderdelen: { naam: { data: tekst, snel: snel controlegetal (hashString) } }
// Geeft het ondertekende lijstje, of null als er geen sleutel is of het niet lukt.
export async function eigenHandtekening({ eigenId, privateKey, onderdelen, ls, nu = Date.now() }) {
  if (!eigenId || !privateKey || !onderdelen) return null
  const cache = alsObject(lees(ls, SHA_CACHE(eigenId), {}))
  const nieuweCache = {}
  const items = {}
  for (const [naam, o] of Object.entries(onderdelen)) {
    if (!o || typeof o.data !== 'string') continue
    const ck = o.data.length + ':' + String(o.snel || '')
    let sha = o.snel && cache[ck]
    if (!sha) sha = await inhoudHash(o.data)
    if (o.snel) nieuweCache[ck] = sha
    items[naam] = sha
  }
  zet(ls, SHA_CACHE(eigenId), Object.fromEntries(Object.entries(nieuweCache).slice(0, MAX_CACHE)))
  const vorig = lees(ls, EIGEN(eigenId), null)
  if (vorig && vorig.v === 1 && String(vorig.eigenaar) === String(eigenId).toLowerCase() && zelfdeItems(vorig.items, items)) return vorig
  // Nieuw lijstje: altijd een hogere versie dan het vorige, ook als de klok van de telefoon terugsprong
  const versie = Math.max(Math.floor(nu), (vorig && Number(vorig.versie) || 0) + 1)
  const lijst = await ondertekenLijst({ eigenaar: eigenId, privateKeyB64: privateKey, items, versie })
  zet(ls, EIGEN(eigenId), lijst)
  return lijst
}
function alsObject(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {} }

// Het lijstje van een vriend controleren en bewaren.
// deps: { eigenId, ls, haalSleutel(vriendId) -> publieke sleutel (SPKI b64) of null,
//         crypto: { sleutelVingerafdruk, isZelfdeSleutel }, db: { get, put }, nu }
// Geeft 'bewaard', 'oud', 'sleutel' (geen of andere sleutel), 'vals' (handtekening klopt niet) of 'leeg'.
export async function bewaarVriendHandtekening(deps, vriendId, lijst) {
  if (!lijst || typeof lijst !== 'object' || !vriendId) return 'leeg'
  if (String(lijst.eigenaar || '').toLowerCase() !== String(vriendId).toLowerCase()) return 'vals'
  let vorig = null
  try { const r = await deps.db.get(VRIEND_SLEUTEL(vriendId)); vorig = r && r.data ? JSON.parse(r.data) : null } catch (e) {}
  if (vorig && !isNieuwer(lijst, vorig)) return 'oud'
  let sleutel = null
  try { sleutel = await deps.haalSleutel(vriendId) } catch (e) {}
  if (typeof sleutel !== 'string' || sleutel.length <= 10) return 'sleutel'
  let onthouden = null
  try { onthouden = deps.ls.getItem(VERTROUWD(deps.eigenId, vriendId)) } catch (e) {}
  if (onthouden) {
    let ok = false
    try { ok = deps.crypto.isZelfdeSleutel(onthouden, await deps.crypto.sleutelVingerafdruk(sleutel)) } catch (e) {}
    if (!ok) return 'sleutel'
  }
  if (!(await controleerProfiel(lijst, { eigenaar: vriendId, publicKeyB64: sleutel, nu: deps.nu || Date.now() }))) return 'vals'
  await deps.db.put({ id: VRIEND_SLEUTEL(vriendId), data: JSON.stringify(lijst), ontvangen: Date.now() })
  return 'bewaard'
}
