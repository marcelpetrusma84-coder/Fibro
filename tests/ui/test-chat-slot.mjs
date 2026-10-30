// Chat (v233): in de vriendenlijst staat het open slotje links van de belknop (Marcel, 30 oktober 2026).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const chat = readFileSync(new URL('../../chat.html', import.meta.url), 'utf8')
const rij = chat.slice(chat.indexOf('function tekenVriendenLijst'), chat.indexOf("container.querySelectorAll('.vriend-item')"))
const slot = rij.indexOf('slotKnopHtml('), bel = rij.indexOf('class="bel-knop"')
assert.ok(slot > 0 && bel > 0, 'slotje en belknop gevonden')
assert.ok(slot < bel, 'het slotje staat voor (links van) de belknop')
console.log('test-chat-slot: alles goed')
