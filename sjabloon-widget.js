// sjabloon-widget.js (v1, 27 nov 2026) - SJABLOON voor een nieuwe widget. Kopieer dit bestand (bijvoorbeeld naar
// mijnwidget.js), geef de functie een eigen naam en zet één regel in widgets.js. Dan staat hij in de Store en op Home.
//
// In gewone woorden: een widget is één functie die een vakje (c) vult. Hij krijgt mee:
//   supabase   de verbinding met de server (supabase.js)
//   uid        wie er ingelogd is (of leeg)
//   T          vertalen: T('Nederlandse zin', { invul }); zet de Engelse zin in taal-en.js (of in window.FIBRO_EN)
//   openSpel   een spel openen met zijn titelscherm: openSpel('eenentwintigen')
// Dit voorbeeld telt hoe vaak je op de knop tikte (bewaard op dit toestel, per account). Het laat zien:
//   - eigen stijl één keer in <head> (met een eigen voorvoegsel, hier 'sjw-');
//   - teksten via T, ook als T ontbreekt;
//   - bewaren op het toestel zonder te crashen (privé-modus of een volle opslag);
//   - een knop die niet doorklikt naar de widget eronder (e.stopPropagation).
// De kleuren van Stekky: knoppen #8b3fd1 met witte letters, accenten #c084fc.

function zetStijl() {
  if (document.getElementById('sjw-css')) return
  const s = document.createElement('style'); s.id = 'sjw-css'
  s.textContent = `.sjw{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;text-align:center}
.sjw-getal{font-size:28px;font-weight:900;color:#c084fc;font-variant-numeric:tabular-nums}
.sjw-knop{padding:8px 14px;border:0;border-radius:12px;background:#8b3fd1;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.sjw-knop:active{transform:scale(.96)}`
  document.head.append(s)
}

const vul = (s, w) => String(s).replace(/\{(\w+)\}/g, (m, k) => (w && k in w ? w[k] : m))   // zonder taal.js: alleen invullen

export function tekenSjabloonWidget(c, { uid = '', T = globalThis.T || vul, storage = globalThis.localStorage } = {}) {
  zetStijl()
  const tt = (s, w) => { try { return T(s, w) } catch (e) { return vul(s, w) } }
  const sleutel = 'fibro_sjabloonwidget_' + (uid || 'lokaal')
  let n = 0
  try { n = Math.max(0, parseInt(storage?.getItem(sleutel), 10) || 0) } catch (e) {}

  const doos = document.createElement('div'); doos.className = 'sjw'
  const getal = document.createElement('div'); getal.className = 'sjw-getal'
  const knop = document.createElement('button'); knop.type = 'button'; knop.className = 'sjw-knop'; knop.textContent = tt('Tik hier')
  const teken = () => { getal.textContent = tt('{n} keer getikt', { n }) }
  knop.onclick = e => {
    e.stopPropagation()
    n++
    try { storage?.setItem(sleutel, String(n)) } catch (e2) {}
    teken()
  }
  doos.append(getal, knop)
  c.replaceChildren(doos)
  teken()
  return { getal: () => n }
}
