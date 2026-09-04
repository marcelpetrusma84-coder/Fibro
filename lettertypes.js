// Alle beschikbare lettertypes. Nieuwe toevoegen: een regel erbij.
// naam = Google Fonts-naam, val = CSS fallback, label = wat de gebruiker ziet
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
  { naam: 'Press Start 2P', val: 'cursive', label: 'Retro game' },
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

// Laadt alleen het gekozen lettertype, niet alle 38.
export function laadFont(naam) {
  if (!naam) return
  const id = 'font-' + naam.replace(/[^a-zA-Z0-9]/g, '')
  if (document.getElementById(id)) return
  const l = document.createElement('link')
  l.id = id
  l.rel = 'stylesheet'
  l.href = 'https://fonts.googleapis.com/css2?family=' + naam.replace(/ /g, '+') + ':wght@400;600&display=swap'
  document.head.appendChild(l)
}
