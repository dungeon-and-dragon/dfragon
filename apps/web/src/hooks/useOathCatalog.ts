import type { OathCatalog } from '#core/catalog'
import { useClientHost } from '#host/client-host'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'

export function useOathCatalog(): LoadedResult<OathCatalog | null> {
  const { getOathCatalog } = useClientHost()

  return useLoadedResult(['oath-catalog'], getOathCatalog)
}
