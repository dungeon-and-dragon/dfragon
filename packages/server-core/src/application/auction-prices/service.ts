import type { LabItemPriceTarget } from '@dfragon/database'
import type { FetchLowestListing, FindItem } from './ports.js'
import type { AuctionPriceRepository } from './repository.js'

type ItemPrice = {
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
}

export class AuctionPriceService {
  constructor(
    private readonly repository: AuctionPriceRepository,
    private readonly fetchLowestListing: FetchLowestListing,
    private readonly findItem: FindItem,
    private readonly now: () => Date = () => new Date()
  ) {}

  // 재화로 교환하는 아이템은 경매장을 부르지 않고, 경매장 매물이 없는 아이템과 함께 아이템 검색으로 아이콘만 찾는다.
  private async priceOf({ itemName, exchanged }: LabItemPriceTarget): Promise<ItemPrice> {
    if (!exchanged) {
      const listing = await this.fetchLowestListing(itemName)

      if (listing !== null) {
        return listing
      }
    }

    const item = await this.findItem(itemName)

    if (item === null) {
      return { itemId: null, itemRarity: null, unitPrice: null }
    }

    return { itemId: item.itemId, itemRarity: item.itemRarity, unitPrice: null }
  }

  // 이름마다 바로 저장해, 중간에 조회가 실패해도 앞에서 받은 가격은 남는다.
  async refresh(
    targets: readonly LabItemPriceTarget[],
    reportProgress: (done: number, total: number) => void = () => undefined
  ): Promise<number> {
    let done = 0

    for (const target of targets) {
      const price = await this.priceOf(target)
      const checkedAt = this.now()

      await this.repository.record({ itemName: target.itemName, ...price, checkedAt })
      done += 1
      reportProgress(done, targets.length)
    }

    return targets.length
  }
}
