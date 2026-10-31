// Proefleider: N telefoons (elk een eigen browsercontext = eigen opslag), echte WebRTC, nep-signalering.
const { chromium } = require('playwright')
const http = require('http'), fs = require('fs'), path = require('path')
const [,, map, aantal, seconden, nieuw] = process.argv
const WWW = path.resolve(map)
const server = http.createServer((req, res) => {
  const p = path.join(WWW, decodeURIComponent(req.url.split('?')[0]))
  if (!p.startsWith(WWW) || !fs.existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(p).pipe(res)
}).listen(0)
;(async () => {
  const poort = server.address().port
  const namen = Array.from({ length: Number(aantal) }, (_, i) => 'u' + i + 'x'.repeat(3))
  const br = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] })
  const paginas = {}, abonnees = new Map(), logs = {}
  for (const ik of namen) {
    const ctx = await br.newContext(); const p = await ctx.newPage(); paginas[ik] = p; logs[ik] = []
    p.on('console', m => { const t = m.text(); if (/\[sync\] (Start sync|Klaar met|Vraag|Geen antwoord|Sync gestopt|Niet alles|DataChannel OPEN|.*mislukt|.*Synckanaal geweigerd)/.test(t)) logs[ik].push(t) })
    p.on('pageerror', e => logs[ik].push('FOUT ' + e.message))
    await p.exposeBinding('__stuur', async (src, soort, a, b) => {
      if (soort === 'abonneer') { if (!abonnees.has(a)) abonnees.set(a, new Set()); abonnees.get(a).add(ik) }
      else if (soort === 'opzeggen') { abonnees.get(a)?.delete(ik) }
      else if (soort === 'kanaal') { for (const ander of abonnees.get(a) || []) if (ander !== ik) paginas[ander].evaluate(([n, x]) => window.__ontvang(n, x), [a, b]).catch(() => {}) }
      else if (soort === 'paar') { paginas[a]?.evaluate(([v, s, d]) => window.__paarBericht(v, s, d), [ik, b.soort, b.data]).catch(() => {}) }
    })
  }
  for (const ik of namen) await paginas[ik].goto(`http://127.0.0.1:${poort}/telefoon.html?ik=${ik}&vrienden=${namen.join(',')}&nieuw=${nieuw}&oud=${process.env.OUD || ''}`)
  const begin = Date.now(), alle = namen.length * (namen.length - 1)
  let volledigNa = null
  while (Date.now() - begin < Number(seconden) * 1000) {
    await new Promise(r => setTimeout(r, 1000))
    let n = 0
    for (const ik of namen) n += await paginas[ik].evaluate(([ik, nn]) => nn.filter(x => x !== ik && localStorage.getItem('fibro_syncbij_' + ik + '_' + x)).length, [ik, namen])
    if (n === alle && volledigNa === null) { volledigNa = Math.round((Date.now() - begin) / 1000); break }
  }
  const stand = {}
  for (const ik of namen) stand[ik] = await paginas[ik].evaluate(([ik, nn]) => nn.filter(x => x !== ik).map(x => x + (localStorage.getItem('fibro_syncbij_' + ik + '_' + x) ? ':ja' : ':nee') + (localStorage.getItem('vriend_naam_' + x + '_' + ik) ? '(naam ' + localStorage.getItem('vriend_naam_' + x + '_' + ik) + ')' : '')).join(' '), [ik, namen])
  console.log(JSON.stringify({ volledigNa, stand }, null, 1))
  if (process.env.LOG) for (const ik of namen) console.log(ik, logs[ik].slice(0, 25).join('\n   '))
  const fouten = Object.values(logs).flat().filter(l => l.startsWith('FOUT'))
  if (fouten.length) console.log('fouten:', fouten.slice(0, 5))
  await br.close(); server.close()
})()
