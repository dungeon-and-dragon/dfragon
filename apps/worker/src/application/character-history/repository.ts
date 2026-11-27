import type { CharacterHistoryKey } from '@dfragon/database'

export interface LoweredHistoryTrimRepository {
  readCharacters(): Promise<CharacterHistoryKey[]>
  trim(character: CharacterHistoryKey): Promise<boolean>
}
