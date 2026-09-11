// dammen-ui.js — speelscherm voor internationaal dammen (10x10) in Fibro
// Slagen kies je stap voor stap. Zetten reizen via het spelkanaal; raakt er een
// bericht zoek, dan haalt de wachtende speler de stand vanzelf opnieuw op.

export function start({ Dammen, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
    const titel = document.getElementById('spelTitelBar')
    if (titel) titel.textContent = '⚫ Dammen'
        const inhoud = document.getElementById('spelInhoud')
        const VAKJE = 32
        const mijnKleur = benIkSpeler1 ? 'w' : 'z'
        const naam = vriendNaam || 'vriend'

        let staat = Dammen.nieuweSpelStaat()
        let spelId = 0, nr = 0, gameOver = false
        let laatsteKeten = null, geselecteerd = null, pad = [], ketensCache = null, melding = ''

        inhoud.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div id="dam-status" style="color:white;font-size:14px;font-weight:600;text-align:center;min-height:20px;"></div>
        <div id="dam-bord" style="display:grid;grid-template-columns:repeat(10,${VAKJE}px);grid-template-rows:repeat(10,${VAKJE}px);border:3px solid #3a2a5e;border-radius:6px;overflow:hidden;touch-action:manipulation;"></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.6);text-align:center;">Slaan is verplicht. De slag met de meeste stukken gaat voor.</div>
        <button id="dam-opnieuw" style="display:none;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:10px;padding:10px 22px;color:#1a0a2e;font-weight:600;cursor:pointer;">↻ Opnieuw spelen</button>
        </div>`
        const bordEl = document.getElementById('dam-bord')
        const statusEl = document.getElementById('dam-status')
        const opnieuwBtn = document.getElementById('dam-opnieuw')
        try { Bordgeluid.knop(statusEl) } catch (e) {}

        const zelfde = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]
        const stuur = (event, payload) => { try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
        const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)

        function mijnKetens() {
            if (!ketensCache) ketensCache = Dammen.alleZetten(staat, mijnKleur)
                return ketensCache
        }
        function kandidaten() {
            if (!geselecteerd) return []
                return mijnKetens().ketens.filter(k => zelfde(k[0].van, geselecteerd) && pad.every((s, i) => zelfde(k[i] && k[i].naar, s.naar)))
        }

        function rijVolgorde() { return mijnKleur === 'z' ? [9,8,7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7,8,9] }
        function kolVolgorde() { return mijnKleur === 'z' ? [9,8,7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7,8,9] }

        function tekenBord() {
            // Toon het bord zoals het er halverwege een gekozen slagroute uitziet
            const bord = staat.bord.map(r => r.slice())
            const halfGeslagen = []
            if (geselecteerd && pad.length) {
                const stuk = bord[geselecteerd[0]][geselecteerd[1]]
                bord[geselecteerd[0]][geselecteerd[1]] = null
                for (const s of pad) if (s.geslagen) halfGeslagen.push(s.geslagen)
                    const eind = pad[pad.length - 1].naar
                    bord[eind[0]][eind[1]] = stuk
            }
            const kand = kandidaten()
            const volgende = kand.filter(k => k.length > pad.length).map(k => k[pad.length].naar)
            const padVelden = pad.map(s => s.naar)
            const mijnBeurt = !gameOver && staat.aanZet === mijnKleur
            const moetSlaan = mijnBeurt && !geselecteerd && mijnKetens().verplichtSlaan
            const slaanVanaf = moetSlaan ? mijnKetens().ketens.map(k => k[0].van) : []
            const laatste = laatsteKeten ? [laatsteKeten[0].van, ...laatsteKeten.map(s => s.naar)] : []

            bordEl.innerHTML = ''
            for (const r of rijVolgorde()) {
                for (const k of kolVolgorde()) {
                    const v = document.createElement('div')
                    const donker = (r + k) % 2 === 1
                    let achter = donker ? '#8a6242' : '#eed9b8'
                    if (donker && laatste.some(p => zelfde(p, [r, k]))) achter = '#c9a93a'
                        if (donker && padVelden.some(p => zelfde(p, [r, k]))) achter = '#a78bfa'
                            if (zelfde(geselecteerd, [r, k]) && !pad.length) achter = '#7ec8e3'
                                v.style.cssText = `width:${VAKJE}px;height:${VAKJE}px;background:${achter};display:flex;align-items:center;justify-content:center;position:relative;cursor:${donker ? 'pointer' : 'default'};user-select:none;`
                                v.dataset.r = r; v.dataset.k = k
                                const stuk = bord[r][k]
                                if (stuk) {
                                    const s = document.createElement('div')
                                    const wit = stuk[0] === 'w'
                                    const verplicht = slaanVanaf.some(p => zelfde(p, [r, k]))
                                    const weg = halfGeslagen.some(p => zelfde(p, [r, k]))
                                    s.style.cssText = `width:${VAKJE - 8}px;height:${VAKJE - 8}px;border-radius:50%;background:${wit ? 'radial-gradient(circle at 35% 30%, #fff, #ddd)' : 'radial-gradient(circle at 35% 30%, #555, #111)'};box-shadow:${verplicht ? '0 0 0 3px #fbbf24,0 0 10px #fbbf24' : '0 2px 3px rgba(0,0,0,0.5)'};display:flex;align-items:center;justify-content:center;opacity:${weg ? 0.35 : 1};pointer-events:none;`
                                    if (stuk[1] === 'D') s.innerHTML = `<span style="font-size:14px;color:${wit ? '#b8860b' : '#fbbf24'};">★</span>`
                                        v.appendChild(s)
                                }
                                if (donker && volgende.some(p => zelfde(p, [r, k]))) {
                                    const stip = document.createElement('div')
                                    stip.style.cssText = 'position:absolute;width:10px;height:10px;border-radius:50%;background:rgba(34,197,94,0.85);pointer-events:none;'
                                    v.appendChild(stip)
                                }
                                bordEl.appendChild(v)
                }
            }
            toonStatus(moetSlaan)
        }

        function toonStatus(moetSlaan) {
            if (gameOver) return
                if (melding) { statusEl.textContent = melding; return }
                if (staat.aanZet !== mijnKleur) { statusEl.textContent = 'Wachten op ' + naam + '...'; return }
                if (geselecteerd && pad.length) { statusEl.textContent = 'Tik op het volgende groene stipje'; return }
                if (moetSlaan) {
                    const n = mijnKetens().ketens[0].filter(s => s.geslagen).length
                    statusEl.textContent = 'Jouw beurt — je moet slaan' + (n > 1 ? ' (' + n + ' stukken)' : '') + '!'
                    return
                }
                statusEl.textContent = 'Jouw beurt'
        }

        bordEl.addEventListener('click', e => {
            const v = e.target.closest('[data-r]')
            if (v) vakjeKlik(parseInt(v.dataset.r, 10), parseInt(v.dataset.k, 10))
        })

        function vakjeKlik(r, k) {
            if (gameOver || staat.aanZet !== mijnKleur) return
                melding = ''
                if (geselecteerd) {
                    const verder = kandidaten().filter(kt => kt.length > pad.length && zelfde(kt[pad.length].naar, [r, k]))
                    if (verder.length) {
                        pad.push(verder[0][pad.length])
                        const klaar = verder.find(kt => kt.length === pad.length)
                        if (klaar) { uitvoeren(klaar); return }
                        tekenBord(); return
                    }
                    if (pad.length) { geselecteerd = null; pad = []; tekenBord(); return }
                }
                const stuk = staat.bord[r][k]
                if (stuk && stuk[0] === mijnKleur) {
                    const { ketens, verplichtSlaan } = mijnKetens()
                    if (ketens.some(kt => zelfde(kt[0].van, [r, k]))) { geselecteerd = [r, k]; pad = [] }
                    else {
                        geselecteerd = null; pad = []
                        melding = verplichtSlaan ? 'Deze schijf kan niet slaan. Kies een schijf met een gouden rand.' : 'Deze schijf kan niet bewegen.'
                    }
                } else { geselecteerd = null; pad = [] }
                tekenBord()
        }

        function uitvoeren(keten) {
            Dammen.voerKetenUit(staat, keten)
            laatsteKeten = keten; nr++
            geselecteerd = null; pad = []
            stuur('zet', { keten, bord: staat.bord, aanZet: staat.aanZet, nr, spelId })
            naBeurt()
        }

        function naBeurt() {
            ketensCache = null; melding = ''
            try { Bordgeluid.dammen(Dammen, staat, laatsteKeten, mijnKleur) } catch (e) {}
            if (Dammen.heeftGeenZetten(staat, staat.aanZet)) {
                gameOver = true
                statusEl.textContent = staat.aanZet !== mijnKleur ? '🎉 Jij wint — ' + naam + ' kan niet meer zetten!' : '😢 ' + naam + ' wint!'
                opnieuwBtn.style.display = 'block'
            }
            tekenBord()
        }

        function neemStandOver(p) {
            spelId = p.spelId; nr = p.nr
            staat.bord = p.bord.map(r => r.slice()); staat.aanZet = p.aanZet
            laatsteKeten = p.keten || null
            gameOver = false; opnieuwBtn.style.display = 'none'
            geselecteerd = null; pad = []
            naBeurt()
        }

        spelKanaal.on('broadcast', { event: 'zet' }, msg => {
            const p = msg.payload || {}
            if (p.bord) {
                if (!nieuwer(p.spelId ?? spelId, p.nr ?? nr + 1)) return
                    neemStandOver({ spelId: p.spelId ?? spelId, nr: p.nr ?? nr + 1, bord: p.bord, aanZet: p.aanZet, keten: p.keten })
            } else if (p.keten) {
                Dammen.voerKetenUit(staat, p.keten); laatsteKeten = p.keten; nr++
                geselecteerd = null; pad = []; naBeurt()
            }
        })

        spelKanaal.on('broadcast', { event: 'vraag-stand' }, msg => {
            const p = msg.payload || {}
            if (spelId > (p.spelId ?? 0) || (spelId === (p.spelId ?? 0) && nr > (p.nr ?? 0))) {
                stuur('stand', { spelId, nr, bord: staat.bord, aanZet: staat.aanZet, keten: laatsteKeten })
            }
        })

        spelKanaal.on('broadcast', { event: 'stand' }, msg => {
            const p = msg.payload || {}
            if (p.bord && nieuwer(p.spelId ?? 0, p.nr ?? 0)) neemStandOver(p)
        })

        function nieuwSpel(id) {
            staat = Dammen.nieuweSpelStaat()
            spelId = id; nr = 0; gameOver = false
            laatsteKeten = null; geselecteerd = null; pad = []; ketensCache = null; melding = ''
            opnieuwBtn.style.display = 'none'
            try { Bordgeluid.kiesDamGeluid(Dammen, staat, null, mijnKleur) } catch (e) {}
            tekenBord()
        }

        spelKanaal.on('broadcast', { event: 'opnieuw' }, msg => {
            const id = (msg.payload && msg.payload.spelId) || spelId + 1
            if (id > spelId) nieuwSpel(id)
        })
        opnieuwBtn.addEventListener('click', () => {
            const id = Math.max(Date.now(), spelId + 1)
            nieuwSpel(id)
            stuur('opnieuw', { spelId: id })
        })

        // Wie wacht, vraagt af en toe de stand op. Zo loopt het spel nooit vast op een zoekgeraakt bericht.
        const vraag = () => stuur('vraag-stand', { spelId, nr })
        setTimeout(vraag, 1500)
        const timer = setInterval(() => {
            if (!bordEl.isConnected) { clearInterval(timer); return }
            if (!gameOver && staat.aanZet !== mijnKleur) vraag()
        }, 3000)

        nieuwSpel(0)
}
