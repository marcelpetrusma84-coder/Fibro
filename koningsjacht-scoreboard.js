import { maakNeonScorebord } from './neon-raiders-scoreboard.js?v=6'

const NIVEAUS = ['', 'Schildknaap', 'Ridder', 'Koning']
const MODI = { solo: 'Alleen', samen: 'Samen', wedstrijd: 'Wedstrijd', duel: 'Duel', beleg: 'Belegering' }

export function koningsjachtScoreDetail(run, T = s => s) {
  return [T(NIVEAUS[run.level] || 'Niveau onbekend'), T(MODI[run.mode] || 'Alleen'),
    run.score === 12 ? T('Kasteel veroverd') : ''].filter(Boolean).join(' · ')
}

export function maakKoningsjachtScorebord(options) {
  return maakNeonScorebord({ ...options, title: 'Koningsjacht scores', brand: 'KONINGSJACHT',
    formatScore: n => `${n}/12`, formatDetail: koningsjachtScoreDetail })
}
