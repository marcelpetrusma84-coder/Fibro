From 474608725b5fff7a4b78c61df713fb5340b92afd Mon Sep 17 00:00:00 2001
From: Claude <noreply@anthropic.com>
Date: Mon, 26 Oct 2026 12:58:53 +0100
Subject: [PATCH] Controller-ondersteuning: controller.js zet een gamepad om in
toetsen voor alle actiespellen

Linker stick/d-pad = pijltjes, A/RT = spatie, B/X = X, Y = Q, Start = Enter, Select = Escape.
Geladen in chat.html, spel.html en spellen/runner-gunner.html.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TzhyqHmcKEvsP74kZ6GRLP
---
chat.html                  |   1 +
controller.js              | 128 +++++++++++++++++++++++++++++++++++++
spel.html                  |   1 +
spellen/runner-gunner.html |   1 +
4 files changed, 131 insertions(+)
create mode 100644 controller.js

diff --git a/chat.html b/chat.html
index 73c24a5..89c8615 100644
--- a/chat.html
+++ b/chat.html
@@ -15,6 +15,7 @@
<script src="huisregel.js?v=1"></script>
<script src="taal.js?v=30"></script>
<script src="verbinding.js?v=3"></script>
+<script src="controller.js?v=1"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title data-t>Fibro — Chat</title>
<link rel="apple-touch-icon" href="icon-192.png">
diff --git a/controller.js b/controller.js
new file mode 100644
index 0000000..908a6f4
--- /dev/null
+++ b/controller.js
@@ -0,0 +1,128 @@
+// controller.js (v1): spelcomputer-controller (Steam Deck, Xbox, PlayStation, MFi op iPhone) als toetsenbord.
+// De spellen luisteren al naar toetsen op window; dit bestand leest de controller uit en stuurt dezelfde
+// keydown/keyup-gebeurtenissen. Zo werkt elk spel met toetsenbordbesturing meteen, ook spellen die later komen.
+// Er wordt alleen iets gedaan zolang er een controller verbonden is.
+//
+// Indeling (standaard controller):
+//   linker stick / d-pad  -> pijltjes        A (onder)  -> spatie
+//   B (rechts)            -> X               X (links)  -> X
+//   Y (boven)             -> Q               RT         -> spatie
+//   Start / Menu          -> Enter           Select     -> Escape
+;(function () {
    +  if (typeof window === 'undefined' || window.__fibroController) return
    +  window.__fibroController = true
    +  if (!navigator.getGamepads) return
    +
    +  const TOETS = {
        +    links:  { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
        +    rechts: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        +    op:     { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
        +    neer:   { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
        +    spatie: { key: ' ',          code: 'Space',      keyCode: 32 },
        +    x:      { key: 'x',          code: 'KeyX',       keyCode: 88 },
        +    q:      { key: 'q',          code: 'KeyQ',       keyCode: 81 },
        +    enter:  { key: 'Enter',      code: 'Enter',      keyCode: 13 },
        +    esc:    { key: 'Escape',     code: 'Escape',     keyCode: 27 }
        +  }
        +  // Richtingen herhalen bij vasthouden, net als een echt toetsenbord (Block It schuift dan door)
+  const HERHAAL = { links: 1, rechts: 1, op: 1, neer: 1 }
+  const EERSTE_HERHAAL = 180, HERHAAL_ELKE = 70, DODE_ZONE = 0.5
+
+  const vast = {}        // naam -> tijdstip van de volgende herhaling
+  let lus = 0
+
+  function typt () {
    +    const a = document.activeElement
    +    return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)
    +  }
    +
    +  function stuur (soort, naam, herhaling) {
        +    const t = TOETS[naam]
        +    const e = new KeyboardEvent(soort, { key: t.key, code: t.code, repeat: !!herhaling, bubbles: true, cancelable: true })
        +    // Phaser leest keyCode/which; die kun je niet via de constructor zetten
        +    try { Object.defineProperty(e, 'keyCode', { get: () => t.keyCode }) } catch (_) {}
        +    try { Object.defineProperty(e, 'which', { get: () => t.keyCode }) } catch (_) {}
        +    window.dispatchEvent(e)
        +  }
        +
        +  function knop (gp, i) { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5) }
        +
        +  function leesStand () {
            +    const nu = {}
            +    const lijst = navigator.getGamepads ? navigator.getGamepads() : []
            +    for (const gp of lijst) {
                +      if (!gp || !gp.connected) continue
                +      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0
                +      const std = gp.mapping === 'standard'
                +      if (ax < -DODE_ZONE || (std && knop(gp, 14))) nu.links = 1
                +      if (ax >  DODE_ZONE || (std && knop(gp, 15))) nu.rechts = 1
                +      if (ay < -DODE_ZONE || (std && knop(gp, 12))) nu.op = 1
                +      if (ay >  DODE_ZONE || (std && knop(gp, 13))) nu.neer = 1
                +      if (knop(gp, 0)) nu.spatie = 1
                +      if (std && knop(gp, 7)) nu.spatie = 1
                +      if (knop(gp, 1) || knop(gp, 2)) nu.x = 1
                +      if (knop(gp, 3)) nu.q = 1
                +      if (std && knop(gp, 9)) nu.enter = 1
                +      if (std && knop(gp, 8)) nu.esc = 1
                +    }
                +    // Links+rechts of op+neer tegelijk: geen van beide
                +    if (nu.links && nu.rechts) { delete nu.links; delete nu.rechts }
                +    if (nu.op && nu.neer) { delete nu.op; delete nu.neer }
                +    return nu
                +  }
                +
                +  function laatAllesLos () {
                    +    for (const naam of Object.keys(vast)) { delete vast[naam]; stuur('keyup', naam) }
                    +  }
                    +
                    +  function tik () {
                        +    lus = 0
                        +    const nu = typt() || document.hidden ? {} : leesStand()
                        +    const tijd = performance.now()
                        +    for (const naam of Object.keys(vast)) {
                            +      if (!nu[naam]) { delete vast[naam]; stuur('keyup', naam) }
                            +    }
                            +    for (const naam of Object.keys(nu)) {
                                +      if (!(naam in vast)) {
                                    +        vast[naam] = HERHAAL[naam] ? tijd + EERSTE_HERHAAL : Infinity
                                    +        stuur('keydown', naam, false)
                                    +      } else if (tijd >= vast[naam]) {
                                        +        vast[naam] = tijd + HERHAAL_ELKE
                                        +        stuur('keydown', naam, true)
                                        +      }
                                        +    }
                                        +    if (heeftController()) lus = requestAnimationFrame(tik)
                                        +    else laatAllesLos()
                                        +  }
                                        +
                                        +  function heeftController () {
                                            +    const lijst = navigator.getGamepads ? navigator.getGamepads() : []
                                            +    for (const gp of lijst) if (gp && gp.connected) return true
                                            +    return false
                                            +  }
                                            +
                                            +  function start () { if (!lus) lus = requestAnimationFrame(tik) }
                                            +
                                            +  let melding = null
                                            +  function meld (tekst) {
                                                +    if (!document.body) return
                                                +    if (!melding) {
                                                    +      melding = document.createElement('div')
                                                    +      melding.setAttribute('role', 'status')
                                                    +      melding.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translateX(-50%);' +
                                                    +        'z-index:2147483647;padding:8px 16px;border-radius:999px;background:rgba(20,10,40,.88);color:#fff;' +
                                                    +        'font:600 15px/1.2 system-ui,sans-serif;pointer-events:none;transition:opacity .3s;opacity:0'
                                                    +      document.body.appendChild(melding)
                                                    +    }
                                                    +    melding.textContent = tekst
                                                    +    melding.style.opacity = '1'
                                                    +    clearTimeout(meld.t)
                                                    +    meld.t = setTimeout(() => { melding.style.opacity = '0' }, 1800)
                                                    +  }
                                                    +
                                                    +  window.addEventListener('gamepadconnected', () => { meld('🎮 ✓'); start() })
                                                    +  window.addEventListener('gamepaddisconnected', () => { meld('🎮 ✕'); if (!heeftController()) laatAllesLos() })
                                                    +  window.addEventListener('blur', laatAllesLos)
                                                    +  // Was de controller al verbonden voordat deze pagina laadde (komt van een andere Fibro-pagina)?
                                                    +  if (heeftController()) start()
                                                    +})()
                                                    diff --git a/spel.html b/spel.html
                                                    index 01e0694..efa2532 100644
                                                    --- a/spel.html
                                                    +++ b/spel.html
                                                    @@ -5,6 +5,7 @@
                                                    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://qmgatbphiplrfxrljtbe.supabase.co; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://qmgatbphiplrfxrljtbe.supabase.co wss://qmgatbphiplrfxrljtbe.supabase.co data: blob:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'">
                                                    <script src="huisregel.js?v=1"></script>
                                                    <script src="taal.js?v=30"></script>
                                                    +<script src="controller.js?v=1"></script>
                                                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                                                    <title data-t>Fibro — Spel</title>
                                                    <link rel="apple-touch-icon" href="icon-192.png">
                                                    diff --git a/spellen/runner-gunner.html b/spellen/runner-gunner.html
                                                    index 5240f47..331a815 100644
                                                    --- a/spellen/runner-gunner.html
                                                    +++ b/spellen/runner-gunner.html
                                                    @@ -5,6 +5,7 @@
                                                    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://qmgatbphiplrfxrljtbe.supabase.co; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://qmgatbphiplrfxrljtbe.supabase.co wss://qmgatbphiplrfxrljtbe.supabase.co data: blob:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'">
                                                    <script src="../huisregel.js?v=1"></script>
                                                    <script src="../taal.js?v=30"></script>
                                                    +<script src="../controller.js?v=1"></script>
                                                    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
                                                    <title>Runner &amp; Gunner — 16bit</title>
                                                    <link href="../lettertypen/press-start-2p.css?v=1" rel="stylesheet">
                                                    --
                                                    2.43.0
