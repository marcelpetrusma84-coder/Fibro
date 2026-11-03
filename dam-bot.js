// dam-bot.js - de computer als tegenstander bij dammen (spel.html), v1 (3 nov 2026)
//
// Praat met dammen-ui.js via hetzelfde nep-kanaal als een vriend (solo.js: maakSoloKanaal): hij krijgt 'zet',
// 'vraag-stand' en 'opnieuw', en stuurt 'zet' en 'stand' terug. Mens = wit, computer = zwart.
// Het rekenen gebeurt in dammen-worker.js (lukt een worker niet, dan hier, met dezelfde damcomputer).
import { damKies } from './dammen-computer.js?v=1'

export function damBot({ stuur, niveau, isDicht, motor: Dammen }) {
    const IK = 'z'
    let staat = Dammen.nieuweSpelStaat()
    let spelId = 0, nr = 0, vraagNr = 0
    let laatsteKeten = null
    let worker = null, timer = null
    try {
        worker = new Worker(new URL('./dammen-worker.js?v=1', import.meta.url), { type: 'module' })
        worker.onerror = () => { try { worker.terminate() } catch (e) {} worker = null }
    } catch (e) { worker = null }

    // Even wachten voor de zet, anders voelt het niet als een tegenstander (op moeilijk en expert denkt hij zelf al)
    const pauze = () => (niveau === 'moeilijk' || niveau === 'expert') ? 150 : 450 + Math.floor(Math.random() * 400)

    function zet(keten, id, n) {
        if (isDicht() || !keten || id !== spelId || n !== nr || staat.aanZet !== IK) return
        staat = Dammen.voerKetenUit({ bord: staat.bord, aanZet: staat.aanZet }, keten)
        nr++
        laatsteKeten = keten
        stuur('zet', { keten, bord: staat.bord, aanZet: staat.aanZet, nr, spelId })
    }

    function denk() {
        const id = spelId, n = nr, mijnVraag = ++vraagNr
        const begin = Date.now()
        clearTimeout(timer)
        const klaar = keten => {
            if (mijnVraag !== vraagNr) return
            const wacht = Math.max(0, pauze() - (Date.now() - begin))
            timer = setTimeout(() => zet(keten, id, n), wacht)
        }
        const stand = { bord: staat.bord.map(r => r.slice()), aanZet: staat.aanZet }
        if (worker) {
            const luister = ({ data }) => {
                if (!data || data.id !== mijnVraag) return
                worker && worker.removeEventListener('message', luister)
                klaar(data.keten)
            }
            worker.addEventListener('message', luister)
            worker.postMessage({ id: mijnVraag, staat: stand, niveau })
        } else {
            timer = setTimeout(() => klaar(damKies(Dammen, stand, niveau)), 30)
        }
    }

    return {
        ontvang(event, p) {
            if (event === 'zet' && p.bord) {
                const id = p.spelId ?? spelId, n = p.nr ?? nr + 1
                if (id < spelId || (id === spelId && n <= nr)) return
                spelId = id; nr = n
                staat = { bord: p.bord.map(r => r.slice()), aanZet: p.aanZet }
                laatsteKeten = p.keten || null
                if (staat.aanZet === IK && !Dammen.heeftGeenZetten(staat, IK) && !p.einde) denk()
            } else if (event === 'vraag-stand') {
                const id = p.spelId ?? 0, n = p.nr ?? 0
                if (spelId > id || (spelId === id && nr > n)) stuur('stand', { spelId, nr, bord: staat.bord, aanZet: staat.aanZet, keten: laatsteKeten })
            } else if (event === 'opnieuw') {
                const id = p.spelId ?? spelId + 1
                if (id <= spelId) return
                spelId = id; nr = 0; vraagNr++
                staat = Dammen.nieuweSpelStaat()
                laatsteKeten = null
                clearTimeout(timer)
            }
        },
        stop() { clearTimeout(timer); vraagNr++; if (worker) { try { worker.terminate() } catch (e) {} worker = null } },
    }
}
