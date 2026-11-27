// casino.js (v1, 27 nov 2026, Marcel) - casino-tokens: speelgeld waarmee je inzet in de casinospellen (eerst Black Jack).
// De regels staan op de server (sql/casino-tokens.sql); dit bestand praat ermee en tekent het inzetscherm.
//
// In gewone woorden:
//  - Elke week krijg je 250 tokens erbij. Je saldo kan zakken tot -100. Hoogstens 100 per potje.
//  - Voordat de kaarten worden gedeeld kies je je inzet (of "Zonder inzet"). De inzet gaat er meteen af.
//  - Win je, dan krijg je 2× je inzet terug; gelijkspel = je inzet terug; verlies = niets.
//  - Zonder internet of zonder account speel je gewoon zonder inzet.
//  - Lukt het versturen van een uitslag niet (internet weg), dan onthoudt dit toestel hem en probeert het later opnieuw.
//
//   maakCasino({ supabase, spel })
//     .overzicht()              { saldo, volgende, vrienden, laatste } of null (geen internet / geen account)
//     .zetIn(inzet)             { runId, inzet, saldo }  (gooit een fout met .reden: 'te-weinig' of 'offline')
//     .uitslag(runId, uitslag)  { saldo } of null (later opnieuw)
//     .kiesInzet(host, { T })   toont het inzetscherm; geeft { inzet, runId, saldo } of { inzet: 0 }
export const WEEKBEDRAG = 250
export const MINIMUM = -100
export const MAX_INZET = 100
export const INZETTEN = [10, 25, 50, 100]
export const CASINO_SPELLEN = ['eenentwintigen', 'pokertexasholdem']   // 27 nov 2026: ook Poker (inkopen, de hele tafel winnen = 2×)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UITSLAGEN = ['winst', 'verlies', 'gelijk']
const OPEN = 'fibro_casino_open_'
const getal = v => Number.isSafeInteger(Number(v)) ? Number(v) : null

export const magInzetten = (saldo, inzet) => Number.isSafeInteger(saldo) && INZETTEN.includes(inzet) && saldo - inzet >= MINIMUM
// Wat je terugkrijgt na het potje (de inzet is er al af)
export const uitbetaling = (inzet, uitslag) => uitslag === 'winst' ? 2 * inzet : uitslag === 'gelijk' ? inzet : 0
// Wat het potje je opleverde: +inzet, 0 of -inzet
export const verschil = (inzet, uitslag) => uitbetaling(inzet, uitslag) - inzet

export function maakCasino({ supabase, spel, storage, uuid = () => globalThis.crypto.randomUUID(),
  isOnline = () => globalThis.navigator?.onLine !== false } = {}) {
  if (!CASINO_SPELLEN.includes(spel)) throw new TypeError('Geen casinospel: ' + spel)
  if (storage === undefined) { try { storage = globalThis.localStorage } catch {} }

  async function account() {
    try { const { data } = await supabase.auth.getSession(); const id = data?.session?.user?.id; return UUID.test(id || '') ? id : null }
    catch { return null }
  }
  // Uitslagen die nog niet zijn aangekomen (per account op dit toestel)
  function leesOpen(uid) {
    try { const l = JSON.parse(storage?.getItem(OPEN + uid) || '[]'); return Array.isArray(l) ? l.filter(o => o && UUID.test(o.runId || '') && UITSLAGEN.includes(o.uitslag)).slice(-30) : [] }
    catch { return [] }
  }
  function schrijfOpen(uid, lijst) { try { if (lijst.length) storage?.setItem(OPEN + uid, JSON.stringify(lijst)); else storage?.removeItem(OPEN + uid) } catch {} }

  async function stuurUitslag(uid, runId, uitslag) {
    let data, error
    try { ({ data, error } = await supabase.rpc('casino_uitslag', { p_run_id: runId, p_uitslag: uitslag, p_expected_user: uid })) } catch (f) { error = f }
    if (error) {
      // Onbekend of te oud: opnieuw proberen heeft geen zin
      const blijvend = /Unknown bet|Bet expired|Invalid result/.test(String(error.message || ''))
      return { ok: blijvend, saldo: null }
    }
    return { ok: true, saldo: getal(data?.saldo) }
  }
  async function verstuurOpen(uid) {
    if (!isOnline()) return
    let lijst = leesOpen(uid)
    for (const o of [...lijst]) {
      const r = await stuurUitslag(uid, o.runId, o.uitslag)
      if (!r.ok) return
      lijst = lijst.filter(x => x.runId !== o.runId)
      schrijfOpen(uid, lijst)
    }
  }

  const dienst = {
    spel,
    async overzicht() {
      const uid = await account()
      if (!uid || !isOnline()) return null
      await verstuurOpen(uid)
      let data, error
      try { ({ data, error } = await supabase.rpc('casino_overzicht')) } catch (f) { error = f }
      if (error || !data || getal(data.saldo) === null) return null
      const vrienden = (Array.isArray(data.vrienden) ? data.vrienden : [])
        .filter(v => v && UUID.test(v.user_id || '') && getal(v.saldo) !== null)
        .map(v => ({ id: v.user_id, username: typeof v.username === 'string' ? v.username.slice(0, 40) : '', saldo: getal(v.saldo), isSelf: v.user_id === uid }))
        .sort((a, b) => b.saldo - a.saldo)
      const laatste = (Array.isArray(data.laatste) ? data.laatste : [])
        .filter(l => l && UITSLAGEN.includes(l.uitslag) && getal(l.inzet) > 0)
        .map(l => ({ spel: String(l.spel || ''), inzet: getal(l.inzet), uitslag: l.uitslag, verschil: verschil(getal(l.inzet), l.uitslag) }))
      const t = Date.parse(data.volgende)
      return { uid, saldo: getal(data.saldo), volgende: Number.isFinite(t) ? t : null, vrienden, laatste }
    },
    async zetIn(inzet) {
      const fout = reden => Object.assign(new Error(reden), { reden })
      const uid = await account()
      if (!uid || !isOnline()) throw fout('offline')
      if (!INZETTEN.includes(inzet)) throw fout('ongeldig')
      const runId = uuid()
      let data, error
      try { ({ data, error } = await supabase.rpc('casino_inzet', { p_run_id: runId, p_spel: spel, p_inzet: inzet, p_expected_user: uid })) } catch (f) { error = f }
      if (error) throw fout(/Not enough tokens/.test(String(error.message || '')) ? 'te-weinig' : 'offline')
      const saldo = getal(data?.saldo)
      if (saldo === null) throw fout('offline')
      return { runId, inzet, saldo }
    },
    async uitslag(runId, uitslag) {
      if (!UUID.test(runId || '') || !UITSLAGEN.includes(uitslag)) return null
      const uid = await account()
      if (!uid) return null
      const r = isOnline() ? await stuurUitslag(uid, runId, uitslag) : { ok: false }
      if (!r.ok) { schrijfOpen(uid, [...leesOpen(uid).filter(o => o.runId !== runId), { runId, uitslag }]); return null }
      return { saldo: r.saldo }
    },
    kiesInzet(host, opties = {}) { return kiesInzet(dienst, host, opties) },
  }
  return dienst
}

function zetStijl() {
  if (document.getElementById('cas-css')) return
  const s = document.createElement('style'); s.id = 'cas-css'
  s.textContent = `.cas-inzet{position:absolute;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;padding:16px;background:#1a0a2ee6;backdrop-filter:blur(3px)}
.cas-kaart{width:min(100%,340px);padding:20px 18px;border:1px solid #c084fc88;border-radius:20px;background:linear-gradient(155deg,#2a1248,#160a26);box-shadow:0 18px 50px #000a;color:#fff;text-align:center}
.cas-titel{font-size:19px;font-weight:800;margin-bottom:4px}
.cas-saldo{font-size:30px;font-weight:900;color:#fde68a;font-variant-numeric:tabular-nums;margin:6px 0 2px}
.cas-saldo.min{color:#ff8fa3}
.cas-uitleg{font-size:12px;opacity:.75;line-height:1.4;margin-bottom:14px}
.cas-rij{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.cas-fiche{aspect-ratio:1;border-radius:50%;border:3px dashed #ffffffaa;background:#8b3fd1;color:#fff;font:inherit;font-size:17px;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #4c1d7a,0 6px 14px #0008}
.cas-fiche:nth-child(2){background:#0f9f6e}.cas-fiche:nth-child(3){background:#d1453f}.cas-fiche:nth-child(4){background:#1f1f2e}
.cas-fiche:disabled{opacity:.3;cursor:not-allowed}
.cas-fiche:active:not(:disabled){transform:translateY(2px)}
.cas-zonder{width:100%;padding:11px 0;border-radius:12px;border:1px solid #c084fc88;background:transparent;color:#c084fc;font:inherit;font-weight:700;cursor:pointer}
.cas-melding{min-height:18px;font-size:12px;color:#ff8fa3;margin-top:8px}`
  document.head.append(s)
}

// Het inzetscherm. Zonder internet of account: meteen { inzet: 0 } (dan speel je zonder inzet).
async function kiesInzet(dienst, host, { T = globalThis.T || (s => s) } = {}) {
  const tt = (s, w) => { try { return T(s, w) } catch { return s } }
  const ov = await dienst.overzicht()
  if (!ov || !host) return { inzet: 0 }
  zetStijl()
  host.querySelector('.cas-inzet')?.remove()
  return new Promise(klaar => {
    const d = document.createElement('div'); d.className = 'cas-inzet'
    d.innerHTML = '<div class="cas-kaart" role="dialog" aria-modal="true"><div class="cas-titel"></div><div class="cas-saldo"></div>' +
      '<div class="cas-uitleg"></div><div class="cas-rij"></div><button type="button" class="cas-zonder"></button><div class="cas-melding" aria-live="polite"></div></div>'
    const saldoEl = d.querySelector('.cas-saldo'), melding = d.querySelector('.cas-melding')
    d.querySelector('.cas-titel').textContent = tt('🎰 Hoeveel zet je in?')
    d.querySelector('.cas-uitleg').textContent = tt('Win je, dan krijg je je inzet dubbel terug. Elke week {n} tokens erbij; je kunt tot {min} staan.', { n: WEEKBEDRAG, min: MINIMUM })
    d.querySelector('.cas-zonder').textContent = tt('Zonder inzet spelen')
    let saldo = ov.saldo, bezig = false
    const rij = d.querySelector('.cas-rij')
    function teken() {
      saldoEl.textContent = '🪙 ' + saldo
      saldoEl.classList.toggle('min', saldo < 0)
      saldoEl.setAttribute('aria-label', tt('Saldo: {n} tokens', { n: saldo }))
      for (const b of rij.children) b.disabled = bezig || !magInzetten(saldo, Number(b.dataset.inzet))
    }
    for (const n of INZETTEN) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cas-fiche'; b.dataset.inzet = n; b.textContent = n
      b.setAttribute('aria-label', tt('{n} tokens inzetten', { n }))
      b.onclick = async () => {
        if (bezig) return
        bezig = true; melding.textContent = ''; teken()
        try { const r = await dienst.zetIn(n); d.remove(); klaar(r) }
        catch (e) {
          bezig = false
          if (e.reden === 'te-weinig') { melding.textContent = tt('Zoveel tokens heb je niet. Je kunt tot {min} staan.', { min: MINIMUM }); const o = await dienst.overzicht(); if (o) saldo = o.saldo }
          else melding.textContent = tt('Inzetten lukt nu niet. Speel zonder inzet of probeer het zo nog eens.')
          teken()
        }
      }
      rij.append(b)
    }
    d.querySelector('.cas-zonder').onclick = () => { if (!bezig) { d.remove(); klaar({ inzet: 0 }) } }
    teken()
    host.append(d)
    if (!INZETTEN.some(n => magInzetten(saldo, n))) melding.textContent = tt('Je kunt niet lager dan {min}. Maandag krijg je {n} tokens erbij.', { min: MINIMUM, n: WEEKBEDRAG })
  })
}
