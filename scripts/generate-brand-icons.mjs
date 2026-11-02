import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const FAVICON_SIZE = 64
const CHANNELS = 4

function downscale(source, size) {
  const factor = source.width / size
  if (source.width !== source.height || !Number.isInteger(factor) || factor < 1) {
    throw new Error(
      `원본은 ${size}px의 정수배인 정사각형이어야 합니다: ${source.width}×${source.height}`
    )
  }

  const output = new PNG({ width: size, height: size })
  const area = factor * factor
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0]
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const offset = ((y * factor + dy) * source.width + x * factor + dx) * CHANNELS
          for (let channel = 0; channel < CHANNELS; channel += 1) {
            sums[channel] += source.data[offset + channel]
          }
        }
      }
      const target = (y * size + x) * CHANNELS
      for (let channel = 0; channel < CHANNELS; channel += 1) {
        output.data[target + channel] = Math.round(sums[channel] / area)
      }
    }
  }

  return output
}

const source = PNG.sync.read(await readFile(join(root, 'assets/brand/dfragon.png')))
const favicon = downscale(source, FAVICON_SIZE)
await writeFile(join(root, 'apps/web/public/favicon.png'), PNG.sync.write(favicon))
