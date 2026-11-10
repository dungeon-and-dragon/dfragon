import { readFile } from 'node:fs/promises'
import { parseServerBuildInfo } from '@dfragon/lib'
import type { ServerBuildInfo } from '@dfragon/lib'

export async function readApiBuildInfo(path = '/app/build-info.json'): Promise<ServerBuildInfo> {
  const value: unknown = await readFile(path, 'utf8')
    .then(JSON.parse)
    .catch(() => null)
  const info = parseServerBuildInfo(value, 'api') ?? { service: 'api', commit: null }

  return info
}
