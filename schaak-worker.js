// Keep the search off the UI thread so gestures and animations stay responsive.
import * as Schaak from './schaak.js?v=95'
import { schaakKies } from './solo-bord.js?v=2'

self.onmessage = ({ data: { staat, niveau } }) => {
  self.postMessage(schaakKies(Schaak, staat, niveau))
}
