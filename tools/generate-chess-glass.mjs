// Derive glass materials from the credited source SVGs without changing paths.
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sourceRoot = new URL('../assets/chess-three/', import.meta.url)
const outputRoot = new URL('glass/', sourceRoot)
const materials = {
  w: {
    body:[['#ffffff',.92], ['#eefaff',.68], ['#bed3dd',.38], ['#f5ffff',.78], ['#ffffff',.9]],
    rim:['#ffffff', '#91edf2', '#f8ffff'], glow:'#b8ffff', detail:'#45606c', reflection:'#ffffff'
  },
  b: {
    body:[['#c8d3db',.76], ['#4c535a',.7], ['#0a0e13',.82], ['#69747e',.46], ['#dce7ed',.8]],
    rim:['#edfcff', '#71818e', '#caefff'], glow:'#a3dfff', detail:'#d3eaf3', reflection:'#e9faff'
  },
  r: {
    body:[['#ffcfda',.92], ['#f7194c',.72], ['#930825',.4], ['#ff103e',.78], ['#ffb0c5',.9]],
    rim:['#fff0f4', '#ff0643', '#ff7c9b'], glow:'#ff1652', detail:'#79152d', reflection:'#ffe5ee'
  }
}

await mkdir(outputRoot, { recursive:true })
for (const kind of ['pawn','knight','bishop','rook','queen','king']) {
  for (const [colour, material] of Object.entries(materials)) {
    const source = await readFile(new URL(`${kind}-${colour}.svg`, sourceRoot), 'utf8')
    const [, header, original] = source.match(/^([\s\S]*?<svg\b[^>]*>)([\s\S]*?)<\/svg>\s*$/)
    const base = original.match(/<g fill="#[A-F0-9]+" stroke="#000"[\s\S]*?<\/g>/)[0]
    const outline = attributes => base.replace(/^<g\b[^>]*>/, `<g fill="none" stroke-linecap="round" stroke-linejoin="round" ${attributes}>`)
    const stops = material.body.map(([color, opacity], index) =>
      `<stop offset="${[0,.23,.5,.76,1][index]}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')
    const defs = `<defs>
  <linearGradient id="glass-body" gradientUnits="userSpaceOnUse" x1="7" y1="8" x2="36" y2="37">${stops}</linearGradient>
  <linearGradient id="glass-rim" gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="36" y2="40"><stop stop-color="${material.rim[0]}"/><stop offset=".5" stop-color="${material.rim[1]}"/><stop offset="1" stop-color="${material.rim[2]}"/></linearGradient>
  <filter id="neon-halo" filterUnits="userSpaceOnUse" x="0" y="0" width="45" height="45"><feGaussianBlur stdDeviation=".7"/></filter>
</defs>`
    const glass = original.replace(base, base.replace(/^<g\b[^>]*>/,
      '<g fill="url(#glass-body)" stroke="url(#glass-rim)" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" paint-order="stroke fill">'))
      .replaceAll('stroke="#000"', `stroke="${material.detail}"`)
      .replaceAll('stroke="#FFF"', `stroke="${material.detail}"`)
      .replaceAll('fill="#000"', `fill="${material.detail}"`)
      .replaceAll('fill="#FFF"', `fill="${material.reflection}" fill-opacity=".8"`)
    const markup = `${header}
<!-- Glass/neon material adaptation. Original paths and attribution retained. CC BY-SA 3.0. -->
${defs}
<ellipse cx="22.5" cy="40" rx="11" ry="1.1" fill="${material.glow}" opacity=".32" filter="url(#neon-halo)"/>
${outline(`stroke="${material.glow}" stroke-width="2.3" opacity=".68" filter="url(#neon-halo)"`)}
${outline('stroke="#111b26" stroke-width="2.4" opacity=".86"')}
${glass}
</svg>
`
    await writeFile(new URL(`${kind}-${colour}.svg`, outputRoot), markup, 'utf8')
  }
}
console.log('Generated 18 glass/neon chess SVGs from the original contours.')
