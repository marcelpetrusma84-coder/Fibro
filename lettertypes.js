// Alle beschikbare lettertypes. Nieuwe toevoegen: een regel erbij.
// naam = lettertypenaam (bestand: lettertypen/<naam-met-streepjes>.css), val = CSS fallback, label = wat de gebruiker ziet
export const LETTERTYPES = [
  { naam: 'DM Sans', val: 'sans-serif', label: 'Standaard' },
  { naam: 'Nunito', val: 'sans-serif', label: 'Rond' },
  { naam: 'Lora', val: 'serif', label: 'Schreef' },
  { naam: 'Space Mono', val: 'monospace', label: 'Typemachine' },
  { naam: 'Quicksand', val: 'sans-serif', label: 'Zacht' },
  { naam: 'Playfair Display', val: 'serif', label: 'Chic' },
  { naam: 'Bebas Neue', val: 'sans-serif', label: 'Blokletters' },
  { naam: 'Lobster', val: 'cursive', label: 'Retro' },
  { naam: 'Pacifico', val: 'cursive', label: 'Handgeschreven' },
  { naam: 'Comfortaa', val: 'cursive', label: 'Bol' },
  { naam: 'Rye', val: 'serif', label: 'Cowboy' },
  { naam: 'Creepster', val: 'cursive', label: 'Horror' },
  { naam: 'Nosifer', val: 'cursive', label: 'Bloederig' },
  { naam: 'Orbitron', val: 'sans-serif', label: 'Sci-fi' },
  { naam: 'Audiowide', val: 'cursive', label: 'Techno' },
  { naam: 'Press Start 2P Tekst', val: 'cursive', label: 'Retro game' }, // v130: kleinere versie (zie lettertypen/press-start-2p-tekst.css)
  { naam: 'Silkscreen', val: 'cursive', label: 'Pixels' },
  { naam: 'Bungee', val: 'cursive', label: 'Verkeersbord' },
  { naam: 'Bungee Shade', val: 'cursive', label: 'Verkeersbord 3D' },
  { naam: 'Monoton', val: 'cursive', label: 'Neon' },
  { naam: 'MedievalSharp', val: 'cursive', label: 'Middeleeuws' },
  { naam: 'Cinzel Decorative', val: 'serif', label: 'Sprookje' },
  { naam: 'Great Vibes', val: 'cursive', label: 'Prinses' },
  { naam: 'Pirata One', val: 'cursive', label: 'Ridder' },
  { naam: 'Share Tech Mono', val: 'monospace', label: 'Matrix' },
  { naam: 'Rubik Spray Paint', val: 'sans-serif', label: 'Graffiti' },
  { naam: 'Mountains of Christmas', val: 'cursive', label: 'Kerst' },
  { naam: 'Fascinate', val: 'cursive', label: 'Circus' },
  { naam: 'Chewy', val: 'cursive', label: 'Speels' },
  { naam: 'Rampart One', val: 'cursive', label: 'Klei' },
  { naam: 'Sedgwick Ave', val: 'cursive', label: 'Marker' },
  { naam: 'Caveat', val: 'cursive', label: 'Handschrift' },
  { naam: 'Bagel Fat One', val: 'cursive', label: 'Dik' },
  { naam: 'Titan One', val: 'cursive', label: 'Stripboek' },
  { naam: 'Fredoka', val: 'sans-serif', label: 'Vriendelijk' },
  { naam: 'Rubik Bubbles', val: 'cursive', label: 'Bellen' },
  { naam: 'Shadows Into Light', val: 'cursive', label: 'Zacht handschrift' },
  { naam: 'Permanent Marker', val: 'cursive', label: 'Stift' },
]

// v118: de lettertypen staan in de eigen repo (map lettertypen/, Fontsource 5.3.0),
// niet meer bij Google. Ook oudere keuzes (van voor deze lijst) staan erin.
const EIGEN = new Set([
  'audiowide', 'bagel-fat-one', 'bebas-neue', 'bungee', 'bungee-shade', 'caveat', 'chewy',
  'cinzel', 'cinzel-decorative', 'comfortaa', 'courier-prime', 'creepster', 'dancing-script',
  'dm-mono', 'dm-sans', 'dm-serif-display', 'fascinate', 'fredoka', 'great-vibes', 'lobster',
  'lora', 'medievalsharp', 'merriweather', 'monoton', 'mountains-of-christmas', 'nosifer',
  'nunito', 'orbitron', 'oswald', 'pacifico', 'permanent-marker', 'pirata-one', 'playfair-display',
  'press-start-2p', 'press-start-2p-tekst', 'quicksand', 'raleway', 'rampart-one', 'righteous', 'rubik-bubbles',
  'rubik-spray-paint', 'rye', 'satisfy', 'sedgwick-ave', 'shadows-into-light', 'share-tech-mono',
  'silkscreen', 'space-mono', 'titan-one'
])
export function lettertypeSlug(naam) {
  return String(naam || '').trim().toLowerCase().replace(/ /g, '-')
}

// Laadt alleen het gekozen lettertype, niet alle 38.
export function laadFont(naam) {
  const slug = lettertypeSlug(naam)
  if (!EIGEN.has(slug)) return
  const id = 'font-' + slug
  if (document.getElementById(id)) return
  const l = document.createElement('link')
  l.id = id
  l.rel = 'stylesheet'
  l.href = 'lettertypen/' + slug + '.css?v=1'
  document.head.appendChild(l)
}
