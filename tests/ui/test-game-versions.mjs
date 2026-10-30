import assert from 'node:assert/strict'
import { SPEL_VERSIES, vulSpelVersies } from '../../spelversies.js'

function element(game) {
  return {
    textContent: 'old label',
    attributes: new Map([['data-spelversie', game]]),
    getAttribute(name) { return this.attributes.get(name) },
    setAttribute(name, value) { this.attributes.set(name, value) }
  }
}

for (const language of ['nl', 'en']) {
  globalThis.T = Object.assign(key => key, { taal: language })
  const labels = Object.keys(SPEL_VERSIES).map(element)
  const unknown = element('not-a-game')
  vulSpelVersies({ querySelectorAll: () => [...labels, unknown] })
  const first = SPEL_VERSIES[Object.keys(SPEL_VERSIES)[0]]
  assert.equal(labels[0].textContent, 'v' + first.toFixed(1), 'a whole game version includes its minor number')
  for (const label of labels) {
    assert.match(label.textContent, /^v\d+\.\d+$/u, 'every game has a major.minor display label')
    assert.equal(label.attributes.get('aria-label'), `${language === 'en' ? 'version' : 'versie'} ${label.textContent.slice(1)}`)
  }
  assert.equal(unknown.textContent, '', 'unregistered games are not assigned an invented version')
}
delete globalThis.T
console.log('PASS: major.minor game labels, all registered games, translated accessible labels and unknown games.')
