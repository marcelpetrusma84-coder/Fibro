// fibro-v28: supabase.js laadt nu supabase-lib.js uit de eigen repo. Een nieuwe
// CACHE_VERSION gooit alle oude scriptkopieen weg, zodat iedereen de nieuwe ophaalt.
// v30 (zonder nieuwe CACHE_VERSION): html-pagina's worden ook bewaard, voor als er
// geen internet is. Zie hieronder bij 'Html-pagina's'.
// fibro-v30: supabase.js wacht zonder internet niet meer op een verlopen inlogpas.
// supabase.js wordt bijna overal geladen (?v=95); een nieuwe CACHE_VERSION zorgt dat
// iedereen de nieuwe ophaalt. kastvullen.js vult de kast daarna vanzelf weer aan.
const CACHE_VERSION = 'fibro-v36' // v36: stable friend games, camera layout, and recovered media state
// v139 (zonder nieuwe CACHE_VERSION, de kast blijft vol): html-pagina's wachten hoogstens
// 0,4 seconde op internet; daarna de bewaarde kopie. Zie hieronder bij 'Html-pagina's'.
const WACHT_MS = 400
const MAX_LEEFTIJD = 7 * 24 * 3600 * 1000 // een oudere kopie: gewoon wachten op internet
// v168: het bolletje op het icoon van de app (iPhone, Windows/Mac). ongelezen.js zet het juiste aantal zodra Fibro
// open is en bewaart het in dit kastje; komt er een pushmelding (bericht, buzz, gemiste oproep) terwijl Fibro dicht
// is, dan telt de portier er een bij. Het kastje blijft staan bij een nieuwe CACHE_VERSION.
const BADGE_KAST = 'fibro-badge', BADGE_SLEUTEL = 'fibro-badge-teller'
// Een eigen teller voor de meldingenlade. Een buzz of oproep kan nog steeds het app-icoon bijwerken.
const CHAT_TAG = 'stekky-chat-ongelezen', CHAT_STAND = 'fibro-chat-melding-stand'
const CHAT_SYNC = 'fibro-chat-melding-teller', CHAT_CLEAR = 'fibro-chat-melding-wis'
const CHAT_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
let chatStand = null, chatRij = Promise.resolve()

function planChatMelding(taak) {
  const werk = chatRij.then(taak)
  chatRij = werk.catch(() => {}) // Een mislukte melding blokkeert de volgende niet.
  return werk
}

function geldigeChatStand(stand) {
  return stand && Number.isSafeInteger(stand.aantal) && stand.aantal >= 0 &&
    Number.isSafeInteger(stand.gemeten) && stand.gemeten > 0
}

async function leesChatStand() {
  if (chatStand) return chatStand
  try {
    const kast = await caches.open(BADGE_KAST)
    const bewaard = await kast.match(CHAT_STAND)
    if (bewaard) {
      const stand = await bewaard.json()
      if (Number.isSafeInteger(stand?.aantal) && stand.aantal >= 0 &&
          Number.isSafeInteger(stand.gemeten) && stand.gemeten >= 0 && Array.isArray(stand.ids)) chatStand = stand
    }
  } catch (e) {}
  return chatStand ||= { ontvanger: '', aantal: 0, gemeten: 0, exact: false, ids: [], taal: 'nl' }
}

async function bewaarChatStand(stand) {
  chatStand = stand
  try { await (await caches.open(BADGE_KAST)).put(CHAT_STAND, new Response(JSON.stringify(stand))) } catch (e) {}
}

function chatMeldingTekst({ aantal, exact, taal }) {
  const n = new Intl.NumberFormat(taal === 'en' ? 'en' : 'nl').format(aantal)
  if (taal === 'en') return n + (exact ? ' unread chat ' : ' new chat ') + (aantal === 1 ? 'message' : 'messages')
  return n + (exact ? ' ongelezen ' : (aantal === 1 ? ' nieuw ' : ' nieuwe ')) + (aantal === 1 ? 'chatbericht' : 'chatberichten')
}

function toonChatMelding(stand, nieuw) {
  const url = bestand => new URL(bestand, self.registration.scope).href
  return self.registration.showNotification('Stekky', {
    body: chatMeldingTekst(stand),
    tag: CHAT_TAG,
    icon: url('icon-192.png?v=4'),
    badge: url('icon-192.png?v=4'),
    renotify: nieuw,
    ...(nieuw ? { vibrate: [200, 100, 200] } : { silent: true }),
    data: { url: url('chat.html') },
  })
}

async function wisChatMelding(ontvanger) {
  const oud = await leesChatStand()
  if (oud.ontvanger && oud.ontvanger !== ontvanger) return
  await bewaarChatStand({ ...oud, ontvanger, aantal: 0, ids: [], afgemeld: true })
  for (const melding of await self.registration.getNotifications({ tag: CHAT_TAG })) melding.close()
}

async function werkChatMeldingBij(data) {
  const oud = await leesChatStand()
  const zelfdeAccount = oud.ontvanger === data.ontvanger || !oud.ontvanger
  if (zelfdeAccount && data.gemeten < oud.gemeten) return
  const stand = {
    ontvanger: data.ontvanger, aantal: data.aantal, gemeten: data.gemeten,
    exact: true, ids: zelfdeAccount ? oud.ids : [], taal: data.taal === 'en' ? 'en' : 'nl',
  }
  await bewaarChatStand(stand)
  const meldingen = await self.registration.getNotifications({ tag: CHAT_TAG })
  if (!stand.aantal || !zelfdeAccount) {
    for (const melding of meldingen) melding.close()
    return
  }
  // Een weggeveegde melding blijft weg. Pas een volgend bericht maakt weer een kaartje.
  if (meldingen.some(melding => melding.body !== chatMeldingTekst(stand))) await toonChatMelding(stand, false)
}

async function nieuwChatBericht(data) {
  const oud = await leesChatStand()
  if (oud.afgemeld) return
  const ontvanger = CHAT_UUID.test(data.ontvanger || '') ? data.ontvanger : oud.ontvanger
  if (ontvanger && oud.ontvanger && ontvanger !== oud.ontvanger) return
  const id = CHAT_UUID.test(data.berichtId || '') ? data.berichtId : ''
  if (id && oud.ids.includes(id)) return
  const metStand = geldigeChatStand(data.chatTeller)
  if (metStand && data.chatTeller.gemeten < oud.gemeten) return
  const stand = {
    ontvanger,
    aantal: metStand ? data.chatTeller.aantal : oud.aantal + 1,
    gemeten: metStand ? data.chatTeller.gemeten : oud.gemeten,
    exact: !!metStand,
    ids: id ? [...oud.ids.slice(-63), id] : oud.ids,
    taal: data.taal === 'en' || (!data.taal && /^you have|^new message/i.test(data.body || '')) ? 'en'
      : data.taal === 'nl' ? 'nl' : oud.taal,
  }
  await bewaarChatStand(stand)
  if (stand.aantal) await toonChatMelding(stand, true)
  else for (const melding of await self.registration.getNotifications({ tag: CHAT_TAG })) melding.close()
}

self.addEventListener('message', function(event) {
  const data = event.data
  if (!CHAT_UUID.test(data?.ontvanger || '')) return
  // Alleen de webapp brengt haar eigen, ingelogde stand over naar de worker.
  if (!event.source?.url || !event.source.url.startsWith(self.registration.scope)) return
  if (data.type === CHAT_CLEAR) event.waitUntil(planChatMelding(() => wisChatMelding(data.ontvanger)))
  if (data.type === CHAT_SYNC && geldigeChatStand(data)) event.waitUntil(planChatMelding(() => werkChatMeldingBij(data)))
})
// v270: in een pushmelding de eigen naam van je vriend erbij ("Sanne aka ChonkyCapibara404 belt je"), zie pushnamen.js.
// Lukt het laden niet, dan gewoon de tekst van de server.
try { importScripts('./pushnamen.js?v=1') } catch (e) {}
async function badgeEenErbij() {
  try {
    const kast = await caches.open(BADGE_KAST)
    const oud = await kast.match(BADGE_SLEUTEL)
    const n = (oud ? (parseInt(await oud.text(), 10) || 0) : 0) + 1
    await kast.put(BADGE_SLEUTEL, new Response(String(n)))
    if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n)
  } catch (e) {}
}
// v172: de plaatjes en geluiden van de stickers (stickers/f1..f6/01..12.webp en geluiden/<naam>.mp3?v=...) in een
// eigen kast, zodat ze ook zonder internet werken en niet steeds opnieuw bij GitHub nagevraagd worden. Ze veranderen
// (bijna) nooit. Een nieuw stickervel (nieuwe namen) hoeft hier niets: die komen vanzelf in de kast (en kastvullen.js
// haalt ze alvast op). Vervang je een BESTAAND plaatje (zoals stickers/f4/05.webp in v167), verhoog dan het getal
// hieronder: de oude kast gaat weg en alles komt opnieuw binnen (±2,5 MB per toestel). Een vervangen mp3: zoals altijd
// MP3_VERSIE in stickerfx.js (de oude versie gaat hier dan vanzelf uit de kast). De kast blijft bij een nieuwe
// CACHE_VERSION staan.
const MEDIA_KAST = 'fibro-media-1'
// 11 nov 2026: ook de kaartplaatjes van de kaartspellen (kaarten/perkament/hA.webp?v=1 ...; kaartspel-hulp.js).
const IS_MEDIA = /\/(stickers\/f[1-9]\/\d{2}\.webp|geluiden\/[a-z0-9-]+\.mp3|kaarten\/[a-z]+\/[A-Za-z0-9]+\.webp)$/
async function ruimOudeVersiesOp(kast, url) { // hetzelfde bestand met een andere ?v= (oude MP3_VERSIE) eruit
  try {
    for (const k of await kast.keys()) {
      const u = new URL(k.url)
      if (u.pathname === url.pathname && u.search !== url.search) await kast.delete(k)
    }
  } catch (e) {}
}

// v265: een script met ?v= dat (nog) niet binnenkomt: geen internet even, of vlak na een update heeft GitHub het
// nieuwe bestand nog niet overal klaar (404). Dan bleef de pagina leeg tot je zelf opnieuw laadde. Nu wacht de portier
// 0,8 seconde en probeert het nog één keer, niet uit de browsercache. Lukt dat ook niet, dan gaat het antwoord (of de
// fout) gewoon door, zoals vroeger; foutmelder.js laadt de pagina dan één keer opnieuw.
async function haalMetHerkansing(req) {
  try {
    const res = await fetch(req, { cache: 'no-cache' }) // niet uit de browsercache: altijd de echte nieuwste
    if (res.ok || res.status < 500 && res.status !== 404) return res
  } catch (e) {}
  await new Promise(klaar => setTimeout(klaar, 800))
  return fetch(req, { cache: 'reload' })
}

self.addEventListener('install', function(event) {
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(keys =>
    Promise.all(keys
    .filter(key => key !== CACHE_VERSION && key !== BADGE_KAST && key !== MEDIA_KAST)
    .map(key => caches.delete(key)))
    ).then(() => caches.open(MEDIA_KAST)) // v172: alvast aanmaken, zodat kastvullen.js weet dat deze portier stickers bewaart
    .then(() => clients.claim())
  )
})

self.addEventListener('fetch', function(event) {
  const req = event.request
  if (req.method !== 'GET') return

    const url = new URL(req.url)
    // Supabase, TURN en andere domeinen: niet aanraken
    if (url.origin !== self.location.origin) return

      // Scripts en CSS met ?v=: direct uit de cache
      if (url.searchParams.has('v') && /\.(js|css)$/.test(url.pathname)) {
        event.respondWith(
          caches.open(CACHE_VERSION).then(async function(cache) {
            const hit = await cache.match(req)
            if (hit) return hit
              const res = await haalMetHerkansing(req) // v265: mislukt het, dan nog één keer (pagina bleef soms leeg)
              if (res.ok) cache.put(req, res.clone())
                return res
          })
        )
        return
      }
      // Lettertypebestanden (v118): veranderen nooit, dus ook direct uit de cache
      if (/\/lettertypen\/[a-z0-9-]+\.woff2$/.test(url.pathname)) {
        event.respondWith(
          caches.open(CACHE_VERSION).then(async function(cache) {
            const hit = await cache.match(req)
            if (hit) return hit
              const res = await fetch(req)
              if (res.ok) cache.put(req, res.clone())
                return res
          })
        )
        return
      }
      // Stickerplaatjes en stickergeluiden (v172): uit de eigen kast; de eerste keer van internet (niet uit de
      // browsercache, die kan na een vervanging nog de oude hebben) en dan in de kast. Een vraag om een stukje van een
      // bestand (Range, bijv. een <audio> die zelf afspeelt) laat de portier aan de browser over.
      if (IS_MEDIA.test(url.pathname) && !req.headers.has('range')) {
        event.respondWith(
          caches.open(MEDIA_KAST).then(async function(kast) {
            const hit = await kast.match(req.url)
            if (hit) return hit
            const res = await fetch(req, { cache: 'no-cache' })
            if (res.ok && res.status === 200 && res.type === 'basic') {
              const bewaren = kast.put(req.url, res.clone()).then(() => ruimOudeVersiesOp(kast, url)).catch(() => {})
              try { event.waitUntil(bewaren) } catch (e) {} // de portier niet stilleggen voordat het bewaard is
            }
            return res
          })
        )
        return
      }
      // Html-pagina's (v30): eerst van internet, zodat je online altijd de nieuwste
      // versie krijgt. Lukt internet niet, dan de laatst bewaarde kopie: zo opent Fibro
      // ook zonder internet. Een kopie wordt bewaard zonder ?vriend=... e.d. (die leest
      // de pagina zelf uit het adres) en verdwijnt met een nieuwe CACHE_VERSION, samen
      // met de scripts waar ze bij hoort.
      // v139: duurt internet langer dan 0,4 seconde (trage 4G, wifi met een slecht
      // signaal), dan meteen de bewaarde kopie. De nieuwe versie komt intussen gewoon
      // binnen en gaat in de kast, voor de volgende keer. Na een update zie je bij traag
      // internet dus hoogstens een keer de vorige versie (met de scripts die erbij horen).
      // Is de kopie ouder dan een week, of weet je niet hoe oud, dan wachten zoals vroeger.
      // Een verandering waarbij een oude pagina niet meer met de server kan praten: een
      // nieuwe CACHE_VERSION, dan zijn alle kopieen weg.
      if (req.mode === 'navigate' && /(\/|\.html)$/.test(url.pathname)) {
        const sleutel = url.origin + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '')
        const netwerk = fetch(req)
        // Bewaren mag nooit de pagina zelf in de weg zitten. De kopie wordt meteen
        // gemaakt (voordat de pagina de inhoud leest), ook als de pagina de oude kreeg.
        event.waitUntil(netwerk.then(function(res) {
          if (!res.ok || res.type !== 'basic') return
          const kopie = res.clone()
          return caches.open(CACHE_VERSION).then(c => c.put(sleutel, kopie))
        }).catch(() => {}))
        // v240: geeft de server een storing (5xx, zoals GitHubs eenhoorn-pagina "We're having a really bad day"),
        // dan de bewaarde kopie in plaats van de foutpagina, ook als die ouder is dan een week.
        event.respondWith((async function() {
          const hit = await caches.open(CACHE_VERSION).then(c => c.match(sleutel)).catch(() => null)
          if (!hit) return netwerk // nog geen kopie: wachten, zoals vroeger
          const goedOfKopie = netwerk.then(res => res.status >= 500 ? hit : res, () => hit)
          const leeftijd = Date.now() - Date.parse(hit.headers.get('date') || '')
          if (!(leeftijd < MAX_LEEFTIJD)) return goedOfKopie
          const op_tijd = await Promise.race([
            goedOfKopie, // geen internet of een storing: meteen de kopie
            new Promise(klaar => setTimeout(() => klaar(null), WACHT_MS))
          ])
          return op_tijd || hit
        })())
        return
      }
      // Al het andere (afbeeldingen e.d.): browser regelt het zelf
})
// v187: 'Buzz schudt en trilt' uit (menu > Instellingen; meldingen.js zet de keuze in het kastje 'fibro-badge'): een
// buzz trilt dan zoals een gewoon bericht en krijgt het gewone icoon.
async function buzzRustig() {
  try { const k = await caches.open(BADGE_KAST); const r = await k.match('fibro-buzz-rustig'); return !!r && (await r.text()) === '1' } catch (e) { return false }
}
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  if (!data.type || data.type === 'bericht' || data.type === 'groep') {
    event.waitUntil(Promise.all([
      planChatMelding(() => nieuwChatBericht(data)),
      !data.type || data.type === 'bericht' ? badgeEenErbij() : null,
    ]))
    return
  }
  const title = data.title || 'Stekky'
  const isBuzz = data.type === 'buzz'
  // v151: oproep ('belt je') blijft staan tot je erop tikt; 'gemist' vervangt hem (zelfde tag van de server)
  const isOproep = data.type === 'oproep' || data.type === 'oproep-video'
  const tag = typeof data.tag === 'string' && data.tag ? data.tag : (isBuzz ? 'buzz' : undefined)
  // v168: een bericht, buzz of gemiste oproep telt mee in het bolletje op het icoon ('belt je' niet)
  const telt = !data.type || data.type === 'buzz' || data.type === 'gemist'
  event.waitUntil((async () => {
    const schud = isBuzz && !(await buzzRustig())
    let body = data.body || 'Je hebt een nieuw bericht'
    try { if (self.FibroPushNamen) body = self.FibroPushNamen.naamInMelding(body, await self.FibroPushNamen.lees()) } catch (e) {} // v270
    const options = {
      body: body,
      icon: schud ? '/Fibro/icon-buzz.png' : '/Fibro/icon-192.png?v=4', // v271: nieuw icoon (kleurverloop)
      badge: '/Fibro/icon-192.png?v=4',
      vibrate: schud ? [300, 80, 300, 80, 300, 80, 500] : isOproep ? [700, 300, 700, 300, 700, 300, 700] : [200, 100, 200],
      tag: tag,
      renotify: !!tag,
      requireInteraction: isOproep,
      data: { url: data.url || '/chat.html' }
    }
    await Promise.all([self.registration.showNotification(title, options), telt ? badgeEenErbij() : null])
  })())
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
});
