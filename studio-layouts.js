// studio-layouts.js (26 nov 2026: de layout "Nu.nl" is weg, NU.nl staat commercieel gebruik van de feeds niet toe; 25 nov 2026) - de widget-layouts die met Stekky Studio zijn gemaakt (layouts.js).
// Elke layout: { id: 'l1', store: 'layout-<naam>', titel, uitleg: [nl, en], h, vakken: [{ soort, x, y, w, h }] }.
// In de Store staat hij bij Widgets; op Home heet de widget 'mix_<id>'. Niet met de hand bewerken:
// tests/tools/studio-layout-installeer.mjs voegt een layout toe.
// Ids die weg zijn: nooit opnieuw gebruiken (anders krijgt wie de oude widget had de nieuwe, met de oude inhoud).
// l1 = Nu.nl (26 nov 2026). Staat ook in VERVALLEN_WIDGETS in index.html (als mix_l1).
export const VERVALLEN_LAYOUTS = ['l1']
export const STUDIO_LAYOUTS = []
