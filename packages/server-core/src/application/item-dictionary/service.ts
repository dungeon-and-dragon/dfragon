import { chunk } from 'remeda'
import { CATALOG_LIMITS, isCatalogId } from '#domain/character-catalog/index.js'
import { toItemDictionaryEntry } from '#domain/item-dictionary/index.js'
import type { FetchItemDetails } from './ports.js'
import type { ItemDictionaryRepository } from './repository.js'

export class ItemDictionaryService {
  constructor(
    private readonly repository: ItemDictionaryRepository,
    private readonly fetchItemDetails: FetchItemDetails
  ) {}

  // 조회한 묶음마다 바로 저장해, 중간에 실패해도 저장한 itemId는 다시 묻지 않는다.
  async fill(
    itemIds: readonly string[],
    reportProgress: (done: number, total: number) => void = () => undefined
  ): Promise<number> {
    const unlisted = await this.repository.readUnlistedItemIds(itemIds.filter(isCatalogId))
    let done = 0

    for (const batch of chunk(unlisted, CATALOG_LIMITS.maximumBatchKeys)) {
      const details = await this.fetchItemDetails(batch)
      await this.repository.record(
        batch.map((itemId) => toItemDictionaryEntry(itemId, details.get(itemId)))
      )
      done += batch.length
      reportProgress(done, unlisted.length)
    }

    return unlisted.length
  }
}
