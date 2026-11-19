import type { Guild } from '#core/adventure-guild'
import { storyRankedCharacters } from '#testing/story-support/story-characters'

// 길드와 캐릭터 이름은 실제 값이 아닌 합성 값이다.

export function storyGuild(memberCount: number): Guild {
  const guildMembers = storyRankedCharacters(memberCount).map((character) => ({
    ...character,
    guildId: 'guild-1',
    guildName: '길드1'
  }))

  return { guildId: 'guild-1', guildName: '길드1', memberCount, members: guildMembers }
}
