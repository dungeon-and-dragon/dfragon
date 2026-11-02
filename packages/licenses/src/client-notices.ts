import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

type AssetContext = {
  emitFile(asset: { type: 'asset'; fileName: string; source: string }): unknown
}

const clientNoticesRoot = fileURLToPath(new URL('../notices/client/', import.meta.url))

export function clientNotices() {
  return {
    name: 'dfragon-client-notices',
    generateBundle(this: AssetContext) {
      for (const name of readdirSync(clientNoticesRoot).sort()) {
        this.emitFile({
          type: 'asset',
          fileName: `notices/client/${name}`,
          source: readFileSync(join(clientNoticesRoot, name), 'utf8')
        })
      }
    }
  }
}
