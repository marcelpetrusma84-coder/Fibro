# Schaken v5.0: taal en slaggeluid / language and capture audio

## Nederlands

Schaken begint in het Nederlands, ook als de algemene Fibro-taal Engels is.
De taalkeuze bovenaan de schaakinstellingen geldt voor twee én drie spelers en
wordt op dit toestel bewaard onder `fibro_chess_language_v1`. De hoofdtaal van
Fibro verandert niet. Een taalwissel vertaalt de bestaande bediening, status,
spelregels, punten, camera’s en toegankelijkheidslabels; hij begint geen nieuwe
partij en verplaatst of herstart geen camerastreams. Gebruikersnamen blijven intact.

Bij slaan komt de waarde van het **veroverde** stuk uit de stelling vóór de zet:
pion 1, paard/loper 3, toren 5 en dame 9. Eigen veroveringen krijgen een heldere
chimeklank met metalen resonanties, een zachte aanslag en een natuurlijke uitklank.
Hoge boventonen doven eerder uit dan de grondtoon. Waardevollere stukken hebben
een rijkere en langere klank; de dame krijgt een duidelijke beloningsklank.
Eigen verliezen houden hun donkere, dalende dreun met gefilterde materiaalruis
en lage resonanties. Er klinken geen oude schaak-/promotiepiepjes bovenop een slag.
Klassiek/Hout en de bestaande geluidsknop blijven werken. Alle geluidsbronnen
stoppen en worden opgeruimd.

In een echte driespelerspartij volgt het geluid de ingelogde speler. Als de twee
andere spelers elkaar slaan, klinkt alleen de gewone zet. In FIBRO TEST is jouw
perspectief wit, ook wanneer je zelf de zwarte en rode zetten test. De losse
driespelerspreview zonder toegewezen speler volgt de kleur die de zet doet.
Een geslagen koning gebruikt de zwaarste effectklasse; dat kent de koning geen
puntenwaarde toe en verandert de eliminatieregels niet.

Geen migratie, extra netwerkbericht of nieuwe cameratoestemming nodig voor deze
wijziging. Gebouwd vanaf Marcels `main` (`d72dada`). Er zitten geen nog niet
samengevoegde Home-/Neon-aanpassingen van de lokale werkbranch in deze PR.

### Proberen

- `spel.html?spel=schaken`: kies een niveau, doe een zet, open de instellingen en wissel de taal. Stelling, selectie, denktijd, bordstijl en overige keuzes blijven behouden.
- `chat.html?test=FIBRO%20TEST&players=3`: lokale test met alle 96 vakken en drie camerakaders, zonder uitnodigingen. Open **Instellingen** of **Spelregels**.
- `tests/fixtures/chess-sound-preview.html`: positieve en negatieve klanken per stukwaarde, met materiaalkeuze. Start geen partij of camera.
- `tests/fixtures/chess-language-preview.html`: de echte lokale test in een mobiel iframe van 390 pixels breed.
- `tests/fixtures/chess-audio-check.html`: 16 echte OfflineAudioContext-renders controleren stilte, pieken, staarten en toenemende energie.

51 Node-tests slagen in `tests/chess`, `tests/security`, `tests/ui`,
`tests/onboarding`, `tests/neon`, `tests/sync` en `tests/foutmelder`.
De nieuwe tests behandelen taalopslag, ontbrekende opslag, live wisselen,
camerabehoud, stukwaarde, perspectief, en passant, promotieslagen, geluidsuitvoer,
opruimen en dubbele ontvangen zetten. Ook zijn beide varianten in de browser
met echte zetten gecontroleerd, inclusief mobiele instellingen.

## English

Chess defaults to Dutch independently of Fibro’s app language. Choose
**English** at the top of chess settings; the per-device preference applies to
both variants. Switching updates text and accessible labels while preserving
the game, selection, other settings and camera streams. Real usernames are
never translated.

Capture audio uses the captured piece’s value (1 / 3 / 5 / 9). Capturing rewards
you with a metallic chime and naturally decaying resonances; losing a piece uses a darker falling impact.
Larger values add weight, resonance and duration rather than high-pitched UI
bleeps. Queen captures have distinct reward/loss voicings. Existing mute and
Classic/Wood choices apply. Another two opponents capturing each other is
neutral for the local player. FIBRO TEST keeps White as your listening
perspective; unassigned hotseat previews follow the moving colour.

No database or protocol change. The preview paths above work without an
account; camera capture remains an explicit user action. Validation includes
51 passing Node tests, 16 actual browser audio renders and live language
switches after real moves on both boards, including a 390-pixel mobile frame.
