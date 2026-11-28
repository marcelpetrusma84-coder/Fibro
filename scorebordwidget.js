// scorebordwidget.js (v1, 26 nov 2026, Marcel) - de widget 🏆 Scorebord op Home: al je spellen op een rij, jouw beste
// score naast die van je beste vriend. Tik op een spel en het opent (met het titelscherm, zoals de spelwidgets).
//
// Waar het vandaan komt:
//  - spel_scores_overzicht (sql/spel-scores.sql): per spel je beste en de beste vriend. Alleen echte vrienden
//    (van twee kanten), zonder wie geblokkeerd is.
//  - Koningsjacht en Neon Raiders hebben hun eigen lijsten (koningsjacht_boards, neon_raiders_boards).
//  - Zonder internet of zonder account: alleen je eigen scores van dit toestel (spelscores.js bewaart ze).
// Persoonlijk: alleen op je eigen Home. Op het profiel van een vriend staat hij niet (vriend-profiel.html).
import { scoreSpelInfo } from './scorespellen.js?v=9'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kort = v => typeof v === 'string' ? v.trim().slice(0, 40) : ''
const getal = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null
const EIGEN = { koningsjacht: { naam: 'Koningsjacht', icoon: '👑', soort: 'punten', rpc: 'koningsjacht_boards', toon: n => n + '/12' },
  shmup: { naam: 'Neon Raiders', icoon: '🚀', soort: 'punten', rpc: 'neon_raiders_boards' } }

function zetStijl() {
  if (document.getElementById('sbw-css')) return
  const s = document.createElement('style'); s.id = 'sbw-css'
  s.textContent = `.sbw{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;font-size:13px}
.sbw-lijst{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:0;list-style:none}
.sbw-rij{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:7px 4px;border:0;border-top:1px solid #ffffff14;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.sbw-rij:first-child{border-top:0}
.sbw-rij:active{background:#ffffff0d}
.sbw-icoon{font-size:20px;text-align:center}
.sbw-naam{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sbw-sub{font-size:11px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sbw-stand{display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-variant-numeric:tabular-nums}
.sbw-jij{font-weight:800;color:#c084fc}
.sbw-vriend{font-size:11px;opacity:.85}
.sbw-leeg{margin:auto;padding:12px;text-align:center;opacity:.8;line-height:1.5}
.sbw-voet{font-size:11px;opacity:.65;padding-top:4px;text-align:center}`
  document.head.append(s)
}

export async function tekenScorebordWidget(c, { supabase, uid, openSpel, open = openSpel || (() => {}), T = globalThis.T || (s => s), storage = globalThis.localStorage } = {}) {
  zetStijl()
  const tt = (s, w) => { try { return T(s, w) } catch (e) { return s } }
  c.replaceChildren()
  const doos = document.createElement('div'); doos.className = 'sbw'
  const laden = document.createElement('div'); laden.className = 'sbw-leeg'; laden.textContent = tt('Scores laden…')
  doos.append(laden); c.append(doos)

  const naamVan = (id, username) => {
    try { const n = kort(storage?.getItem('vriend_naam_' + uid + '_' + id)); if (n) return n } catch (e) {}
    return kort(username) || tt('Vriend')
  }
  const rijen = []   // { spel, naam, icoon, soort, mijn, vriend: { naam, waarde } | null, laatst, toon }
  let online = true
  if (UUID.test(uid || '')) {
    try {
      const { data, error } = await supabase.rpc('spel_scores_overzicht')
      if (error || !Array.isArray(data)) throw error || new Error('geen lijst')
      for (const r of data) {
        const info = scoreSpelInfo(r?.spel)
        const mijn = getal(r?.mijn)
        if (!info || mijn === null || r.soort !== info.soort) continue
        const vw = r.vriend && UUID.test(r.vriend.user_id || '') ? getal(r.vriend.waarde) : null
        rijen.push({ spel: info.id, naam: info.naam, icoon: info.icoon, soort: info.soort, mijn, laatst: String(r.laatst || ''),
          vriend: vw === null ? null : { naam: naamVan(r.vriend.user_id, r.vriend.username), waarde: vw } })
      }
    } catch (e) { online = false }
    // Koningsjacht en Neon Raiders: hun eigen lijsten (jouw beste en de beste vriend)
    await Promise.all(Object.entries(EIGEN).map(async ([spel, info]) => {
      try {
        const { data, error } = await supabase.rpc(info.rpc)
        if (error || !data) return
        const eigen = (data.personal || []).filter(r => r?.user_id === uid).map(r => getal(r.score)).filter(n => n !== null)
        if (!eigen.length) return
        const vr = (data.friends || []).filter(r => r && r.user_id !== uid && UUID.test(r.user_id || '') && getal(r.score) !== null)
          .sort((a, b) => b.score - a.score)[0]
        rijen.push({ spel, naam: info.naam, icoon: info.icoon, soort: 'punten', mijn: Math.max(...eigen), toon: info.toon,
          laatst: String((data.personal || [])[0]?.played_at || ''),
          vriend: vr ? { naam: naamVan(vr.user_id, vr.username), waarde: vr.score } : null })
      } catch (e) {}
    }))
  } else online = false

  // Geen internet of geen account: je eigen beste scores van dit toestel
  if (!online || !rijen.length) {
    const al = new Set(rijen.map(r => r.spel))
    try {
      for (let i = 0; i < (storage?.length || 0); i++) {
        const k = storage.key(i) || ''
        const m = /^fibro_spelscores_v1_([a-z0-9_-]+)_(.+)$/.exec(k)
        if (!m || al.has(m[1]) || (m[2] !== (uid || 'lokaal'))) continue
        const info = scoreSpelInfo(m[1]); if (!info) continue
        const potjes = (JSON.parse(storage.getItem(k) || '{}').potjes || []).filter(p => p && getal(p.score) !== null)
        if (!potjes.length) continue
        const mijn = info.soort === 'punten' ? Math.max(...potjes.map(p => p.score)) : potjes.filter(p => p.gewonnen).length
        rijen.push({ spel: info.id, naam: info.naam, icoon: info.icoon, soort: info.soort, mijn, vriend: null,
          laatst: potjes.map(p => p.playedAt || '').sort().pop() || '' })
      }
    } catch (e) {}
  }

  doos.replaceChildren()
  if (!rijen.length) {
    const leeg = document.createElement('div'); leeg.className = 'sbw-leeg'
    leeg.textContent = tt('Nog geen scores. Speel een spel en vergelijk je met je vrienden!')
    doos.append(leeg); return { rijen }
  }
  rijen.sort((a, b) => b.laatst.localeCompare(a.laatst))
  const lijst = document.createElement('ul'); lijst.className = 'sbw-lijst'
  for (const r of rijen) {
    const waarde = n => r.toon ? r.toon(n) : r.soort === 'winst' ? tt('{n}× gewonnen', { n }) : new Intl.NumberFormat(T.locale || 'nl-NL').format(n)
    const li = document.createElement('li')
    const knop = document.createElement('button'); knop.type = 'button'; knop.className = 'sbw-rij'; knop.dataset.spel = r.spel
    const icoon = document.createElement('span'); icoon.className = 'sbw-icoon'; icoon.textContent = r.icoon; icoon.setAttribute('aria-hidden', 'true')
    const midden = document.createElement('span'); midden.style.minWidth = '0'
    const naam = document.createElement('div'); naam.className = 'sbw-naam'; naam.textContent = tt(r.naam)
    const sub = document.createElement('div'); sub.className = 'sbw-sub'
    const ikVoor = !r.vriend || r.mijn > r.vriend.waarde, gelijk = r.vriend && r.mijn === r.vriend.waarde
    sub.textContent = !r.vriend ? (online ? tt('Nog geen vriend met een score') : tt('Alleen van dit toestel'))
      : gelijk ? tt('🤝 Gelijk met {naam}', { naam: r.vriend.naam })
      : ikVoor ? tt('👑 Jij staat voor op {naam}', { naam: r.vriend.naam }) : tt('{naam} staat voor', { naam: r.vriend.naam })
    midden.append(naam, sub)
    const stand = document.createElement('span'); stand.className = 'sbw-stand'
    const jij = document.createElement('span'); jij.className = 'sbw-jij'; jij.textContent = tt('Jij: {s}', { s: waarde(r.mijn) })
    stand.append(jij)
    if (r.vriend) { const v = document.createElement('span'); v.className = 'sbw-vriend'; v.textContent = r.vriend.naam + ': ' + waarde(r.vriend.waarde); stand.append(v) }
    knop.append(icoon, midden, stand)
    knop.setAttribute('aria-label', tt(r.naam) + '. ' + jij.textContent + (r.vriend ? '. ' + r.vriend.naam + ': ' + waarde(r.vriend.waarde) : ''))
    knop.onclick = e => { e.stopPropagation(); open(r.spel) }
    li.append(knop); lijst.append(li)
  }
  doos.append(lijst)
  if (!online) { const voet = document.createElement('div'); voet.className = 'sbw-voet'; voet.textContent = tt('De scores van je vrienden komen zodra je online bent.'); doos.append(voet) }
  return { rijen }
}
