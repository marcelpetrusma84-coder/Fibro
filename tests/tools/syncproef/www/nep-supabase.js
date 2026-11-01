// Nep-supabase: realtime-kanalen via de proefleider (window.__stuur / window.__ontvang)
const kanalen = new Map()
window.__ontvang = (naam, bericht) => { const k = kanalen.get(naam); if (k && k.open) for (const l of k.luisteraars) if (l.event === bericht.event || l.event === '*') setTimeout(() => l.fn(bericht), 0) }
export const supabase = {
  channel(naam) {
    if (kanalen.has(naam)) return kanalen.get(naam)
    const k = { topic: 'realtime:' + naam, naam, luisteraars: [], open: false,
      on(type, f, fn) { this.luisteraars.push({ event: f.event, fn }); return this },
      subscribe(cb) { this.open = true; window.__stuur('abonneer', naam); setTimeout(() => cb && cb('SUBSCRIBED'), 50); return this },
      async send(b) { if (!this.open) return 'error'; window.__stuur('kanaal', naam, b); return 'ok' } }
    kanalen.set(naam, k); return k
  },
  getChannels() { return [...kanalen.values()] },
  async removeChannel(k) { k.open = false; kanalen.delete(k.naam); window.__stuur('opzeggen', k.naam) },
  from() { const q = { update() { return q }, eq() { return q }, select() { return Promise.resolve({ data: [{ id: 1 }], error: null }) } }; return q },
}
