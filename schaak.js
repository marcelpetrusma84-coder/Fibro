// ════════════════════════════════════════════════════
// schaak.js — compacte schaak-engine voor Fibro multiplayer
// Bord: 8x8 array, rij 0 = zwart achterste rij, rij 7 = wit achterste rij
// Stuk notatie: 'wP','wN','wB','wR','wQ','wK' (wit), 'zP','zN','zB','zR','zQ','zK' (zwart)
// ════════════════════════════════════════════════════

export function nieuwBord() {
  const b = Array(8).fill(null).map(() => Array(8).fill(null))
  const volgorde = ['R','N','B','Q','K','B','N','R']
  for (let k = 0; k < 8; k++) {
    b[0][k] = 'z' + volgorde[k]
    b[1][k] = 'zP'
    b[6][k] = 'wP'
    b[7][k] = 'w' + volgorde[k]
  }
  return b
}

export function nieuweSpelStaat() {
  return {
    bord: nieuwBord(),
    aanZet: 'w',                 // 'w' of 'z'
    rokade: { wK: true, wQ: true, zK: true, zQ: true }, // koningszijde/damezijde rokaderecht
    enPassantKolom: null,        // kolom waar en-passant mogelijk is (net na een dubbele pionzet)
    halfzetTeller: 0,            // voor 50-zetten regel (niet gebruikt voor nu, maar netjes om te hebben)
  }
}

function kleurVan(stuk) { return stuk ? stuk[0] : null }
function typeVan(stuk) { return stuk ? stuk[1] : null }
function tegenKleur(k) { return k === 'w' ? 'z' : 'w' }
function inBord(r, k) { return r >= 0 && r < 8 && k >= 0 && k < 8 }

// ── Genereer alle "ruwe" zetten voor een stuk (zonder schaak-check) ──
function ruweZetten(staat, r, k) {
  const stuk = staat.bord[r][k]
  if (!stuk) return []
  const kleur = kleurVan(stuk)
  const type = typeVan(stuk)
  const zetten = []
  const bord = staat.bord

  const voegToe = (nr, nk, specType) => {
    if (!inBord(nr, nk)) return false
    const doel = bord[nr][nk]
    if (doel && kleurVan(doel) === kleur) return false
    zetten.push({ van: [r,k], naar: [nr,nk], type: specType || (doel ? 'slag' : 'normaal') })
    return !doel // ga door als leeg, stop als geslagen
  }

  if (type === 'P') {
    const richting = kleur === 'w' ? -1 : 1
    const startRij = kleur === 'w' ? 6 : 1
    // Voorwaarts
    if (inBord(r+richting, k) && !bord[r+richting][k]) {
      voegToe(r+richting, k, 'normaal')
      if (r === startRij && !bord[r+2*richting][k]) {
        voegToe(r+2*richting, k, 'dubbelzet')
      }
    }
    // Diagonaal slaan
    for (const dk of [-1, 1]) {
      const nr = r+richting, nk = k+dk
      if (!inBord(nr, nk)) continue
      const doel = bord[nr][nk]
      if (doel && kleurVan(doel) !== kleur) {
        zetten.push({ van:[r,k], naar:[nr,nk], type:'slag' })
      } else if (!doel && staat.enPassantKolom === nk && r === (kleur==='w'?3:4)) {
        zetten.push({ van:[r,k], naar:[nr,nk], type:'enpassant' })
      }
    }
  } else if (type === 'N') {
    const sprongen = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
    for (const [dr,dk] of sprongen) voegToe(r+dr, k+dk)
  } else if (type === 'B') {
    for (const [dr,dk] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let nr=r+dr, nk=k+dk
      while (inBord(nr,nk)) { if (!voegToe(nr,nk)) break; nr+=dr; nk+=dk }
    }
  } else if (type === 'R') {
    for (const [dr,dk] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let nr=r+dr, nk=k+dk
      while (inBord(nr,nk)) { if (!voegToe(nr,nk)) break; nr+=dr; nk+=dk }
    }
  } else if (type === 'Q') {
    for (const [dr,dk] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) {
      let nr=r+dr, nk=k+dk
      while (inBord(nr,nk)) { if (!voegToe(nr,nk)) break; nr+=dr; nk+=dk }
    }
  } else if (type === 'K') {
    for (const [dr,dk] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      voegToe(r+dr, k+dk)
    }
    // Rokade
    const rij = kleur === 'w' ? 7 : 0
    if (r === rij && k === 4) {
      const kort = kleur === 'w' ? staat.rokade.wK : staat.rokade.zK
      const lang = kleur === 'w' ? staat.rokade.wQ : staat.rokade.zQ
      if (kort && !bord[rij][5] && !bord[rij][6] && bord[rij][7] === kleur+'R') {
        if (!staatInSchaak(staat, kleur) && !veldAangevallen(staat, rij, 5, tegenKleur(kleur)) && !veldAangevallen(staat, rij, 6, tegenKleur(kleur))) {
          zetten.push({ van:[r,k], naar:[rij,6], type:'rokade-kort' })
        }
      }
      if (lang && !bord[rij][1] && !bord[rij][2] && !bord[rij][3] && bord[rij][0] === kleur+'R') {
        if (!staatInSchaak(staat, kleur) && !veldAangevallen(staat, rij, 3, tegenKleur(kleur)) && !veldAangevallen(staat, rij, 2, tegenKleur(kleur))) {
          zetten.push({ van:[r,k], naar:[rij,2], type:'rokade-lang' })
        }
      }
    }
  }

  return zetten
}

// ── Voer een zet uit op een KOPIE van het bord (voor simulatie) ──
function voerZetUitOpKopie(staat, zet) {
  const bord = staat.bord.map(rij => rij.slice())
  const [vr, vk] = zet.van
  const [nr, nk] = zet.naar
  const stuk = bord[vr][vk]
  bord[vr][vk] = null

  if (zet.type === 'enpassant') {
    const richting = kleurVan(stuk) === 'w' ? 1 : -1
    bord[nr+richting][nk] = null // geslagen pion verwijderen
  }
  if (zet.type === 'rokade-kort') {
    const rij = vr
    bord[rij][5] = bord[rij][7]; bord[rij][7] = null
  }
  if (zet.type === 'rokade-lang') {
    const rij = vr
    bord[rij][3] = bord[rij][0]; bord[rij][0] = null
  }

  bord[nr][nk] = stuk
  return bord
}

function vindKoning(bord, kleur) {
  for (let r = 0; r < 8; r++)
    for (let k = 0; k < 8; k++)
      if (bord[r][k] === kleur + 'K') return [r, k]
  return null
}

function veldAangevallen(staat, r, k, aanvallerKleur) {
  for (let rr = 0; rr < 8; rr++) {
    for (let kk = 0; kk < 8; kk++) {
      const stuk = staat.bord[rr][kk]
      if (!stuk || kleurVan(stuk) !== aanvallerKleur) continue
      const zetten = ruweZetten(staat, rr, kk)
      if (zetten.some(z => z.naar[0] === r && z.naar[1] === k)) return true
    }
  }
  return false
}

export function staatInSchaak(staat, kleur) {
  const kPos = vindKoning(staat.bord, kleur)
  if (!kPos) return false
  return veldAangevallen(staat, kPos[0], kPos[1], tegenKleur(kleur))
}

// ── Alle LEGALE zetten voor een stuk (filtert zetten die jezelf in schaak zetten) ──
export function legaleZetten(staat, r, k) {
  const stuk = staat.bord[r][k]
  if (!stuk) return []
  const kleur = kleurVan(stuk)
  const ruwe = ruweZetten(staat, r, k)

  return ruwe.filter(zet => {
    const nieuwBordSim = voerZetUitOpKopie(staat, zet)
    const simStaat = { ...staat, bord: nieuwBordSim }
    return !staatInSchaak(simStaat, kleur)
  })
}

export function alleLegaleZetten(staat, kleur) {
  const alles = []
  for (let r = 0; r < 8; r++) {
    for (let k = 0; k < 8; k++) {
      const stuk = staat.bord[r][k]
      if (stuk && kleurVan(stuk) === kleur) {
        alles.push(...legaleZetten(staat, r, k))
      }
    }
  }
  return alles
}

// ── Voer een zet ECHT uit (muteert de staat, update rokaderecht/en-passant) ──
export function voerZetUit(staat, zet, promotieStuk) {
  const [vr, vk] = zet.van
  const [nr, nk] = zet.naar
  const stuk = staat.bord[vr][vk]
  const kleur = kleurVan(stuk)
  const type = typeVan(stuk)

  staat.bord[vr][vk] = null

  if (zet.type === 'enpassant') {
    const richting = kleur === 'w' ? 1 : -1
    staat.bord[nr+richting][nk] = null
  }
  if (zet.type === 'rokade-kort') {
    staat.bord[vr][5] = staat.bord[vr][7]; staat.bord[vr][7] = null
  }
  if (zet.type === 'rokade-lang') {
    staat.bord[vr][3] = staat.bord[vr][0]; staat.bord[vr][0] = null
  }

  // Promotie: pion die de laatste rij bereikt
  let geplaatstStuk = stuk
  if (type === 'P' && (nr === 0 || nr === 7)) {
    geplaatstStuk = kleur + (promotieStuk || 'Q')
  }
  staat.bord[nr][nk] = geplaatstStuk

  // Update rokaderecht
  if (type === 'K') {
    if (kleur === 'w') { staat.rokade.wK = false; staat.rokade.wQ = false }
    else { staat.rokade.zK = false; staat.rokade.zQ = false }
  }
  if (type === 'R') {
    if (vr === 7 && vk === 0) staat.rokade.wQ = false
    if (vr === 7 && vk === 7) staat.rokade.wK = false
    if (vr === 0 && vk === 0) staat.rokade.zQ = false
    if (vr === 0 && vk === 7) staat.rokade.zK = false
  }
  // Als toren geslagen wordt, verlies ook rokaderecht
  if (nr === 7 && nk === 0) staat.rokade.wQ = false
  if (nr === 7 && nk === 7) staat.rokade.wK = false
  if (nr === 0 && nk === 0) staat.rokade.zQ = false
  if (nr === 0 && nk === 7) staat.rokade.zK = false

  // Update en-passant kolom
  staat.enPassantKolom = (zet.type === 'dubbelzet') ? vk : null

  staat.aanZet = tegenKleur(staat.aanZet)
  return staat
}

export function isSchaakmat(staat, kleur) {
  return staatInSchaak(staat, kleur) && alleLegaleZetten(staat, kleur).length === 0
}

export function isPat(staat, kleur) {
  return !staatInSchaak(staat, kleur) && alleLegaleZetten(staat, kleur).length === 0
}

export const STUK_SYMBOLEN = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  zK:'♚', zQ:'♛', zR:'♜', zB:'♝', zN:'♞', zP:'♟',
}
