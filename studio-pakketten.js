// studio-pakketten.js (23 nov 2026) - stickervellen die met Stekky Studio (studio.html) zijn gemaakt.
// Elk vel: { id: 'f8', store: 'stickers-<naam>', titel, uitleg: [nl, en], stickers: [ { nr, naam: [nl, en], b, g } x 12 ] }
// De plaatjes staan in stickers/<id>/<nr>.webp. Een sticker met een eigen geluid heeft dat in geluiden/<id>-<nr>.mp3: dan is
// g die naam (bijv. 'f8-03'), terug het bibliotheekgeluid dat klinkt als de mp3 niet laadt, bron waar het geluid vandaan komt en
// licentie ('zelf', 'cc0', 'cc-by' of 'betaald', zie studio-pakket.js). De Store toont de bron bij cc0 en cc-by.
// stickerfx.js maakt van zulke stickers een geluid. Niet met de hand bewerken: tests/tools/studio-installeer.mjs voegt een vel
// toe (en zet de plaatjes en geluiden op hun plek). Id's gaan door na f7 (Sinterklaas, in stickervellen.js).
export const STUDIO_VELLEN = []
