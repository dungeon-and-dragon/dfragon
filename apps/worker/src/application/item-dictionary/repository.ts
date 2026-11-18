export interface AcquisitionItemRepository {
  readUnlistedItemIds(since: Date): Promise<string[]>
}
