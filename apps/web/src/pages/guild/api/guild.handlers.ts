import { delay, HttpResponse, http } from 'msw'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storyGuild } from './guild.fixture'

export const GUILD_URL = `${API_BASE_URL}/guilds/:guildId`

export const guildHandlers = {
  members: (memberCount: number) => {
    const guild = storyGuild(memberCount)

    return http.get(GUILD_URL, () => HttpResponse.json(guild))
  },
  loading: http.get(GUILD_URL, async () => {
    await delay('infinite')
  }),
  failure: http.get(GUILD_URL, () =>
    HttpResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: '길드를 받지 못했습니다.' } },
      { status: 500 }
    )
  )
}
