// Derive glass materials from the credited source SVGs without changing paths.
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sourceRoot = new URL('../assets/chess-three/', import.meta.url)
const outputRoot = new URL('glass/', sourceRoot)
const materials = {
  w: {
    body:[['#ffffff',.98], ['#eefaff',.92], ['#bed3dd',.82], ['#f5ffff',.94], ['#ffffff',.98]],
    rim:['#ffffff', '#91edf2', '#f8ffff'], glow:'#b8ffff', detail:'#45606c', reflection:'#ffffff'
  },
  b: {
    body:[['#c8d3db',.93], ['#4c535a',.91], ['#0a0e13',.96], ['#69747e',.84], ['#dce7ed',.94]],
    rim:['#edfcff', '#71818e', '#caefff'], glow:'#a3dfff', detail:'#d3eaf3', reflection:'#e9faff'
  },
  r: {
    body:[['#ffcfda',.97], ['#f7194c',.91], ['#930825',.83], ['#ff103e',.93], ['#ffb0c5',.97]],
    rim:['#fff0f4', '#ff0643', '#ff7c9b'], glow:'#ff1652', detail:'#5a0b22', reflection:'#ffe5ee'
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
  <filter id="neon-halo" filterUnits="userSpaceOnUse" x="0" y="0" width="45" height="45"><feGaussianBlur stdDeviation=".45"/></filter>
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
<ellipse cx="22.5" cy="40" rx="11" ry="1.1" fill="${material.glow}" opacity=".18" filter="url(#neon-halo)"/>
${outline(`stroke="${material.glow}" stroke-width="2.3" opacity=".45" filter="url(#neon-halo)"`)}
${outline('stroke="#111b26" stroke-width="2.4" opacity=".96"')}
${glass}
</svg>
`
    await writeFile(new URL(`${kind}-${colour}.svg`, outputRoot), markup, 'utf8')
  }
}
console.log('Generated 18 glass/neon chess SVGs from the original contours.')
