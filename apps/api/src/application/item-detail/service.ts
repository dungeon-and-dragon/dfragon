import type { CharacterCatalog } from '@dfragon/server-core/application/character-catalog/ports.js'
import { isCatalogId } from '@dfragon/server-core/domain/character-catalog/index.js'
import { type ItemDetail, ItemDetailFailure, projectItemDetail } from '#domain/item-detail/index.js'

export class ItemDetailService {
  constructor(private readonly catalog: CharacterCatalog) {}

  async get(itemId: string, signal: AbortSignal): Promise<ItemDetail> {
    if (!isCatalogId(itemId)) {
      throw new ItemDetailFailure('query')
    }

    const items = await this.catalog.load([itemId], signal)
    const detail = items.get(itemId)

    // catalog는 Neople 실패와 없는 itemId를 모두 unavailable로 준다.
    if (detail === undefined || detail.status === 'unavailable') {
      throw new ItemDetailFailure('api')
    }

    const item = projectItemDetail(itemId, detail.data)

    if (item === null) {
      throw new ItemDetailFailure('api')
    }

    return item
  }
}
