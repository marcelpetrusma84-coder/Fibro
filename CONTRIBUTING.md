# Meehelpen aan Stekky / Contributing

Stekky (voorheen Fibro) is een app voor vrienden: chat, bellen, spellen en een eigen profiel. Meehelpen mag graag.

## Afspraken

- **Eigenaar:** Marcel. Hij en Tijn beslissen wat er gemerged wordt. Schrijf in pull requests in eenvoudig Nederlands
  (Engels mag ook).
- **Werkwijze:** maak een branch vanaf `main` en open een pull request. Elke pull request krijgt een testversie op
  Netlify: `deploy-preview-<nr>--stately-llama-4b380e.netlify.app`.
- **Tests:** `node tests/alle-tests.mjs`. Browsertests: `tests/tools/proef*.py` (draaien ook op GitHub).
  Een nieuwe functie of reparatie krijgt bij voorkeur een browsertest die op de oude versie misgaat.
- **Versienummers:** elk veranderd script krijgt een hoger `?v=` (de app bewaart per versie). Controle:
  `node tests/tools/controleer-versies.mjs origin/main HEAD`.
- **Teksten:** de app is Nederlands. Zet elke nieuwe zin in `T('...')` en de Engelse vertaling in `taal-en.js`;
  daarna `taal-en.js` en `taal.js` een hoger `?v=`.
- **Database (Supabase):** veranderingen staan als SQL in `sql/`. Die voeren Marcel of Tijn zelf uit.
- Meer afspraken: [`CLAUDE.md`](CLAUDE.md) en [`AGENTS.md`](AGENTS.md).

## Licentie

Door bij te dragen ga je ermee akkoord dat jouw bijdrage onder dezelfde licentie valt als Stekky:
**AGPL-3.0-or-later** (zie [LICENTIE.md](LICENTIE.md)).

Beveiligingslekken meld je niet in een pull request maar privé, zie [SECURITY.md](SECURITY.md).

---

**English:** branch from `main`, open a pull request, run `node tests/alle-tests.mjs`, bump the `?v=` of every changed
script, and add English translations to `taal-en.js` for new texts. By contributing you agree that your contribution
is licensed under AGPL-3.0-or-later. Report security issues privately (see SECURITY.md).
