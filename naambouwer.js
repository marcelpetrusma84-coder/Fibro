// naambouwer.js (v1, 24 nov 2026): de gebruikersnaam-generator bij registreren (login.html en invite.html).
//
// Een gebruikersnaam bestaat uit drie stukjes: een begin (Turbo, Gekke, Sleepy...), een dier of grappig woord
// (Kikker, Stroopwafel, Badeend...) en een einde (42, Pro, Koning...). Voorheen stonden er drie korte lijstjes
// los in login.html en invite.html. Op verzoek van Marcel zijn er nu veel meer woorden, op één plek, en kun je je
// naam ook zelf samenstellen: drie keuzelijstjes met elk een 🔄-knop.
//
// Het naamveld blijft op slot (readonly). Je kiest alleen uit deze lijstjes, zodat niemand per ongeluk zijn echte
// naam of iets onaardigs als gebruikersnaam neemt. Je echte naam vul je in bij "Je eigen naam" (eigennaam.js).
//
// Alle woorden: alleen letters a-z en A-Z (geen spaties, geen ë/ï): de gebruikersnaam wordt ook het (nep-)
// e-mailadres <naam>@fibro.internal bij Supabase. De einden mogen ook cijfers hebben.

export const BEGIN = [
  // Engels
  'Turbo', 'Pixel', 'Neon', 'Fluffy', 'Sneaky', 'Chonky', 'Sparkly', 'Grumpy', 'Bouncy', 'Squishy', 'Dizzy',
  'Glitchy', 'Funky', 'Wiggly', 'Zappy', 'Bubbly', 'Fuzzy', 'Goofy', 'Jazzy', 'Mighty', 'Nifty', 'Peppy', 'Quirky',
  'Sassy', 'Ultra', 'Wacky', 'Zesty', 'Blobby', 'Clumsy', 'Derpy', 'Floppy', 'Hangry', 'Jumpy', 'Kooky', 'Lazy',
  'Moody', 'Nerdy', 'Silly', 'Zippy', 'Psycho', 'Mega', 'Hyper', 'Retro', 'Cyber', 'Magic', 'Spicy', 'Crispy',
  'Sleepy', 'Happy', 'Jolly', 'Cheeky', 'Wobbly', 'Snappy', 'Speedy', 'Cosmic', 'Galactic', 'Atomic', 'Rocket',
  'Thunder', 'Stormy', 'Sunny', 'Frosty', 'Toasty', 'Cozy', 'Comfy', 'Crunchy', 'Salty', 'Sugar', 'Honey', 'Minty',
  'Fizzy', 'Soapy', 'Disco', 'Party', 'Ninja', 'Pirate', 'Robo', 'Royal', 'Golden', 'Silver', 'Rusty', 'Shiny',
  'Glowy', 'Sparky', 'Twinkle', 'Stinky', 'Tiny', 'Mini', 'Giga', 'Super', 'Captain', 'Professor', 'Sir', 'Lady',
  'Baron', 'Mister', 'Missy', 'Lucky', 'Spooky', 'Wonky', 'Noisy', 'Sticky', 'Slimy', 'Bonkers', 'Chill', 'Epic',
  'Legendary', 'Turbo', 'Mystic', 'Shadow', 'Laser', 'Rainbow', 'Banana', 'Waddle', 'Snuggle', 'Tickle', 'Giggly',
  'Humble', 'Brave', 'Clever', 'Swift', 'Wild', 'Fancy', 'Dapper', 'Grand', 'Polar', 'Tropical', 'Jungle', 'Arctic',
  'Lunar', 'Solar', 'Stellar', 'Quantum', 'Turbo', 'Nitro', 'Pocket', 'Jumbo', 'Mellow', 'Rowdy', 'Zany',
  // Nederlands
  'Gekke', 'Vrolijke', 'Stoere', 'Slimme', 'Snelle', 'Luie', 'Malle', 'Rare', 'Blije', 'Dappere', 'Brutale',
  'Lieve', 'Kleine', 'Grote', 'Dolle', 'Wilde', 'Toffe', 'Coole', 'Hippe', 'Knappe', 'Ondeugende', 'Slaperige',
  'Hongerige', 'Kriebelige', 'Wiebelige', 'Zoete', 'Pittige', 'Knapperige', 'Glibberige', 'Pluizige', 'Mollige',
  'Giechelende', 'Dansende', 'Zingende', 'Vliegende', 'Springende', 'Rollende', 'Snurkende', 'Stuiterende',
  'Knotsgekke', 'Superslimme', 'Megagrote', 'Piepkleine', 'Bliksemsnelle', 'Reuzenblije', 'Kriskras', 'Hoepla',
  'Knetter', 'Stuiter', 'Kwebbel', 'Babbel', 'Knuffel', 'Snoezige', 'Zonnige', 'Sterke', 'Wijze', 'Rappe'
].filter((w, i, a) => a.indexOf(w) === i)

// Het middelste stukje, in groepjes (de groepjes zie je in het keuzelijstje bij "Zelf samenstellen").
export const MIDDEN = {
  'Dieren': [
    'Kikker', 'Panda', 'Hamster', 'Wasbeer', 'Capibara', 'Axolotl', 'Koala', 'Pinguin', 'Flamingo', 'Alpaca',
    'Eekhoorn', 'Narwal', 'Quokka', 'Wombat', 'Platypus', 'Blobfish', 'Aap', 'Beer', 'Bever', 'Bij', 'Buffel',
    'Cavia', 'Chinchilla', 'Dolfijn', 'Das', 'Dodo', 'Duif', 'Eend', 'Egel', 'Eland', 'Ezel', 'Fazant', 'Fret',
    'Gans', 'Gekko', 'Gibbon', 'Giraf', 'Gnoe', 'Goudvis', 'Gorilla', 'Haai', 'Haan', 'Haas', 'Hagedis', 'Hert',
    'Hond', 'Hommel', 'Hyena', 'IJsbeer', 'Inktvis', 'Jaguar', 'Kameel', 'Kanarie', 'Kangoeroe', 'Kat', 'Kever',
    'Kip', 'Koe', 'Kolibrie', 'Konijn', 'Krab', 'Kreeft', 'Krokodil', 'Kwal', 'Lama', 'Leeuw', 'Libel', 'Luiaard',
    'Lynx', 'Maki', 'Marmot', 'Mol', 'Mier', 'Mus', 'Muis', 'Neushoorn', 'Nijlpaard', 'Octopus', 'Oehoe',
    'Olifant', 'Orka', 'Otter', 'Paard', 'Pad', 'Papegaai', 'Pauw', 'Pelikaan', 'Poema', 'Pony', 'Poedel', 'Rups',
    'Ree', 'Rog', 'Salamander', 'Schaap', 'Schildpad', 'Slak', 'Slang', 'Spreeuw', 'Stekelvarken', 'Stokstaartje',
    'Struisvogel', 'Tapir', 'Tijger', 'Toekan', 'Uil', 'Varken', 'Vleermuis', 'Vlinder', 'Vos', 'Walrus', 'Wezel',
    'Wolf', 'Worm', 'Zebra', 'Zeehond', 'Zeekoe', 'Zeepaardje', 'Zwaan', 'Rendier', 'Lemming', 'Okapi',
    'Pangolin', 'Fennek', 'Honingdas', 'Koekoek', 'Merel', 'Specht', 'Ekster', 'Kraai', 'Raaf', 'Mops', 'Tekkel',
    'Corgi', 'Husky', 'Puppy', 'Kitten', 'Kuiken', 'Lammetje', 'Veulen', 'Kwartel', 'Ooievaar', 'Reiger', 'Meeuw',
    'Mammoet', 'Dino', 'Trex', 'Lieveheersbeestje', 'Sprinkhaan', 'Krekel', 'Vuurvlieg', 'Zeester',
    'Garnaal', 'Mossel', 'Clownvis', 'Piranha', 'Meerval', 'Snoek', 'Baviaan', 'Chimpansee', 'Orangoetan',
    'Gordeldier', 'Miereneter', 'Buidelrat', 'Wallaby', 'Emoe', 'Kiwi', 'Papegaaiduiker'
  ],
  'Fantasie': [
    'Draak', 'Eenhoorn', 'Yeti', 'Kraken', 'Feniks', 'Griffioen', 'Trol', 'Kabouter', 'Elfje', 'Robot', 'Alien',
    'Spook', 'Monster', 'Tovenaar', 'Ridder', 'Piraat', 'Ninja', 'Viking', 'Astronaut', 'Superheld', 'Zeemeermin',
    'Reus', 'Heks', 'Fee', 'Wizard', 'Goblin', 'Sfinx', 'Pegasus', 'Bigfoot', 'Nessie', 'Cyborg', 'Droid', 'Golem',
    'Gremlin', 'Ufo', 'Marsmannetje'
  ],
  'Eten': [
    'Noodle', 'Pickle', 'Waffle', 'Muffin', 'Burrito', 'Spaghetti', 'Nugget', 'Avocado', 'Stroopwafel',
    'Poffertje', 'Kroket', 'Bitterbal', 'Frikandel', 'Pannenkoek', 'Oliebol', 'Tosti', 'Friet', 'Kaas',
    'Hagelslag', 'Drop', 'Pindakaas', 'Appelflap', 'Banaan', 'Mango', 'Ananas', 'Aardbei', 'Bosbes', 'Kokosnoot',
    'Peer', 'Citroen', 'Meloen', 'Broccoli', 'Wortel', 'Spruitje', 'Aardappel', 'Taco', 'Nacho', 'Pizza', 'Donut',
    'Cupcake', 'Brownie', 'Koekje', 'Croissant', 'Bagel', 'Pretzel', 'Sushi', 'Dumpling', 'Popcorn',
    'Marshmallow', 'Toffee', 'Lolly', 'Snoepje', 'Pudding', 'Jelly', 'Smoothie', 'Milkshake', 'Boterham',
    'Worstje', 'Gehaktbal', 'Tompouce', 'Speculaas', 'Pepernoot', 'Kruidnoot', 'Spekje', 'Zuurtje', 'Gummibeer',
    'Knakworst', 'Kipnugget', 'Loempia', 'Pasta', 'Ravioli', 'Lasagne', 'Hotdog', 'Hamburger', 'Pancake', 'Cookie',
    'Biscuit', 'Cracker', 'Chips', 'Augurk', 'Olijf', 'Radijs', 'Courgette', 'Aubergine', 'Paprika', 'Pompoen',
    'Komkommer', 'Tomaat', 'Ui', 'Knoflook', 'Champignon', 'Ijsje', 'Waterijsje', 'Taart', 'Slagroom', 'Vla'
  ],
  'Dingen en geluiden': [
    'Toaster', 'Pillow', 'Cactus', 'Sok', 'Pantoffel', 'Theepot', 'Paraplu', 'Badeend', 'Stofzuiger',
    'Wasknijper', 'Gieter', 'Boemerang', 'Trampoline', 'Ballon', 'Knikker', 'Jojo', 'Tol', 'Kazoo', 'Ukelele',
    'Tuba', 'Trommel', 'Toeter', 'Fluitje', 'Scooter', 'Skateboard', 'Rakker', 'Bengel', 'Boefje', 'Snuiter',
    'Kwak', 'Plons', 'Boing', 'Wiebel', 'Bonk', 'Knal', 'Zoef', 'Pief', 'Poef', 'Paf', 'Floep', 'Plop', 'Hatsjoe',
    'Kriebel', 'Giechel', 'Snurk', 'Gniffel', 'Tjilp', 'Wobble', 'Bloop', 'Zoink', 'Kaboom', 'Sokpop', 'Kussen',
    'Pyjama', 'Slof', 'Klomp', 'Molen', 'Fiets', 'Tractor', 'Raket', 'Komeet', 'Planeet', 'Meteoor', 'Wolkje',
    'Regenboog', 'Bliksem', 'Sneeuwpop', 'Gamepad', 'Joystick', 'Diskette', 'Walkman', 'Cassette', 'Radio',
    'Lampion', 'Ratel', 'Vuurtoren', 'Kompas', 'Schatkist', 'Pinata', 'Confetti', 'Glitter', 'Spatel', 'Garde',
    'Pollepel', 'Vergiet', 'Teddybeer', 'Knuffel', 'Rubberbal', 'Frisbee', 'Vlieger', 'Zandkasteel', 'Emmer',
    'Schepje', 'Kruimel', 'Bubbel', 'Klodder', 'Spetter', 'Druppel', 'Wervelwind', 'Tornado', 'Popje', 'Hoed',
    'Bolhoed', 'Strik', 'Snor', 'Baard', 'Bril', 'Neus', 'Teen', 'Oorworm', 'Brul', 'Gil', 'Boer', 'Hik'
  ]
}
export const MIDDEN_ALLES = [...new Set(Object.values(MIDDEN).flat())]

export const EINDE = [
  '42', '88', '99', '404', '1337', 'XL', 'Pro', 'Max', 'Zero', 'Alpha', 'Prime', '9000', 'Plus', 'Elite', 'Ace',
  'Boss', 'Legend', '007', '777', '1', '7', '11', '13', '21', '23', '33', '64', '100', '101', '123', '200', '321',
  '360', '500', '999', '1000', '2000', '3000', '5000', 'Jr', 'Sr', 'II', 'III', 'XXL', 'Mini', 'Turbo', 'Deluxe',
  'Supreme', 'Royale', 'Express', 'GT', 'HD', '3D', 'X', 'Z', 'Ultra', 'Junior', 'Senior', 'Neo', 'Nova', 'Omega',
  'Gamma', 'Delta', 'Koning', 'Baas', 'Held', 'Kampioen', 'Ster', 'Prins', 'Graaf', 'Ridder', 'Meester', 'Expert',
  'Fan', 'Club', 'Crew', 'Squad', 'Gang', 'Bende', 'Party', 'Power', 'Kracht', 'Snel', 'Blitz', 'Flits', 'Go',
  'Yeah', 'Wow', 'Woef', 'Boem', 'Hoi', 'Joepie', 'Hup', 'Tadaa', 'Ole', 'Hoera', 'Wiii', 'Brrr', 'Zzz'
].filter((w, i, a) => a.indexOf(w) === i)

const kies = (lijst, rnd) => lijst[Math.min(lijst.length - 1, Math.floor(rnd() * lijst.length))]

// Drie willekeurige stukjes. rnd is te vervangen in de tests.
// Een willekeurige naam is hoogstens MAX_WILLEKEURIG tekens (anders opnieuw), zodat hij overal goed past.
// Zelf samenstellen mag langer (tot ongeveer 38 tekens: BliksemsnelleLieveheersbeestjeKampioen).
export const MAX_WILLEKEURIG = 24
export function willekeurigeDelen(rnd = Math.random) {
  let d
  for (let poging = 0; poging < 20; poging++) {
    d = { begin: kies(BEGIN, rnd), midden: kies(MIDDEN_ALLES, rnd), einde: kies(EINDE, rnd) }
    if (plakNaam(d).length <= MAX_WILLEKEURIG) break
  }
  return d
}
export function plakNaam(d) { return (d.begin || '') + (d.midden || '') + (d.einde || '') }
export function genereerNaam(rnd = Math.random) { return plakNaam(willekeurigeDelen(rnd)) }

// Een naam mag alleen uit deze stukjes bestaan (dezelfde lijsten); "geen einde" mag ook.
export function isGeldigeDelen(d) {
  return !!d && BEGIN.includes(d.begin) && MIDDEN_ALLES.includes(d.midden) && (d.einde === '' || EINDE.includes(d.einde))
}

const t = (zin) => (typeof window !== 'undefined' && typeof window.T === 'function' ? window.T(zin) : zin)

function zetStijl() {
  if (document.getElementById('naambouwerStijl')) return
  const s = document.createElement('style')
  s.id = 'naambouwerStijl'
  s.textContent = `
    .naambouwer { margin-top:10px; padding:12px; border:1px solid var(--border, rgba(192,132,252,.35)); border-radius:12px; background:rgba(192,132,252,.07); }
    .naambouwer[hidden] { display:none; }
    .naambouwer-uitleg { margin:0 0 10px; font-size:13px; line-height:1.4; opacity:.85; }
    .naambouwer-rij { display:flex; align-items:flex-end; gap:8px; margin-bottom:10px; }
    .naambouwer-rij label { flex:1; display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:600; min-width:0; }
    .naambouwer-rij select { width:100%; min-height:44px; border-radius:10px; border:1.5px solid var(--border, #e2d4ef); background:#faf7fd; color:var(--text, #2a1240); font:inherit; font-size:16px; font-weight:600; padding:8px 10px; }
    .naambouwer-rij select:focus { outline:none; box-shadow:0 0 0 4px rgba(139,63,209,.15); }
    .naambouwer-schud { flex:0 0 44px; width:44px; height:44px; border-radius:10px; border:1px solid var(--accent, #c084fc); background:transparent; color:var(--accent, #c084fc); font-size:18px; cursor:pointer; }
    .naambouwer-schud:active { background:var(--accent, #c084fc); color:#1a0a2e; }
    .naambouwer-klaar { display:block; width:100%; min-height:44px; border:none; border-radius:22px; background:#8b3fd1; color:#fff; font:inherit; font-weight:700; font-size:15px; cursor:pointer; }
    .naam-zelf { margin-top:6px; }`
  document.head.appendChild(s)
}

function vulKeuze(select, lijst, metGeen) {
  if (metGeen) select.append(new Option(t('Geen'), ''))
  for (const w of lijst) select.append(new Option(w, w))
}
function vulGroepen(select) {
  for (const [groep, woorden] of Object.entries(MIDDEN)) {
    const og = document.createElement('optgroup')
    og.label = t(groep)
    for (const w of woorden) og.append(new Option(w, w))
    select.append(og)
  }
}

// Koppelt de generator en "Zelf samenstellen" aan het (readonly) naamveld.
//   invoer: het naamveld; knopZelf: de knop "Zelf samenstellen" (het paneel komt eronder).
// Geeft { nieuw() } terug: nieuw() maakt een willekeurige naam (de knop 🔄 Gebruikersnaam-generator).
export function maakNaamBouwer({ invoer, knopZelf, rnd = Math.random } = {}) {
  if (!invoer) return { nieuw() {}, delen: () => null }
  let delen = willekeurigeDelen(rnd)
  let paneel = null, keuzes = null

  const toon = (opvallen) => {
    invoer.value = plakNaam(delen)
    if (keuzes) { keuzes.begin.value = delen.begin; keuzes.midden.value = delen.midden; keuzes.einde.value = delen.einde }
    if (opvallen) {
      invoer.style.transform = 'scale(1.04)'
      invoer.style.borderColor = 'var(--accent)'
      setTimeout(() => { invoer.style.transform = ''; invoer.style.borderColor = '' }, 200)
    }
  }

  function bouwPaneel() {
    zetStijl()
    paneel = document.createElement('div')
    paneel.className = 'naambouwer'
    paneel.id = 'naambouwer'
    paneel.hidden = true
    const uitleg = document.createElement('p')
    uitleg.className = 'naambouwer-uitleg'
    uitleg.textContent = t('Kies zelf de drie stukjes van je gebruikersnaam. Met 🔄 krijg je een willekeurig stukje.')
    paneel.append(uitleg)
    keuzes = {}
    const rijen = [
      ['begin', 'Begin', (s) => vulKeuze(s, BEGIN), () => kies(BEGIN, rnd)],
      ['midden', 'Dier of woord', (s) => vulGroepen(s), () => kies(MIDDEN_ALLES, rnd)],
      ['einde', 'Einde', (s) => vulKeuze(s, EINDE, true), () => kies(EINDE, rnd)]
    ]
    for (const [sleutel, tekst, vul, schud] of rijen) {
      const rij = document.createElement('div')
      rij.className = 'naambouwer-rij'
      const label = document.createElement('label')
      const span = document.createElement('span')
      span.textContent = t(tekst)
      const select = document.createElement('select')
      select.dataset.deel = sleutel
      vul(select)
      select.addEventListener('change', () => { delen = { ...delen, [sleutel]: select.value }; toon(true) })
      label.append(span, select)
      const knop = document.createElement('button')
      knop.type = 'button'
      knop.className = 'naambouwer-schud'
      knop.dataset.deel = sleutel
      knop.textContent = '🔄'
      knop.setAttribute('aria-label', t('Willekeurig') + ': ' + t(tekst))
      knop.addEventListener('click', () => { delen = { ...delen, [sleutel]: schud() }; toon(true) })
      rij.append(label, knop)
      paneel.append(rij)
      keuzes[sleutel] = select
    }
    const klaar = document.createElement('button')
    klaar.type = 'button'
    klaar.className = 'naambouwer-klaar'
    klaar.textContent = t('Klaar')
    klaar.addEventListener('click', () => { paneel.hidden = true; knopZelf.setAttribute('aria-expanded', 'false'); knopZelf.focus() })
    paneel.append(klaar)
    knopZelf.insertAdjacentElement('afterend', paneel)
    knopZelf.setAttribute('aria-controls', paneel.id)
  }

  if (knopZelf) {
    knopZelf.setAttribute('aria-expanded', 'false')
    knopZelf.addEventListener('click', () => {
      if (!paneel) bouwPaneel()
      const open = paneel.hidden
      paneel.hidden = !open
      knopZelf.setAttribute('aria-expanded', open ? 'true' : 'false')
      if (open) { toon(false); keuzes.begin.focus() }
    })
  }

  return {
    nieuw() { delen = willekeurigeDelen(rnd); toon(true) },
    delen: () => ({ ...delen })
  }
}
