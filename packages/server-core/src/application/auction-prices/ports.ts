export interface AuctionListing {
  itemId: string
  itemRarity: string | null
  unitPrice: number
}

export type FetchLowestListing = (itemName: string) => Promise<AuctionListing | null>

export interface FoundItem {
  itemId: string
  itemRarity: string
}

export type FindItem = (itemName: string) => Promise<FoundItem | null>
