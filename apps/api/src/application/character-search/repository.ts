import type { StoredAdventureName, StoredCharacterScoreRow } from '@dfragon/database'

export interface CharacterSearchRepository {
  readAdventureNames(
    characters: readonly { serverId: string; characterId: string }[]
  ): Promise<StoredAdventureName[]>
  readCharacterScores(
    characters: readonly { serverId: string; characterId: string }[]
  ): Promise<StoredCharacterScoreRow[]>
}
