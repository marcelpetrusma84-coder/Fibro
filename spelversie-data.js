// Canonical game versions and their recorded history, independent of Fibro's
// application/cache versions. Strings preserve minor versions such as 6.10.
// Historical dates are the first-parent main commits that introduced a number,
// not exact deployment times. The baseline is the start of registration, not
// an invented creation date. Unrecorded older versions remain unknown.
const firstRecordedAt = '2026-10-21T21:08:23+02:00'
const firstRecordedCommit = 'fbe8d756386a42fb8c6dbaa3436f7bf2534fc033'
const initial = version => ({ version, updatedAt:firstRecordedAt, summary:'Eerste vastgelegde versie', summaryEn:'First recorded version', firstRecorded:true, sourceCommit:firstRecordedCommit })
const record = (version, updatedAt, sourceCommit, summary, summaryEn) => ({ version, updatedAt, summary, summaryEn, firstRecorded:false, sourceCommit })

const histories = {
  botkaaseiren:[
    record('2.0.0', '2026-10-30T16:38:46+01:00', 'a01c648e63c01bb7b260f808d8def589af8a6503', 'Houten bord en stukken', 'Wooden board and pieces'),
    initial('1.0.0'),
  ],
  vieroprij:[
    record('2.0.0', '2026-10-30T16:45:18+01:00', '101e06baa06ad7d3a621be47602b110f5c2682b5', 'Vallende schijven en speelgoedstijl', 'Falling discs and a toy-style board'),
    initial('1.0.0'),
  ],
  schaken:[
    record('6.3.1', '2026-11-06T18:15:14+01:00', '7d9626a9373d52e1fc317ba84887a146be96de3a', 'Mobiel Ultra-bord reageert natuurlijker op een kleinere pinchbeweging', 'Ultra board resizing responds more naturally to a smaller pinch gesture'),
    record('6.3.0', '2026-11-06T17:53:27+01:00', 'a3e222e24ac0e895681644bccd7ec8c6411b54bb', 'Ultra toont na lang indrukken een legale zet met uitleg; hint en aangevallen stuk blijven duidelijk te onderscheiden', 'Ultra reveals a legal move with an explanation after a hold; the hint stays distinct when its piece is under attack'),
    record('6.2.0', '2026-11-06T17:20:18+01:00', '76fc7dc4d1226068b12b9fe3a331e3817a01a043', 'Live stappen en zichtbaarheid van paardroutes, met een highlight op het onderzochte paard', 'Live knight-route depth and opacity with a highlighted source knight'),
    record('6.1.1', '2026-11-04T17:42:54+01:00', '9cc8906dc63092618e79a705b9aee904236bab01', 'Schaakmattekst zoomt van halve naar volle grootte', 'Checkmate text zooms from half to full size'),
    // Actual implementation commit; separate from the deployment time.
    record('6.1.0', '2026-11-03T23:10:04+01:00', '3e21c7752e8d1c557054847e693b92303af5b6f7', 'Paardroutes na 2 seconden, sterker contrast en vernieuwde versiehistorie', 'Knight routes after 2 seconds, stronger contrast and improved version history'),
    record('6.0.0', '2026-11-02T13:16:03+01:00', '6289a3fde4d7ad93e7c97f4924dc017fbe12fc3a', 'Ultra en live evaluatie', 'Ultra and live evaluation'),
    record('5.0.0', '2026-11-01T11:55:54+01:00', '7bf6d9768db72fb1f2de3dccf95ca82265c25709', 'Taalkeuze en gradatiegeluiden', 'Language choice and graded capture sounds'),
    record('4.0.0', '2026-10-22T19:53:19+02:00', '1c6ce6d520b10fb496253522d8919c20a938e58b', 'Betrouwbaardere camera- en geluidsstatus', 'More reliable camera and audio status'),
    record('3.0.0', '2026-10-22T18:28:32+02:00', '8fa72a338aca029249863eb46cc0e09f95222071', 'Webcam en spelen met een vriend', 'Webcam and playing with a friend'),
    initial('2.0.0'),
  ],
  dammen:[
    record('2.0.0', '2026-11-03T11:50:42+01:00', 'd2b5f6464026e0e83bcad0c50705c49cd3ed4c8c', 'Nieuw bord, sterkere computer en instellingen', 'New board, stronger computer and settings'),
    initial('1.0.0'),
  ],
  pong:[
    record('3.0.0', '2026-10-31T05:02:58+01:00', '75013c0ffcd6693b31ec5b3e1a033b39ff3915e4', 'Klassieke en blokjes-spelvormen', 'Classic and block game modes'),
    record('2.0.0', '2026-10-30T16:17:09+01:00', 'd1f1f18e63f38955e307791671adb9187eeda455', 'Blokjes, power-ups en levels', 'Blocks, power-ups and levels'),
    initial('1.0.0'),
  ],
  pacman:[initial('1.0.0')],
  pinball:[initial('1.0.0')],
  flappybird:[initial('1.0.0')],
  breakout:[
    record('2.0.0', '2026-11-02T11:42:27+01:00', '49646a13480620e4236a6fdf225a42c93a88a8e5', 'Computertegenstander en zwarte aanval', 'Computer opponent and black attack'),
    initial('1.0.0'),
  ],
  swarm:[initial('1.0.0')],
  endlessrunner:[initial('1.0.0')],
  shmup:[
    record('5.0.0', '2026-11-01T11:55:54+01:00', '7bf6d9768db72fb1f2de3dccf95ca82265c25709', 'Verder spelen na lang indrukken', 'Resume after holding the restart button'),
    record('4.0.0', '2026-10-27T21:42:57+01:00', '887d9f8955c821518648dd87f66b2448e61dd1f9', 'Muisbesturing en scorelijsten', 'Mouse controls and scoreboards'),
    initial('3.0.0'),
  ],
  // 11 nov 2026: het eerste kaartspel, alleen via de Stekky Store
  pesten:[
    // nieuw spel: de eerste versie is ook het begin van zijn geschiedenis (firstRecorded), met de echte commit
    { version:'1.0.0', updatedAt:'2026-11-11T09:41:39+01:00', summary:'Eerste kaartspel: waaier, vegen, stapel, beurtklok en spraak', summaryEn:'First card game: fanned hand, swipes, deck, turn timer and voice', firstRecorded:true, sourceCommit:'f79355903f4f2a27a866f29cd8ece3065c4e4b49' },
  ],
  // 11 nov 2026: twee kaartspellen erbij, ook alleen via de Stekky Store
  toepen:[
    { version:'1.0.0', updatedAt:'2026-11-11T16:53:30+01:00', summary:'Toepen: vier slagen, de laatste telt, en toepen om de inzet', summaryEn:'Toepen: four tricks, the last one counts, and knock to raise the stake', firstRecorded:true, sourceCommit:'48c3818ba9826733552905fd17e06ea49c1c5cc5' },
  ],
  eenentwintigen:[
    { version:'1.0.0', updatedAt:'2026-11-11T16:53:30+01:00', summary:'Eenentwintigen: pak kaarten tot zo dicht mogelijk bij 21', summaryEn:'Twenty-One: draw cards to get as close to 21 as you can', firstRecorded:true, sourceCommit:'48c3818ba9826733552905fd17e06ea49c1c5cc5' },
  ],
}

export const SPEL_HISTORIE = Object.freeze(Object.fromEntries(Object.entries(histories).map(([game, entries]) =>
  [game, Object.freeze(entries.map(entry => Object.freeze(entry)))])))
export const SPEL_VERSIES = Object.freeze(Object.fromEntries(Object.entries(SPEL_HISTORIE).map(([game, entries]) => [game, entries[0].version])))
const emptyHistory = Object.freeze([])

export function spelHistorie(game) {
  return typeof game === 'string' && Object.hasOwn(SPEL_HISTORIE, game) ? SPEL_HISTORIE[game] : emptyHistory
}

function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.test(value)) return null
  const parts = value.split('.').map(Number)
  if (!parts.every(Number.isSafeInteger)) return null
  return parts.length === 2 ? [...parts,0] : parts
}

export function vergelijkVersies(a, b) {
  const left = versionParts(a), right = versionParts(b)
  if (!left || !right) throw new TypeError('Game versions must be major.minor or major.minor.patch strings.')
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  return 0
}

export function versieLabel(version) {
  const parts = versionParts(version)
  return parts ? `v${parts[0]}.${parts[1]}${parts[2] ? '.' + parts[2] : ''}` : ''
}
