// v258 (4 nov 2026): likes en reacties onder foto's, muziek en video's (profielreacties.js). Vaste afspraken; het echte
// gedrag staat in tests/tools/proef238.py (Chrome) en tests/tools/proef235.mjs (de pushmelding).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lees = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
globalThis.window = {}
const m = await import('../../profielreacties.js')
const mod = lees('profielreacties.js'), sync = lees('sync.js'), sql = lees('sql/profiel-likes.sql'), push = lees('supabase/functions/stuur-push/index.ts')
const vp = lees('vriend-profiel.html'), index = lees('index.html'), chat = lees('chat.html'), viewer = lees('fotoviewer.js')

// 1. De vingerafdruk is precies die van sync.js (anders komen eigenaar en vriend niet op hetzelfde uit)
const hashString = new Function(sync.slice(sync.indexOf('function hashString(s) {'), sync.indexOf('\n}\n', sync.indexOf('function hashString(s) {')) + 3) + '; return hashString')()
for (const s of ['', 'data:image/png;base64,AAAA', 'data:audio/wav;base64,' + 'Zm9v'.repeat(5000), '{"thumb":"x"}'])
  assert.equal(m.itemVan(s), hashString(s), 'zelfde vingerafdruk')
assert.match(m.itemVan('x'), /^[0-9a-f]{1,16}$/, 'past in de controle van de tabel')

// 2. Dezelfde emoji en soorten in de app, de tabel en de pushfunctie
assert.deepEqual(m.EMOJI, ['❤️', '😂', '🔥', '😍', '😮', '👏'])
assert.ok(sql.includes("emoji in ('❤️', '😂', '🔥', '😍', '😮', '👏')") && sql.includes("soort in ('foto', 'muziek', 'video')"))
assert.ok(push.includes('const LIKE_EMOJI = new Set(["❤️", "😂", "🔥", "😍", "😮", "👏"]);'))
assert.ok(push.includes('const ALLEEN_SERVER = new Set(["spel", "vriend-nieuw", "gastenboek", "like"]);'), 'een app kan geen likemelding sturen')

// 3. De tabel: lezen alleen eigen likes of als eigenaar; liken alleen bij een vriend; tellers zonder namen voor vrienden
assert.match(sql, /for select to authenticated\n\s+using \(\(select auth\.uid\(\)\) = liker or \(select auth\.uid\(\)\) = eigenaar\)/)
assert.match(sql, /\(select auth\.uid\(\)\) = liker\n\s+and not \(select public\.ben_ik_geblokkeerd\(\)\).*\n\s+and exists \(select 1 from public\.friendships f\n\s+where f\.user_id = liker and f\.friend_id = eigenaar and f\.status = 'accepted'\)/)
assert.match(sql, /returns table \(soort text, item text, emoji text, aantal integer\)/, 'tellers: geen kolom met wie')
assert.match(sql, /revoke execute on function public\.profiel_like_tellers\(uuid\) from public, anon;/)
assert.match(sql, /new\.eigenaar := old\.eigenaar; new\.liker := old\.liker;/, 'bij wijzigen alleen de emoji')
assert.ok(lees('sql/mijn-gegevens-likes.sql').includes("'profiel_likes', coalesce((select jsonb_agg(to_jsonb(pl) order by pl.created_at) from public.profiel_likes pl where pl.liker = mij or pl.eigenaar = mij)"), 'mijn gegevens')

// 4. Het chatbericht: heen en terug, en rommel wordt geweigerd
const plaatje = 'data:image/jpeg;base64,' + 'A'.repeat(100)
const tekst = m.maakReactieBericht({ soort: 'foto', tekst: 'Mooi!', plaatje, titel: '' })
assert.ok(tekst.startsWith('profielreactie:{'))
assert.deepEqual(m.leesReactieBericht(tekst), { soort: 'foto', tekst: 'Mooi!', titel: '', plaatje })
for (const fout of ['profielreactie:{"s":"foto","t":""}', 'profielreactie:{"s":"sticker","t":"x"}', 'profielreactie:kapot', 'hallo', null])
  assert.equal(m.leesReactieBericht(fout), null, String(fout))
for (const raar of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', 'data:image/jpeg;base64,"><script>'])
  assert.equal(m.leesReactieBericht('profielreactie:' + JSON.stringify({ s: 'foto', t: 'x', p: raar })).plaatje, null, 'geen raar plaatje: ' + raar)
assert.equal(m.leesReactieBericht(m.maakReactieBericht({ soort: 'muziek', tekst: 'x'.repeat(900), titel: 'y'.repeat(200) })).tekst.length, 500)
const kaart = mod.slice(mod.indexOf('export function tekenReactieKaart'))
assert.ok(!/innerHTML/.test(kaart), 'het kaartje in de chat zonder innerHTML (niets uit het bericht als html)')

// 5. De pagina's
assert.match(vp, /const content = await versleutel\(tekst, priv, pub, \{ soort: 'bericht', van: huidigeUser\.id, naar: vriendId \}\)/, 'een reactie is een gewoon versleuteld bericht')
assert.match(vp, /if \(!src \|\| !src\.startsWith\('data:image'\) \|\| !img\.closest\('#vriendWidgetGrid'\)/, 'alleen foto\'s uit de widgets van de vriend')
assert.match(index, /isEigen: true/)
assert.match(index, /!img\.closest\('#profiel-sectie'\)/)
assert.match(chat, /const profielReactie = !onversleuteld \? leesReactieBericht\(content\) : null/, 'een onversleuteld bericht wordt nooit een kaartje')
assert.match(viewer, /if \(typeof window\.FibroFotoBalk === 'function'\) window\.FibroFotoBalk\(fotos\[huidig\], balk\)/)
for (const [bestand, v] of [['vriend-profiel.html', 'fotoviewer.js?v=8'], ['index.html', 'fotoviewer.js?v=8'], ['chat.html', 'profielreacties.js?v=2']])
  assert.ok(lees(bestand).includes(v), bestand + ' ' + v)

// 6. Engels
new Function('window', lees('taal-en.js'))(globalThis.window)
const EN = globalThis.window.FIBRO_EN
for (const k of ['💬 Reageer', 'Reageer op de {wat} van {naam}', 'Schrijf iets…', 'Verstuur', '✅ Verstuurd naar je chat met {naam}', 'Open de chat',
  'Wie vond je {wat} leuk', 'Nog niemand.', 'Je reageerde op een {wat}', 'Reageerde op je {wat}', 'foto', 'nummer', 'video',
  '🔒 Komt in jullie chat. Alleen jullie twee kunnen het lezen.', 'Leuk vinden. Houd vast voor een andere emoji.'])
  assert.ok(Object.hasOwn(EN, k), 'Engels voor ' + k)
delete globalThis.window
console.log('likes en reacties: alles goed')
