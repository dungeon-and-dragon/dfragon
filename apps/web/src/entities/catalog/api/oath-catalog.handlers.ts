import { delay, HttpResponse, http } from 'msw'
import type { OathCatalog } from '#entities/catalog/model/oath-catalog'
import { oathCatalogUrl } from './useOathCatalog'

export const OATH_CATALOG_URL = oathCatalogUrl()

export const oathCatalogHandlers = {
  catalog: (catalog: OathCatalog) => http.get(OATH_CATALOG_URL, () => HttpResponse.json(catalog)),
  notUploaded: http.get(OATH_CATALOG_URL, () => new HttpResponse(null, { status: 404 })),
  loading: http.get(OATH_CATALOG_URL, async () => {
    await delay('infinite')
  })
}
