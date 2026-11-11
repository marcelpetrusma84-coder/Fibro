// One source for compact game labels and the browsable history on Home.
// Versions are semantic strings: a minor update such as 6.10 is never 6.1.
import { SPEL_VERSIES, spelHistorie, versieLabel } from './spelversie-data.js?v=8'
import { mountSpelVersie } from './spelversie-ui.js?v=8'
export { SPEL_VERSIES, SPEL_HISTORIE, spelHistorie, versieLabel, vergelijkVersies } from './spelversie-data.js?v=8'
export { mountSpelVersie }

const histories = new WeakMap()

export function spelVersie(naam) {
  return Object.hasOwn(SPEL_VERSIES, naam) ? SPEL_VERSIES[naam] : null
}

export function vulSpelVersies(wortel = globalThis.document) {
  const language = typeof T === 'function' && T.taal === 'en' ? 'en' : 'nl'
  for (const element of wortel.querySelectorAll('[data-spelversie]')) {
    const game = element.getAttribute('data-spelversie'), version = spelVersie(game)
    const controller = histories.get(element)
    if (version && element.getAttribute('data-spelversie-history') != null) {
      const options = { game, currentVersion:version, history:spelHistorie(game), language }
      if (controller) controller.update(options)
      else histories.set(element, mountSpelVersie(element, options))
      continue
    }
    if (controller) { controller.destroy(); histories.delete(element) }
    element.textContent = version ? versieLabel(version) : ''
    if (version) element.setAttribute('aria-label', `${language === 'en' ? 'version' : 'versie'} ${versieLabel(version).slice(1)}`)
    else element.removeAttribute?.('aria-label')
  }
}
