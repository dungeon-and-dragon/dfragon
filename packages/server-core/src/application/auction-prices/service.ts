import type { FetchLowestListing } from './ports.js'
import type { AuctionPriceRepository } from './repository.js'

export class AuctionPriceService {
  constructor(
    private readonly repository: AuctionPriceRepository,
    private readonly fetchLowestListing: FetchLowestListing,
    private readonly now: () => Date = () => new Date()
  ) {}

  // 이름마다 바로 저장해, 중간에 조회가 실패해도 앞에서 받은 가격은 남는다.
  async refresh(
    itemNames: readonly string[],
    reportProgress: (done: number, total: number) => void = () => undefined
  ): Promise<number> {
    let done = 0

    for (const itemName of itemNames) {
      const listing = await this.fetchLowestListing(itemName)
      const checkedAt = this.now()

      await this.repository.record({
        itemName,
        itemId: listing?.itemId ?? null,
        itemRarity: listing?.itemRarity ?? null,
        unitPrice: listing?.unitPrice ?? null,
        checkedAt
      })
      done += 1
      reportProgress(done, itemNames.length)
    }

    return itemNames.length
  }
}
