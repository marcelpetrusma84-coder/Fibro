// naambouwer.js (v4, 24 nov 2026; v2: begin, midden en einde naast elkaar; v3: alle woorden Engels;
// v4: zonder hoofdletters, dus crazyfrogking in plaats van CrazyFrogKing): de gebruikersnaam-generator bij registreren (login.html en invite.html).
//
// Een gebruikersnaam bestaat uit drie stukjes: een begin (Turbo, Crazy, Sleepy...), een dier of grappig woord
// (Frog, Pancake, RubberDuck...) en een einde (42, Pro, King...). Sinds v3 zijn alle woorden Engels (op verzoek
// van Marcel); bestaande gebruikersnamen veranderen niet. Voorheen stonden er drie korte lijstjes
// los in login.html en invite.html. Op verzoek van Marcel zijn er nu veel meer woorden, op één plek, en kun je je
// naam ook zelf samenstellen: drie keuzelijstjes met elk een 🔄-knop.
//
// Het naamveld blijft op slot (readonly). Je kiest alleen uit deze lijstjes, zodat niemand per ongeluk zijn echte
// naam of iets onaardigs als gebruikersnaam neemt. Je echte naam vul je in bij "Je eigen naam" (eigennaam.js).
//
// Alle woorden: alleen kleine letters a-z (v4: zonder hoofdletters, op verzoek van Marcel; in de lijsten hieronder
// staan ze nog met hoofdletters, zodat ze makkelijk te lezen zijn). Geen spaties, geen ë/ï: de gebruikersnaam wordt ook het (nep-)
// e-mailadres <naam>@fibro.internal bij Supabase. De einden mogen ook cijfers hebben.

export const BEGIN = [
  'Turbo', 'Pixel', 'Neon', 'Fluffy', 'Sneaky', 'Chonky', 'Sparkly', 'Grumpy', 'Bouncy', 'Squishy', 'Dizzy',
  'Glitchy', 'Funky', 'Wiggly', 'Zappy', 'Bubbly', 'Fuzzy', 'Goofy', 'Jazzy', 'Mighty', 'Nifty', 'Peppy', 'Quirky',
  'Sassy', 'Ultra', 'Wacky', 'Zesty', 'Blobby', 'Clumsy', 'Derpy', 'Floppy', 'Hangry', 'Jumpy', 'Kooky', 'Lazy',
  'Moody', 'Nerdy', 'Silly', 'Zippy', 'Psycho', 'Mega', 'Hyper', 'Retro', 'Cyber', 'Magic', 'Spicy', 'Crispy',
  'Sleepy', 'Happy', 'Jolly', 'Cheeky', 'Wobbly', 'Snappy', 'Speedy', 'Cosmic', 'Galactic', 'Atomic', 'Rocket',
  'Thunder', 'Stormy', 'Sunny', 'Frosty', 'Toasty', 'Cozy', 'Comfy', 'Crunchy', 'Salty', 'Sugar', 'Honey', 'Minty',
  'Fizzy', 'Soapy', 'Disco', 'Party', 'Ninja', 'Pirate', 'Robo', 'Royal', 'Golden', 'Silver', 'Rusty', 'Shiny',
  'Glowy', 'Sparky', 'Twinkle', 'Stinky', 'Tiny', 'Mini', 'Giga', 'Super', 'Captain', 'Professor', 'Sir', 'Lady',
  'Baron', 'Mister', 'Missy', 'Lucky', 'Spooky', 'Wonky', 'Noisy', 'Sticky', 'Slimy', 'Bonkers', 'Chill', 'Epic',
  'Legendary', 'Mystic', 'Shadow', 'Laser', 'Rainbow', 'Banana', 'Waddle', 'Snuggle', 'Tickle', 'Giggly',
  'Humble', 'Brave', 'Clever', 'Swift', 'Wild', 'Fancy', 'Dapper', 'Grand', 'Polar', 'Tropical', 'Jungle', 'Arctic',
  'Lunar', 'Solar', 'Stellar', 'Quantum', 'Nitro', 'Pocket', 'Jumbo', 'Mellow', 'Rowdy', 'Zany',
  'Crazy', 'Cheerful', 'Tough', 'Smart', 'Fast', 'Merry', 'Weird', 'Glad', 'Daring', 'Bold', 'Sweet', 'Little',
  'Big', 'Cool', 'Hip', 'Naughty', 'Hungry', 'Itchy', 'Slippery', 'Chubby', 'Dancing', 'Singing', 'Flying',
  'Jumping', 'Rolling', 'Snoring', 'Bouncing', 'Smarty', 'Massive', 'Teeny', 'Blazing', 'Joyful', 'Zigzag',
  'Crackle', 'Chatty', 'Cuddly', 'Cutie', 'Strong', 'Wise', 'Rapid', 'Turbo', 'Frozen', 'Fiery', 'Electric',
  'Velvet', 'Cranky', 'Spunky', 'Snazzy', 'Groovy', 'Dreamy', 'Breezy', 'Misty', 'Dusty', 'Muddy', 'Sandy'
].map(w => w.toLowerCase()).filter((w, i, a) => a.indexOf(w) === i)

// Het middelste stukje, in groepjes (de groepjes zie je in het keuzelijstje bij "Zelf samenstellen").
// Een woord staat maar in één groepje (komt het twee keer voor, dan telt het eerste).
const MIDDEN_RUW = {
  'Dieren': [
    'Frog', 'Panda', 'Hamster', 'Raccoon', 'Capybara', 'Axolotl', 'Koala', 'Penguin', 'Flamingo', 'Alpaca',
    'Squirrel', 'Narwhal', 'Quokka', 'Wombat', 'Platypus', 'Blobfish', 'Monkey', 'Bear', 'Beaver', 'Bee', 'Buffalo',
    'GuineaPig', 'Chinchilla', 'Dolphin', 'Badger', 'Dodo', 'Pigeon', 'Duck', 'Hedgehog', 'Moose', 'Donkey',
    'Pheasant', 'Ferret', 'Goose', 'Gecko', 'Gibbon', 'Giraffe', 'Gnu', 'Goldfish', 'Gorilla', 'Shark', 'Rooster',
    'Hare', 'Lizard', 'Deer', 'Dog', 'Bumblebee', 'Hyena', 'PolarBear', 'Squid', 'Jaguar', 'Camel', 'Canary',
    'Kangaroo', 'Cat', 'Beetle', 'Chicken', 'Cow', 'Hummingbird', 'Bunny', 'Crab', 'Lobster', 'Crocodile',
    'Jellyfish', 'Llama', 'Lion', 'Dragonfly', 'Sloth', 'Lynx', 'Lemur', 'Marmot', 'Mole', 'Ant', 'Sparrow',
    'Mouse', 'Rhino', 'Hippo', 'Octopus', 'Owl', 'Elephant', 'Orca', 'Otter', 'Horse', 'Toad', 'Parrot', 'Peacock',
    'Pelican', 'Puma', 'Pony', 'Poodle', 'Caterpillar', 'Stingray', 'Salamander', 'Sheep', 'Turtle', 'Snail',
    'Snake', 'Starling', 'Porcupine', 'Meerkat', 'Ostrich', 'Tapir', 'Tiger', 'Toucan', 'Pig', 'Bat', 'Butterfly',
    'Fox', 'Walrus', 'Weasel', 'Wolf', 'Worm', 'Zebra', 'Seal', 'Manatee', 'Seahorse', 'Swan', 'Reindeer',
    'Lemming', 'Okapi', 'Pangolin', 'Fennec', 'HoneyBadger', 'Cuckoo', 'Blackbird', 'Woodpecker', 'Magpie', 'Crow',
    'Raven', 'Pug', 'Dachshund', 'Corgi', 'Husky', 'Puppy', 'Kitten', 'Chick', 'Lamb', 'Foal', 'Quail', 'Stork',
    'Heron', 'Seagull', 'Mammoth', 'Dino', 'Trex', 'Ladybug', 'Grasshopper', 'Cricket', 'Firefly', 'Starfish',
    'Shrimp', 'Mussel', 'Clownfish', 'Piranha', 'Catfish', 'Pike', 'Baboon', 'Chimp', 'Orangutan', 'Armadillo',
    'Anteater', 'Possum', 'Wallaby', 'Emu', 'Kiwi', 'Puffin', 'Goat', 'Yak', 'Bison', 'Mongoose', 'Koi', 'Tadpole',
    'Iguana', 'Chameleon', 'Turkey', 'Vulture', 'Eagle', 'Falcon', 'Hawk', 'Moth', 'Wasp'
  ],
  'Fantasie': [
    'Dragon', 'Unicorn', 'Yeti', 'Kraken', 'Phoenix', 'Griffin', 'Troll', 'Gnome', 'Pixie', 'Robot', 'Alien',
    'Ghost', 'Monster', 'Wizard', 'Knight', 'Pirate', 'Ninja', 'Viking', 'Astronaut', 'Superhero', 'Mermaid',
    'Giant', 'Witch', 'Fairy', 'Goblin', 'Sphinx', 'Pegasus', 'Bigfoot', 'Nessie', 'Cyborg', 'Droid', 'Golem',
    'Gremlin', 'Ufo', 'Martian', 'Elf', 'Ogre', 'Vampire', 'Zombie', 'Mummy', 'Sorcerer', 'Jester'
  ],
  'Eten': [
    'Noodle', 'Pickle', 'Waffle', 'Muffin', 'Burrito', 'Spaghetti', 'Nugget', 'Avocado', 'Pancake', 'Crumpet',
    'Croquette', 'Meatball', 'Sausage', 'Toastie', 'Fries', 'Cheese', 'Sprinkles', 'Licorice', 'PeanutButter',
    'ApplePie', 'Banana', 'Mango', 'Pineapple', 'Strawberry', 'Blueberry', 'Coconut', 'Pear', 'Lemon', 'Melon',
    'Broccoli', 'Carrot', 'Sprout', 'Potato', 'Taco', 'Nacho', 'Pizza', 'Donut', 'Cupcake', 'Brownie', 'Cookie',
    'Croissant', 'Bagel', 'Pretzel', 'Sushi', 'Dumpling', 'Popcorn', 'Marshmallow', 'Toffee', 'Lollipop', 'Candy',
    'Pudding', 'Jelly', 'Smoothie', 'Milkshake', 'Sandwich', 'Hotdog', 'Hamburger', 'Gingerbread', 'Gumdrop',
    'GummyBear', 'Pasta', 'Ravioli', 'Lasagna', 'Biscuit', 'Cracker', 'Chips', 'Olive', 'Radish', 'Zucchini',
    'Eggplant', 'Pepper', 'Pumpkin', 'Cucumber', 'Tomato', 'Onion', 'Garlic', 'Mushroom', 'IceCream', 'Popsicle',
    'Cake', 'Custard', 'Cherry', 'Peach', 'Plum', 'Grape', 'Bacon', 'Omelette', 'Cereal', 'Wasabi', 'Ketchup',
    'Mustard', 'Mayo', 'Butter', 'Bun', 'Cinnamon', 'Fudge', 'Truffle', 'Macaron', 'Churro', 'Quesadilla'
  ],
  'Dingen en geluiden': [
    'Toaster', 'Pillow', 'Cactus', 'Sock', 'Slipper', 'Teapot', 'Umbrella', 'RubberDuck', 'Vacuum', 'Clothespin',
    'Boomerang', 'Trampoline', 'Balloon', 'Marble', 'Yoyo', 'Spinner', 'Kazoo', 'Ukulele', 'Tuba', 'Drum', 'Horn',
    'Whistle', 'Scooter', 'Skateboard', 'Rascal', 'Scamp', 'Imp', 'Quack', 'Splash', 'Boing', 'Wobble', 'Bonk',
    'Bang', 'Zoom', 'Whoosh', 'Poof', 'Pow', 'Zap', 'Plop', 'Achoo', 'Giggle', 'Snore', 'Chuckle', 'Tweet', 'Bloop',
    'Zoink', 'Kaboom', 'SockPuppet', 'Cushion', 'Pajamas', 'Clog', 'Windmill', 'Bike', 'Tractor', 'Comet', 'Planet',
    'Meteor', 'Cloud', 'Snowman', 'Gamepad', 'Joystick', 'Walkman', 'Cassette', 'Radio', 'Lantern', 'Rattle',
    'Lighthouse', 'Compass', 'Treasure', 'Pinata', 'Confetti', 'Glitter', 'Spatula', 'Whisk', 'Ladle', 'Colander',
    'Teddy', 'Plushie', 'Frisbee', 'Kite', 'Sandcastle', 'Bucket', 'Shovel', 'Crumb', 'Bubble', 'Blob', 'Splat',
    'Droplet', 'Whirlwind', 'Tornado', 'Hat', 'Bowtie', 'Mustache', 'Beard', 'Glasses', 'Nose', 'Toe', 'Roar',
    'Burp', 'Hiccup', 'Sneeze', 'Slurp', 'Honk', 'Beep', 'Bleep', 'Squeak', 'Noodlehead', 'Doodle', 'Gizmo',
    'Gadget', 'Widget', 'Sprocket', 'Thingamajig', 'Doohickey', 'Wiggle', 'Jiggle', 'Bingo', 'Jackpot'
  ]
}
const gezien = new Set()
export const MIDDEN = Object.fromEntries(Object.entries(MIDDEN_RUW).map(([groep, woorden]) =>
  [groep, woorden.map(w => w.toLowerCase()).filter(w => !gezien.has(w) && gezien.add(w))]))
export const MIDDEN_ALLES = [...gezien]

export const EINDE = [
  '42', '88', '99', '404', '1337', 'XL', 'Pro', 'Max', 'Zero', 'Alpha', 'Prime', '9000', 'Plus', 'Elite', 'Ace',
  'Boss', 'Legend', '007', '777', '1', '7', '11', '13', '21', '23', '33', '64', '100', '101', '123', '200', '321',
  '360', '500', '999', '1000', '2000', '3000', '5000', 'Jr', 'Sr', 'II', 'III', 'XXL', 'Mini', 'Turbo', 'Deluxe',
  'Supreme', 'Royale', 'Express', 'GT', 'HD', '3D', 'X', 'Z', 'Ultra', 'Junior', 'Senior', 'Neo', 'Nova', 'Omega',
  'Gamma', 'Delta', 'King', 'Queen', 'Hero', 'Champ', 'Star', 'Prince', 'Duke', 'Knight', 'Master', 'Expert',
  'Fan', 'Club', 'Crew', 'Squad', 'Gang', 'Party', 'Power', 'Force', 'Speed', 'Blitz', 'Flash', 'Go', 'Yeah',
  'Wow', 'Woof', 'Boom', 'Hey', 'Yay', 'Yippee', 'Tadaa', 'Ole', 'Hooray', 'Wheee', 'Brrr', 'Zzz', 'Rocks',
  'Zone', 'Land', 'World', 'Time', 'Mode', 'Life'
].map(w => w.toLowerCase()).filter((w, i, a) => a.indexOf(w) === i)

const kies = (lijst, rnd) => lijst[Math.min(lijst.length - 1, Math.floor(rnd() * lijst.length))]

// Drie willekeurige stukjes. rnd is te vervangen in de tests.
// Een willekeurige naam is hoogstens MAX_WILLEKEURIG tekens (anders opnieuw), zodat hij overal goed past.
// Zelf samenstellen mag langer (zie test-naambouwer.mjs voor de langste).
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
    .naambouwer-rijen { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px; margin-bottom:10px; }
    .naambouwer-rij { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .naambouwer-rij label { display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:600; min-width:0; }
    .naambouwer-rij label span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .naambouwer-rij select { width:100%; min-width:0; min-height:44px; border-radius:10px; border:1.5px solid var(--border, #e2d4ef); background:#faf7fd; color:var(--text, #2a1240); font:inherit; font-size:16px; font-weight:600; padding:8px 3px; text-overflow:ellipsis; -webkit-appearance:none; appearance:none; text-align:center; text-align-last:center; cursor:pointer; }
    .naambouwer-rij select:focus { outline:none; box-shadow:0 0 0 4px rgba(139,63,209,.15); }
    .naambouwer-schud { width:100%; height:40px; border-radius:10px; border:1px solid var(--accent, #c084fc); background:transparent; color:var(--accent, #c084fc); font-size:18px; cursor:pointer; }
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
    // v2: begin, midden en einde naast elkaar (op verzoek van Marcel), elk met de 🔄 eronder
    const naastElkaar = document.createElement('div')
    naastElkaar.className = 'naambouwer-rijen'
    paneel.append(naastElkaar)
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
      naastElkaar.append(rij)
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
