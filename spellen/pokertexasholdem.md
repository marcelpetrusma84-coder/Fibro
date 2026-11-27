# Bouwopdracht: Poker Texas Hold'em (🎲)

*Gemaakt in Stekky Studio. Bouw dit spel volgens BLAUWDRUK-KAARTSPEL.md. Het spel staat al overal aangemeld (studio-spellen.js) en heeft een werkend beginspel in `pokertexasholdem-ui.js` en een computerspeler in `pokertexasholdem.js`. Vervang dat beginspel door de echte regels hieronder.*

## Wat

- Soort: Kaartspel
- Id: `pokertexasholdem`
- Naam: Poker Texas Hold'em (Engels: Poker Texas Hold'em)
- Store, Nederlands: Texas Hold'em tegen de computer, een vriend of je groep: twee eigen kaarten, vijf op tafel, en bluffen maar. Speel met speelfiches, of zet je casino-tokens in.
- Store, Engels: Texas Hold'em against the computer, a friend or your group: two cards of your own, five on the table, and bluff away. Play with chips, or bet your casino tokens.

## Spelregels

Bij Texas Hold'em krijgt elke speler twee eigen kaarten (hole cards) en liggen er maximaal vijf gemeenschappelijke kaarten (community cards) open op tafel. Je maakt de sterkste combinatie van vijf kaarten met een vrije keuze uit je twee eigen kaarten en de vijf gemeenschappelijke kaarten (je mag dus ook één eigen kaart of zelfs nul eigen kaarten gebruiken).

Verloop van een hand
1
Plaats de blinds
De speler links van de dealerknop (button) legt de small blind in, de speler ernaast de big blind. Dit zijn verplichte inzetten om potactie op gang te brengen.

2
Deel de hole cards en speel de pre-flop
Elke speler krijgt twee gesloten kaarten. Daarna volgt de eerste inzetronde (pre-flop), te beginnen bij de speler links van de big blind. Spelers kunnen folden (passen), callen (meegaan met de huidige inzet) of raisen (verhogen).

3
Leg de flop neer
De dealer verbrandt één kaart (face-down) en legt drie open gemeenschappelijke kaarten op tafel (de flop). Daarna volgt een nieuwe inzetronde, beginnend bij de eerste actieve speler links van de dealerknop.

4
Leg de turn neer
Na een nieuwe burn card komt de vierde open gemeenschappelijke kaart op tafel (de turn), gevolgd door de derde inzetronde.

5
Leg de river neer
Na nog een burn card komt de vijfde en laatste gemeenschappelijke kaart op tafel (de river), gevolgd door de laatste inzetronde.

6
Speel de showdown
Blijven er na de river twee of meer spelers over, dan tonen zij hun kaarten. De speler met de hoogste vijfkartencombinatie wint de pot. Bij een exact gelijke hand wordt de pot gedeeld (split pot).

Acties tijdens een inzetronde
Check: Geen inzet plaatsen wanneer er in de huidige ronde nog geen inzet is gedaan.

Bet: De eerste inzet in een ronde plaatsen.

Call: Hetzelfde bedrag inzetten als de huidige hoogste inzet in die ronde.

Raise: De huidige inzet verhogen. Bij No-Limit Hold'em mag je tot al je chips (all-in) gaan; bij Limit Hold'em liggen de inzet- en verhogingsbedragen vast.

Fold: Je hand weggooien en uit de huidige hand stappen; je verliest wat je al hebt ingezet.

Handranglijst (van hoog naar laag)
Rang Hand Voorbeeld Toelichting
1 Royal flush A♠ K♠ Q♠ J♠ 10♠ Straight flush van 10 tot en met aas in dezelfde kleur
2 Straight flush 9♥ 8♥ 7♥ 6♥ 5♥ Vijf opeenvolgende kaarten van dezelfde kleur
3 Four of a kind K♣ K♦ K♥ K♠ 4♣ Vier kaarten van dezelfde waarde
4 Full house Q♠ Q♥ Q♦ 8♣ 8♠ Three of a kind gecombineerd met een paar
5 Flush A♦ J♦ 8♦ 6♦ 2♦ Vijf willekeurige kaarten van dezelfde kleur
6 Straight 10♣ 9♦ 8♥ 7♠ 6♣ Vijf opeenvolgende waarden in gemengde kleuren (aas mag hoog en laag: A-2-3-4-5)
7 Three of a kind 7♠ 7♥ 7♦ A♣ 3♠ Drie kaarten van dezelfde waarde
8 Two pair J♠ J♦ 5♥ 5♣ A♦ Twee verschillende paren
9 One pair 10♥ 10♠ K♦ 9♣ 2♥ Eén paar kaarten van dezelfde waarde
10 High card A♠ Q♣ 9♦ 6♥ 3♠ Geen van bovenstaande combinaties; hoogste kaart telt
Bij gelijke combinaties (bijvoorbeeld twee spelers met een paar vrouwen) beslissen de kickers—de hoogste losse kaarten die niet onderdeel zijn van de combinatie—wie wint.

Met of zonder tokens (Marcel, 27 nov 2026)
Iedereen begint een potje met 1000 speelfiches; de blinds zijn 10/20 en gaan elke 10 handen omhoog. Je speelt door tot één speler alle fiches heeft (of tot jij geen fiches meer hebt).
Met tokens (alleen tegen de computer): aan het begin koop je in met 10, 25, 50 of 100 tokens (casino.js). Win je de hele tafel, dan krijg je 2× je inzet terug; ben je eerder af of ga je weg, dan ben je de inzet kwijt.
Zonder tokens: dezelfde speelfiches, je saldo blijft gelijk. Met een vriend of in de groep altijd zonder tokens.

## Kaarten

- Kaartspel: Gewoon kaartspel (52 kaarten)
- Kaarten per speler: 2
- Spelers: 2 tot 6
- Gebruik de kaarttafel (`kaartspel-hulp.js`): kaartstijlen, ondergrond, animaties, beurtklok en trillen.

## Met meer spelers (2 tot 6)

- Bouw het zoals Eenendertigen (`eenendertigen.js` en `eenendertigen-ui.js`, zie BLAUWDRUK-KAARTSPEL.md, "Met meer spelers en met de groep").
- De regels werken voor `n` spelers (zetels 1 tot n), om de beurt in de rondte; wie eruit ligt, wordt overgeslagen.
- Het spel loopt via `groepspel.js`: `start({ spelKanaal, spelers, mijnZetel })`. Zetel 1 (wie start) heeft de stand; de computer speelt lege plekken en wie weggaat.
- De anderen als rondjes rond de tafel: `tafel.tegenstanders(...)`, met 🤖 voor de computer.
- Tegen de computer: eerst kiezen tegen hoeveel computers (1 tot 5).
- Zet `"max": 6` bij dit spel in studio-spellen.js zodra het met meer spelers werkt: dan staat het in de groepschat onder 🎲 (met pushmelding).

## Wat erin zit

- Spelmenu ☰ (pauze, geluid, microfoon, camera, menu, verlaten): ja
- Met een vriend spelen in de chat: ja
- Tegen de computer (op Home, makkelijk, normaal of moeilijk): ja
- Chatbalk in het spel: stickers 🎨, emoji 😊 en berichten: ja
- Webcamrondjes bovenin (met 📹-knop): ja
- In de Stekky Store (downloaden, dan op Home en in het spelmenu): ja
- Spraak: Spraak meteen aan als het spel begint (zoals bij de kaartspellen)
- Titelscherm: zoals Pesten

## Extra's

- Knop ❓ met de spelregels in het spel
- Knop ↻ Opnieuw spelen na afloop
- Beurtklok (een rondje dat aftelt)
- Trillen als je aan de beurt bent
- Scorebord over meerdere potjes
- Geluidjes bij zetten, winnen en verliezen
- Animaties (kaarten of stukken die bewegen)
- Hulp: laten oplichten wat je mag doen
- Instelling: grote kaarten of stukken

## Klaar is

- de regels werken met een vriend en tegen de computer (wat hierboven aan staat);
- alle teksten met `T(...)`, en Engels in `taal-en.js`;
- een test in `tests/` en een browsertest in `tests/tools/` (ook met 3 spelers in de groepschat, zoals proef340);
- de `?v=` van pokertexasholdem-ui.js en pokertexasholdem.js omhoog (en `v` in studio-spellen.js).
