// studio-pakketten.js (23 nov 2026) - stickervellen die met Stekky Studio (studio.html) zijn gemaakt.
// Elk vel: { id: 'f8', store: 'stickers-<naam>', titel, uitleg: [nl, en], stickers: [ { nr, naam: [nl, en], b, g } x 12 ] }
// De plaatjes staan in stickers/<id>/<nr>.webp. Een sticker met een eigen geluid heeft dat in geluiden/<id>-<nr>.mp3: dan is
// g die naam (bijv. 'f8-03'), terug het bibliotheekgeluid dat klinkt als de mp3 niet laadt, bron waar het geluid vandaan komt en
// licentie ('zelf', 'cc0', 'cc-by' of 'betaald', zie studio-pakket.js). De Store toont de bron bij cc0 en cc-by.
// stickerfx.js maakt van zulke stickers een geluid. Niet met de hand bewerken: tests/tools/studio-installeer.mjs voegt een vel
// toe (en zet de plaatjes en geluiden op hun plek). Id's gaan door na f7 (Sinterklaas, in stickervellen.js).
export const STUDIO_VELLEN = [
  { id: "f8", store: "stickers-santa", titel: "Santa",
    uitleg: ["Twaalf stickers die bewegen en geluid maken.","Twelve stickers that move and make sounds."],
    stickers: [
      { nr: '01', naam: ["Kerstman","Santa"], b: "schud", g: "dankbaar" },
      { nr: '02', naam: ["Open haard","Fireplace"], b: "hup", g: "haardvuur" },
      { nr: '03', naam: ["Cadeautjes","Presents"], b: "hup", g: "pakpapier" },
      { nr: '04', naam: ["Sneeuwbol","Snow globe"], b: "groei", g: "vrede" },
      { nr: '05', naam: ["Kerstboom","Christmas tree"], b: "oplichten", g: "engel" },
      { nr: '06', naam: ["Peperkoekmannetje","Gingerbread man"], b: "knik", g: "tadaa" },
      { nr: '07', naam: ["Kerstkrans","Wreath"], b: "schud", g: "mijterglans" },
      { nr: '08', naam: ["Arrenslee","Sleigh"], b: "hup", g: "hoefslag" },
      { nr: '09', naam: ["Zuurstok","Candy cane"], b: "oplichten", g: "chocokrak" },
      { nr: '10', naam: ["Kerstklokken","Bells"], b: "hartslag", g: "pietsprong" },
      { nr: '11', naam: ["Kerstsok","Stocking"], b: "duw", g: "tadaa" },
      { nr: '12', naam: ["Roodborstje","Robin"], b: "wiebel", g: "piep" },
    ] },
  { id: "f9", store: "stickers-winter", titel: "Winter",
    uitleg: ["Twaalf stickers die bewegen en geluid maken.","Twelve stickers that move and make sounds."],
    stickers: [
      { nr: '01', naam: ["Sneeuwpop","Snowman"], b: "stuiter", g: "slurp" },
      { nr: '02', naam: ["Schaatsen","Ice skates"], b: "hup", g: "ting" },
      { nr: '03', naam: ["Sneeuwvlok","Snowflake"], b: "draai", g: "boing" },
      { nr: '04', naam: ["Warme chocolademelk","Hot chocolate"], b: "wiebel", g: "klets" },
      { nr: '05', naam: ["Wanten","Mittens"], b: "schud", g: "woesj" },
      { nr: '06', naam: ["Besneeuwde boom","Snowy tree"], b: "zweef", g: "dankbaar" },
      { nr: '07', naam: ["Rendier","Reindeer"], b: "hup", g: "hoefslag" },
      { nr: '08', naam: ["Ski's","Skis"], b: "zweef", g: "dakwind" },
      { nr: '09', naam: ["Blokhut","Log cabin"], b: "flakker", g: "engel" },
      { nr: '10', naam: ["Oorwarmers","Earmuffs"], b: "hup", g: "geluk" },
      { nr: '11', naam: ["Pinguïn op slee","Penguin on a sled"], b: "knik", g: "glijfluit" },
      { nr: '12', naam: ["Muts","Beanie"], b: "kantel", g: "zoefweg" },
    ] },
]
