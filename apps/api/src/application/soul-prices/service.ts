import { SOUL_CRYSTALS, soulPriceFailure } from '#domain/soul-prices/index.js'
import type { AuctionListing, FetchLowestListing } from './ports.js'

// 경매장 최저가는 수시로 바뀌지만 메인 화면을 열 때마다 6번씩 부르지 않게 잠깐 저장한다.
const CACHE_TTL_MS = 5 * 60 * 1000

export interface SoulPrice {
  itemName: string
  itemRarity: string | null
  unitPrice: number | null
  revelationCount: number
}

export interface SoulPrices {
  crystals: SoulPrice[]
}

interface CachedSoulPrices {
  prices: SoulPrices
  expiresAt: number
}

function soulPriceOf(
  { itemName, revelationCount }: (typeof SOUL_CRYSTALS)[number],
  listing: AuctionListing | null
): SoulPrice {
  if (listing === null) {
    return { itemName, itemRarity: null, unitPrice: null, revelationCount }
  }

  return { itemName, itemRarity: listing.itemRarity, unitPrice: listing.unitPrice, revelationCount }
}

export class SoulPriceService {
  private cached: CachedSoulPrices | undefined
  private loading: Promise<SoulPrices> | undefined

  constructor(
    private readonly fetchLowestListing: FetchLowestListing,
    private readonly now: () => number = Date.now
  ) {}

  async get(): Promise<SoulPrices> {
    const current = this.cached

    if (current !== undefined && this.now() < current.expiresAt) {
      return current.prices
    }

    this.loading ??= this.load().finally(() => {
      this.loading = undefined
    })

    try {
      return await this.loading
    } catch (error) {
      throw soulPriceFailure(error)
    }
  }

  private async load(): Promise<SoulPrices> {
    const startedAt = this.now()
    const listings = await Promise.all(
      SOUL_CRYSTALS.map(({ itemName }) => this.fetchLowestListing(itemName))
    )
    const crystals = SOUL_CRYSTALS.map((crystal, index) =>
      soulPriceOf(crystal, listings[index] ?? null)
    )
    const prices = { crystals }
    const expiresAt = startedAt + CACHE_TTL_MS
    this.cached = { prices, expiresAt }

    return prices
  }
}
