export interface AuctionListing {
  itemId: string
  itemRarity: string | null
  unitPrice: number
}

export type FetchLowestListing = (itemName: string) => Promise<AuctionListing | null>
