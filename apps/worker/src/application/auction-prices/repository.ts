export interface LabItemRepository {
  readItemNames(): Promise<string[]>
}
