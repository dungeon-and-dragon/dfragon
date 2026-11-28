import type { LabItemPriceTarget } from '@dfragon/database'
import type {
  AuctionListing,
  FetchLowestLevelListing,
  FetchLowestListing,
  FindItem
} from './ports.js'
import type { AuctionPriceRepository } from './repository.js'

// 레벨 꼬리표 매물은 실험실 종류와 같은 아이템 종류만 받는다. 마법부여 카드와 보주는 레벨 꼬리표 매물이 없어 찾지 않는다.
const LEVEL_LISTING_TYPE_DETAILS: ReadonlyMap<string, string> = new Map([
  ['TITLE', '칭호'],
  ['CREATURE', '크리쳐'],
  ['AURA', '오라']
])
const AURA_CATEGORY = 'AURA'
// 오라는 경매장에 본체가 아니라 상자로만 올라, 오라 이름에 상자 이름을 붙인 매물을 받는다.
const AURA_BOX_SUFFIX = ' 오라 상자'

type ItemPrice = {
  itemId: string | null
  itemRarity: string | null
  unitPrice: number | null
}

export class AuctionPriceService {
  constructor(
    private readonly repository: AuctionPriceRepository,
    private readonly fetchLowestListing: FetchLowestListing,
    private readonly fetchLowestLevelListing: FetchLowestLevelListing,
    private readonly findItem: FindItem,
    private readonly now: () => Date = () => new Date()
  ) {}

  private async lowestListing(
    itemName: string,
    categories: readonly string[]
  ): Promise<AuctionListing | null> {
    const listing = await this.fetchLowestListing(itemName)
    const itemTypeDetails = categories.flatMap((category) => {
      const typeDetail = LEVEL_LISTING_TYPE_DETAILS.get(category)

      if (typeDetail === undefined) {
        return []
      }

      return [typeDetail]
    })

    if (listing !== null || itemTypeDetails.length === 0) {
      return listing
    }

    const levelListing = await this.fetchLowestLevelListing(itemName, itemTypeDetails)

    if (levelListing !== null || !categories.includes(AURA_CATEGORY)) {
      return levelListing
    }

    return this.auraBoxListing(itemName)
  }

  // 상자 매물의 itemId는 상자 아이템이라, 아이템 정보 tooltip이 오라 본체를 보이도록 itemId와 등급은 오라 이름으로 찾은 아이템에서 받는다.
  private async auraBoxListing(itemName: string): Promise<AuctionListing | null> {
    const boxListing = await this.fetchLowestListing(`${itemName}${AURA_BOX_SUFFIX}`)

    if (boxListing === null) {
      return null
    }

    const aura = await this.findItem(itemName)

    if (aura === null) {
      return boxListing
    }

    return { ...boxListing, itemId: aura.itemId, itemRarity: aura.itemRarity }
  }

  // 재화로 교환하는 아이템은 경매장을 부르지 않고, 경매장 매물이 없는 아이템과 함께 아이템 검색으로 아이콘만 찾는다.
  private async priceOf({
    itemName,
    exchanged,
    categories
  }: LabItemPriceTarget): Promise<ItemPrice> {
    if (!exchanged) {
      const listing = await this.lowestListing(itemName, categories)

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
