// studio-kaarten.js (v1, 25 nov 2026) - de speelkaarten uit Stekky Studio (kaartmaker.js). Dit bestand schrijft
// tests/tools/studio-kaarten-installeer.mjs; met de hand aanpassen hoeft niet.
//
// In gewone woorden: elke set hier staat vanzelf bij "Kies je kaarten" in elk kaartspel (kaartspel-hulp.js). De plaatjes
// staan in kaarten/<id>/<kaart>.webp (375 x 525).
//   { id, naam: [nl, en], soort: 'plaatjes'|'alles', kleur: { h, r, k, s }, v }
//   plaatjes: alleen <kleur>A/B/V/H, achterkant en joker; 2 tot en met 10 tekent de app met de tekens in 'kleur'.

export const STUDIO_KAARTSETS = []

if (typeof window !== 'undefined') {
  const en = window.FIBRO_EN ||= {}
  for (const s of STUDIO_KAARTSETS) en[s.naam[0]] ??= s.naam[1]
}
