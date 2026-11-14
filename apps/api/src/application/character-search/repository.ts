import type { StoredAdventureName } from '@dfragon/database'

export interface CharacterSearchRepository {
  readAdventureNames(
    characters: readonly { serverId: string; characterId: string }[]
  ): Promise<StoredAdventureName[]>
}
