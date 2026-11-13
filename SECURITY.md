# Beveiliging / Security

Heb je een beveiligingslek gevonden in Stekky? Fijn dat je het meldt.

**Meld het niet in een gewone issue of pull request**, want die zijn openbaar. Gebruik op GitHub:
**Security → Report a vulnerability** (een privémelding die alleen de makers zien).

Zet erbij:
- wat het probleem is en waar (bestand, pagina of functie);
- hoe we het kunnen nadoen;
- wat iemand ermee zou kunnen (bijvoorbeeld berichten lezen, inloggen als een ander).

We reageren zo snel als we kunnen. Stekky wordt in de vrije tijd gemaakt, dus soms duurt het een paar dagen.
Maak het lek pas openbaar als het is opgelost, of als we samen een datum hebben afgesproken.

Extra belangrijk zijn: inloggen (`login.html`), de versleuteling (`crypto.js`), bellen (`bellen.js`), de chat
(`chat.html`), de database-regels (`sql/`) en de service worker (`service-worker.js`).

---

**English:** please report security issues privately via **Security → Report a vulnerability** on GitHub, not in a
public issue. Include what is affected, how to reproduce it and the possible impact. Please give us time to fix it
before disclosing it publicly.
