// registratie.js (v226): mag je hier een nieuw account maken? Voor de (open) bèta.
// De echte controle zit in de database (sql/registratie-schakelaar.sql, een trigger op auth.users). Dit bestand
// zorgt er alleen voor dat login.html en invite.html meteen een duidelijke uitleg tonen in plaats van een
// formulier dat toch niet werkt, en dat een geweigerde aanmelding een begrijpelijke melding geeft.
// Standen: open (iedereen), uitnodiging (alleen met een geldige uitnodiging), dicht (niemand).
// Is de SQL nog niet uitgevoerd, dan geldt 'open': dan werkt alles zoals vroeger.
(function () {
  const STANDEN = ['open', 'uitnodiging', 'dicht']
  const TEKST = {
    uitnodiging: 'Nieuwe accounts maak je nu alleen met een uitnodiging. Vraag iemand die al op Fibro zit om een uitnodigingslink.',
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

  window.FibroRegistratie = { STANDEN, TEKST, ONBEKEND, VERLOPEN, geldigeStand, melding, weigerTekst, isGeweigerd, haalStand }
})()
