// widgets.js (v1, 27 nov 2026, Marcel: "een widget aanmelden in één regel") - de lijst met widgets die zichzelf tekenen.
//
// In gewone woorden: een nieuwe widget is één bestand (bijvoorbeeld casinowidget.js, met een functie die de widget in een
// vakje tekent) en één regel hier. Daarmee staat hij vanzelf:
//   - in de Store bij Widgets (store.js, STORE_WIDGETS), met de uitleg in het Nederlands en het Engels;
//   - op Home (index.html: in de lijst met widgets en getekend met tekenLijstWidget);
//   - NIET op het profiel van een vriend als hij persoonlijk is (vriend-profiel.html slaat hem over).
// Begin met sjabloon-widget.js (een werkende voorbeeldwidget).
//
// Een regel: { id, icoon, titel, titelEn, w, h, bestand, teken, persoonlijk, alleenVolwassen, uitleg: [nl, en] }
//   id          de naam van de widget (kleine letters), ook de naam in de Store
//   w, h        hoe breed (1 tot 4) en hoe hoog (1 tot 4) in vakjes
//   bestand     het script, met ?v= (zoals elk script)
//   teken       de functie in dat script: teken(vakje, { supabase, uid, T, openSpel }) - mag async zijn
//   persoonlijk true = alleen op je eigen Home (bijvoorbeeld jouw scores of jouw tokens); vrienden zien hem niet
//   alleenVolwassen  true = alleen voor 18+ (28 nov 2026, het casino): onder de 18 staat hij niet in de Store, niet op Home
//                    en niet in Profiel > Widgets (leeftijd.js)
// Widgets met inhoud die naar vrienden gaat (foto's, radio, RSS, ...) staan nog op de oude manier in index.html,
// vriend-profiel.html en sync.js; die verhuizen later.

import { benIkVolwassen } from './leeftijd.js?v=1'

export const WIDGET_LIJST = [
  { id: 'scorebord', icoon: '\u{1F3C6}', titel: 'Scorebord', titelEn: 'Scoreboard', w: 4, h: 3, bestand: './scorebordwidget.js?v=9', teken: 'tekenScorebordWidget', persoonlijk: true,
    uitleg: ['Al je spellen op een rij: jouw beste score naast die van je beste vriend. Wie staat er voor? Tik op een spel om meteen te spelen. Alleen je echte vrienden doen mee, en alleen jij ziet deze widget.',
      'All your games in a row: your best score next to your best friend\'s. Who is ahead? Tap a game to play right away. Only your real friends take part, and only you see this widget.'] },
  { id: 'casino', icoon: '\u{1F3B0}', titel: 'Casino', titelEn: 'Casino', w: 4, h: 3, bestand: './casinowidget.js?v=5', teken: 'tekenCasinoWidget', persoonlijk: true, alleenVolwassen: true,
    uitleg: ['Je casino-tokens op Home (18+): elke week krijg je er 250 bij en je kunt tot -100 staan. Zet ze in bij Black Jack, Poker, Video Poker, Hoger of lager en de Fruitautomaat, en kijk wie van je vrienden de rijkste is. Tokens zijn speelgeld: je kunt ze niet kopen of inwisselen.',
      'Your casino tokens on Home (18+): you get 250 more every week and you can go down to -100. Bet them at Black Jack, Poker, Video Poker, Higher or lower and the Fruit machine, and see which of your friends is the richest. Tokens are play money: you cannot buy or cash them in.'] },
]

const ID = /^[a-z][a-z0-9_-]{1,30}$/
// 28 nov 2026: mag je deze widget zien? (alleenVolwassen: niet als je onder de 18 bent; onbekend = wel, de server beslist)
export const magZien = (w, volwassen = benIkVolwassen()) => Boolean(w) && (!w.alleenVolwassen || volwassen !== false)
const zichtbaar = () => { const v = benIkVolwassen(); return WIDGET_LIJST.filter(w => magZien(w, v)) }
export const lijstWidget = id => WIDGET_LIJST.find(w => w.id === id) || null
export const isPersoonlijk = id => Boolean(lijstWidget(id)?.persoonlijk)

// Voor de lijst met widgets op Home (index.html, PROFIEL_DEFS)
export const homeDefs = () => zichtbaar().map(w => ({ id: w.id, icon: w.icoon, titel: w.titel, w: w.w, h: w.h }))
// Voor de Store (store.js, STORE_WIDGETS)
export const storeDefs = () => zichtbaar().map(w => ({ id: w.id, soort: 'widget', titel: w.titel, widget: w.id, homeIcoon: w.icoon, w: w.w, h: w.h,
  uitleg: w.uitleg[0], uitlegEn: w.uitleg[1] }))

// Een widget uit de lijst tekenen in vakje c. Lukt het laden niet, dan blijft het vakje leeg (met een melding in de console).
export async function tekenLijstWidget(id, c, ctx = {}) {
  const w = lijstWidget(id)
  if (!w || !c || !magZien(w)) return false
  let m
  try { m = await import(w.bestand) } catch (e) { console.warn('[widget ' + id + ']', e); return false }
  if (typeof m[w.teken] !== 'function') { console.warn('[widget ' + id + '] geen functie ' + w.teken); return false }
  try { await m[w.teken](c, ctx) } catch (e) { console.warn('[widget ' + id + ']', e); return false }
  return true
}

// Klopt de lijst? (tests/ui/test-widgets-lijst.mjs) Geeft een lijst met fouten.
export function controleerLijst(lijst = WIDGET_LIJST) {
  const f = [], gezien = new Set()
  for (const w of lijst) {
    if (!w || !ID.test(w.id || '')) { f.push('Onbekende id: ' + (w && w.id)); continue }
    if (gezien.has(w.id)) f.push('Dubbel: ' + w.id); gezien.add(w.id)
    if (typeof w.icoon !== 'string' || !w.icoon || w.icoon.length > 8) f.push(w.id + ': icoon')
    if (typeof w.titel !== 'string' || !w.titel.trim() || typeof w.titelEn !== 'string' || !w.titelEn.trim()) f.push(w.id + ': titel (nl en en)')
    if (![1, 2, 3, 4].includes(w.w) || ![1, 2, 3, 4].includes(w.h)) f.push(w.id + ': w en h zijn 1 tot 4')
    if (!/^\.\/[a-z0-9-]+\.js\?v=\d+$/.test(w.bestand || '')) f.push(w.id + ': bestand moet ./naam.js?v=getal zijn')
    if (!/^[a-zA-Z]\w*$/.test(w.teken || '')) f.push(w.id + ': teken')
    if (typeof w.persoonlijk !== 'boolean') f.push(w.id + ': persoonlijk ja/nee')
    if (w.alleenVolwassen !== undefined && typeof w.alleenVolwassen !== 'boolean') f.push(w.id + ': alleenVolwassen ja/nee')
    if (!Array.isArray(w.uitleg) || w.uitleg.length !== 2 || w.uitleg.some(u => typeof u !== 'string' || u.trim().length < 20)) f.push(w.id + ': uitleg (nl en en)')
  }
  return f
}

// Engels: de titel (de Nederlandse titel is de sleutel, zoals in taal-en.js)
if (typeof window !== 'undefined') {
  const en = window.FIBRO_EN ||= {}
  for (const w of WIDGET_LIJST) en[w.titel] ??= w.titelEn
}
