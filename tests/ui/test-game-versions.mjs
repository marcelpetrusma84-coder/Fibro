import assert from 'node:assert/strict'
import { SPEL_VERSIES, spelVersie, versieLabel, vergelijkVersies, vulSpelVersies } from '../../spelversies.js'

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
  assert.equal(labels[0].textContent, versieLabel(first), 'a whole game version includes its minor number')
  for (const label of labels) {
    const game = label.getAttribute('data-spelversie')
    assert.match(SPEL_VERSIES[game], /^\d+\.\d+\.\d+$/u, 'canonical game versions are full semantic version strings')
    assert.equal(label.textContent, versieLabel(SPEL_VERSIES[game]))
    assert.match(label.textContent, /^v\d+\.\d+(?:\.\d+)?$/u, 'a nonzero patch remains visible in the display label')
    assert.equal(label.attributes.get('aria-label'), `${language === 'en' ? 'version' : 'versie'} ${label.textContent.slice(1)}`)
  }
  assert.equal(unknown.textContent, '', 'unregistered games are not assigned an invented version')
}
assert.equal(spelVersie('not-a-game'), null)
assert.equal(versieLabel('6.1.0'), 'v6.1')
assert.equal(versieLabel('6.1.1'), 'v6.1.1')
assert.equal(versieLabel('6.10.0'), 'v6.10')
assert.equal(vergelijkVersies('6.10.0', '6.9.0'), 1, 'version comparison uses integer segments')
delete globalThis.T
console.log('PASS: semantic game versions, current labels, translated accessible labels, minor/patch helpers and unknown games.')
