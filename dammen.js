// ════════════════════════════════════════════════════
// dammen.js — internationale dammen-engine (10x10) voor Fibro multiplayer
// Bord: 10x10 array. Alleen donkere velden (r+k oneven) worden gebruikt.
// Stuk notatie: 'wS' (wit schijf), 'wD' (wit dam), 'zS' (zwart schijf), 'zD' (zwart dam)
// Wit speelt van onder naar boven (rij 9 -> rij 0), zwart van boven naar onder
// ════════════════════════════════════════════════════

export function nieuwBord() {
  const b = Array(10).fill(null).map(() => Array(10).fill(null))
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 10; k++) {
      if ((r + k) % 2 === 1) b[r][k] = 'zS'
    }
  }
  for (let r = 6; r < 10; r++) {
    for (let k = 0; k < 10; k++) {
      if ((r + k) % 2 === 1) b[r][k] = 'wS'
    }
  }
  return b
}

export function nieuweSpelStaat() {
  return {
    bord: nieuwBord(),
    aanZet: 'w',
  }
}

function kleurVan(stuk) { return stuk ? stuk[0] : null }
function isDam(stuk) { return stuk ? stuk[1] === 'D' : false }
function tegenKleur(k) { return k === 'w' ? 'z' : 'w' }
function inBord(r, k) { return r >= 0 && r < 10 && k >= 0 && k < 10 }

function vindSlagKetens(bord, r, k, kleur, dam, reedsGeslagen = []) {
  const richtingen = [[-1,-1],[-1,1],[1,-1],[1,1]]
  const ketens = []

  for (const [dr, dk] of richtingen) {
    if (dam) {
      let nr = r + dr, nk = k + dk
      let tegenstanderPos = null
      while (inBord(nr, nk) && !bord[nr][nk]) { nr += dr; nk += dk }
      if (inBord(nr, nk) && bord[nr][nk] && kleurVan(bord[nr][nk]) !== kleur &&
          !reedsGeslagen.some(([gr,gk]) => gr===nr && gk===nk)) {
        tegenstanderPos = [nr, nk]
        let lr = nr + dr, lk = nk + dk
        while (inBord(lr, lk) && !bord[lr][lk]) {
          const nieuweKeten = { van: [r,k], naar: [lr,lk], geslagen: tegenstanderPos }
          const vervolgBord = simuleerSlag(bord, r, k, lr, lk, tegenstanderPos)
          const vervolgKetens = vindSlagKetens(vervolgBord, lr, lk, kleur, true, [...reedsGeslagen, tegenstanderPos])
          if (vervolgKetens.length > 0) {
            for (const vk2 of vervolgKetens) ketens.push([nieuweKeten, ...vk2])
          } else {
            ketens.push([nieuweKeten])
          }
          lr += dr; lk += dk
        }
      }
    } else {
      const mr = r + dr, mk = k + dk
      const lr = r + 2*dr, lk = k + 2*dk
      if (!inBord(lr, lk) || bord[lr][lk]) continue
      if (!inBord(mr, mk) || !bord[mr][mk] || kleurVan(bord[mr][mk]) === kleur) continue
      if (reedsGeslagen.some(([gr,gk]) => gr===mr && gk===mk)) continue

      const nieuweKeten = { van: [r,k], naar: [lr,lk], geslagen: [mr,mk] }
      const vervolgBord = simuleerSlag(bord, r, k, lr, lk, [mr, mk])
      const wordtDam = (kleur === 'w' && lr === 0) || (kleur === 'z' && lr === 9)
      const vervolgKetens = wordtDam ? [] : vindSlagKetens(vervolgBord, lr, lk, kleur, false, [...reedsGeslagen, [mr,mk]])
      if (vervolgKetens.length > 0) {
        for (const vk2 of vervolgKetens) ketens.push([nieuweKeten, ...vk2])
      } else {
        ketens.push([nieuweKeten])
      }
    }
  }
  return ketens
}

function simuleerSlag(bord, vr, vk, nr, nk, geslagenPos) {
  const nieuw = bord.map(rij => rij.slice())
  const stuk = nieuw[vr][vk]
  nieuw[vr][vk] = null
  nieuw[geslagenPos[0]][geslagenPos[1]] = null
  nieuw[nr][nk] = stuk
  return nieuw
}

function vindNormaleZetten(bord, r, k, kleur, dam) {
  const zetten = []
  if (dam) {
    const richtingen = [[-1,-1],[-1,1],[1,-1],[1,1]]
    for (const [dr, dk] of richtingen) {
      let nr = r + dr, nk = k + dk
      while (inBord(nr, nk) && !bord[nr][nk]) {
        zetten.push({ van:[r,k], naar:[nr,nk], geslagen:null })
        nr += dr; nk += dk
      }
    }
  } else {
    const dr = kleur === 'w' ? -1 : 1
    for (const dk of [-1, 1]) {
      const nr = r + dr, nk = k + dk
      if (inBord(nr, nk) && !bord[nr][nk]) {
        zetten.push({ van:[r,k], naar:[nr,nk], geslagen:null })
      }
    }
  }
  return zetten
}

export function alleZetten(staat, kleur) {
  const bord = staat.bord
  let alleSlagKetens = []
  let alleNormaleZetten = []

  for (let r = 0; r < 10; r++) {
    for (let k = 0; k < 10; k++) {
      const stuk = bord[r][k]
      if (!stuk || kleurVan(stuk) !== kleur) continue
      const dam = isDam(stuk)

      const ketens = vindSlagKetens(bord, r, k, kleur, dam)
      if (ketens.length > 0) alleSlagKetens.push(...ketens)

      const normaal = vindNormaleZetten(bord, r, k, kleur, dam)
      alleNormaleZetten.push(...normaal.map(z => [z]))
    }
  }

  if (alleSlagKetens.length > 0) return { ketens: alleSlagKetens, verplichtSlaan: true }
  return { ketens: alleNormaleZetten, verplichtSlaan: false }
}

export function zettenVoorStuk(staat, r, k) {
  const stuk = staat.bord[r][k]
  if (!stuk) return []
  const { ketens } = alleZetten(staat, kleurVan(stuk))
  return ketens.filter(keten => keten[0].van[0] === r && keten[0].van[1] === k)
}

export function voerKetenUit(staat, keten) {
  let bord = staat.bord
  for (const sprong of keten) {
    const stuk = bord[sprong.van[0]][sprong.van[1]]
    bord = bord.map(rij => rij.slice())
    bord[sprong.van[0]][sprong.van[1]] = null
    if (sprong.geslagen) bord[sprong.geslagen[0]][sprong.geslagen[1]] = null
    bord[sprong.naar[0]][sprong.naar[1]] = stuk
  }
  const laatste = keten[keten.length - 1]
  const eindStuk = bord[laatste.naar[0]][laatste.naar[1]]
  const kleur = kleurVan(eindStuk)
  if (!isDam(eindStuk)) {
    if ((kleur === 'w' && laatste.naar[0] === 0) || (kleur === 'z' && laatste.naar[0] === 9)) {
      bord[laatste.naar[0]][laatste.naar[1]] = kleur + 'D'
    }
  }
  staat.bord = bord
  staat.aanZet = tegenKleur(staat.aanZet)
  return staat
}

export function heeftGeenZetten(staat, kleur) {
  const { ketens } = alleZetten(staat, kleur)
  return ketens.length === 0
}

export const STUK_SYMBOLEN = { wS: '⛀', wD: '⛁', zS: '⛂', zD: '⛃' }
