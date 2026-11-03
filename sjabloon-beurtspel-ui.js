// sjabloon-beurtspel-ui.js - SJABLOON voor een nieuw beurtspel (v1, 3 nov 2026)
//
// In gewone woorden: een klein, echt werkend spel ("Stokjes": om de beurt 1, 2 of 3 stokjes pakken; wie het
// laatste stokje pakt, verliest). Het staat nog nergens in het menu. Kopieer dit bestand als je een nieuw
// beurtspel maakt, en volg BLAUWDRUK-BEURTSPEL.md. Alles wat elk beurtspel nodig heeft zit hier al in:
//   - start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }): dezelfde aanroep als de andere spellen;
//   - het protocol over het spelkanaal: 'zet', 'vraag-stand', 'stand', 'opnieuw' (zie onder);
//   - ruimte voor de webcamrondjes (beurtspel-hulp.js) en de rode rand als iemand verliest;
//   - teksten met T(...) zodat ze in het Engels kunnen (taal-en.js).
// De chatbalk en de webcam doet chat.html vanzelf zodra de naam van het spel in BEURTSPELLEN staat.
import { webcamRuimte, opWebcamWissel, meldGeslagen } from './beurtspel-hulp.js?v=1'

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const BEGIN = 15

export function start({ Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
    const inhoud = document.getElementById('spelInhoud')
    const titel = document.getElementById('spelTitelBar')
    if (titel) titel.textContent = '🪵 Sticks'
    const ik = benIkSpeler1 ? 1 : 2
    const naam = vriendNaam || T('vriend')
    const solo = Boolean(spelKanaal && spelKanaal.isSolo)

    // ── De stand van het spel. Alles wat de ander moet weten, zit in dit ene object. ──
    let staat = { over: BEGIN, aanZet: 1 }
    let spelId = 0, nr = 0, gameOver = false

    inhoud.innerHTML = '<div class="sj-spel" style="display:flex;flex-direction:column;align-items:center;gap:14px;color:#fff;font-family:system-ui,sans-serif">'
        + '<div class="sj-status" role="status" aria-live="polite" style="font-weight:700;min-height:22px;text-align:center"></div>'
        + '<div class="sj-stokjes" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:320px"></div>'
        + '<div class="sj-knoppen" style="display:flex;gap:8px"></div>'
        + '<button type="button" class="sj-opnieuw" hidden style="padding:10px 16px;border-radius:12px;border:none;font-weight:700">' + T('↻ Opnieuw spelen') + '</button>'
        + '</div>'
    const spelEl = inhoud.querySelector('.sj-spel')
    const statusEl = inhoud.querySelector('.sj-status')
    const stokjesEl = inhoud.querySelector('.sj-stokjes')
    const knoppenEl = inhoud.querySelector('.sj-knoppen')
    const opnieuwBtn = inhoud.querySelector('.sj-opnieuw')
    const stuur = (event, payload) => { try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
    const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)

    // ── Tekenen ──
    function teken() {
        // BLAUWDRUK: laat bovenin ruimte voor de webcamrondjes (chat.html geeft al padding; hier kun je je bord kleiner maken)
        spelEl.style.transform = webcamRuimte() ? 'scale(.92)' : ''
        stokjesEl.innerHTML = '<span style="display:inline-block;width:10px;height:70px;border-radius:5px;background:linear-gradient(#e9c28a,#9b6a3a)"></span>'.repeat(staat.over)
        const mijnBeurt = !gameOver && staat.aanZet === ik
        knoppenEl.innerHTML = ''
        for (const n of [1, 2, 3]) {
            const b = document.createElement('button')
            b.type = 'button'; b.textContent = T('Pak {n}', { n })
            b.disabled = !mijnBeurt || n > staat.over
            b.style.cssText = 'min-height:44px;padding:8px 14px;border-radius:12px;border:1px solid #ffffff33;background:#ffffff18;color:#fff;font-weight:700'
            b.onclick = () => pak(n)
            knoppenEl.appendChild(b)
        }
        opnieuwBtn.hidden = !gameOver
        if (gameOver) return
        statusEl.textContent = mijnBeurt ? T('Jouw beurt') : (solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam }))
    }

    function controleerEinde(wieDeed) {
        if (staat.over > 0) return
        gameOver = true
        const ikVerloor = wieDeed === ik           // wie het laatste stokje pakte, verliest
        statusEl.textContent = ikVerloor ? T('😢 {naam} wint!', { naam }) : T('🎉 Jij wint!')
        // BLAUWDRUK: meld wie er iets verliest; chat.html maakt dat rondje rood (en jij hoort een geluidje)
        meldGeslagen(ikVerloor ? 'ik' : 'ander')
    }

    // ── Een eigen zet ──
    function pak(n) {
        if (gameOver || staat.aanZet !== ik || n < 1 || n > 3 || n > staat.over) return
        try { Bordgeluid?.knop?.() } catch (e) {}
        staat = { over: staat.over - n, aanZet: ik === 1 ? 2 : 1 }
        nr++
        controleerEinde(ik)
        // BLAUWDRUK: stuur de HELE stand mee (niet alleen de zet). Raakt er een bericht zoek, dan klopt het toch.
        stuur('zet', { staat, nr, spelId, einde: gameOver || undefined })
        teken()
    }

    // ── Berichten van de ander (of de computer) ──
    spelKanaal.on('broadcast', { event: 'zet' }, msg => {
        const p = msg.payload || {}
        if (!p.staat || !nieuwer(p.spelId ?? spelId, p.nr ?? nr + 1)) return
        if (gameOver && (p.spelId ?? spelId) === spelId) return
        const wieDeed = staat.aanZet
        spelId = p.spelId ?? spelId; nr = p.nr ?? nr + 1
        staat = { ...p.staat }
        controleerEinde(wieDeed)
        teken()
    })
    // Wie achterloopt, vraagt de stand op; wie verder is, stuurt hem terug.
    spelKanaal.on('broadcast', { event: 'vraag-stand' }, msg => {
        const p = msg.payload || {}
        if (spelId > (p.spelId ?? 0) || (spelId === (p.spelId ?? 0) && nr > (p.nr ?? 0))) stuur('stand', { staat, nr, spelId })
    })
    spelKanaal.on('broadcast', { event: 'stand' }, msg => {
        const p = msg.payload || {}
        if (!p.staat || !nieuwer(p.spelId ?? 0, p.nr ?? 0)) return
        spelId = p.spelId; nr = p.nr; staat = { ...p.staat }; gameOver = false
        controleerEinde(staat.aanZet === 1 ? 2 : 1)
        teken()
    })
    function nieuwSpel(id) { staat = { over: BEGIN, aanZet: 1 }; spelId = id; nr = 0; gameOver = false; teken() }
    spelKanaal.on('broadcast', { event: 'opnieuw' }, msg => {
        const id = (msg.payload && msg.payload.spelId) || spelId + 1
        if (id > spelId) nieuwSpel(id)
    })
    opnieuwBtn.onclick = () => { const id = Math.max(Date.now(), spelId + 1); nieuwSpel(id); stuur('opnieuw', { spelId: id }) }

    // BLAUWDRUK: opnieuw tekenen als de webcamrondjes verschijnen of verdwijnen
    const stopWebcam = opWebcamWissel(teken)
    // Elke 3 s de stand opvragen als je wacht; stoppen zodra het spel gesloten is.
    const timer = setInterval(() => {
        if (!spelEl.isConnected) { clearInterval(timer); stopWebcam(); return }
        if (!gameOver && staat.aanZet !== ik) stuur('vraag-stand', { spelId, nr })
    }, 3000)
    nieuwSpel(0)
}
