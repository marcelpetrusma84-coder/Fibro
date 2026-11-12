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
  const expliciet = new URLSearchParams(location.search).has('logout') ||
    ['#herstellen', '#registreren'].includes(location.hash)
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
