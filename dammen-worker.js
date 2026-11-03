// dammen-worker.js - de damcomputer rekent hier, los van het scherm (v1, 3 nov 2026)
// Zo blijft het bord soepel reageren, ook als de computer op Expert drie seconden nadenkt.
import * as Dammen from './dammen.js?v=95'
import { damKies } from './dammen-computer.js?v=1'

self.onmessage = ({ data }) => {
    const { id, staat, niveau } = data || {}
    let keten = null
    try { keten = damKies(Dammen, staat, niveau) } catch (e) { keten = null }
    self.postMessage({ id, keten })
}
