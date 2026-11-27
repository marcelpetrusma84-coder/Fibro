// studio-spellen.js (v1, 25 nov 2026) - de spellen uit Stekky Studio (spelmaker.js). Dit bestand schrijft
// tests/tools/studio-spel-installeer.mjs; met de hand aanpassen hoeft niet.
//
// In gewone woorden: elk spel hier staat vanzelf overal waar een spel moet staan: de Store, het spelmenu in de chat,
// tegen de computer (spel.html), Home, Profiel > Widgets, uitnodigingen, het spelicoon en het titelscherm. Wat erin
// zit (chatbalk, webcam, spraak) staat bij 'met' en 'spraak'. Het spel zelf staat in <id>-ui.js (het scherm) en
// <id>.js (de computerspeler, export bot).
//   { id, soort: 'beurt'|'kaart', naam: [nl, en], icoon, uitleg: [nl, en], v, met: { vriend, computer, chatbalk, webcam },
//     spraak: 'knop'|'vanzelf'|'uit', titel: '' | id van een spel waarvan het titelscherm en de muziek gebruikt worden,
//     max: hoeveel spelers hoogstens (25 nov 2026; meer dan 2 = ook met de groep, groepkaartspel.js) }

export const STUDIO_SPELLEN = [
  {"id":"eenendertigen","soort":"kaart","naam":["Eenendertigen","Thirty-One"],"icoon":"🎲","uitleg":["Ruil kaarten met de tafel en kom zo dicht mogelijk bij 31 in één kleur. Klop als je denkt dat je genoeg hebt!","Swap cards with the table and get as close to 31 as you can in one suit. Knock when you think you have enough!"],"v":5,"max":6,"met":{"vriend":true,"computer":true,"chatbalk":true,"webcam":true},"spraak":"vanzelf","titel":"pesten"},
  {"id":"pokertexasholdem","soort":"kaart","naam":["Poker Texas Hold'em","Poker Texas Hold'em"],"icoon":"🎲","uitleg":["Texas Hold'em tegen de computer, een vriend of je groep: twee eigen kaarten, vijf op tafel, en bluffen maar. Speel met speelfiches, of zet je casino-tokens in.","Texas Hold'em against the computer, a friend or your group: two cards of your own, five on the table, and bluff away. Play with chips, or bet your casino tokens."],"v":2,"met":{"vriend":true,"computer":true,"chatbalk":true,"webcam":true},"spraak":"vanzelf","titel":"pesten","max":6},
  {"id":"videopoker","soort":"kaart","naam":["Video Poker","Video Poker"],"icoon":"🎰","uitleg":["Jacks or Better tegen de automaat: 5 kaarten, houd wat je wilt en ruil de rest één keer. Een paar boeren of beter betaalt uit, een royal flush 250×. Met of zonder casino-tokens.","Jacks or Better against the machine: 5 cards, hold what you like and swap the rest once. A pair of jacks or better pays, a royal flush 250×. With or without casino tokens."],"v":1,"met":{"vriend":false,"computer":true,"chatbalk":false,"webcam":false},"spraak":"uit","titel":"pesten"},
]

// Engels: de naam en de uitleg (de Nederlandse tekst is de sleutel, zoals in taal-en.js)
if (typeof window !== 'undefined') {
  const en = window.FIBRO_EN ||= {}
  for (const s of STUDIO_SPELLEN) { en[s.naam[0]] ??= s.naam[1]; en[s.uitleg[0]] ??= s.uitleg[1] }
}

export const studioSpel = id => STUDIO_SPELLEN.find(s => s.id === id) || null
export const spelBestand = s => './' + s.id + '-ui.js?v=' + s.v
export const regelBestand = s => './' + s.id + '.js?v=' + s.v
export const spelIcoon = s => 'spelicoon/' + s.id + '.webp?v=' + s.v

// De computerspeler pas ophalen als je tegen de computer speelt. maakSoloKanaal (solo.js) wil meteen een bot; tot het
// bestand er is, wachten de berichten even.
export function luieBot(s) {
  return opties => {
    let echt = null, wacht = [], gestopt = false
    import(regelBestand(s)).then(m => {
      if (gestopt) return
      echt = m.bot(opties)
      for (const [e, p] of wacht) echt.ontvang(e, p)
      wacht = null
    }).catch(e => console.warn('[studio-spel]', s.id, e))
    return {
      ontvang(e, p) { if (echt) echt.ontvang(e, p); else if (wacht) wacht.push([e, p]) },
      stop() { gestopt = true; if (echt && echt.stop) echt.stop() },
    }
  }
}

// Profiel > Widgets: de widget van een Studio-spel (spel_<id>), net als Pesten (2 x 1)
export function studioWidgetDef(n) {
  const s = typeof n === 'string' && n.startsWith('spel_') ? studioSpel(n.slice(5)) : null
  return s ? { id: 'spel_' + s.id, icon: s.icoon, titel: s.naam[0], w: 2, h: 1 } : null
}
