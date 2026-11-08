import { expect, it, vi } from 'vitest'
import type { StoredCharacter } from '../ranking/ranking-stats'
import type { Guild } from '../adventure-guild/adventure-guild'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'

function respond(body: unknown, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body), { status }))
}

const character: StoredCharacter = {
  serverId: 'cain',
  characterId: 'character-1',
  characterName: '합성 캐릭터',
  adventureName: '합성 모험단',
  level: 115,
  jobId: 'job-1',
  jobGrowId: 'grow-1',
  jobName: '합성 직업',
  jobGrowName: '眞 합성 전직',
  fame: 80123,
  guildId: 'guild-1',
  guildName: '합성 길드',
  role: null
}

const guild: Guild = {
  guildId: 'guild-1',
  guildName: '합성 길드',
  memberCount: 1,
  averageFame: 80123,
  members: [character]
}

it('길드 응답을 읽고, 길드원이 없는 길드도 읽는다', async () => {
  const empty: Guild = { ...guild, guildName: null, memberCount: 0, averageFame: null, members: [] }
  const fetch = respond(guild)

  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).guilds.get('guild-1')
  ).resolves.toEqual(guild)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(`${API_ORIGIN}/guilds/guild-1`)
  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).guilds.get('guild-2')
  ).resolves.toEqual(empty)
})

it('모르는 서버가 있는 길드 응답과 오류 응답은 거부한다', async () => {
  await expect(
    createDfragonClient({
      apiOrigin: API_ORIGIN,
      fetch: respond({ ...guild, members: [{ ...character, serverId: 'unknown' }] })
    }).guilds.get('guild-1')
  ).rejects.toThrow()
  await expect(
    createDfragonClient({
      apiOrigin: API_ORIGIN,
      fetch: respond({ error: { code: 'INTERNAL_SERVER_ERROR', message: '실패' } }, 500)
    }).guilds.get('guild-1')
  ).rejects.toThrow()
})
