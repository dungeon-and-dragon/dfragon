import type { OathCatalog } from '#core/catalog/oath-catalog'
import { useClientHost } from '../../../host/client-host'
import { type LoadedResult, useLoadedResult } from '../../../hooks/useLoadedResult'

export function useOathCatalog(): LoadedResult<OathCatalog | null> {
  const { getOathCatalog } = useClientHost()

  return useLoadedResult(['oath-catalog'], getOathCatalog)
}
