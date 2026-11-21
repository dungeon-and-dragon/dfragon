import { useQueryClient } from '@tanstack/react-query'
import { type OathCatalog, oathCatalogSchema } from '#entities/catalog/model/oath-catalog'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { absoluteUrl, fetchUploadedStaticJson } from '#shared/lib/static-json'

// 서약 데이터는 사이트 빌드에 넣지 않고 따로 올리며, host Caddy와 개발 서버가 같은 origin의 /skilltab/ 아래에 내준다.
export function oathCatalogUrl(): string {
  return `${window.location.origin}/skilltab/oath.v2.json`
}

function readOathCatalog(json: unknown, catalogUrl: string): OathCatalog {
  const catalog = oathCatalogSchema.parse(json)
  const sets = catalog.sets.map((set) => {
    const icon = set.icon !== null ? absoluteUrl(set.icon, catalogUrl) : null
    const options = set.options.map((option) => ({
      ...option,
      icon: absoluteUrl(option.icon, catalogUrl)
    }))

    return { ...set, icon, options }
  })
  const items = catalog.items.map((item) => ({
    ...item,
    icon: absoluteUrl(item.icon, catalogUrl)
  }))

  return { ...catalog, sets, items }
}

async function requestOathCatalog(): Promise<OathCatalog | null> {
  const catalogUrl = oathCatalogUrl()
  const json = await fetchUploadedStaticJson(catalogUrl)
  if (json === null) {
    return null
  }

  return readOathCatalog(json, catalogUrl)
}

export function useOathCatalog(): LoadedResult<OathCatalog | null> {
  const queryClient = useQueryClient()

  // 서약 파일은 받은 뒤 페이지를 닫을 때까지 다시 받지 않고, 실패하면 캐시에 남지 않아 다음에 열 때 다시 받는다.

  return useLoadedResult(['oath-catalog'], () =>
    queryClient.fetchQuery({
      queryKey: ['oath-catalog-file'],
      queryFn: requestOathCatalog,
      staleTime: Infinity,
      gcTime: Infinity
    })
  )
}
