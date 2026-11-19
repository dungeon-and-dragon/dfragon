import type { FavoriteCharacter } from '#features/favorite-character'
import { storyRankedCharacters } from './story-characters'

// 캐릭터, 모험단, 길드 이름은 실제 값이 아닌 합성 값이다.

export const storyFavoriteCharacters: FavoriteCharacter[] = storyRankedCharacters(6).map(
  (
    {
      serverId,
      characterId,
      characterName,
      adventureName,
      guildId,
      guildName,
      level,
      jobName,
      jobGrowName,
      fame,
      role
    },
    index
  ) => ({
    serverId,
    characterId,
    characterName,
    adventureName,
    guildId,
    guildName,
    level,
    jobName,
    jobGrowName,
    fame,
    role,
    savedAt: index
  })
)
