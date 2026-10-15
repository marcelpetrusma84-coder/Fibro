// belregel.js — v152 (15 oktober 2026): regels over bellen in de chat.
//
// Na een gesprek zet de app van de beller een regel in de chat, als gewoon bericht in de
// tabel messages (zie bellen.js). De inhoud is dan 'oproep:<soort>:<a|v>:<seconden>':
//   soort    gemist (niemand nam op, of de beller hing op), geweigerd, gesprek
//   a / v    alleen geluid of met video
//   seconden hoe lang het gesprek duurde (alleen bij gesprek, anders 0)
// Zo'n regel is niet versleuteld (net als buzz en spel-uitnodiging): er staat alleen in
// dat er gebeld is en hoe lang, nooit wat er gezegd werd.
// Alleen een gemiste oproep telt als ongelezen (sql/belregels.sql, ongelezen.js).
const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))

const SOORTEN = ['gemist', 'geweigerd', 'gesprek']

export function maakBelregel(soort, video, seconden) {
  const s = SOORTEN.includes(soort) ? soort : 'gesprek'
  const n = Math.max(0, Math.min(359999, Math.round(Number(seconden) || 0)))
  return 'oproep:' + s + ':' + (video ? 'v' : 'a') + ':' + n
}

export function isBelregel(inhoud) {
  return typeof inhoud === 'string' && inhoud.startsWith('oproep:')
}

// Gemiste oproep bij de ander: die krijgt in de chat een rode regel
export function isGemist(inhoud) {
  return typeof inhoud === 'string' && inhoud.startsWith('oproep:gemist:')
}

// 2:34, of 1:02:03 vanaf een uur
function duurTekst(sec) {
  const u = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  const ss = String(s).padStart(2, '0')
  return u ? u + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss
}

// De tekst in de chat. isMijn = ik belde (dan 'niet opgenomen' in plaats van 'gemist').
export function belregelTekst(inhoud, isMijn) {
  const delen = String(inhoud).split(':')
  const soort = delen[1] || ''
  const video = delen[2] === 'v'
  const sec = Math.max(0, parseInt(delen[3], 10) || 0)
  if (soort === 'gemist') {
    if (isMijn) return video ? T('📹 Video-oproep · niet opgenomen') : T('📞 Oproep · niet opgenomen')
    return video ? T('📵 Gemiste video-oproep') : T('📵 Gemiste oproep')
  }
  if (soort === 'geweigerd') {
    if (isMijn) return video ? T('📹 Video-oproep · geweigerd') : T('📞 Oproep · geweigerd')
    return video ? T('📵 Video-oproep geweigerd') : T('📵 Oproep geweigerd')
  }
  if (soort === 'gesprek') {
    if (sec > 0) return video ? T('📹 Videogesprek · {duur}', { duur: duurTekst(sec) }) : T('📞 Gesprek · {duur}', { duur: duurTekst(sec) })
    return video ? T('📹 Videogesprek') : T('📞 Gesprek')
  }
  return video ? T('📹 Video-oproep') : T('📞 Oproep')
}
