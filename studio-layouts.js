// studio-layouts.js (25 nov 2026) - de widget-layouts die met Stekky Studio zijn gemaakt (layouts.js).
// Elke layout: { id: 'l1', store: 'layout-<naam>', titel, uitleg: [nl, en], h, vakken: [{ soort, x, y, w, h }] }.
// In de Store staat hij bij Widgets; op Home heet de widget 'mix_<id>'. Niet met de hand bewerken:
// tests/tools/studio-layout-installeer.mjs voegt een layout toe.
export const STUDIO_LAYOUTS = [
  { id: "l1", store: "layout-nu-nl", titel: "Nu.nl",
    uitleg: ["Het nieuws van NU.nl in één widget. Kies zelf welke rubrieken je ziet (hoogstens 3).","The news from NU.nl in one widget. Choose which sections you see (up to 3)."],
    h: 4, vakken: [
      { soort: "rss", x: 0, y: 0, w: 4, h: 4,
        inhoud: {"manier":"kiezen","feeds":[{"url":"https://www.nu.nl/rss/Algemeen","naam":"Algemeen"},{"url":"https://www.nu.nl/rss/Economie","naam":"Economie"},{"url":"https://www.nu.nl/rss/Sport","naam":"Sport"},{"url":"https://www.nu.nl/rss/entertainment","naam":"Media & Cultuur"},{"url":"https://www.nu.nl/rss/Achterklap","naam":"Achterklap"},{"url":"https://www.nu.nl/rss/Opmerkelijk","naam":"Opmerkelijk"},{"url":"https://www.nu.nl/rss/slimmer-leven","naam":"Slimmer leven"},{"url":"https://www.nu.nl/rss/tech-wetenschap","naam":"Tech & Wetenschap"}]} },
    ] },
]
