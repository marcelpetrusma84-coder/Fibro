// meldingen-aan.js (v258, 4 nov 2026): meldingen aanzetten met EEN tik, overal op dezelfde manier.
//
// Vanzelf aanzetten kan niet: Apple en Google laten een site alleen meldingen sturen als je zelf op 'Sta toe' tikt.
// Wel kan het op het goede moment met een tik:
//  - meteen na het inschrijven (invite.html, het welkomstscherm met je herstelcode)
//  - op Home: een kaart tot de meldingen aan staan ('Nu niet' = drie dagen niet). Zijn ze ooit geweigerd, dan legt de
//    kaart uit waar je ze in de instellingen van de telefoon weer aanzet.
//  - in Stijl (profiel.html, Meldingen), zoals al sinds v248
//  - op de iPhone (als app): de eerste tik op 'Welkom bij Fibro, tik om te beginnen' (beltoon.js) vraagt het meteen mee
// Op de iPhone werken meldingen alleen als Fibro op het beginscherm staat. In Safari zelf toont Home daarom de tip van
// beginscherm.js ('Zet Fibro op je beginscherm'); de eerste keer vanaf het beginscherm komt deze kaart.
// Eenmaal aan komen alle soorten binnen: berichten, buzz, bellen, spellen, nieuwe vrienden en het gastenboek.
import { iphoneZonderApp, openBeginschermUitleg } from './beginscherm.js?v=3'

const T = window.T || ((s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v) ? v[k] : m))
const SERVERSLEUTEL = 'BBTo5083-joPZ8FjJW0_lIMuyUWP3T6b6cul22b971RK033GrXdRzFyPUbSE8aoTADuQmdRtVOq1CI2n3v-RLyA'
const WERKER = './service-worker.js?v=97' // dezelfde als op de andere pagina's
const WEG_SLEUTEL = 'fibro_meldkaart_weg'
const WEG_DAGEN = 3

const kanPush = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

// De stand op dit toestel: 'aan' | 'uit' | 'geweigerd' | 'iphone-zonder-app' | 'niet-mogelijk'
export async function meldStand() {
  if (iphoneZonderApp()) return 'iphone-zonder-app'
  if (!kanPush()) return 'niet-mogelijk'
  if (Notification.permission === 'denied') return 'geweigerd'
  if (Notification.permission !== 'granted') return 'uit'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return reg && reg.pushManager && await reg.pushManager.getSubscription() ? 'aan' : 'uit'
  } catch (e) { return 'uit' }
}

// Aanroepen bij een tik, zonder eerst iets anders af te wachten: de iPhone laat de vraag alleen zien als hij meteen bij
// de tik komt. Geeft 'aan', 'uit' (vraag weggetikt), 'geweigerd', 'iphone-zonder-app', 'niet-mogelijk' of 'mislukt'.
export async function zetMeldingenAan(supabase, userId) {
  if (iphoneZonderApp()) { openBeginschermUitleg({ reden: 'meldingen' }); return 'iphone-zonder-app' }
  if (!kanPush()) return 'niet-mogelijk'
  let vraag
  try { vraag = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission) }
  catch (e) { vraag = Promise.resolve(Notification.permission) }
  const toestemming = await vraag
  if (toestemming === 'denied') return 'geweigerd'
  if (toestemming !== 'granted') return 'uit'
  try {
    const reg = await navigator.serviceWorker.register(WERKER)
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ||
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: SERVERSLEUTEL })
    if (!userId) { const { data } = await supabase.auth.getSession(); userId = data && data.session && data.session.user && data.session.user.id }
    if (!userId) return 'mislukt'
    const { error } = await supabase.from('push_subscriptions').upsert({ user_id: userId, subscription: sub.toJSON() }, { onConflict: 'user_id,endpoint' })
    if (error) { console.warn('[meldingen] opslaan mislukt:', error.message); return 'mislukt' }
    return 'aan'
  } catch (e) { console.warn('[meldingen] aanzetten mislukt:', e); return 'mislukt' }
}

// Waar zet je ze weer aan als ze geweigerd zijn?
function instellingenTekst() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) return T('Zet ze aan in <b>Instellingen > Meldingen > Stekky</b>.')
  if (/Android/.test(ua)) return T('Houd het Stekky-icoon ingedrukt, kies <b>App-info > Meldingen</b> en zet ze aan.')
  return T('Klik op het slotje naast het adres van deze pagina en zet <b>Meldingen</b> op Toestaan.')
}

function knop(tekst, hoofd) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = tekst
  b.style.cssText = hoofd
    ? 'flex-shrink:0;min-height:38px;padding:8px 16px;border-radius:19px;border:none;background:var(--knop,#8b3fd1);color:#ffffff;font-weight:700;font-size:14.5px;cursor:pointer;font-family:inherit'
    : 'flex-shrink:0;width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.1);color:var(--text,#fff);font-size:18px;cursor:pointer'
  return b
}

// Home: de kaart, tot de meldingen aan staan. Niets bij 'aan', bij een toestel zonder meldingen, en in Safari op de
// iPhone (daar staat al de tip om Fibro op het beginscherm te zetten).
export async function toonMeldkaart(plek, supabase, userId) {
  if (!plek || document.getElementById('meldkaart')) return null
  const stand = await meldStand()
  if (stand === 'aan' || stand === 'niet-mogelijk' || stand === 'iphone-zonder-app') return null
  try { if (Date.now() - Number(localStorage.getItem(WEG_SLEUTEL) || 0) < WEG_DAGEN * 86400000) return null } catch (e) {}
  const kaart = document.createElement('div')
  kaart.id = 'meldkaart'
  kaart.setAttribute('role', 'note')
  kaart.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0 4px;padding:12px;border-radius:14px;border:1px solid rgba(192,132,252,0.55);background:rgba(192,132,252,0.13);font-size:14px;line-height:1.4'
  const tekst = document.createElement('div')
  tekst.className = 'meldkaart-tekst'
  tekst.style.cssText = 'flex:1;min-width:0'
  const aan = knop(T('Aanzetten'), true)
  aan.className = 'meldkaart-aan'
  const weg = knop('×', false)
  weg.className = 'meldkaart-weg'
  weg.setAttribute('aria-label', T('Nu niet'))
  weg.title = T('Nu niet')
  weg.onclick = () => { try { localStorage.setItem(WEG_SLEUTEL, String(Date.now())) } catch (e) {}; kaart.remove() }
  const geweigerd = () => {
    tekst.innerHTML = T('\u{1F515} <b>Meldingen staan uit</b> voor Stekky, dus je mist berichten van vrienden.') + ' ' + instellingenTekst()
    aan.remove()
  }
  if (stand === 'geweigerd') geweigerd()
  else tekst.innerHTML = T('\u{1F514} <b>Zet meldingen aan</b>, dan weet je wanneer vrienden je schrijven, buzzen of uitdagen.')
  aan.onclick = async () => {
    aan.disabled = true
    const uit = await zetMeldingenAan(supabase, userId)
    aan.disabled = false
    if (uit === 'aan') {
      tekst.innerHTML = T('✅ <b>Meldingen staan aan!</b>')
      aan.remove()
      setTimeout(() => kaart.remove(), 2500)
    } else if (uit === 'geweigerd') geweigerd()
    else if (uit === 'mislukt') tekst.innerHTML = T('⚠️ Dat lukte niet. Probeer het later nog eens, of in Stijl > Meldingen.')
  }
  kaart.append(tekst)
  if (stand !== 'geweigerd') kaart.append(aan)
  kaart.append(weg)
  plek.prepend(kaart)
  // Op de iPhone (als app) staat bij het openen 'Welkom bij Fibro, tik om te beginnen' (beltoon.js). Die eerste tik vraagt
  // dan ook meteen om de meldingen: zo staan ze er met dezelfde tik bij. Eén keer; de kaart blijft als het niet lukt.
  if (stand === 'uit') {
    window.FibroMeldingenBijTik = () => {
      window.FibroMeldingenBijTik = null
      if (kaart.isConnected && aan.isConnected && !aan.disabled) aan.onclick()
    }
  }
  return kaart
}
