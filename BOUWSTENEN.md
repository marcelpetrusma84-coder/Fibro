# Het pakhuis: bouwstenen van Stekky

*Gemaakt op 27 november 2026 (Marcel). Lees dit **voordat** je iets nieuws bouwt. Staat wat je nodig hebt hier al, gebruik
het dan (of breid het uit). Bouw het niet opnieuw.*

## Zo gebruik je het pakhuis

1. **Eerst zoeken.** Kijk in de lijst hieronder (zoek op een woord: "geluid", "score", "kanaal", "kaart"...). Lees daarna de
   kop van het bestand zelf: daar staat precies hoe het werkt.
2. **Past het bijna?** Breid de bouwsteen uit (met een test erbij), zodat het volgende spel er ook wat aan heeft. Maak geen
   tweede versie.
3. **Iets nieuws gebouwd dat een ander later ook kan gebruiken?** Zet het hier bij de goede groep, met één regel uitleg.
   Iets dat alleen voor één spel of pagina is, zet je bij [Alleen voor één onderdeel](#alleen-voor-één-onderdeel).
4. **De controle** `tests/ui/test-bouwstenen.mjs` kijkt of elk script (`*.js` in de hoofdmap), elk SQL-bestand, elke
   edge function en elk installeerscript hier genoemd wordt, en of alles wat hier staat ook echt bestaat. Vergeten = rood.
5. **In de PR** schrijf je onder "Bouwstenen" welke je hergebruikte en welke er nieuw bij kwamen.

Grotere uitleg staat in [BLAUWDRUK-BEURTSPEL.md](BLAUWDRUK-BEURTSPEL.md), [BLAUWDRUK-KAARTSPEL.md](BLAUWDRUK-KAARTSPEL.md),
[PLAN-STEKKY-STUDIO.md](PLAN-STEKKY-STUDIO.md) en in `docs/`.

---

## 1. Spellen

### Een nieuw spel in de app zetten
| Bouwsteen | Wat het doet |
|---|---|
| `tests/tools/studio-spel-installeer.mjs` | **De snelste weg.** Zet een spel (een `.stekkyspel.json`, uit Studio of zelf gemaakt) overal in de app: Store, chat, spel.html, Home, widgets, uitnodigingen, spelicoon, titelscherm, scorebord. Plus een werkend beginspel en de bouwopdracht `spellen/<id>.md`. |
| `studio-spellen.js` | De lijst van spellen uit Studio. Eén regel = het spel staat overal. Opties: `max` (groep, tot 6), `zonderKanaal` (alleen spelen, geen niveaus), `titel` (titelscherm van een ander spel). |
| `solo.js` | Tegen de computer (spel.html): `SOLO_SPELLEN`, het nagemaakte spelkanaal `maakSoloKanaal`, en kant-en-klare computerspelers (`kaartspelBot` voor kaartspellen met `computerStap`). |
| `spel.html` | Het startscherm van een spel (niveaus, ▶ Start, 👤 vriend, 👥 groep, 📤 Delen, 🏆 Scores). Zet ook `window.fibroSoloUitslag`, `window.fibroSoloScore` en `window.fibroCasino` klaar. |
| **Sjablonen: een werkend beginspel per soort** | De installer kiest het vanzelf (`sjabloonVoor` in `spelmaker.js`); zonder Studio kopieer je ze zelf. |
| `sjabloon-beurtspel-ui.js`, `sjabloon-beurtspel.js` | Beurtspel met z'n tweeën ("Stokjes"): het spelkanaal-protocol, webcamrondjes, computerspeler. |
| `sjabloon-kaartspel-ui.js`, `sjabloon-kaartspel.js` | Kaartspel voor 2 tot 6 spelers ("Hoogste kaart"): `groepspel.js`, de kaarttafel, tegenstanders, computer, groep, ❓ regels, eindscherm. |
| `sjabloon-automaat-ui.js`, `sjabloon-automaat.js` | Een automaat die je alleen speelt ("Hoger of lager"), met of zonder casino-tokens (`zonderKanaal`). |
| `sjabloon-arcade-ui.js`, `sjabloon-arcade.js` | Arcadespel ("Ontwijk"): canvas, toetsen/vinger/controller, pauze, punten, record en scorebord. Uitleg: [BLAUWDRUK-ARCADE.md](BLAUWDRUK-ARCADE.md). |
| `spelicoon.js` | Het plaatje van een spel (`spelicoon/<id>.webp`), met een terugval als het ontbreekt. |
| `titelscherm.js`, `titelscenes.js`, `titelstijl.js`, `titelmuziek.js` | Titelscherm met bewegend plaatje en eigen deuntje voor elk spel; `openSpelMetTitel` opent een spel vanaf Home. |
| `spelmenu.js` | Het ☰-menu in elk spel: pauze, geluid, microfoon, camera, 🏆 Scores, menu, verlaten. `spelgeluidAan()` = mag een spel geluid maken. |
| `samenspelen.js` | Kan dit spel met een vriend of een groep (`kanMetVriend`, `kanMetGroep`). |
| `speluitnodiging.js`, `spelsessie.js`, `uitnodigen.js` | Iemand uitnodigen voor een spel (op elke pagina), één geldige sessie per vriendenpaar, en een uitnodigingslink delen via het deelmenu. |
| `startkaart.js` | De kaart "Speel met een vriend" op Home voor nieuwe gebruikers. |
| `spelversies.js`, `spelversie-data.js`, `spelversie-ui.js`, `spelversie-langdruk.js` | Versienummers en geschiedenis per spel (3 seconden vasthouden op een spelkaart). |

### Samen spelen (het spelkanaal)
| Bouwsteen | Wat het doet |
|---|---|
| `groepspel.js` | **2 tot 6 spelers** over één kanaal: de gastheer heeft de stand, de anderen sturen acties, de computer speelt lege zetels en wie weggaat. Geef alleen je regels mee (`doeStap`, `computerStap`, `geldigeStand`, `aanZet`, `volgendeRonde`). Ook tegen de computer. |
| `groepkaartspel.js` | Een spel starten in de groepschat: uitnodiging, wachtkamer, 🤖 erbij, pushmelding. |
| `spelverbinding.js` | Het spelkanaal in de chat (Supabase Realtime) dat een verbroken verbinding overleeft. |
| `spelnet.js` | **Snelle** berichten rechtstreeks tussen telefoons (WebRTC) voor actiespellen; Supabase alleen om te verbinden. |
| `beurtspel-hulp.js` | Ruimte voor de webcamrondjes en "geslagen" melden (rode rand, geluid). |
| `controller.js` | Een spelcomputer-controller (Steam Deck, Xbox, PlayStation) wordt gewoon toetsenbord: elk spel met toetsen werkt meteen. |
| `mollenmeppen.js` | Mini-game voor in een wachtkamer, terwijl je op vrienden wacht. |
| `wachtspellen.js` | **Snel een gokje terwijl je wacht** (casinospellen): Hoger of lager en de Fruitautomaat in een wachtkamer (`wachtspelKnoppen`) of als knop op een tafel die doorloopt (`wachtspelKnop`, Poker als je eruit ligt). Tokens alleen als iedereen in de chat 18+ is. |

### Kaartspellen
| Bouwsteen | Wat het doet |
|---|---|
| `kaartspel-hulp.js` | **De kaarttafel**: kaarten (SVG en plaatjes), kaartstijlen, waaier, stapel, aflegstapel, delen, animaties, beurtklok, effecten, reacties, knoppen, `kiesUit` (keuzevenster), `einde`, tegenstanders als rondjes, instellingen, `kaartGeluid` en `tril`. Ook los te gebruiken: `kaartSvg`, `achterkantSvg`, `kaartNaam`. |
| `kaarten-motor.js` | **De kaartenmotor**: `maakDeck('52' / '32' / '54' / '104')`, `schud(lijst, rng)`, `kaartInfo`, `isKaart`, `rang` (aas 14), `kleurNaam`. Gebruik deze in elk nieuw kaartspel. |
| `kaartwaaier.js`, `kaart-stapel-feedback.js` | Hulpjes van de tafel: een leesbare waaier, en de stapel die reageert op je vinger. |
| `studio-kaarten.js`, `kaartmaker.js` | Eigen kaartsets uit Studio (`kaarten/<id>/`, 375 × 525, 5 : 7); staan vanzelf bij "Kies je kaarten". Een set mag een eigen `achtergrond` (`#rrggbb`) meegeven voor de getekende 2 t/m 10 (zoals Salon: crème), en een tweede joker (`joker2.webp`, `MAG_ERBIJ`). |
| `pokertexasholdem.js` | Pokerrekenwerk dat ook elders past: `besteHand` (beste 5 uit 5-7 kaarten), `score5`, `vergelijk`, `huidigeHand`, `HAND_NAMEN`, `winKans` (kans om te winnen door na te spelen), inzetrondes met zijpotten. |
| `videopoker.js` | `beoordeel` (Jacks or Better-tabel) en `tip` (welke kaarten houden). |
| Regelbestanden (`pesten.js`, `toepen.js`, `eenentwintigen.js`, `eenendertigen.js`, `koningsjacht.js`) | Elk met dezelfde vorm: één stand, functies die een nieuwe stand teruggeven, `geldigeStand`, `computerStap`. Gebruik er een als voorbeeld. |

### Computerspelers
| Bouwsteen | Wat het doet |
|---|---|
| `computerStap` in een regelbestand + `groepspel.js` | De gewone manier: de computer kiest een stap met dezelfde regels als de mens. |
| `solo.js` (`kaartspelBot`, `stilBot`) | Een computerspeler aan de andere kant van het nagemaakte kanaal (spellen met z'n tweeën). |
| `dammen-worker.js`, `schaak-worker.js`, `solo-bord.js` | Zwaar rekenen in een worker, zodat het scherm soepel blijft. |
| `schaak-ultra-engine.js` | Stockfish (schaken) aansturen. |

### Scores en scoreborden
| Bouwsteen | Wat het doet |
|---|---|
| `spelscores.js` + `sql/spel-scores.sql` | **Scores voor elk spel**: eerst op het toestel, dan naar de server; punten (top 10) of keer gewonnen per niveau, met je vrienden. |
| `scorespellen.js`, `scoreborden.js` | Welk spel welk soort scorebord heeft, en de stijl uit Studio. |
| `neon-raiders-scoreboard.js` | Het scorebordscherm (`maakNeonScorebord`) dat alle spellen gebruiken. |
| `scorebordwidget.js` | De widget 🏆 Scorebord op Home. |

### Casino-tokens
| Bouwsteen | Wat het doet |
|---|---|
| `casino.js` + `sql/casino-tokens.sql` | Speelgeld: 500 per week (28 nov 2026), fiches 5/10/25/50/100, tot -100. `maakCasino().kiesInzet()` = het inzetscherm; `uitslag()` betaalt uit (2×, inzet terug, niets). Server: `casino_bij` (saldo bijwerken) en `casino_ik` (de gewone controles) voor nieuwe casino-functies. |
| `sql/videopoker.sql` | **Patroon "de server deelt"**: als een uitslag veel waard is, schudt en beoordeelt de server zelf, zodat niemand valsspeelt. |
| `casinowidget.js` | De widget 🎰 Casino op Home (alleen 18+, `alleenVolwassen` in `widgets.js`). |
| `leeftijd.js` + `sql/casino-volwassen.sql` | **18+**: `benIkVolwassen()` (geboortejaar uit je inlog), `casinoMagHier({ vriend, groep })` (is iedereen in deze chat 18+? alleen ja/nee van de server). De server weigert tokens onder de 18 (`casino_ik`) en zet het geboortejaar één keer vast. Ook: `hogerlager_deel`/`hogerlager_raad` (de server deelt, uitbetaling naar de kans), `fruitautomaat_draai`, weekgeld 500 en fiches 5 tot 100. |
| `fruitautomaat.js` | De Fruitautomaat: gewichten, uitbetalingstabel, `terugKans` (eerlijk uitgerekend) en `maakFruitServer` (de server draait, zoals Video Poker). |

---

## 2. Geluid, muziek en beeld

| Bouwsteen | Wat het doet |
|---|---|
| `kaartGeluid` (in `kaartspel-hulp.js`) | Kant-en-klare geluidjes met Web Audio: tik, pak, schud, deel, beurt, speciaal, win, verlies... |
| `titelmuziek.js` | Een klein synthesizertje en deuntjes (`speelTitelMuziek`, `DEUNTJES`). |
| `bordgeluid.js`, `schaak-slaggeluid.js`, `schaak-evaluatiegeluid.js` | Houten en stenen geluiden voor bordspellen. |
| `stickerfx.js` | 15 bewegingen en 19 geluiden voor stickers (ook bruikbaar als effect elders). |
| `geluidregelaar.js` | Nooit twee geluiden door elkaar: wat speelt, pauzeert; daarna gaat het verder. |
| `vergrendelscherm.js` | Het spelertje op het vergrendelscherm en de koptelefoonknoppen (Media Session). |
| `buzzgeluid.js` | Een geluid dat op de iPhone ook meteen klinkt (zonder eerst te tikken). |
| `animatie.js`, `thema.js`, `lettertypes.js`, `icoonthema.js`, `blokstijl.js`, `wallpaper.js` | Achtergrondanimaties, thema's, lettertypes, iconen, blokstijl en achtergronden. |
| `fotoviewer.js` | Een foto groot bekijken, bladeren, vegen, likes. |
| `camerafilters.js` | Filters voor de camera tijdens bellen. |
| `videohulp.js` | Een video omzetten naar H.264 (MP4) op het toestel. |

---

## 3. Home, profiel en widgets

| Bouwsteen | Wat het doet |
|---|---|
| **Een widget toevoegen** → `widgets.js` | Eén bestand met een tekenfunctie en **één regel** in `widgets.js`: dan staat hij in de Store, op Home en in Profiel > Widgets (met schakelaar en 🗑), en (als hij persoonlijk is) niet op het profiel van een vriend. Begin met `sjabloon-widget.js`. Voorbeelden: `scorebordwidget.js`, `casinowidget.js`. (Widgets waarvan de inhoud naar vrienden gaat, zoals foto's en radio, staan nog op de oude manier in `index.html`, `vriend-profiel.html` en `sync.js`.) |
| `store.js` | De Stekky Store: games, widgets, stickers, lettertypes; downloaden, verwijderen, `gameAan`. |
| `layouts.js`, `studio-layouts.js` | Een widget die een paar andere widgets samen laat zien (uit Studio). |
| `standaardwidgets.js` | Welke widgets een nieuw account meteen krijgt. |
| `volgorde.js` | Blokken verslepen door ze vast te houden. |
| `rsswidget.js` | Ophalen via de server (`maakOphaler`, edge function `rss-ophalen`), en een **fotosprite**: veel kleine plaatjes in één plaatje dat naar vrienden gaat (`maakFotos`, `spriteDelen`, `tekenSprite`). |
| `voorbeeldplaatje.js` | Titel en plaatje van een link ophalen en verkleinen. |
| `gastenboekstijl.js`, `stickerwidget.js`, `moodsticker.js` | Het uiterlijk van het gastenboek, stickers als widget, een sticker als mood. |
| `profielreacties.js` | Likes en reacties onder foto's, muziek en video's. |
| `profielmuziek.js` | Je profielnummer speelt vanzelf; stopt tijdens een spel (`fibro-spel-open` / `fibro-spel-dicht`). |

---

## 4. Vrienden, versleuteling en synchroniseren

| Bouwsteen | Wat het doet |
|---|---|
| `crypto.js` | Berichten versleutelen tussen twee mensen (ECDH + AES-GCM), herstelsleutel. |
| `groepsleutel.js` | Versleutelen voor een hele groep (ook bestanden: `versleutelGroepsBytes`). |
| `paren.js` | Een **afgeschermd kanaal per vriendenpaar**: alleen jullie twee (online, seintjes, typen). |
| `sync.js`, `syncbeurt.js` | Je profiel rechtstreeks van telefoon naar telefoon (en met welke vriend als eerste). `lokaleVriendNaam` = de naam die jij je vriend gaf. |
| `postbus.js` | Kleine profielupdates via de server voor als je vriend niet tegelijk online is (versleuteld). |
| `doorgeven.js`, `profielbundel.js`, `profielhandtekening.js` | Een profiel via een gezamenlijke vriend, met een handtekening zodat niemand iets verandert. |
| `p2pfoto.js`, `ice-config.js` | Bestanden rechtstreeks tussen telefoons (WebRTC); de STUN/TURN-servers. |
| `lijntjes.js` | Realtime-verbindingen openhouden na een netwerkwissel. |
| `onlinestip.js`, `heartbeat.js` | Wie is er online (het groene bolletje). |
| `vriendfotos.js`, `cache.js`, `opruimen.js` | Avatars van vrienden op het toestel, vriendcache, alles van een vriend weggooien. |
| `sleutelcontrole.js`, `slotuitleg.js` | De sleutel van een vriend controleren (QR of cijfers); uitleg bij het slotje. |
| SQL-hulpjes `spel_vriend` en `spel_speler_zichtbaar` (in `sql/spel-scores.sql`) | Op de server: zijn twee mensen echt vrienden en is iemand niet geblokkeerd. Gebruik ze voor elke lijst "met je vrienden". |

---

## 5. Chat, groep, bellen en stickers

| Bouwsteen | Wat het doet |
|---|---|
| `chatstatus.js`, `reacties.js`, `reply.js`, `smileys.js`, `chatvolgorde.js` | Typen en gelezen-vinkjes, reacties op berichten, antwoorden, smileys naar emoji, volgorde van de chatlijst. |
| `spraak.js`, `chatfotos.js` | Spraakberichtjes opnemen en afspelen; foto's uit de chat op het toestel bewaren. |
| `groepmedia.js`, `groepmuziek.js`, `groepbord.js`, `groeppiano.js` | In een groep: foto's en spraak, een gedeelde playlist, een tekenbord, een piano. Alles over het live-kanaal, niets in de database. |
| `bellen.js`, `groepbellen.js`, `bel-luisteraar.js`, `beltoon.js`, `belregel.js` | Bellen met één vriend of de groep, inkomende oproepen op elke pagina, beltoon, de regel "gemiste oproep" in de chat. |
| `stickervellen.js`, `stickerkeuze.js`, `eigenstickers.js`, `stickervakken.js`, `stickermaker.js`, `stickerkwast.js`, `onderwerp.js` | Stickervellen, de keuze in de chat, eigen stickers maken (knippen, kwast, onderwerp uitknippen). |
| `spelbericht.js`, `spelchat-crypto.js` | Een wolkje in een spel als je een bericht krijgt; versleutelde chat tijdens een spel. |

---

## 6. De basis van de app (op elke pagina)

| Bouwsteen | Wat het doet |
|---|---|
| `supabase.js` | De verbinding met de server (één client; ook zonder internet snel). |
| `taal.js`, `taal-en.js` | `T('Nederlandse zin', { invul })` en de Engelse vertaling. Spellen uit Studio mogen hun Engels ook in `window.FIBRO_EN` zetten. |
| `huisregel.js`, `foutmelder.js` | Eerste script op elke pagina; fouten naar de server (Moderatie > Fouten). |
| `offline.js`, `verbinding.js`, `sessie.js` | Geen internet, server even weg, uitgelogd of alleen een hapering. |
| `service-worker.js`, `kastvullen.js` | Offline werken: elk bestand per `?v=` in de cache, en de cache vooraf vullen. |
| `meldingen.js`, `meldingen-aan.js`, `pushmeldingen.js`, `pushnamen.js`, `ongelezen.js`, `chat-melding.js` | Buzz en meldingen op de pagina, meldingen aanzetten, pushkeuzes, namen in pushmeldingen, ongelezen tellers. |
| `appslot.js`, `passkey-kluis.js` | App op slot (Face ID, pincode); de sleutel in een passkey-kluis. |
| `balk-vast.js`, `menuschuif.js`, `swipe.js` | De balk onderin, schuiven over het menu, vegen tussen pagina's. |
| `beginscherm.js`, `opslag.js`, `toestel.js` | Op het beginscherm zetten, opslag beschermen, soort toestel melden. |
| `terugmelden.js`, `rapport.js`, `blokkade.js`, `persoonblok.js` | Fout of idee melden, iemand rapporteren, geblokkeerd account, zelf iemand blokkeren. |

---

## 7. Server (Supabase)

| Bouwsteen | Wat het doet |
|---|---|
| **Patroon voor een RPC** | `security definer`, `set search_path = pg_catalog, pg_temp`, eerst controleren wie je bent (zie `casino_ik` in `sql/casino-tokens.sql`), een tempo-grens per minuut, en `revoke all` op tabellen: alleen de functie mag erin. Herhaalbaar schrijven (`if not exists`, `create or replace`). |
| Edge functions in `supabase/functions/` | `stuur-push` (pushmeldingen), `rss-ophalen` (feeds via de server), `get-turn-credentials` (TURN-pasje), `fediverse` (inloggen bij Mastodon/PeerTube), `wachtwoord-reset`. |
| SQL-bestanden in `sql/` | Elk bestand eenmaal uitvoeren in Supabase. Het overzicht staat in [Alleen voor één onderdeel](#server-sql). |

---

## 8. Stekky Studio en de installeerscripts

| Bouwsteen | Wat het doet |
|---|---|
| `tests/tools/studio-spel-installeer.mjs` | Een spel in de app zetten (zie 1). |
| `tests/tools/studio-kaarten-installeer.mjs` | Een kaartset in de app zetten. |
| `tests/tools/studio-layout-installeer.mjs` | Een widget-layout in de app zetten. |
| `tests/tools/studio-scorebord-installeer.mjs` | De scorebordinstellingen in de app zetten. |
| `tests/tools/studio-installeer.mjs` | Een stickervel in de app zetten. |
| `studio-knippen.js` | Plaatjes uit één grote plaat knippen (stickers, kaarten). Bruikbaar voor sprites van een platformspel. |
| `studio-geluid.js` | Een geluid opruimen en een kleine mp3 maken. |
| `studio-prompt.js` | Prompts voor Gemini die goed te knippen platen opleveren. |
| `spelmaker.js`, `studio-pakket.js` | De bestandsformaten van Studio (spel, stickerpakket) en het nakijken ervan. |

---

## 9. Tests en gereedschap

| Bouwsteen | Wat het doet |
|---|---|
| `tests/alle-tests.mjs` | Alle Node-tests. |
| `tests/tools/controleer-versies.mjs`, `tests/tools/verhoog-versies.mjs` | Elk veranderd script een nieuw `?v=`: controleren en ophogen. |
| `tests/tools/proefhulp.py` | **Begin hier voor een nieuwe browsertest.** Het webservertje (`BASIS`), `check` en `klaar()`, `wacht`, `browser`/`context`, `nep_supabase(ctx, f)` (al het verkeer naar buiten dicht, Supabase naar jouw functie), `sessie(uid)` en `inloggen(ctx, s)`, `nieuwe_pagina` (vangt paginafouten), `lege_spelpagina` + `start_spel(q, bestand, opties)` (één spel-UI starten, met `'kanaal': [nr, naam]` voor 2 tot 6 spelers en `'solo': 'record:7'` voor arcade), `KANAAL`, `RUST`, `HAND` en `dubbeltik`. Bovenaan de proef: `import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` en `from proefhulp import *`. Voorbeelden: `proef353.py` (inloggen, nep-Supabase, met 2 en 3 spelers) en `proef356.py` (drie spellen los gestart). |
| `tests/tools/proef*.py` | Browsertests. Nieuwe proeven gebruiken `proefhulp.py`; oudere hebben nog alles zelf (laat ze zo, tenzij je ze toch verandert). Gebruik `pg.wait_for_timeout`, geen `time.sleep`. |
| `tests/tools/browsertests.txt`, `tests/tools/browsertests.py` | De browsertests die op GitHub draaien, in 4 groepjes tegelijk (ongeveer 8 minuten). Een nieuwe proef = een regel erbij. Mislukt een proef, dan draait hij nog één keer; lukt het dan, dan heet hij "wankel" (waarschuwing, maar groen). |
| `tests/tools/taalcheck.py` | Heeft elke Nederlandse tekst een Engelse vertaling? |
| `tests/tools/proef46.mjs`, `proef47.mjs`, `proef50.mjs`, `proef77.mjs`, `proef229.mjs`, `proef233.mjs`, `proef235.mjs`, `proef266.mjs`, `proef280.mjs`, `proef314.mjs` | Node-proeven (vooral de pushfunctie en de server). |

---

## Dubbel werk (op te ruimen)

Hier is iets meer dan één keer gebouwd. Bij het volgende spel dat het nodig heeft: eerst samenvoegen tot één bouwsteen
(met tests), dan pas gebruiken.

| Wat | Waar het dubbel staat | Voorstel |
|---|---|---|
| Kaartspel maken en schudden (`maakDeck`, `schud`, `kaartInfo`, `isKaart`) | `pesten.js`, `toepen.js`, `eenentwintigen.js`, `eenendertigen.js`, `koningsjacht.js` (Poker, Video Poker en de sjablonen gebruiken al `kaarten-motor.js`) | Deze vijf ook op `kaarten-motor.js` zetten (let op: Pesten heeft jokers, Eenendertigen piket). |
| Pokerhanden beoordelen | `pokertexasholdem.js` (`besteHand`) en `videopoker.js` (`beoordeel`) | `beoordeel` bouwen op `score5`. |
| Een toon of ruis maken met Web Audio | `kaartspel-hulp.js`, `bordgeluid.js`, `titelmuziek.js`, `stickerfx.js`, `dammen-geluid.js`, `flappy-geluid.js`, `koningsjacht-geluid.js`, `mollenmeppen.js`, `groeppiano.js` en een paar spellen | Eén *geluidmaker.js* met `toon`, `ruis`, deuntjes en "geluid aan" (via `spelmenu.js`). |
| Scores op het toestel en dan naar de server | `spelscores.js`, `koningsjacht-scores.js`, `neon-raiders-scores.js` | Koningsjacht en Neon Raiders overzetten op `spelscores.js` als het schema het toelaat. |
| Fotosprite en ophalen | `rsswidget.js` en `mastodon.js` (eigen `vak`, `kiesPlaatjes`, `maakFotos`, `spriteDelen`, `tekenSprite`) | Mastodon de functies van `rsswidget.js` laten gebruiken. |
| De opzet van een browsertest (webservertje, `check`, `wacht`, nep-Supabase, nagemaakt spelkanaal) | In bijna elke `tests/tools/proef*.py` opnieuw | Staat nu in `proefhulp.py`. Verander je een oude proef, zet hem dan meteen over. |
| Kleine hulpjes: `esc` (html veilig maken), de `T`-terugval, de `UUID`-controle, "wie is ingelogd" (`account()` / `accountId()` uit `sb-...-auth-token`) | In ruim tien bestanden elk | Eén *hulp.js*. |
| Naam van een vriend opzoeken (`vriend_naam_<ik>_<vriend>`) | `spelscores.js`, `scorebordwidget.js`, `casinowidget.js`, `koningsjacht-scores.js`, `neon-raiders-scores.js`, `nieuwbij.js` | Overal `lokaleVriendNaam` (`sync.js`) of één klein hulpje. |

## Wat nog ontbreekt

- **Een platformmotor** (springen, botsen, vijanden, camera, levels uit een bestand) en een leveleditor in Studio. `phaser.min.js` staat al in de app; `studio-knippen.js` kan sprites knippen.
- **De gedeelde *geluidmaker.js* en *hulp.js*** uit de lijst hierboven.

---

## Alleen voor één onderdeel

Deze bestanden horen bij één spel, pagina of functie. Kijk erin als je aan dat onderdeel werkt; voor iets nieuws zijn ze
meestal niet nodig.

- **Pagina's (Home, profiel, vrienden):** `account.js`, `apk.js`, `eigennaam.js`, `herstel-herinnering.js`, `nieuwbij.js`, `naambouwer.js`, `registratie.js`, `login-sessie.js`, `profile-controls.js`, `profile-unsaved.js`, `timer-melding.js`, `vriendverzoek.js` (uitgeschakeld), `fibro.js` (oud prototype), `setup-shortcuts.js`, `shortcut-folder-store.js`, `device-shortcuts.js`, `foutgroepen.js` (Moderatie).
- **Widgets:** `mastodon.js`, `muziekwidget.js`, `peertube.js`, `fediverse.js`, `quiz.js`, `radio.js`, `radioskins.js`.
- **Chat en groep:** `chat-onlinegolf.js`, `groepenlijst.js`, `chess-layout.js`.
- **Stekky Studio (schermen):** `studio-ui.js`, `studio-kaarten-ui.js`, `studio-layout-ui.js`, `studio-scorebord-ui.js`, `studio-spel-ui.js`, `studio-pakketten.js`.
- **Tic-Tac-Toe, Four in a Row, Invaders:** `bke-ui.js`, `vieroprij-ui.js`, `invaders-ui.js`.
- **Pesten, Toepen, Black Jack, Eenendertigen:** `pesten-ui.js`, `toepen-ui.js`, `eenentwintigen-ui.js`, `eenendertigen-ui.js`.
- **Poker en Video Poker:** `pokertexasholdem-ui.js`, `videopoker-ui.js`.
- **Hoger of lager en de Fruitautomaat:** `hogerlager.js`, `hogerlager-ui.js`, `fruitautomaat-ui.js` (allebei ook als wachtspelletje: `maakHogerLager`, `maakFruitautomaat`).
- **Koningsjacht:** `koningsjacht-ui.js`, `koningsjacht-bier.js`, `koningsjacht-eindscene.js`, `koningsjacht-geluid.js`, `koningsjacht-kaarsen.js`, `koningsjacht-scene.js`, `koningsjacht-score-partij.js`, `koningsjacht-scoreboard.js`, `koningsjacht-scores.js`.
- **Schaken:** `schaak.js`, `schaken-ui.js`, `schaken-drie-ui.js`, `schaak-drie.js`, `schaak-drie-artwork.js`, `schaak-hint-hold.js`, `schaak-hint-uitleg.js`, `schaak-hint-weergave.js`, `schaak-paard-hold.js`, `schaak-paardroutes.js`, `schaak-paardroutes-ui.js`, `schaak-stukken.js`, `schaak-taal.js`, `schaak-taal-en.js`, `schaak-tafelklap.js`, `schaak-testmodus.js`, `schaak-ultra.js`, `schaak-ultra-focus.js`, `schaak-ultra-historie.js`, `schaak-ultra-lichess.js`, `schaak-ultra-swipe.js`, `schaak-wallpaper.js`, `schaak-wallpaper-depth.js`.
- **Dammen:** `dammen.js`, `dammen-ui.js`, `dammen-computer.js`, `dammen-geluid.js`, `dam-bot.js`.
- **Arcade:** `blockit-ui.js`, `blockit-computer.js`, `flappy-ui.js`, `flappy-geluid.js`, `pong-ui.js`, `neopaddle.js`, `neopaddle-levels.js`, `swarm-ui.js`, `ecto-ui.js` (Ghost Tag), `runner-gunner-ui.js`, `twin-snakes-ui.js`, `neon-raiders-ui.js`, `neon-raiders-input.js`, `neon-raiders-scores.js`, `neon-raiders-verder.js`.
- **Bibliotheken van anderen (niet aanpassen):** `supabase-lib.js`, `phaser.min.js`, `lame.min.js`, `qrcode.min.js`, `mediabunny.js` (zie `BIBLIOTHEKEN.txt`).
- **Gegenereerd (niet met de hand):** `titelstijl.js` (tests/gen/maak_titelstijl.py), `scoreborden.js`, `studio-kaarten.js`, `studio-layouts.js`, `studio-pakketten.js`, `studio-spellen.js` (de installeerscripts).

### Server (SQL)
Elk bestand in `sql/` hoort bij één onderdeel; de naam zegt waarbij.

- **Account en privacy:** `account-verwijderen.sql`, `mijn-gegevens-likes.sql`, `mijn-gegevens-postbus.sql`, `minimumleeftijd.sql`, `registratie-schakelaar.sql`, `passkey-kluis.sql`, `taal.sql`, `toon-online.sql`, `profielen-publiek-dicht.sql`, `profielrechten.sql`, `profielvelden.sql`, `profiel-versie.sql`, `profiel-post.sql`, `profiel-likes.sql`, `profiel-via-vrienden.sql`, `foto-etiketten.sql`.
- **Vrienden en blokkeren:** `vriendschap-rechten.sql`, `vriendverzoek-groep.sql`, `vriendverzoek-push.sql`, `uitnodiger-foto.sql`, `uitnodigingen-grens.sql`, `blokkeren.sql`, `blokkade-melding.sql`, `geblokkeerd-regels.sql`, `persoonlijk-blokkeren.sql`, `persoonlijk-blokkeren-2.sql`, `persoonlijk-blokkeren-3.sql`.
- **Chat en groep:** `berichten-bewaren.sql`, `berichten-verwijderen.sql`, `belregels.sql`, `gelezen-vinkjes.sql`, `ongelezen.sql`, `chat-melding-teller.sql`, `groepen.sql`, `groep-extra.sql`, `groep-geblokkeerd.sql`, `groep-onbekenden.sql`, `realtime-kanalen.sql`, `poll.sql`.
- **Meldingen:** `pushmeldingen.sql`, `push-vanaf-server.sql`, `contact-push.sql`.
- **Spellen en Store:** `spel-scores.sql`, `koningsjacht-scores.sql`, `neon-raiders-scores.sql`, `schaken-drie-spelers.sql`, `casino-tokens.sql`, `videopoker.sql`, `casino-volwassen.sql`, `stekky-store.sql`, `stekky-store-iedereen.sql`.
- **Beheer en veiligheid:** `foutmeldingen.sql`, `terugmeldingen.sql`, `controle-alles.sql`, `database-groei.sql`, `fibro-plus-afschermen.sql`, `functies-afgeschermd.sql`, `rechten-ronde2.sql`.
