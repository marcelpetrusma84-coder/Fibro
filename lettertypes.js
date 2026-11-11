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

// v132: lettertype-pakketten uit de Stekky Store (store.html): per thema 4 lettertypes in 1 download.
// id = de naam in de store (tabel store_downloads, kolom item_id). Pas na het downloaden kies je ze bij Lettertype.
// oud = de losse download uit v131 (10-11-2026); wie die al had, houdt dat lettertype.
// Alle lettertypes staan ook in EIGEN hieronder, zodat iedereen ze kan laten zien (kiest een vriend er een,
// dan zie jij zijn profiel ook in dat lettertype). Een nieuw pakket: een blok hieronder + bestanden in lettertypen/.
export const STORE_PAKKETTEN = [
  { id: 'pakket-retro', titel: 'Retro', lettertypes: [
    { naam: 'Shrikhand', val: 'cursive', label: 'Diner' },
    { naam: 'Righteous', val: 'sans-serif', label: 'Jukebox' },
    { naam: 'Faster One', val: 'sans-serif', label: 'Racewagen' },
    { naam: 'Abril Fatface', val: 'serif', label: 'Krantenkop', oud: 'lettertype-abril-fatface' },
  ] },
  { id: 'pakket-scifi', titel: 'Sci-fi', lettertypes: [
    { naam: 'Michroma', val: 'sans-serif', label: 'Ruimteschip' },
    { naam: 'Zen Dots', val: 'sans-serif', label: 'Planeet' },
    { naam: 'Oxanium', val: 'sans-serif', label: 'Cyborg' },
    { naam: 'Syncopate', val: 'sans-serif', label: 'Sterrenstelsel' },
  ] },
  { id: 'pakket-cowboy', titel: 'Cowboy', lettertypes: [
    { naam: 'Ewert', val: 'serif', label: 'Saloon' },
    { naam: 'Sancreek', val: 'serif', label: 'Sheriff' },
    { naam: 'Smokum', val: 'serif', label: 'Wanted' },
    { naam: 'Diplomata', val: 'serif', label: 'Rodeo' },
  ] },
  { id: 'pakket-prinses', titel: 'Prinses', lettertypes: [
    { naam: 'Princess Sofia', val: 'cursive', label: 'Tiara' },
    { naam: 'Parisienne', val: 'cursive', label: 'Bal' },
    { naam: 'Pinyon Script', val: 'cursive', label: 'Kroon' },
    { naam: 'Sacramento', val: 'cursive', label: 'Sierlijk', oud: 'lettertype-sacramento' },
  ] },
  { id: 'pakket-urban', titel: 'Urban', lettertypes: [
    { naam: 'Sedgwick Ave Display', val: 'cursive', label: 'Spuitbus' },
    { naam: 'Rock Salt', val: 'cursive', label: 'Muurkrijt' },
    { naam: 'Knewave', val: 'cursive', label: 'Skater' },
    { naam: 'Rubik Wet Paint', val: 'sans-serif', label: 'Natte verf' },
  ] },
  { id: 'pakket-horror', titel: 'Horror', lettertypes: [
    { naam: 'Butcherman', val: 'cursive', label: 'Monster' },
    { naam: 'Eater', val: 'cursive', label: 'Zombie' },
    { naam: 'Metal Mania', val: 'cursive', label: 'Heavy metal' },
    { naam: 'Jolly Lodger', val: 'cursive', label: 'Spookhuis' },
  ] },
  { id: 'pakket-strip', titel: 'Strip', lettertypes: [
    { naam: 'Luckiest Guy', val: 'cursive', label: 'Superheld' },
    { naam: 'Bubblegum Sans', val: 'cursive', label: 'Kauwgom' },
    { naam: 'Bangers', val: 'cursive', label: 'Stripheld', oud: 'lettertype-bangers' },
    { naam: 'Gloria Hallelujah', val: 'cursive', label: 'Kinderhand', oud: 'lettertype-gloria-hallelujah' },
  ] },
  { id: 'pakket-agent', titel: 'Geheim agent', lettertypes: [
    { naam: 'Stardos Stencil', val: 'sans-serif', label: 'Topgeheim' },
    { naam: 'Allerta Stencil', val: 'sans-serif', label: 'Missie' },
    { naam: 'Black Ops One', val: 'sans-serif', label: 'Leger', oud: 'lettertype-black-ops-one' },
    { naam: 'Special Elite', val: 'monospace', label: 'Oude typemachine', oud: 'lettertype-special-elite' },
  ] },
  { id: 'pakket-ridders', titel: 'Ridders & draken', lettertypes: [
    { naam: 'UnifrakturMaguntia', val: 'serif', label: 'Kasteel' },
    { naam: 'Uncial Antiqua', val: 'serif', label: 'Tovenaar' },
    { naam: 'Almendra Display', val: 'serif', label: 'Draak' },
    { naam: 'Grenze Gotisch', val: 'serif', label: 'Harnas' },
  ] },
]

// Alle store-lettertypes op een rij. ids = de downloads die dit lettertype geven (het pakket, en de oude losse).
export const STORE_LETTERTYPES = STORE_PAKKETTEN.flatMap(p => p.lettertypes.map(f =>
  Object.assign({}, f, { pakket: p.id, ids: [p.id].concat(f.oud ? [f.oud] : []) })))

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
  'silkscreen', 'space-mono', 'titan-one',
  // v131: Stekky Store
  'abril-fatface', 'bangers', 'black-ops-one', 'gloria-hallelujah', 'sacramento', 'special-elite',
  // v132: lettertype-pakketten
  'shrikhand', 'faster-one', 'michroma', 'zen-dots', 'oxanium', 'syncopate', 'ewert', 'sancreek', 'smokum',
  'diplomata', 'princess-sofia', 'parisienne', 'pinyon-script', 'sedgwick-ave-display', 'rock-salt', 'knewave',
  'rubik-wet-paint', 'butcherman', 'eater', 'metal-mania', 'jolly-lodger', 'luckiest-guy', 'bubblegum-sans',
  'stardos-stencil', 'allerta-stencil', 'unifrakturmaguntia', 'uncial-antiqua', 'almendra-display', 'grenze-gotisch'
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
