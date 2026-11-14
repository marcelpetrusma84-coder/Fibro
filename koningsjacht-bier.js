// Persoonlijke tafelstatus; verandert nooit de spelregels of de zetvolgorde.
export function herstelBierPartij(bewaard, partij, nieuw = false) {
  const geldig = !nieuw && bewaard?.partij === partij
    && Number.isSafeInteger(bewaard.ronde) && bewaard.ronde >= 0
    && Number.isInteger(bewaard.inhoud) && bewaard.inhoud >= 0 && bewaard.inhoud <= 100
    && typeof bewaard.oorRechts === 'boolean'
  return geldig
    ? { partij, ronde: bewaard.ronde, inhoud: bewaard.inhoud, oorRechts: bewaard.oorRechts }
    : { partij, ronde: 0, inhoud: 100, oorRechts: true }
}

export function verbindBierpul(kanaal, { speler, lees, toon, partij = () => null, actief = () => true, klok = Date.now, timers = globalThis }) {
  if (!kanaal) return { update() {}, stop() {} }
  const ander = speler === 1 ? 2 : 1
  let gestopt = false, versie = 0, ontvangenVersie = -1, laatstVerstuurd = ''
  const geldig = p => p && typeof p.zichtbaar === 'boolean' && Number.isInteger(p.inhoud)
    && p.inhoud >= 0 && p.inhoud <= 100 && typeof p.oorRechts === 'boolean'
    && Number.isSafeInteger(p.ronde) && p.ronde >= 0
  function stuur(event, payload) {
    if (gestopt || !actief()) return
    try { Promise.resolve(kanaal.send({ type: 'broadcast', event, payload })).catch(() => {}) } catch {}
  }
  function update() {
    if (gestopt || !actief()) return
    const p = lees()
    if (!geldig(p)) return
    const stand = { partij: partij(), zichtbaar: p.zichtbaar, inhoud: p.inhoud, oorRechts: p.oorRechts, ronde: p.ronde }
    const sleutel = JSON.stringify(stand)
    if (sleutel !== laatstVerstuurd) { versie = Math.max(versie + 1, klok()); laatstVerstuurd = sleutel }
    stuur('kj-bier-stand', { ...stand, speler, versie })
  }
  kanaal.on('broadcast', { event: 'kj-bier-stand' }, msg => {
    if (gestopt || !actief()) return
    const p = msg?.payload
    if (!geldig(p) || p.partij !== partij() || p.speler !== ander || !Number.isSafeInteger(p.versie) || p.versie <= ontvangenVersie) return
    ontvangenVersie = p.versie
    toon({ zichtbaar: p.zichtbaar, inhoud: p.inhoud, oorRechts: p.oorRechts, ronde: p.ronde })
  })
  kanaal.on('broadcast', { event: 'kj-bier-vraag' }, msg => {
    if (msg?.payload?.speler === ander) update()
  })
  const interval = timers.setInterval(() => {
    if (!actief()) { stop(); return }
    update()
  }, 5000)
  function stop() { if (!gestopt) { gestopt = true; timers.clearInterval(interval) } }
  update()
  stuur('kj-bier-vraag', { speler })
  return { update, stop }
}
