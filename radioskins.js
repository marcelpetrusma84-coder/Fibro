// radioskins.js (v1, 19 nov 2026) - de skins van de radio (radio.js), ontworpen door Marcel.
// De plaatjes staan in radioskins/<naam>.webp (gemaakt met tests/gen/radioskins_bouw.py: het schermpje is leeg en het
// vaste naaldje is weg). radio.js legt er het schermpje met de echte zender, een meelopend naaldje en werkende knoppen
// overheen. Alle plekken zijn [links, boven, breedte, hoogte] in procenten van het plaatje.
// Een skin is alleen een naam in de opslag (radio_<uid>.skin); de plaatjes zitten in de app, dus bij vrienden wordt
// er niets extra's verstuurd of opgehaald.
export const SKINS = {
  hout: { naam: 'Retro hout', tekst: '#2b1d12', sub: '#5a4128', accent: '#ff4d3d', b: 608, h: 270,
    scherm: [47.86, 10.37, 37.17, 26.67], vorige: [35.53, 6.67, 8.88, 34.07], volgende: [88.32, 6.67, 8.88, 34.07], schaal: [35.53, 46.3, 61.84, 14.81], speaker: [1.97, 5.56, 30.59, 55.56],
    p: [[2.14, 72.22, 7.89, 18.52], [11.68, 72.22, 7.73, 18.52], [21.05, 72.22, 8.06, 18.52], [30.59, 72.22, 7.89, 18.52]], play: [70.07, 67.78, 12.17, 27.41], knop: [84.7, 67.41, 12.5, 28.15] },
  neon: { naam: 'Cyberpunk / Neon', tekst: '#5ff2ff', sub: '#ff6fd8', accent: '#22f0ff', b: 608, h: 255,
    scherm: [48.03, 12.16, 36.68, 26.67], vorige: [35.86, 7.84, 8.22, 34.51], volgende: [88.82, 7.84, 7.89, 34.51], schaal: [35.69, 49.41, 61.51, 12.55], speaker: [2.14, 6.67, 30.26, 57.25],
    p: [[2.47, 74.51, 7.4, 18.04], [12.01, 74.51, 7.4, 18.04], [21.38, 74.51, 7.57, 18.04], [30.92, 74.51, 7.57, 18.04]], play: [70.07, 68.63, 12.17, 29.02], knop: [84.87, 68.63, 12.17, 29.02] },
  scifi: { naam: 'Futuristisch / Sci-Fi', tekst: '#f2f6ff', sub: '#a9c4e8', accent: '#8fd3ff', b: 610, h: 245,
    scherm: [47.87, 11.84, 36.72, 25.71], vorige: [35.74, 7.76, 8.52, 33.47], volgende: [88.2, 7.76, 8.69, 33.47], schaal: [36.07, 45.71, 60.82, 14.29], speaker: [2.46, 6.94, 29.84, 54.29],
    p: [[2.62, 71.43, 7.87, 20.41], [12.13, 71.43, 7.87, 20.41], [21.48, 71.43, 7.87, 20.41], [30.98, 71.43, 7.87, 20.41]], play: [70.16, 65.71, 11.8, 29.39], knop: [84.92, 65.31, 12.13, 30.2] },
  natuur: { naam: 'Natuur / Botanisch', tekst: '#2b1d12', sub: '#5a4128', accent: '#ff4d3d', b: 631, h: 247,
    scherm: [48.49, 16.6, 35.34, 19.84], vorige: [36.61, 12.15, 8.4, 28.34], volgende: [87.32, 12.15, 8.56, 28.34], schaal: [36.61, 45.75, 59.27, 10.12], speaker: [4.6, 11.34, 28.84, 48.58],
    p: [[4.44, 70.85, 7.45, 17.41], [13.47, 70.85, 7.61, 17.41], [22.66, 70.85, 7.45, 17.41], [31.7, 70.85, 7.61, 17.41]], play: [69.89, 62.75, 11.41, 29.15], knop: [83.84, 61.94, 12.04, 30.77] },
  graffiti: { naam: 'Graffiti / Street Art', tekst: '#2b1d12', sub: '#5a4128', accent: '#ff2fd6', b: 608, h: 219,
    scherm: [48.03, 11.87, 36.68, 19.63], vorige: [35.69, 8.22, 8.72, 26.03], volgende: [88.32, 8.22, 8.88, 26.03], schaal: [35.69, 38.81, 61.51, 13.7], speaker: [2.47, 6.85, 29.93, 47.95],
    p: [[2.3, 66.21, 7.89, 22.83], [11.84, 66.21, 7.73, 22.83], [21.22, 66.21, 7.73, 22.83], [30.59, 66.21, 7.89, 22.83]], play: [69.41, 59.36, 13.16, 36.53], knop: [84.87, 60.27, 12.5, 34.7] },
  pixel: { naam: 'Pixel Art (8-bit)', tekst: '#ffffff', sub: '#d6c2ff', accent: '#b9a6ff', b: 608, h: 258,
    scherm: [48.03, 11.63, 36.51, 26.36], vorige: [35.69, 7.75, 8.72, 34.11], volgende: [88.49, 7.75, 8.55, 34.11], schaal: [35.53, 48.45, 61.68, 13.95], speaker: [2.14, 6.2, 30.26, 56.98],
    p: [[2.3, 72.87, 7.89, 19.38], [11.84, 72.87, 7.73, 19.38], [21.22, 72.87, 7.89, 19.38], [30.59, 72.87, 7.89, 19.38]], play: [70.07, 67.44, 12.17, 28.68], knop: [84.87, 67.05, 12.5, 29.46] },
  steampunk: { naam: 'Steampunk / Messing', tekst: '#2b1d12', sub: '#5a3a1c', accent: '#d9622b', b: 608, h: 246,
    scherm: [48.68, 13.01, 34.87, 26.02], vorige: [35.69, 7.32, 8.72, 31.3], volgende: [88.49, 7.32, 8.55, 31.3], schaal: [35.69, 46.75, 61.51, 13.41], speaker: [2.14, 6.1, 30.26, 54.88],
    p: [[2.47, 71.14, 7.73, 20.33], [11.84, 71.14, 7.89, 20.33], [21.38, 71.14, 7.73, 20.33], [30.76, 71.14, 7.89, 20.33]], play: [70.39, 65.85, 11.84, 29.27], knop: [84.54, 64.23, 13.16, 32.52] },
}
export const SKIN_NAMEN = Object.keys(SKINS)
export const skinPlaatje = naam => new URL('./radioskins/' + naam + '.webp?v=1', import.meta.url).href
