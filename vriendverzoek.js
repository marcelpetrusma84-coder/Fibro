// vriendverzoek.js — UITGESCHAKELD (20 aug 2026)
//
// De in-app verzoek-flow was half gebouwd: stuurVriendverzoek() werd nergens
// aangeroepen, maar de luisteraar draaide op vier pagina's en de accepteer-knop
// riep maak_vriendschap() aan met een vrij op te geven user-id. Die RPC omzeilde
// de vriend-only policy op profiles en is daarom verwijderd.
//
// Vriend worden gaat nu uitsluitend via een uitnodigingslink
// (maak_vriendschap_via_invite, token-gebonden).
//
// Wil je verzoeken later alsnog: sla ze op als rij in friendships met
// status='pending' en laat een security-definer functie op die rij controleren.
// Niet via broadcast — daar is geen bewijs voor de server.

export async function startVriendverzoekLuisteraar() {
  // bewust leeg: imports op vier pagina's blijven zo werken
}
