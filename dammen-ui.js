// dammen-ui.js — speelscherm voor internationaal dammen (10x10) in Fibro
// Slagen kies je stap voor stap. Zetten reizen via het spelkanaal; raakt er een
// bericht zoek, dan haalt de wachtende speler de stand vanzelf opnieuw op.
// v147: teksten ook in het Engels (taal.js)
// v148 (3 nov 2026): helemaal nieuw uiterlijk, net zo verzorgd als schaken:
//   - een houten bord met lijst (of walnoot, marmer, Fibro-paars), echte damschijven met groeven en diepte, een dam als
//     twee gestapelde schijven met een gouden kroon; zetten en slagen bewegen (de geslagen schijven verdwijnen één voor één);
//   - spelersbalken met wie aan zet is en de geslagen schijven ernaast; veldnummers (1-50) als je wilt;
//   - remise: 25 zetten na elkaar alleen met dammen (zonder slaan), of drie keer dezelfde stand;
//   - instellingen (⚙): bordstijl, grootte van de schijven, hulp (stipjes, gouden rand bij een verplichte slag),
//     veldnummers, tafelachtergrond, beweging en geluid. Bewaard op dit toestel (localStorage 'fibro_dammen_inst');
//   - eigen geluiden (dammen-geluid.js); tegen een vriend een webcamknop (de webcams staan als rondjes bovenin,
//     dat regelt chat.html).
// v149: de webcamrondjes zijn groter (120 px), het bord houdt daar rekening mee. Word je geslagen, dan stuurt het
//   spel 'fibro-dam-geslagen' en kleurt je webcamrondje even rood.
// v150: word je geslagen terwijl de webcamrondjes er staan, dan klinkt er ook een geluidje (geluid.geslagen).
// Het protocol over het spelkanaal is hetzelfde gebleven (zet, vraag-stand, stand, opnieuw), dus een vriend met een
// oudere Fibro kan gewoon meespelen. Nieuw is alleen 'einde: true' in een zet die de partij beëindigt.
import { geluid, geluidAan, zetGeluid, ontgrendel } from './dammen-geluid.js?v=2'

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m)) // taal.js (v147)

const INST_SLEUTEL = 'fibro_dammen_inst'
const STANDAARD = { bord: 'hout', grootte: 'standaard', stippen: true, verplicht: true, nummers: false, tafel: 'geen', beweging: true }
const SCHAAL = { klein: 0.74, standaard: 0.84, groot: 0.92 }
const STAPTIJD = 170   // ms per sprong in de animatie

const KROON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.5h18l-1.7-9.2-4.5 4.1L12 5l-2.8 7.4-4.5-4.1z" fill="#f6c84c" stroke="#6e4f0c" stroke-width="1.1" stroke-linejoin="round"/><rect x="3.2" y="18.2" width="17.6" height="2.8" rx="1.1" fill="#e2ad2f" stroke="#6e4f0c" stroke-width="1"/><circle cx="12" cy="5" r="1.4" fill="#fff3c4" stroke="#6e4f0c" stroke-width=".8"/></svg>'

function leesInst() {
    let opgeslagen = {}
    try { opgeslagen = JSON.parse(localStorage.getItem(INST_SLEUTEL) || '{}') || {} } catch (e) {}
    const minder = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    return { ...STANDAARD, beweging: !minder, ...opgeslagen }
}
function bewaarInst(inst) { try { localStorage.setItem(INST_SLEUTEL, JSON.stringify(inst)) } catch (e) {} }

function zetStijl() {
    if (document.getElementById('dm-stijl')) return
    const st = document.createElement('style')
    st.id = 'dm-stijl'
    st.textContent = `
.dm-spel{--dm-licht:#f0d7a8;--dm-donker:#a46d3f;--dm-nerf:rgba(60,30,10,.10);--dm-lijst1:#7a4b26;--dm-lijst2:#4a2b13;--dm-lijstrand:#c99a62;--dm-cijfer:rgba(255,240,210,.7);
  display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;color:#fff;font-family:'DM Sans',system-ui,sans-serif;user-select:none;-webkit-user-select:none}
.dm-spel[data-bord="walnoot"]{--dm-licht:#d6b282;--dm-donker:#6a4325;--dm-nerf:rgba(20,8,0,.14);--dm-lijst1:#3c2413;--dm-lijst2:#22130a;--dm-lijstrand:#8a6038}
.dm-spel[data-bord="marmer"]{--dm-licht:#efede8;--dm-donker:#6c7784;--dm-nerf:rgba(255,255,255,.10);--dm-lijst1:#4a525e;--dm-lijst2:#2c323b;--dm-lijstrand:#a8b1bd;--dm-cijfer:rgba(255,255,255,.75)}
.dm-spel[data-bord="fibro"]{--dm-licht:#2b1a4e;--dm-donker:#6a3fb5;--dm-nerf:rgba(255,255,255,.05);--dm-lijst1:#1a0d33;--dm-lijst2:#0d061d;--dm-lijstrand:#c084fc;--dm-cijfer:rgba(240,220,255,.75)}
.dm-status{min-height:22px;font-size:14px;font-weight:650;text-align:center;line-height:1.35;padding:0 10px;text-shadow:0 1px 2px #0008}
.dm-speler{display:flex;align-items:center;gap:8px;width:var(--dm-breed);max-width:100%;box-sizing:border-box;padding:6px 10px;border-radius:12px;background:rgba(10,6,22,.55);border:1px solid rgba(255,255,255,.10);transition:border-color .25s,box-shadow .25s}
.dm-speler.aan-zet{border-color:#7ef0c8;box-shadow:0 0 0 1px #7ef0c855,0 0 16px #3fe0a845}
.dm-speler .dm-naam{font-weight:700;font-size:14px;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-speler .dm-zet-teken{font-size:11px;color:#a7f3d0;font-weight:700;opacity:0;transition:opacity .25s}
.dm-speler.aan-zet .dm-zet-teken{opacity:1}
.dm-speler .dm-vangst{margin-left:auto;display:flex;align-items:center;min-height:16px}
.dm-speler .dm-vangst i{display:block;width:14px;height:14px;border-radius:50%;margin-left:-5px;box-shadow:0 1px 2px #0009}
.dm-speler .dm-vangst b{font-size:12px;margin-left:5px;color:#e7e2ff}
.dm-mini{width:18px;height:18px;border-radius:50%;flex:none;box-shadow:0 2px 0 #0006}
.dm-wit{background:radial-gradient(circle at 35% 30%,#fffaf0,#ece0c6 50%,#c4b08a)}
.dm-zwart{background:radial-gradient(circle at 35% 30%,#76767c,#2a2a2e 52%,#09090b)}
.dm-bordvak{position:relative;padding:var(--dm-lijst);border-radius:14px;background:linear-gradient(145deg,var(--dm-lijst1),var(--dm-lijst2));
  box-shadow:0 14px 30px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.18),inset 0 0 0 2px var(--dm-lijstrand);touch-action:manipulation}
.dm-spel[data-bord="fibro"] .dm-bordvak{box-shadow:0 0 0 2px #c084fc,0 0 28px #a855f799,0 14px 30px rgba(0,0,0,.55)}
.dm-bord{position:relative;display:grid;grid-template-columns:repeat(10,var(--dm-cel));grid-template-rows:repeat(10,var(--dm-cel));
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.12);cursor:pointer}
.dm-vak{position:relative;background:var(--dm-licht)}
.dm-vak.d{background:var(--dm-donker);background-image:repeating-linear-gradient(104deg,var(--dm-nerf) 0 2px,transparent 2px 7px),linear-gradient(160deg,rgba(255,255,255,.07),rgba(0,0,0,.10))}
.dm-spel[data-bord="marmer"] .dm-vak{background-image:radial-gradient(ellipse at 20% 30%,rgba(0,0,0,.05),transparent 60%),radial-gradient(ellipse at 80% 70%,rgba(0,0,0,.04),transparent 55%)}
.dm-spel[data-bord="marmer"] .dm-vak.d{background-image:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.14),transparent 55%),linear-gradient(120deg,transparent 40%,rgba(255,255,255,.12) 50%,transparent 60%)}
.dm-spel[data-bord="fibro"] .dm-vak.d{background-image:linear-gradient(145deg,rgba(255,255,255,.10),rgba(0,0,0,.18))}
.dm-vak.laatste::before{content:'';position:absolute;inset:0;background:rgba(255,214,90,.38)}
.dm-vak.pad::before{content:'';position:absolute;inset:0;background:rgba(167,139,250,.55)}
.dm-vak.gekozen::before{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 3px #7ef0ff,inset 0 0 14px #7ef0ffaa}
.dm-nr{position:absolute;z-index:5;left:2px;top:1px;font-size:var(--dm-nrmaat);font-weight:800;line-height:1;color:var(--dm-cijfer);text-shadow:0 0 2px #000,0 1px 1px #000;pointer-events:none}
.dm-stip{position:absolute;left:50%;top:50%;width:30%;height:30%;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle,#5ef08f 0 45%,#1f9d55 60%,transparent 62%);box-shadow:0 0 10px #4ade80aa;pointer-events:none;z-index:3}
.dm-laag{position:absolute;left:var(--dm-lijst);top:var(--dm-lijst);width:calc(var(--dm-cel)*10);height:calc(var(--dm-cel)*10);pointer-events:none}
.dm-schijf{position:absolute;width:var(--s);height:var(--s);border-radius:50%;will-change:transform}
.dm-schijf.w{background:
   radial-gradient(circle,transparent 0 24%,rgba(110,85,50,.32) 24% 27%,transparent 27% 36%,rgba(110,85,50,.26) 36% 39%,transparent 39%),
   radial-gradient(circle at 35% 28%,#fffbf2,#efe3c9 46%,#c9b48d 100%);
  box-shadow:0 calc(var(--s)*.07) 0 #a28c63,0 calc(var(--s)*.12) calc(var(--s)*.16) rgba(0,0,0,.5),inset 0 calc(var(--s)*-.04) calc(var(--s)*.08) rgba(0,0,0,.18)}
.dm-schijf.z{background:
   radial-gradient(circle,transparent 0 24%,rgba(255,255,255,.12) 24% 27%,transparent 27% 36%,rgba(255,255,255,.10) 36% 39%,transparent 39%),
   radial-gradient(circle at 35% 28%,#6e6e75,#2b2b30 48%,#0a0a0c 100%);
  box-shadow:0 calc(var(--s)*.07) 0 #000,0 calc(var(--s)*.12) calc(var(--s)*.16) rgba(0,0,0,.6),inset 0 calc(var(--s)*.03) calc(var(--s)*.06) rgba(255,255,255,.12)}
.dm-schijf.dam{margin-top:calc(var(--s)*-.09)}
.dm-schijf.w.dam{box-shadow:0 calc(var(--s)*.07) 0 #a28c63,0 calc(var(--s)*.13) 0 #e6d8b9,0 calc(var(--s)*.19) 0 #a28c63,0 calc(var(--s)*.24) calc(var(--s)*.16) rgba(0,0,0,.55)}
.dm-schijf.z.dam{box-shadow:0 calc(var(--s)*.07) 0 #000,0 calc(var(--s)*.13) 0 #34343a,0 calc(var(--s)*.19) 0 #000,0 calc(var(--s)*.24) calc(var(--s)*.16) rgba(0,0,0,.65)}
.dm-schijf svg{position:absolute;left:22%;top:20%;width:56%;height:56%;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.dm-schijf.moet::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:3px solid #fbbf24;box-shadow:0 0 12px #fbbf24;animation:dm-puls 1.2s ease-in-out infinite}
.dm-schijf.half{opacity:.32}
@keyframes dm-puls{0%,100%{opacity:1}50%{opacity:.45}}
.dm-damring{position:absolute;border-radius:50%;border:3px solid #fde68a;box-shadow:0 0 18px #fbbf24,inset 0 0 12px #fbbf24aa;pointer-events:none}
.dm-vonk{position:absolute;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#fff 0 30%,#fde047 45%,#f59e0b 70%,transparent 72%);pointer-events:none}
.dm-damtekst{position:absolute;z-index:6;transform:translateX(-50%);font-weight:900;font-size:var(--dm-damtekst,18px);color:#fde68a;letter-spacing:.04em;white-space:nowrap;text-shadow:0 2px 0 #7c4a03,0 0 12px #f59e0b,0 0 2px #000;pointer-events:none}
.dm-knoppen{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.dm-knop{min-height:38px;padding:8px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.09);color:#fff;font:inherit;font-size:13px;font-weight:650;cursor:pointer}
.dm-knop:active{transform:scale(.97)}
.dm-knop.hoofd{background:linear-gradient(135deg,var(--accent,#c084fc),var(--accent2,#f0abfc));color:#1a0a2e;border:none}
.dm-knop[aria-pressed="true"]{border-color:#7ef0c8;box-shadow:0 0 0 1px #7ef0c855}
.dm-regel{font-size:11px;color:rgba(255,255,255,.62);text-align:center;max-width:var(--dm-breed);line-height:1.4}
.dm-instellingen{position:fixed;inset:0;z-index:10060;display:flex;align-items:flex-end;justify-content:center;background:rgba(5,2,14,.72);padding:12px}
.dm-paneel{width:min(100%,420px);max-height:min(82dvh,640px);overflow:auto;border-radius:20px;padding:18px;background:linear-gradient(160deg,#2a1d12,#16101f);
  border:1px solid rgba(255,220,170,.28);box-shadow:0 20px 60px #000a;color:#fff}
.dm-paneel h2{margin:0 0 4px;font-size:18px}
.dm-paneel p.uitleg{margin:0 0 12px;font-size:12px;color:rgba(255,255,255,.65)}
.dm-paneel fieldset{border:none;margin:0 0 12px;padding:0}
.dm-paneel legend{font-size:12px;font-weight:700;color:#f3d9a6;margin-bottom:6px;letter-spacing:.03em}
.dm-keuzes{display:flex;flex-wrap:wrap;gap:6px}
.dm-keuzes button{flex:1 1 auto;min-height:38px;padding:7px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:13px;cursor:pointer}
.dm-keuzes button[aria-pressed="true"]{background:#f3d9a6;color:#2a1a08;border-color:#f3d9a6;font-weight:700}
.dm-schakel{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;font-size:14px;border-top:1px solid rgba(255,255,255,.07)}
.dm-schakel input{width:22px;height:22px;accent-color:#f3d9a6}
.dm-paneel .dm-sluit{width:100%;margin-top:8px}
[data-dam-tafel="hout"]{background:linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.42)),repeating-linear-gradient(92deg,#5b3a1f 0 6px,#6a4527 6px 11px,#53351c 11px 19px) !important}
[data-dam-tafel="laken"]{background:radial-gradient(ellipse at 50% 40%,#1f6b45,#0d3a24 70%,#082516) !important}
[data-dam-tafel="fibro"]{background:radial-gradient(ellipse at 50% 30%,#3b1d6e,#1a0a2e 65%,#0c0518) !important}
`
    document.head.appendChild(st)
}

export function start({ Dammen, Bordgeluid, spelKanaal, benIkSpeler1, vriendNaam }) {
    void Bordgeluid   // v148: eigen geluiden (dammen-geluid.js)
    zetStijl()
    const titel = document.getElementById('spelTitelBar')
    if (titel) titel.textContent = '⚫ Draughts'
    const inhoud = document.getElementById('spelInhoud')
    const overlay = document.getElementById('spelOverlay')
    const mijnKleur = benIkSpeler1 ? 'w' : 'z'
    const anderKleur = mijnKleur === 'w' ? 'z' : 'w'
    const solo = !!(spelKanaal && spelKanaal.isSolo)
    const naam = vriendNaam || T('vriend')
    let inst = leesInst()

    let staat = Dammen.nieuweSpelStaat()
    let spelId = 0, nr = 0, gameOver = false, uitslag = null
    let laatsteKeten = null, geselecteerd = null, pad = [], ketensCache = null, melding = ''
    let stil = 0, herhaling = new Map()                    // remise: zetten zonder slaan/schijf, en standen
    let animatie = null                                    // { keten, vorigBord } voor de volgende tekening
    let cel = 40

    inhoud.innerHTML = `
    <div class="dm-spel" data-bord="${inst.bord}">
      <div class="dm-status" role="status" aria-live="polite"></div>
      <div class="dm-speler ander"><span class="dm-mini ${anderKleur === 'w' ? 'dm-wit' : 'dm-zwart'}"></span><span class="dm-naam"></span><span class="dm-zet-teken">${T('aan zet')}</span><span class="dm-vangst"></span></div>
      <div class="dm-bordvak"><div class="dm-bord" role="grid" aria-label="${T('Dambord')}"></div><div class="dm-laag"></div></div>
      <div class="dm-speler mij"><span class="dm-mini ${mijnKleur === 'w' ? 'dm-wit' : 'dm-zwart'}"></span><span class="dm-naam">${T('Jij')}</span><span class="dm-zet-teken">${T('aan zet')}</span><span class="dm-vangst"></span></div>
      <div class="dm-knoppen">
        ${solo ? '' : '<button type="button" class="dm-knop dm-video" aria-pressed="false">📹 Webcam</button>'}
        <button type="button" class="dm-knop dm-geluid" aria-label="${T('Geluid')}"></button>
        <button type="button" class="dm-knop dm-inst">⚙ ${T('Instellingen')}</button>
        <button type="button" class="dm-knop hoofd dm-opnieuw" hidden>${T('↻ Opnieuw spelen')}</button>
      </div>
      <div class="dm-regel">${T('Slaan is verplicht. De slag met de meeste stukken gaat voor.')}</div>
    </div>`
    const spelEl = inhoud.querySelector('.dm-spel')
    const bordEl = inhoud.querySelector('.dm-bord')
    const laagEl = inhoud.querySelector('.dm-laag')
    const bordvak = inhoud.querySelector('.dm-bordvak')
    const statusEl = inhoud.querySelector('.dm-status')
    const opnieuwBtn = inhoud.querySelector('.dm-opnieuw')
    const geluidBtn = inhoud.querySelector('.dm-geluid')
    const instBtn = inhoud.querySelector('.dm-inst')
    const videoBtn = inhoud.querySelector('.dm-video')
    const anderBalk = inhoud.querySelector('.dm-speler.ander'), mijnBalk = inhoud.querySelector('.dm-speler.mij')
    anderBalk.querySelector('.dm-naam').textContent = naam

    const zelfde = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]
    const stuur = (event, payload) => { try { spelKanaal.send({ type: 'broadcast', event, payload }) } catch (e) {} }
    const nieuwer = (id, n) => id > spelId || (id === spelId && n > nr)
    const sleutel = () => staat.aanZet + staat.bord.map(r => r.map(x => x || '.').join('')).join('')
    const veldNr = (r, k) => r * 5 + Math.floor(k / 2) + 1
    // Op het scherm: wie zwart speelt, ziet het bord omgedraaid (eigen schijven onderaan)
    const scherm = (r, k) => mijnKleur === 'z' ? [9 - r, 9 - k] : [r, k]

    function mijnKetens() {
        if (!ketensCache) ketensCache = Dammen.alleZetten(staat, mijnKleur)
        return ketensCache
    }
    function kandidaten() {
        if (!geselecteerd) return []
        return mijnKetens().ketens.filter(k => zelfde(k[0].van, geselecteerd) && pad.every((s, i) => zelfde(k[i] && k[i].naar, s.naar)))
    }

    // ── Maat ──
    function maat() {
        const breed = Math.min(inhoud.clientWidth || window.innerWidth, window.innerWidth) - 28
        const camera = overlay && overlay.classList.contains('dam-video-modus') ? 152 : 0
        const hoog = window.innerHeight - 250 - camera
        const ruimte = Math.max(220, Math.min(breed, hoog))
        cel = Math.max(24, Math.min(58, Math.floor(ruimte / 10.7)))
        const lijst = Math.max(8, Math.round(cel * 0.32))
        spelEl.style.setProperty('--dm-cel', cel + 'px')
        spelEl.style.setProperty('--dm-lijst', lijst + 'px')
        spelEl.style.setProperty('--dm-breed', (cel * 10 + lijst * 2) + 'px')
        spelEl.style.setProperty('--dm-nrmaat', Math.max(7, Math.round(cel * 0.19)) + 'px')
    }

    // ── Tekenen ──
    function tekenBord() {
        maat()
        // Het bord zoals het er halverwege een gekozen slagroute uitziet
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
        const volgende = inst.stippen || pad.length ? kand.filter(k => k.length > pad.length).map(k => k[pad.length].naar) : []
        const padVelden = pad.map(s => s.naar)
        const mijnBeurt = !gameOver && staat.aanZet === mijnKleur
        const moetSlaan = mijnBeurt && !geselecteerd && mijnKetens().verplichtSlaan
        const slaanVanaf = moetSlaan && inst.verplicht ? mijnKetens().ketens.map(k => k[0].van) : []
        const laatste = laatsteKeten ? [laatsteKeten[0].van, ...laatsteKeten.map(s => s.naar)] : []

        // vakjes (in schermvolgorde)
        const vakjes = []
        for (let sr = 0; sr < 10; sr++) for (let sk = 0; sk < 10; sk++) {
            const [r, k] = scherm(sr, sk)
            const donker = (r + k) % 2 === 1
            let kl = 'dm-vak' + (donker ? ' d' : '')
            if (donker && laatste.some(p => zelfde(p, [r, k]))) kl += ' laatste'
            if (donker && padVelden.some(p => zelfde(p, [r, k]))) kl += ' pad'
            if (zelfde(geselecteerd, [r, k]) && !pad.length) kl += ' gekozen'
            let binnen = ''
            if (donker && inst.nummers) binnen += '<span class="dm-nr">' + veldNr(r, k) + '</span>'
            if (donker && volgende.some(p => zelfde(p, [r, k]))) binnen += '<span class="dm-stip"></span>'
            vakjes.push('<div class="' + kl + '" data-r="' + r + '" data-k="' + k + '"' + (donker ? ' role="gridcell" aria-label="' + veldNr(r, k) + '"' : '') + '>' + binnen + '</div>')
        }
        bordEl.innerHTML = vakjes.join('')

        // schijven
        const schaal = SCHAAL[inst.grootte] || SCHAAL.standaard
        const s = Math.round(cel * schaal)
        laagEl.style.setProperty('--s', s + 'px')
        const plek = (r, k) => { const [sr, sk] = scherm(r, k); return [sk * cel + (cel - s) / 2, sr * cel + (cel - s) / 2] }
        laagEl.innerHTML = ''
        const maakSchijf = (stuk, r, k) => {
            const el = document.createElement('div')
            el.className = 'dm-schijf ' + stuk[0] + (stuk[1] === 'D' ? ' dam' : '')
            if (stuk[1] === 'D') el.innerHTML = KROON
            const [x, y] = plek(r, k)
            el.style.left = x + 'px'; el.style.top = y + 'px'
            laagEl.appendChild(el)
            return el
        }
        let bewogen = null
        for (let r = 0; r < 10; r++) for (let k = 0; k < 10; k++) {
            const stuk = bord[r][k]
            if (!stuk) continue
            const el = maakSchijf(stuk, r, k)
            if (slaanVanaf.some(p => zelfde(p, [r, k]))) el.classList.add('moet')
            if (halfGeslagen.some(p => zelfde(p, [r, k]))) el.classList.add('half')
            if (animatie && zelfde(animatie.keten[animatie.keten.length - 1].naar, [r, k])) bewogen = el
        }
        // beweging: de schijf springt langs zijn route, de geslagen schijven verdwijnen één voor één
        if (animatie && inst.beweging && bewogen && typeof bewogen.animate === 'function') {
            const { keten, vorigBord } = animatie
            const punten = [keten[0].van, ...keten.map(x => x.naar)]
            const [ex, ey] = plek(...punten[punten.length - 1])
            const frames = punten.map((p, i) => {
                const [x, y] = plek(...p)
                const hoog = i > 0 && i < punten.length - 1 ? ' scale(1.08)' : ''
                return { transform: 'translate(' + (x - ex) + 'px,' + (y - ey) + 'px)' + hoog, offset: i / (punten.length - 1) }
            })
            const duur = STAPTIJD * (punten.length - 1) + 60
            bewogen.animate(frames, { duration: duur, easing: 'cubic-bezier(.3,.7,.3,1)' })
            bezigTot = Date.now() + duur
            keten.forEach((sprong, i) => {
                if (!sprong.geslagen) return
                const oud = vorigBord[sprong.geslagen[0]][sprong.geslagen[1]]
                if (!oud) return
                const geest = maakSchijf(oud, sprong.geslagen[0], sprong.geslagen[1])
                geest.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1)', offset: 0.5 }, { opacity: 0, transform: 'scale(.4)' }],
                    { duration: STAPTIJD * (i + 1) + 220, easing: 'ease-in', fill: 'forwards' })
            })
            // v148: een schijf die dam wordt, krijgt een tweede schijf die er met een sprong bovenop landt
            const eind = punten[punten.length - 1]
            const vooraf = vorigBord[keten[0].van[0]][keten[0].van[1]]
            if (vooraf && vooraf[1] === 'S' && staat.bord[eind[0]][eind[1]]?.[1] === 'D') damSprong(bewogen, vooraf[0], eind, duur, s, plek)
        }
        animatie = null
        tekenBalken()
        toonStatus(moetSlaan)
    }

    // De damsprong: een schijf van dezelfde kleur springt in een boog op de nieuwe dam, de onderste veert even in,
    // dan komt de gouden kroon tevoorschijn met een gouden ring, vonkjes en het woord 'Dam!'.
    const SPRONG = 640
    function damSprong(el, kleur, [r, k], wacht, s, plek) {
        const kroon = el.innerHTML
        el.classList.remove('dam'); el.innerHTML = ''
        const [x, y] = plek(r, k)
        const [sr, sk] = scherm(r, k)
        const dy = (sr < 5 ? 1 : -1) * cel * 2.3            // van de kant van het bord af, zodat hij binnen het bord blijft
        const dx = (sk < 5 ? 1 : -1) * cel * 1.5
        const op = -s * 0.13                                 // de bovenste schijf ligt iets hoger (zoals bij .dam)
        const sprong = document.createElement('div')
        sprong.className = 'dm-schijf ' + kleur
        sprong.style.left = x + 'px'; sprong.style.top = y + 'px'; sprong.style.zIndex = '4'
        laagEl.appendChild(sprong)
        bezigTot = Date.now() + wacht + SPRONG + 750
        sprong.animate([
            { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.7)' },
            { opacity: 1, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1)', offset: 0.14 },
            { opacity: 1, transform: 'translate(' + (dx * 0.4) + 'px,' + (dy * 0.15 - cel * 1.5) + 'px) scale(1.45)', offset: 0.58 },
            { opacity: 1, transform: 'translate(0px,' + (op - cel * 0.35) + 'px) scale(1.12)', offset: 0.84 },
            { opacity: 1, transform: 'translate(0px,' + op + 'px) scale(1)' }
        ], { duration: SPRONG, delay: wacht, easing: 'cubic-bezier(.33,.1,.45,1)', fill: 'both' })
        setTimeout(() => {
            if (!el.isConnected) return
            sprong.remove()
            el.classList.add('dam'); el.innerHTML = kroon
            el.animate([{ transform: 'scale(1.16,.82)' }, { transform: 'scale(.95,1.06)', offset: 0.55 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' })
            const svg = el.querySelector('svg')
            if (svg) svg.animate([{ transform: 'scale(0) rotate(-35deg)', opacity: 0 }, { transform: 'scale(1.55) rotate(8deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1 }],
                { duration: 520, delay: 90, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' })
            const mx = x + s / 2, my = y + s / 2 + op
            const ring = document.createElement('div')
            ring.className = 'dm-damring'
            ring.style.cssText = 'left:' + (mx - s / 2) + 'px;top:' + (my - s / 2) + 'px;width:' + s + 'px;height:' + s + 'px'
            laagEl.appendChild(ring)
            ring.animate([{ transform: 'scale(.6)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'forwards' }).onfinish = () => ring.remove()
            for (let i = 0; i < 12; i++) {
                const v = document.createElement('div')
                v.className = 'dm-vonk'
                v.style.left = (mx - 3.5) + 'px'; v.style.top = (my - 3.5) + 'px'
                laagEl.appendChild(v)
                const hoek = (i / 12) * Math.PI * 2 + Math.random() * 0.4, afstand = cel * (0.9 + Math.random() * 0.7)
                v.animate([{ transform: 'translate(0,0) scale(1.2)', opacity: 1 },
                    { transform: 'translate(' + Math.cos(hoek) * afstand + 'px,' + (Math.sin(hoek) * afstand + cel * 0.25) + 'px) scale(.2)', opacity: 0 }],
                    { duration: 600 + Math.random() * 250, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).onfinish = () => v.remove()
            }
            const tekst = document.createElement('div')
            tekst.className = 'dm-damtekst'
            tekst.textContent = T('Dam!')
            tekst.style.left = mx + 'px'; tekst.style.top = (sr < 5 ? my + s * 0.55 : my - s * 1.15) + 'px'
            tekst.style.setProperty('--dm-damtekst', Math.max(15, Math.round(cel * 0.5)) + 'px')
            laagEl.appendChild(tekst)
            tekst.animate([{ transform: 'translateX(-50%) scale(.4)', opacity: 0 }, { transform: 'translateX(-50%) scale(1.15)', opacity: 1, offset: 0.2 },
                { transform: 'translateX(-50%) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translateX(-50%) translateY(-10px)', opacity: 0 }],
                { duration: 1300, easing: 'ease-out', fill: 'forwards' }).onfinish = () => tekst.remove()
        }, wacht + SPRONG)
    }

    function tekenBalken() {
        const telGeslagen = kleur => 20 - staat.bord.flat().filter(x => x && x[0] === kleur).length
        const vangst = (balk, geslagenKleur) => {
            const n = telGeslagen(geslagenKleur)
            const el = balk.querySelector('.dm-vangst')
            const kl = geslagenKleur === 'w' ? 'dm-wit' : 'dm-zwart'
            el.innerHTML = n ? ('<i class="' + kl + '"></i>').repeat(Math.min(n, 8)) + '<b>' + n + '</b>' : ''
            el.title = n ? T('{n} geslagen', { n }) : ''
        }
        vangst(mijnBalk, anderKleur)       // wat ik van de ander sloeg
        vangst(anderBalk, mijnKleur)
        mijnBalk.classList.toggle('aan-zet', !gameOver && staat.aanZet === mijnKleur)
        anderBalk.classList.toggle('aan-zet', !gameOver && staat.aanZet !== mijnKleur)
    }

    function toonStatus(moetSlaan) {
        if (gameOver) { statusEl.textContent = uitslag || ''; return }
        if (melding) { statusEl.textContent = melding; return }
        if (staat.aanZet !== mijnKleur) { statusEl.textContent = solo ? T('De computer denkt na...') : T('Wachten op {naam}...', { naam }); return }
        if (geselecteerd && pad.length) { statusEl.textContent = T('Tik op het volgende groene stipje'); return }
        if (moetSlaan) {
            const n = mijnKetens().ketens[0].filter(s => s.geslagen).length
            statusEl.textContent = n > 1 ? T('Jouw beurt — je moet slaan ({n} stukken)!', { n }) : T('Jouw beurt — je moet slaan!')
            return
        }
        statusEl.textContent = T('Jouw beurt')
    }

    // ── Tikken ──
    bordEl.addEventListener('click', e => {
        ontgrendel()
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
                geluid.kies()
                tekenBord(); return
            }
            if (pad.length) { geselecteerd = null; pad = []; tekenBord(); return }
        }
        const stuk = staat.bord[r][k]
        if (stuk && stuk[0] === mijnKleur) {
            const { ketens, verplichtSlaan } = mijnKetens()
            if (ketens.some(kt => zelfde(kt[0].van, [r, k]))) { geselecteerd = [r, k]; pad = []; geluid.kies() }
            else {
                geselecteerd = null; pad = []
                melding = verplichtSlaan ? T('Deze schijf kan niet slaan. Kies een schijf met een gouden rand.') : T('Deze schijf kan niet bewegen.')
            }
        } else { geselecteerd = null; pad = [] }
        tekenBord()
    }

    // ── Zetten ──
    function pasToe(keten, vorigBord) {
        const stuk = vorigBord[keten[0].van[0]][keten[0].van[1]]
        const geslagen = keten.filter(s => s.geslagen).length
        stil = (geslagen || (stuk && stuk[1] === 'S')) ? 0 : stil + 1
        if (geslagen || (stuk && stuk[1] === 'S')) herhaling = new Map()
        const sl = sleutel()
        herhaling.set(sl, (herhaling.get(sl) || 0) + 1)
        // geluid
        const werdDam = stuk && stuk[1] === 'S' && staat.bord[keten[keten.length - 1].naar[0]][keten[keten.length - 1].naar[1]]?.[1] === 'D'
        const vertraging = inst.beweging ? STAPTIJD * keten.length : 0
        setTimeout(() => { geluid.zet(keten.length, geslagen); if (werdDam && !inst.beweging) geluid.dam() }, Math.max(0, vertraging - 40))
        if (werdDam && inst.beweging) setTimeout(() => { geluid.zet(1, 0); geluid.dam() }, vertraging + 60 + SPRONG - 20)   // de bovenste schijf landt
        // v149: wie geslagen wordt, krijgt een rode rand om zijn webcamrondje (chat.html luistert hiernaar)
        if (geslagen && stuk) {
            const wie = stuk[0] === mijnKleur ? 'ander' : 'ik'
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('fibro-dam-geslagen', { detail: { wie, aantal: geslagen } }))
                // v150: word jij geslagen terwijl de webcamrondjes er staan, dan ook een geluidje
                if (wie === 'ik' && overlay && overlay.classList.contains('dam-video-modus')) geluid.geslagen(geslagen)
            }, Math.max(0, vertraging - 40))
        }
    }

    function controleerEinde() {
        if (Dammen.heeftGeenZetten(staat, staat.aanZet)) {
            gameOver = true
            const ikWin = staat.aanZet !== mijnKleur
            uitslag = ikWin
                ? (solo ? T('🎉 Jij wint van de computer!') : T('🎉 Jij wint — {naam} kan niet meer zetten!', { naam }))
                : (solo ? T('😢 De computer wint. Probeer het nog eens!') : T('😢 {naam} wint!', { naam }))
            setTimeout(() => ikWin ? geluid.winst() : geluid.verlies(), 450)
            return true
        }
        if (stil >= 50 || (herhaling.get(sleutel()) || 0) >= 3) {
            gameOver = true
            uitslag = stil >= 50 ? T('🤝 Remise: 25 zetten na elkaar alleen met dammen, zonder te slaan.') : T('🤝 Remise: drie keer dezelfde stand.')
            setTimeout(() => geluid.remise(), 450)
            return true
        }
        return false
    }

    function uitvoeren(keten) {
        const vorigBord = staat.bord
        Dammen.voerKetenUit(staat, keten)
        laatsteKeten = keten; nr++
        geselecteerd = null; pad = []
        animatie = { keten, vorigBord }
        pasToe(keten, vorigBord)
        const einde = controleerEinde()
        stuur('zet', einde ? { keten, bord: staat.bord, aanZet: staat.aanZet, nr, spelId, einde: true } : { keten, bord: staat.bord, aanZet: staat.aanZet, nr, spelId })
        naBeurt()
    }

    // Loopt er nog een beweging (een sprong of de damsprong), dan wacht de volgende tekening tot die klaar is.
    // Anders zou een snel antwoord van de computer de animatie halverwege wegvegen.
    let bezigTot = 0, uitstel = null
    function naBeurt() {
        ketensCache = null; melding = ''
        opnieuwBtn.hidden = !gameOver
        clearTimeout(uitstel)
        const wacht = bezigTot - Date.now()
        if (wacht > 0) { uitstel = setTimeout(() => { if (bordEl.isConnected) tekenBord() }, wacht); return }
        tekenBord()
    }

    function neemStandOver(p) {
        const opvolger = p.spelId === spelId && p.nr === nr + 1 && p.keten
        const vorigBord = staat.bord
        spelId = p.spelId; nr = p.nr
        staat.bord = p.bord.map(r => r.slice()); staat.aanZet = p.aanZet
        laatsteKeten = p.keten || null
        gameOver = false; uitslag = null
        geselecteerd = null; pad = []
        if (opvolger) {
            animatie = { keten: p.keten, vorigBord }
            pasToe(p.keten, vorigBord)
        } else { stil = 0; herhaling = new Map() }
        controleerEinde()
        naBeurt()
    }

    spelKanaal.on('broadcast', { event: 'zet' }, msg => {
        const p = msg.payload || {}
        if (p.bord) {
            const id = p.spelId ?? spelId, n = p.nr ?? nr + 1
            if (!nieuwer(id, n)) return
            if (gameOver && id === spelId) return      // de partij is al voorbij
            neemStandOver({ spelId: id, nr: n, bord: p.bord, aanZet: p.aanZet, keten: p.keten })
        } else if (p.keten && !gameOver) {
            const vorigBord = staat.bord
            Dammen.voerKetenUit(staat, p.keten); laatsteKeten = p.keten; nr++
            animatie = { keten: p.keten, vorigBord }
            pasToe(p.keten, vorigBord)
            geselecteerd = null; pad = []
            controleerEinde(); naBeurt()
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
        if (p.bord && nieuwer(p.spelId ?? 0, p.nr ?? 0) && !(gameOver && (p.spelId ?? 0) === spelId)) neemStandOver(p)
    })

    function nieuwSpel(id) {
        staat = Dammen.nieuweSpelStaat()
        spelId = id; nr = 0; gameOver = false; uitslag = null
        laatsteKeten = null; geselecteerd = null; pad = []; ketensCache = null; melding = ''
        stil = 0; herhaling = new Map()
        bezigTot = 0; clearTimeout(uitstel)
        opnieuwBtn.hidden = true
        tekenBord()
    }

    spelKanaal.on('broadcast', { event: 'opnieuw' }, msg => {
        const id = (msg.payload && msg.payload.spelId) || spelId + 1
        if (id > spelId) nieuwSpel(id)
    })
    opnieuwBtn.addEventListener('click', () => {
        ontgrendel()
        const id = Math.max(Date.now(), spelId + 1)
        nieuwSpel(id)
        stuur('opnieuw', { spelId: id })
    })

    // ── Geluid ──
    const tekenGeluidKnop = () => {
        geluidBtn.textContent = geluidAan() ? '🔊' : '🔇'
        geluidBtn.setAttribute('aria-pressed', String(geluidAan()))
        geluidBtn.title = geluidAan() ? T('Geluid uit') : T('Geluid aan')
    }
    tekenGeluidKnop()
    geluidBtn.addEventListener('click', () => { zetGeluid(!geluidAan()); tekenGeluidKnop(); ontgrendel(); geluid.kies() })

    // ── Tafelachtergrond ──
    const pasTafelToe = () => {
        if (!overlay) return
        if (inst.tafel && inst.tafel !== 'geen') overlay.setAttribute('data-dam-tafel', inst.tafel)
        else overlay.removeAttribute('data-dam-tafel')
    }
    pasTafelToe()

    // ── Instellingen ──
    function openInstellingen() {
        const vak = document.createElement('div')
        vak.className = 'dm-instellingen'
        const keuze = (sleutelNaam, opties) => '<div class="dm-keuzes" data-sleutel="' + sleutelNaam + '">' + opties.map(([w, label]) =>
            '<button type="button" data-w="' + w + '" aria-pressed="' + (inst[sleutelNaam] === w) + '">' + label + '</button>').join('') + '</div>'
        const schakel = (sleutelNaam, label) => '<label class="dm-schakel"><span>' + label + '</span><input type="checkbox" data-sleutel="' + sleutelNaam + '"' + (inst[sleutelNaam] ? ' checked' : '') + '></label>'
        vak.innerHTML = '<section class="dm-paneel" role="dialog" aria-modal="true" aria-label="' + T('Daminstellingen') + '">'
            + '<h2>⚙ ' + T('Daminstellingen') + '</h2><p class="uitleg">' + T('Maak het bord en de schijven naar jouw smaak. Dit geldt op dit toestel.') + '</p>'
            + '<fieldset><legend>' + T('Bordstijl') + '</legend>' + keuze('bord', [['hout', T('Hout')], ['walnoot', T('Walnoot')], ['marmer', T('Marmer')], ['fibro', 'Fibro']]) + '</fieldset>'
            + '<fieldset><legend>' + T('Grootte van de schijven') + '</legend>' + keuze('grootte', [['klein', T('Kleiner')], ['standaard', T('Standaard')], ['groot', T('Groter')]]) + '</fieldset>'
            + '<fieldset><legend>' + T('Tafelachtergrond') + '</legend>' + keuze('tafel', [['geen', T('Geen')], ['hout', T('Houten tafel')], ['laken', T('Groen laken')], ['fibro', 'Fibro']]) + '</fieldset>'
            + '<fieldset><legend>' + T('Hulp en weergave') + '</legend>'
            + schakel('stippen', T('Mogelijke zetten tonen (groene stipjes)'))
            + schakel('verplicht', T('Gouden rand bij een verplichte slag'))
            + schakel('nummers', T('Veldnummers (1-50)'))
            + schakel('beweging', T('Zetten laten bewegen'))
            + '<label class="dm-schakel"><span>' + T('Geluid') + '</span><input type="checkbox" data-geluid' + (geluidAan() ? ' checked' : '') + '></label>'
            + '</fieldset><button type="button" class="dm-knop hoofd dm-sluit">' + T('Klaar') + '</button></section>'
        document.body.appendChild(vak)
        const pasAan = () => { bewaarInst(inst); spelEl.dataset.bord = inst.bord; pasTafelToe(); tekenBord() }
        vak.querySelectorAll('.dm-keuzes').forEach(groep => groep.addEventListener('click', e => {
            const b = e.target.closest('button[data-w]')
            if (!b) return
            inst[groep.dataset.sleutel] = b.dataset.w
            groep.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
            pasAan()
        }))
        vak.querySelectorAll('input[data-sleutel]').forEach(i => i.addEventListener('change', () => { inst[i.dataset.sleutel] = i.checked; pasAan() }))
        vak.querySelector('input[data-geluid]').addEventListener('change', e => { zetGeluid(e.target.checked); tekenGeluidKnop(); ontgrendel() })
        const sluit = () => vak.remove()
        vak.querySelector('.dm-sluit').addEventListener('click', sluit)
        vak.addEventListener('click', e => { if (e.target === vak) sluit() })
        vak.querySelector('.dm-keuzes button').focus({ preventScroll: true })
    }
    instBtn.addEventListener('click', openInstellingen)

    // ── Webcam (alleen tegen een vriend; chat.html zet de webcams als rondjes bovenin) ──
    let videoBezig = false
    const zetVideoKnop = eigen => {
        if (!videoBtn) return
        videoBtn.setAttribute('aria-pressed', String(!!eigen))
        videoBtn.textContent = eigen ? '📹 ' + T('Webcam uit') : '📹 Webcam'
    }
    const opVideoStaat = e => { if (!videoBezig) zetVideoKnop(e && e.detail && e.detail.eigen); maat(); tekenBord() }
    const opVideoVoortgang = e => { const d = (e && e.detail) || {}; if (d.tekst && !gameOver) { melding = d.tekst; toonStatus(false); setTimeout(() => { if (melding === d.tekst) { melding = ''; toonStatus(false) } }, 3500) } }
    if (videoBtn) {
        window.addEventListener('fibro-chess-video-state', opVideoStaat)
        window.addEventListener('fibro-chess-video-progress', opVideoVoortgang)
        videoBtn.addEventListener('click', async () => {
            if (videoBezig) return
            videoBezig = true
            videoBtn.disabled = true
            videoBtn.textContent = '📹 ' + T('Verbinden…')
            let antwoord = null
            try { antwoord = await (window.FibroChessVideo ? window.FibroChessVideo() : null) } catch (e) {}
            videoBezig = false
            videoBtn.disabled = false
            if (!antwoord || !antwoord.ok) {
                zetVideoKnop(false)
                melding = antwoord && antwoord.reason === 'connecting'
                    ? T('De verbinding met je vriend wordt nog opgebouwd. Probeer het zo nog eens.')
                    : T('Je camera kon niet worden gestart. Controleer de cameratoestemming en probeer het opnieuw.')
                toonStatus(false)
                return
            }
            zetVideoKnop(antwoord.eigen)
        })
    }

    // ── Opruimen en de stand bijhouden ──
    let maatTimer = null
    const opResize = () => { clearTimeout(maatTimer); maatTimer = setTimeout(() => { if (bordEl.isConnected) tekenBord() }, 120) }
    window.addEventListener('resize', opResize)
    // Wie wacht, vraagt af en toe de stand op. Zo loopt het spel nooit vast op een zoekgeraakt bericht.
    const vraag = () => stuur('vraag-stand', { spelId, nr })
    setTimeout(vraag, 1500)
    const timer = setInterval(() => {
        if (!bordEl.isConnected) {
            clearInterval(timer)
            window.removeEventListener('resize', opResize)
            window.removeEventListener('fibro-chess-video-state', opVideoStaat)
            window.removeEventListener('fibro-chess-video-progress', opVideoVoortgang)
            if (overlay) overlay.removeAttribute('data-dam-tafel')
            document.querySelector('.dm-instellingen')?.remove()
            return
        }
        if (!gameOver && staat.aanZet !== mijnKleur) vraag()
    }, 3000)

    if (window.__fibroProef) window.__dammen = { staat: () => staat, inst: () => inst, uitvoeren, zetStand: (bord, aanZet) => { staat.bord = bord; staat.aanZet = aanZet; ketensCache = null; tekenBord() }, eind: () => ({ gameOver, uitslag, stil }) }
    nieuwSpel(0)
}
