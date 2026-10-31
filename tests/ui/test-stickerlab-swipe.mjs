// v242 (31 okt 2026): in het Stickerlab (Profiel > Stickers) ga je met vegen niet naar een andere pagina.
// swipe.js slaat elke veeg over die begint in een element met data-geen-swipe; het Stickerlab-scherm heeft dat.
// In een echte browser nagekeken: een veeg in het Stickerlab blijft op Profiel, een veeg op Profiel zelf gaat nog
// naar Chat.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const swipe = lees('swipe.js'), maker = lees('stickermaker.js'), profiel = lees('profiel.html')

assert.match(swipe, /const NIET_SWIPEN = '[^']*\[data-geen-swipe\]/, 'swipe.js slaat [data-geen-swipe] over')
assert.match(swipe, /negeer = !!\(e\.target\.closest && e\.target\.closest\(NIET_SWIPEN\)\)/)
assert.match(maker, /el\('div', \{ class: 'sm-scherm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'smTitel', 'data-geen-swipe': '', hidden: '' \}/,
  'het Stickerlab-scherm (het hele scherm, ook de donkere rand) heeft data-geen-swipe')
// het scherm bedekt alles: dan begint elke veeg erin
assert.match(maker, /\.sm-scherm \{ position:fixed; inset:0;/)
const v = [...profiel.matchAll(/stickermaker\.js\?v=(\d+)/g)].map(m => Number(m[1]))
assert.ok(v.length === 1 && v[0] >= 242, 'profiel.html laadt de nieuwe stickermaker.js')

console.log('ok: in het Stickerlab veeg je niet naar een andere pagina')
