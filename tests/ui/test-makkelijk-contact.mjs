// v258 (3 nov 2026): makkelijker contact. Vaste afspraken in de code; het echte gedrag staat in tests/tools/proef236.py
// (pagina's in Chrome) en tests/tools/proef235.mjs (de pushfunctie).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const vrienden = lees('vrienden.html'), invite = lees('invite.html'), login = lees('login.html'), index = lees('index.html')
const chat = lees('chat.html'), push = lees('supabase/functions/stuur-push/index.ts'), sql = lees('sql/contact-push.sql')

// 1. Delen: altijd zichtbaar en bovenaan (voor de QR-code); de link in de tekst zelf; weggetikt = niets;
//    zonder deelmenu de hele uitnodiging kopieren. Het venster kan scrollen (niets valt weg op een kleine telefoon).
assert.match(vrienden, /<div id="qr-sectie" style="display:none;">\n(\s*<!--[\s\S]*?-->\n)?\s*<button type="button" id="deel-link-btn"[^>]*data-t>📤 Delen</)
assert.ok(!/id="deel-link-btn"[^>]*hidden/.test(vrienden), 'nooit verborgen')
assert.match(vrienden, /const volledig = deelTekst \+ '\\n' \+ url/)
assert.match(vrienden, /try \{ await navigator\.share\(\{ text: volledig \}\); return \}\n\s+catch \(e\) \{ if \(e && e\.name === 'AbortError'\) return \}/)
assert.match(vrienden, /await navigator\.clipboard\.writeText\(volledig\)/)
assert.match(vrienden, /\.modal-overlay \{[^}]*overflow-y:auto/)
assert.match(vrienden, /\.modal \{[^}]*margin:auto/)

// 2. Na het vriend worden naar de chat; het beginscherm stuurt hoogstens een keer door, alleen naar een echt id
assert.match(invite, /const verder = vrienden \? 'chat\.html\?vriend=' \+ encodeURIComponent\(ander\) : 'vrienden\.html'/)
assert.match(invite, /if \(gelukt === true\) onthoudNieuweVriend\(data\.user\.id, uitnodigerData\.created_by\)/)
assert.match(index, /localStorage\.removeItem\(sleutel\)\n\s+var vers = /, 'eerst weghalen, dan pas doorsturen')
assert.match(index, /\/\^\[0-9a-f\]\{8\}-/, 'alleen een uuid')
assert.ok(index.indexOf("fibro_nieuwe_vriend_") < index.indexOf('<div id="sleutel-balk"'), 'meteen bovenaan, voor de rest van de pagina')

// 3. Inloggen vanaf een uitnodiging: alleen terug naar de uitnodigingspagina zelf
assert.match(invite, /sessionStorage\.setItem\('fibro_invite_terug', 'invite\.html' \+ location\.search \+ location\.hash\)/)
const EIND = "    return 'index.html'\n  }"
const naInloggenAdres = new Function('sessionStorage', login.slice(login.indexOf('function naInloggenAdres() {'), login.indexOf(EIND) + EIND.length) + '; return naInloggenAdres')
const opslag = w => { let v = w; return { getItem: () => v, removeItem: () => { v = null } } }
assert.equal(naInloggenAdres(opslag('invite.html?token=fibro-abc&spel=dammen#s=' + 'a'.repeat(32)))(), 'invite.html?token=fibro-abc&spel=dammen#s=' + 'a'.repeat(32))
for (const raar of ['https://example.com/invite.html?token=x', '//example.com', 'invite.html?token=x&next=//e.com', 'javascript:alert(1)', null])
  assert.equal(naInloggenAdres(opslag(raar))(), 'index.html', String(raar))
assert.equal((login.match(/location\.href = naInloggenAdres\(\)/g) || []).length, 4, 'alle vier de wegen na het inloggen')

// 4. Zeg hoi: alleen in een lege chat (niet als de berichten uit het geheugen komen), weg zodra er een bericht is
assert.match(chat, /if \(!error && data\) toonZegHoi\(vriendId\) \/\/ v258/)
assert.match(chat, /if \(leeg && !uitGeheugen\) toonZegHoi\(vriendId\) \/\/ v258/)
assert.match(chat, /async function voegBerichtToe\(bericht, metGeluid = false\) \{\n\s+document\.getElementById\('zegHoi'\)\?\.remove\(\)/)
assert.match(chat, /if \(!\(await verstuur\(vriendId, tekst, null, true\)\)\) nietVerstuurd\(vriendId, tekst, null, true\)\n\s+\}\n\s+container\.appendChild\(knop\)/, 'versleuteld, met melding')

// 5. Meldingen alleen vanaf de server, met de triggers
assert.match(push, /const ALLEEN_SERVER = new Set\(\["spel", "vriend-nieuw", "gastenboek"(, "like")?(, "online")?\]\)/)
assert.match(sql, /after update of used_by on public\.invite_tokens\n\s+for each row\n\s+when \(old\.used_by is null and new\.used_by is not null/)
assert.match(sql, /after insert on public\.guestbook_entries\n\s+for each row\n\s+when \(new\.author_id is not null and new\.author_id <> new\.profile_id\)/)
assert.equal((sql.match(/exception when others then\n\s+null;/g) || []).length, 2, 'een melding houdt nooit het opslaan tegen')
assert.ok(!/content/.test(sql.replace(/^--.*$/gm, '')), 'de inhoud van het gastenboek gaat niet mee')

// 6. Engels
globalThis.window = {}
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const k of ['📤 Delen', '{naam} nodigt je uit voor Stekky!', '{naam} nodigt je uit voor Stekky en daagt je uit voor een potje {spel}!',
  'Je bent uitgenodigd voor Stekky!', 'Je bent uitgenodigd voor Stekky en voor een potje {spel}!', 'Tik binnen {duur} op de link om vrienden te worden:',
  '👋 Zeg hoi', 'Hoi! 👋', '✅ Gekopieerd! Plak het in WhatsApp of een bericht.', 'Kopieer deze tekst:', '1 uur', '1 dag', '3 dagen', '7 dagen'])
  assert.ok(Object.hasOwn(EN, k), 'Engels voor ' + k)
delete globalThis.window
console.log('makkelijker contact: alles goed')
