// kaarten-motor.js (v1, 27 nov 2026) - de kaartenmotor: een kaartspel maken, schudden en kaarten lezen. Eén bouwsteen
// voor alle kaartspellen (BOUWSTENEN.md, "Dubbel werk"). Gebruikt door Poker, Video Poker en de sjablonen; de oudere
// spellen (Pesten, Toepen, Black Jack, Eenendertigen, Koningsjacht) hebben nog een eigen kopie en verhuizen later.
//
// In gewone woorden: een kaart is een korte tekst: de kleur (h harten, r ruiten, k klaveren, s schoppen) en de waarde
// (2 tot 10, B boer, V vrouw, H heer, A aas). Bijvoorbeeld 'h10' (harten tien) of 'sA' (schoppen aas). Jokers: 'J1', 'J2'.
//   maakDeck('52')   een gewoon spel; '32' piket (7 tot en met aas), '54' met 2 jokers, '104' twee gewone spellen
//                    (daarin komt elke kaart twee keer voor)
//   schud(lijst, rng)  een geschudde kopie (rng: een eigen toevalsgenerator, handig voor tests)
//   kaartInfo(id)      { kleur, waarde } (een joker: { kleur: 'joker', waarde: 'J' })
//   isKaart(id, deck)  is dit een kaart uit dat spel?
//   rang(id)           2 tot 14 (aas hoog); een joker 0
//   kleurNaam(id)      'harten', 'ruiten', 'klaveren', 'schoppen' of 'joker'
export const KLEUREN = ['h', 'r', 'k', 's']
export const WAARDEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const PIKET = ['7', '8', '9', '10', 'B', 'V', 'H', 'A']
export const JOKERS = ['J1', 'J2']
export const DECKS = ['52', '32', '54', '104']
const KLEURNAMEN = { h: 'harten', r: 'ruiten', k: 'klaveren', s: 'schoppen' }

export const isJoker = id => JOKERS.includes(id)
export function maakDeck(deck = '52') {
  const waarden = deck === '32' ? PIKET : WAARDEN
  const d = []
  for (const k of KLEUREN) for (const w of waarden) d.push(k + w)
  if (deck === '54') d.push(...JOKERS)
  if (deck === '104') return [...d, ...d]
  return d
}
export function schud(lijst, rng = Math.random) {
  const a = lijst.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
export const kaartInfo = id => isJoker(id) ? { kleur: 'joker', waarde: 'J' } : { kleur: String(id)[0], waarde: String(id).slice(1) }
export function isKaart(id, deck = '52') {
  if (typeof id !== 'string') return false
  if (isJoker(id)) return deck === '54'
  return KLEUREN.includes(id[0]) && (deck === '32' ? PIKET : WAARDEN).includes(id.slice(1))
}
export const rang = id => isJoker(id) ? 0 : WAARDEN.indexOf(String(id).slice(1)) + 2
export const kleurNaam = id => isJoker(id) ? 'joker' : KLEURNAMEN[String(id)[0]] || ''
