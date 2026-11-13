// Alleen een weergave tijdens sessieherstel; de Supabase-sessiecheck beslist of iemand is ingelogd.
;(() => {
  const root = document.documentElement
  let timer
  let verlopen = false

  function toonFormulier() {
    clearTimeout(timer)
    root.removeAttribute('data-login-sessie')
    const formulier = document.getElementById('login-inhoud')
    if (formulier) {
      formulier.inert = false
      formulier.removeAttribute('aria-hidden')
    }
  }

  function toonLaden() {
    if (verlopen) return
    root.setAttribute('data-login-sessie', 'laden')
    const formulier = document.getElementById('login-inhoud')
    if (formulier) {
      formulier.inert = true
      formulier.setAttribute('aria-hidden', 'true')
    }
    clearTimeout(timer)
    // Ook bij een niet geladen module of een netwerkstoring blijft aanmelden bereikbaar.
    timer = setTimeout(() => { verlopen = true; toonFormulier() }, 12000)
  }

  window.FibroLoginSessie = { toonLaden, toonFormulier, isVerlopen: () => verlopen }
  const uitgelogd = new URLSearchParams(location.search).has('logout')
  const expliciet = uitgelogd || ['#herstellen', '#registreren'].includes(location.hash)
  // 13 nov 2026: na Uitloggen (login.html?logout=1) is een overgebleven inlogpas nooit meer geldig: weg ermee, voordat
  // Supabase hem leest. Anders kwam je bij de volgende keer openen weer zonder wachtwoord binnen.
  if (uitgelogd) {
    try {
      const weg = []
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) weg.push(k) }
      weg.forEach(k => localStorage.removeItem(k))
    } catch {}
  }
  if (!expliciet) {
    try {
      const sessie = JSON.parse(localStorage.getItem('sb-qmgatbphiplrfxrljtbe-auth-token') || 'null')
      if (sessie?.access_token && sessie?.user?.id) toonLaden()
    } catch {} // Geen leesbare sessie: het gewone formulier blijft beschikbaar.
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (root.hasAttribute('data-login-sessie')) {
      const formulier = document.getElementById('login-inhoud')
      if (formulier) { formulier.inert = true; formulier.setAttribute('aria-hidden', 'true') }
    }
  }, { once: true })
  window.addEventListener('hashchange', () => {
    if (['#herstellen', '#registreren'].includes(location.hash)) toonFormulier()
  })
})()
