// registratie.js (v226): mag je hier een nieuw account maken? Voor de (open) bèta.
// De echte controle zit in de database (sql/registratie-schakelaar.sql, een trigger op auth.users). Dit bestand
// zorgt er alleen voor dat login.html en invite.html meteen een duidelijke uitleg tonen in plaats van een
// formulier dat toch niet werkt, en dat een geweigerde aanmelding een begrijpelijke melding geeft.
// Standen: open (iedereen), uitnodiging (alleen met een geldige uitnodiging), dicht (niemand).
// Is de SQL nog niet uitgevoerd, dan geldt 'open': dan werkt alles zoals vroeger.
// v270 (5 nov 2026): bij het registreren vul je ook je EIGEN NAAM in (verplicht). Dat wordt je weergavenaam: die staat
// alleen op je eigen toestel (fibro_profiel_<id>.naam) en gaat versleuteld naar je vrienden (sync.js, postbus.js).
// De server krijgt hem niet: daar staat alleen je gebruikersnaam.
(function () {
  const STANDEN = ['open', 'uitnodiging', 'dicht']
  const TEKST = {
    uitnodiging: 'Nieuwe accounts maak je nu alleen met een uitnodiging. Vraag iemand die al op Stekky zit om een uitnodigingslink.',
    dicht: 'Er kunnen op dit moment geen nieuwe accounts gemaakt worden. Probeer het later nog eens.'
  }
  const ONBEKEND = 'Account aanmaken lukt nu niet. Probeer het later nog eens.'
  const VERLOPEN = 'Deze uitnodiging is verlopen of al gebruikt. Vraag om een nieuwe uitnodigingslink.'

  function geldigeStand(s) { return STANDEN.includes(s) ? s : 'open' }

  // De uitleg die in plaats van het formulier komt, of null als het formulier gewoon mag
  function melding(stand, metUitnodiging) {
    stand = geldigeStand(stand)
    if (stand === 'open') return null
    if (stand === 'uitnodiging' && metUitnodiging) return null
    return TEKST[stand]
  }

  // De uitleg nadat de database een nieuw account weigerde (stand zoals die nu is)
  function weigerTekst(stand, metUitnodiging) {
    stand = geldigeStand(stand)
    const tekst = melding(stand, metUitnodiging)
    if (tekst) return tekst
    if (stand === 'uitnodiging' && metUitnodiging) return VERLOPEN // een uitnodiging is 20 minuten geldig
    return ONBEKEND
  }

  // Weigert de database een nieuw account, dan zegt Supabase alleen 'Database error saving new user'
  function isGeweigerd(fout) {
    const m = String((fout && fout.message) || fout || '')
    return /database error saving new user|FIBRO_REGISTRATIE/i.test(m)
  }

  async function haalStand(supabase) {
    try {
      const { data, error } = await supabase.rpc('registratie_stand')
      if (error) return 'open'
      return geldigeStand(data)
    } catch (e) { return 'open' }
  }

  // v270: je eigen naam. Hoogstens 40 tekens (zoals de sync en de postbus), spaties netjes.
  const NAAM_MAX = 40
  function schoonEigenNaam(naam) { return String(naam == null ? '' : naam).replace(/\s+/g, ' ').trim().slice(0, NAAM_MAX).trim() }
  // De foutmelding (Nederlandse zin, de sleutel voor de vertaling), of null als de naam goed is
  function eigenNaamFout(naam) {
    const n = schoonEigenNaam(naam)
    if (!n) return 'Vul je eigen naam in, zodat je vrienden weten wie je bent.'
    if (n.length < 2) return 'Je eigen naam is te kort.'
    return null
  }
  // Op dit toestel bewaren als weergavenaam (de rest van het lokale profiel blijft staan)
  function bewaarEigenNaam(uid, naam, ls) {
    ls = ls || window.localStorage
    const n = schoonEigenNaam(naam)
    if (!uid || !n) return false
    let profiel = {}
    try { profiel = JSON.parse(ls.getItem('fibro_profiel_' + uid) || '{}') || {} } catch (e) { profiel = {} }
    if (typeof profiel !== 'object' || Array.isArray(profiel)) profiel = {}
    profiel.naam = n
    try { ls.setItem('fibro_profiel_' + uid, JSON.stringify(profiel)); return true } catch (e) { return false }
  }
  function heeftEigenNaam(uid, ls) {
    ls = ls || window.localStorage
    try { return !!schoonEigenNaam((JSON.parse(ls.getItem('fibro_profiel_' + uid) || '{}') || {}).naam) } catch (e) { return false }
  }

  window.FibroRegistratie = { STANDEN, TEKST, ONBEKEND, VERLOPEN, geldigeStand, melding, weigerTekst, isGeweigerd, haalStand,
    NAAM_MAX, schoonEigenNaam, eigenNaamFout, bewaarEigenNaam, heeftEigenNaam }
})()
