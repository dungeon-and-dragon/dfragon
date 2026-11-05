import { expect, it, vi } from 'vitest'
import { createAdventureWeeklyHttp } from './adventure-weekly-http'
import type { AdventureWeekly } from './adventure-weekly'

const API_ORIGIN = 'https://api.example.test'

function respond(body: unknown, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body), { status }))
}

const weekly: AdventureWeekly = {
  adventureName: '합성 모험단',
  clearNames: [
    { kind: 'raid', name: '합성 레이드' },
    { kind: 'legion', name: '합성 레기온' }
  ],
  characters: [
    {
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
      guildId: null,
      guildName: null,
      weeklyClears: [{ kind: 'raid', name: '합성 레이드' }]
    }
  ]
}

it('모험단 이름을 경로에 담아 주간 클리어 응답을 읽는다', async () => {
  const fetch = respond(weekly)
  const read = createAdventureWeeklyHttp({ apiOrigin: API_ORIGIN, fetch })

  await expect(read('합성 모험단/1')).resolves.toEqual(weekly)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/adventures/${encodeURIComponent('합성 모험단/1')}/weekly`
  )
})

it('클리어가 없는 응답과 빈 응답도 읽는다', async () => {
  const noClears = {
    ...weekly,
    clearNames: [],
    characters: weekly.characters.map((character) => ({ ...character, weeklyClears: [] }))
  }
  const empty = { adventureName: '없는 모험단', clearNames: [], characters: [] }
  for (const body of [noClears, empty]) {
    const read = createAdventureWeeklyHttp({ apiOrigin: API_ORIGIN, fetch: respond(body) })

    await expect(read(body.adventureName)).resolves.toEqual(body)
  }
})

it('빈 이름은 요청하지 않고 거부한다', async () => {
  const fetch = respond(weekly)
  const read = createAdventureWeeklyHttp({ apiOrigin: API_ORIGIN, fetch })

  await expect(read('  ')).rejects.toMatchObject({ code: 'INVALID_SEARCH_QUERY' })
  expect(fetch).not.toHaveBeenCalled()
})

it('모르는 클리어 종류나 weeklyClears가 없는 응답은 거부한다', async () => {
  const { weeklyClears: _weeklyClears, ...withoutClears } = weekly.characters[0]
  for (const body of [
    { ...weekly, clearNames: [{ kind: 'dungeon', name: '합성 던전' }] },
    { ...weekly, characters: [withoutClears] }
  ]) {
    const read = createAdventureWeeklyHttp({ apiOrigin: API_ORIGIN, fetch: respond(body) })

    await expect(read('합성 모험단')).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  }
})
