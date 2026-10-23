import { versleutel, ontsleutelBericht, sleutelVingerafdruk, isZelfdeSleutel } from './crypto.js?v=182'

const TYPES = new Set(['spelchat', 'spelsticker'])
const MAX_CIPHERTEXT = 18000

// Reuse the established chat cryptography, binding game content to this session
// and event. Never downgrade to a readable Supabase broadcast when keys fail.
export function maakSpelChatCrypto({ mijnId, vriendId, mijnPrivateKey, vriendPublicKey, sessie, vingerafdruk }) {
  const gezien = new Set()
  let sleutelControle

  async function controleerSleutel() {
    if (!mijnId || !vriendId || !mijnPrivateKey || !vriendPublicKey || !sessie) throw new Error('missing-key')
    sleutelControle ??= (async () => {
      if (vingerafdruk && !isZelfdeSleutel(vingerafdruk, await sleutelVingerafdruk(vriendPublicKey))) {
        throw new Error('changed-key')
      }
    })()
    await sleutelControle
  }

  function geldig(type, data) {
    if (!TYPES.has(type) || typeof data !== 'string') return false
    return type === 'spelchat'
      ? data.trim().length > 0 && data.length <= 2000
      : /^(f[1-6]|e[12])-\d{2}$/.test(data)
  }

  return {
    async verpak(type, data) {
      if (!geldig(type, data)) throw new Error('invalid-game-message')
      await controleerSleutel()
      const bericht = { v:1, sessie, type, id:crypto.randomUUID(), data }
      const ciphertext = await versleutel(JSON.stringify(bericht), mijnPrivateKey, vriendPublicKey,
        { soort:'bericht', van:mijnId, naar:vriendId })
      return { ciphertext }
    },
    async open(type, payload) {
      if (!TYPES.has(type) || typeof payload?.ciphertext !== 'string' ||
          !payload.ciphertext.startsWith('e2e:2:') || payload.ciphertext.length > MAX_CIPHERTEXT) return null
      try {
        await controleerSleutel()
        const resultaat = await ontsleutelBericht(payload.ciphertext, mijnPrivateKey, vriendPublicKey,
          { soort:'bericht', van:vriendId, naar:mijnId, serverTijd:Date.now() })
        if (resultaat.status !== 'v2') return null
        const bericht = JSON.parse(resultaat.tekst)
        if (bericht?.v !== 1 || bericht.sessie !== sessie || bericht.type !== type ||
            typeof bericht.id !== 'string' || !/^[0-9a-f-]{36}$/.test(bericht.id) ||
            !geldig(type, bericht.data) || gezien.has(bericht.id)) return null
        gezien.add(bericht.id)
        return bericht.data
      } catch { return null }
    }
  }
}
