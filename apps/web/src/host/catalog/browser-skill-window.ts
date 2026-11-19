import { type OathCatalog, oathCatalogSchema } from '#core/catalog'
import { absoluteUrl, fetchUploadedStaticJson } from '#shared/lib/static-json'

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
  const items = catalog.items.map((item) => ({ ...item, icon: absoluteUrl(item.icon, catalogUrl) }))

  return { ...catalog, sets, items }
}

async function fetchOathCatalog(catalogUrl: string): Promise<OathCatalog | null> {
  const json = await fetchUploadedStaticJson(catalogUrl)
  if (json === null) {
    return null
  }

  return readOathCatalog(json, catalogUrl)
}

export function createOathCatalogSource(catalogUrl: string): () => Promise<OathCatalog | null> {
  let remembered: Promise<OathCatalog | null> | undefined

  return () => {
    if (remembered !== undefined) {
      return remembered
    }
    const started = fetchOathCatalog(catalogUrl)
    remembered = started
    // 실패한 요청은 지워 다음에 탭을 열 때 다시 받는다.
    started.catch(() => {
      if (remembered === started) {
        remembered = undefined
      }
    })

    return started
  }
}
