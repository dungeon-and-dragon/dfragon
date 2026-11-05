import { expect, it, vi } from 'vitest'
import type { StoredCharacter } from '../ranking/ranking-stats'
import type { AdventureCharacters, Guild } from './adventure-guild'
import { createAdventureCharactersHttp, createGuildHttp } from './adventure-guild-http'

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
  guildName: '합성 길드'
}

const adventure: AdventureCharacters = { adventureName: '합성 모험단', characters: [character] }
const guild: Guild = {
  guildId: 'guild-1',
  guildName: '합성 길드',
  memberCount: 1,
  averageFame: 80123,
  members: [character]
}

it('모험단 응답을 읽고 한글 이름을 주소에 인코딩한다', async () => {
  const fetch = respond(adventure)
  const read = createAdventureCharactersHttp({ apiOrigin: API_ORIGIN, fetch })

  await expect(read('합성 모험단')).resolves.toEqual(adventure)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/adventures/${encodeURIComponent('합성 모험단')}/characters`
  )
})

it('길드 응답을 읽고, 길드원이 없는 길드도 읽는다', async () => {
  const empty: Guild = { ...guild, guildName: null, memberCount: 0, averageFame: null, members: [] }
  const fetch = respond(guild)

  await expect(createGuildHttp({ apiOrigin: API_ORIGIN, fetch })('guild-1')).resolves.toEqual(guild)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(`${API_ORIGIN}/guilds/guild-1`)
  await expect(
    createGuildHttp({ apiOrigin: API_ORIGIN, fetch: respond(empty) })('guild-2')
  ).resolves.toEqual(empty)
})

it('빈 모험단을 읽고, 모르는 서버가 있는 응답과 오류 응답은 거부한다', async () => {
  const empty: AdventureCharacters = { adventureName: '없는 모험단', characters: [] }

  await expect(
    createAdventureCharactersHttp({ apiOrigin: API_ORIGIN, fetch: respond(empty) })('없는 모험단')
  ).resolves.toEqual(empty)
  await expect(
    createAdventureCharactersHttp({
      apiOrigin: API_ORIGIN,
      fetch: respond({ ...adventure, characters: [{ ...character, serverId: 'unknown' }] })
    })('합성 모험단')
  ).rejects.toThrow()
  await expect(
    createGuildHttp({
      apiOrigin: API_ORIGIN,
      fetch: respond({ error: { code: 'INTERNAL_SERVER_ERROR', message: '실패' } }, 500)
    })('guild-1')
  ).rejects.toThrow()
})
