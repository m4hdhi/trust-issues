import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const mark = await readFile(join(root, 'favicon.svg'))
const INK = { r: 11, g: 18, b: 32, alpha: 1 }

async function icon(size, markRatio, file) {
  const markSize = Math.round(size * markRatio)
  const png = await sharp(mark, { density: 512 }).resize(markSize, markSize).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: png, gravity: 'center' }])
    .png()
    .toFile(join(root, file))
}

await icon(192, 0.78, 'pwa-192.png')
await icon(512, 0.78, 'pwa-512.png')
await icon(512, 0.6, 'pwa-maskable-512.png')
await icon(180, 0.74, 'apple-touch-icon.png')
