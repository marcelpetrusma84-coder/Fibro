// spelscores.js (v1, 26 nov 2026, Marcel) - scores van alle spellen: eerst op dit toestel, dan gedeeld via afgeschermde
// RPC's (sql/spel-scores.sql: spel_score_opslaan, spel_scorebord). Zelfde opzet als koningsjacht-scores.js:
//  - elk potje heeft één UUID; nog een keer versturen telt niet dubbel;
//  - zonder internet blijft het potje bewaard (pending) en gaat het later alsnog mee;
//  - namen: je eigen naam en de namen die je je vrienden gaf staan op dit toestel; anders de gebruikersnaam.
//
//   maakSpelScoreService({ supabase, spel, soort })
//     .bewaar({ score, gewonnen, niveau })  één afgelopen potje
//     .loadBoards()                          { personal, friends, global, status, durable } voor het scorebord
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SPEL = /^[a-z0-9_-]{1,40}$/
const NIVEAU = /^[a-z0-9_-]{0,20}$/
const PREFIX = 'fibro_spelscores_v1_'
const MAX_PENDING = 100
const MAX_LOKAAL = 300   // zoveel potjes per spel onthoudt dit toestel (voor 'winst' tellen ze allemaal mee)
const MAX_SCORE = 1000000000

const geldigeScore = v => Number.isSafeInteger(v) && v >= 0 && v <= MAX_SCORE
function tijd(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}
function setupFout(e) { return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(e?.code) }
const kortNaam = v => typeof v === 'string' ? v.trim().slice(0, 80) : ''

export function maakSpelScoreService({ supabase, spel, soort, storage, now = () => Date.now(),
  uuid = () => globalThis.crypto.randomUUID(), isOnline = () => globalThis.navigator?.onLine !== false } = {}) {
  if (!SPEL.test(String(spel || '')) || !['punten', 'winst'].includes(soort)) throw new TypeError('Onbekend spel of soort')
  if (storage === undefined) { try { storage = globalThis.localStorage } catch {} }
  const geheugen = new Map()
  let rij = Promise.resolve()
  const naElkaar = taak => { const r = rij.then(taak, taak); rij = r.catch(() => {}); return r }

  async function account() {
    try { const { data } = await supabase.auth.getSession(); const id = data?.session?.user?.id; return UUID.test(id || '') ? id : null }
    catch { return null }
  }
  const sleutel = uid => PREFIX + spel + '_' + (uid || 'lokaal')
  function schoon(lijst, max) {
    const gezien = new Set()
    return (Array.isArray(lijst) ? lijst : [])
      .filter(p => p && UUID.test(p.id || '') && geldigeScore(p.score) && tijd(p.playedAt) && NIVEAU.test(p.niveau ?? ''))
      .map(p => ({ id: p.id, score: p.score, gewonnen: p.gewonnen === true, niveau: p.niveau || '', playedAt: tijd(p.playedAt) }))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .filter(p => !gezien.has(p.id) && gezien.add(p.id)).slice(0, max)
  }
  function lees(uid) {
    const k = sleutel(uid)
    let opgeslagen = null
    try { opgeslagen = JSON.parse(storage?.getItem(k) || 'null') } catch {}
    const g = geheugen.get(k)
    return { potjes: schoon([...(opgeslagen?.potjes || []), ...(g?.potjes || [])], MAX_LOKAAL),
      pending: schoon([...(opgeslagen?.pending || []), ...(g?.pending || [])], MAX_PENDING) }
  }
  function schrijf(uid, st) {
    const k = sleutel(uid)
    geheugen.set(k, st)
    try { if (storage) { storage.setItem(k, JSON.stringify(st)); return true } } catch {}
    return false
  }
  function naamVoor(eigenaar, uid, username) {
    if (uid === eigenaar) {
      try { const n = kortNaam(JSON.parse(storage?.getItem('fibro_profiel_' + uid) || 'null')?.naam); if (n) return n } catch {}
    } else {
      try { const n = kortNaam(storage?.getItem('vriend_naam_' + eigenaar + '_' + uid)); if (n) return n } catch {}
    }
    return kortNaam(username)
  }
  async function verstuur(uid, st) {
    if (!uid) return 'local'
    if (!isOnline()) return 'offline'
    for (const p of [...st.pending]) {
      if (await account() !== uid) return 'local'
      let error
      try {
        ;({ error } = await supabase.rpc('spel_score_opslaan', { p_run_id: p.id, p_spel: spel, p_niveau: p.niveau, p_soort: soort,
          p_score: p.score, p_gewonnen: p.gewonnen, p_played_at: p.playedAt, p_expected_user: uid }))
      } catch (f) { error = f }
      if (error) return setupFout(error) ? 'setup' : 'offline'
      st.pending = st.pending.filter(x => x.id !== p.id)
      schrijf(uid, st)
    }
    return 'online'
  }

  // Lokale lijsten (zonder internet, of voordat de server antwoordt)
  function lokaal(uid, st) {
    const naam = uid ? naamVoor(uid, uid, '') : ''
    if (soort === 'punten') {
      const top = [...st.potjes].sort((a, b) => b.score - a.score || a.playedAt.localeCompare(b.playedAt)).slice(0, 10)
      return top.map(p => ({ ...p, name: naam, isSelf: true }))
    }
    const per = new Map()
    for (const p of st.potjes) {
      const n = per.get(p.niveau) || { niveau: p.niveau, gewonnen: 0, gespeeld: 0 }
      n.gespeeld++; if (p.gewonnen) n.gewonnen++
      per.set(p.niveau, n)
    }
    return [...per.values()].map(perNiveau)
  }
  const perNiveau = n => ({ id: 'niveau:' + n.niveau, niveau: n.niveau, score: n.gewonnen, gespeeld: n.gespeeld, isSelf: true, perNiveau: true })

  return {
    spel, soort,
    // Eén afgelopen potje. punten: score = de punten; winst: gewonnen ja/nee (een gelijkspel telt als gespeeld).
    bewaar({ score = 0, gewonnen = false, niveau = '', id, playedAt } = {}) {
      return naElkaar(async () => {
        const s = soort === 'winst' ? (gewonnen ? 1 : 0) : Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(score)) || 0))
        const nv = NIVEAU.test(String(niveau || '')) ? String(niveau || '') : ''
        const p = { id: id && UUID.test(id) ? id : uuid(), score: s, gewonnen: !!gewonnen, niveau: nv, playedAt: tijd(playedAt ?? now()) }
        const uid = await account()
        const st = lees(uid)
        st.potjes = schoon([p, ...st.potjes], MAX_LOKAAL)
        if (uid) st.pending = schoon([p, ...st.pending], MAX_PENDING)
        const bewaard = schrijf(uid, st)
        const status = await verstuur(uid, st)
        return { bewaard, status, id: p.id }
      })
    },
    loadBoards() {
      return naElkaar(async () => {
        const uid = await account(), st = lees(uid)
        const status = await verstuur(uid, st)
        const uit = { personal: lokaal(uid, st), friends: [], global: null, status, durable: schrijf(uid, st) }
        if (!uid || status !== 'online') return uit
        let data, error
        try { ({ data, error } = await supabase.rpc('spel_scorebord', { p_spel: spel, p_soort: soort, p_niveau: '' })) } catch (f) { error = f }
        if (await account() !== uid) return { ...uit, personal: [], status: 'local' }
        if (error || !data || typeof data !== 'object') { uit.status = setupFout(error) ? 'setup' : 'offline'; return uit }
        if (soort === 'punten') {
          const rij = r => (!r || !UUID.test(r.run_id || '') || !UUID.test(r.user_id || '') || !geldigeScore(r.score) || !tijd(r.played_at)) ? null
            : { id: r.user_id === uid ? r.run_id : r.user_id + ':' + r.run_id, score: r.score, niveau: NIVEAU.test(r.niveau || '') ? r.niveau || '' : '',
              playedAt: tijd(r.played_at), name: naamVoor(uid, r.user_id, r.username), isSelf: r.user_id === uid }
          const eigen = (Array.isArray(data.personal) ? data.personal : []).filter(r => r?.user_id === uid).map(rij).filter(Boolean)
          // de server vult aan wat dit toestel nog niet had (bijv. van een ander toestel)
          const gezien = new Set(eigen.map(r => r.id))
          uit.personal = [...eigen, ...uit.personal.filter(r => !gezien.has(r.id))]
            .sort((a, b) => b.score - a.score || a.playedAt.localeCompare(b.playedAt)).slice(0, 10)
          uit.friends = (Array.isArray(data.friends) ? data.friends : []).map(rij).filter(Boolean).slice(0, 10)
          const g = data.global
          if (g && geldigeScore(g.score)) {
            uit.global = { score: g.score, niveau: NIVEAU.test(g.niveau || '') ? g.niveau || '' : '' }
            if (UUID.test(g.user_id || '')) Object.assign(uit.global, { name: naamVoor(uid, g.user_id, g.username), isSelf: g.user_id === uid, playedAt: tijd(g.played_at) })
          }
        } else {
          const getal = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0
          const eigen = (Array.isArray(data.personal) ? data.personal : []).filter(r => r && NIVEAU.test(r.niveau ?? ''))
            .map(r => perNiveau({ niveau: r.niveau || '', gewonnen: getal(r.gewonnen), gespeeld: getal(r.gespeeld) }))
          if (eigen.length) uit.personal = eigen
          uit.friends = (Array.isArray(data.friends) ? data.friends : []).filter(r => r && UUID.test(r.user_id || ''))
            .map(r => ({ id: r.user_id, score: getal(r.gewonnen), gespeeld: getal(r.gespeeld), playedAt: tijd(r.laatst),
              name: naamVoor(uid, r.user_id, r.username), isSelf: r.user_id === uid })).slice(0, 10)
        }
        return uit
      })
    },
  }
}
