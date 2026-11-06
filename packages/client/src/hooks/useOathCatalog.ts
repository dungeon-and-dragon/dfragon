import type { OathCatalog } from '@dfragon/client-core/shared/search/oath-catalog'
import { useClientHost } from './useClientHost'
import { type LoadedResult, useLoadedResult } from './useLoadedResult'

export function useOathCatalog(): LoadedResult<OathCatalog | null> {
  const { getOathCatalog } = useClientHost()

  return useLoadedResult(['oath-catalog'], getOathCatalog)
}
