import { CHARACTER_SERVER_NAMES } from '#entities/character'

// 캐릭터와 모험단 이름은 실제 값이 아닌 합성 값이다.

export function searchedCharacterRow({
  serverId = 'prey',
  characterId,
  characterName = '합성',
  adventureName = null
}: {
  serverId?: 'cain' | 'prey'
  characterId: string
  characterName?: string
  adventureName?: string | null
}) {
  return {
    serverId,
    characterId,
    characterName,
    serverName: CHARACTER_SERVER_NAMES[serverId],
    fame: 1000,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${serverId}/characters/${characterId}?zoom=1`,
    adventureName,
    jobName: null,
    jobGrowName: null
  }
}
