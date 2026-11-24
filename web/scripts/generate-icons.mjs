import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const INK = '#101215'
const GOLD = '#C9A35B'

const quote = `
  <circle cx="6" cy="13" r="5"/>
  <path d="M1.4 13.4C1.2 7.6 3.6 3.2 8.6 1.2" fill="none" stroke="${GOLD}" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="19" cy="13" r="5"/>
  <path d="M14.4 13.4C14.2 7.6 16.6 3.2 21.6 1.2" fill="none" stroke="${GOLD}" stroke-width="3.2" stroke-linecap="round"/>`

function mark({ radius, inset }) {
  const s = 64 - inset * 2
  const k = s / 64
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${INK}"/>
  <g fill="${GOLD}" transform="translate(${inset} ${inset}) scale(${k})">
    <g transform="translate(10 9)">${quote}</g>
    <g transform="translate(54 55) rotate(180)">${quote}</g>
  </g>
</svg>
`
}

await writeFile(join(root, 'favicon.svg'), mark({ radius: 14, inset: 0 }))

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 512 }).resize(size, size).png().toFile(join(root, file))
}

await png(mark({ radius: 0, inset: 4 }), 192, 'pwa-192.png')
await png(mark({ radius: 0, inset: 4 }), 512, 'pwa-512.png')
await png(mark({ radius: 0, inset: 12 }), 512, 'pwa-maskable-512.png')
await png(mark({ radius: 0, inset: 6 }), 180, 'apple-touch-icon.png')
