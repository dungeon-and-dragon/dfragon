import { expect, it, vi } from 'vitest'
import type { CharacterStats, FameRanking } from '#core/ranking/ranking-stats'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'

function respond(body: unknown, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body), { status }))
}

const ranking: FameRanking = {
  characters: [
    {
      rank: 1,
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
      role: null,
      equipmentSet: { id: 'set-1', name: '소울 페어리 세트' },
      oathSet: { id: 16204, name: '야망의 용투 서약', option: '용투 : 용제 강림' }
    }
  ],
  nextCursor: 'cursor-1'
}

const stats: CharacterStats = {
  computedAt: '2026-11-05T15:00:00.000Z',
  total: 3,
  servers: [{ serverId: 'cain', count: 3 }],
  jobs: [
    {
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      jobName: '합성 직업',
      jobGrowName: '眞 합성 전직',
      count: 2,
      averageFame: null
    }
  ],
  fameDistribution: [{ from: 70000, to: 80000, count: 1 }]
}

it('랭킹 응답을 그대로 읽고 정한 직업, 전직, 역할만 query로 보낸다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await expect(read({ jobId: 'job-1', jobGrowId: 'grow-1' })).resolves.toEqual(ranking)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/rankings/fame?jobId=job-1&jobGrowId=grow-1`
  )
  await read({})
  expect(new Request(fetch.mock.calls[1][0]).url).toBe(`${API_ORIGIN}/rankings/fame`)
  await read({ jobId: 'job-1', jobGrowId: 'grow-1', role: 'dealer' })
  expect(new Request(fetch.mock.calls[2][0]).url).toBe(
    `${API_ORIGIN}/rankings/fame?jobId=job-1&jobGrowId=grow-1&role=dealer`
  )
})

it('명성 범위를 query로 보내고, 거꾸로 된 범위는 요청하지 않고 거부한다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await read({ jobId: 'job-1', fameFrom: 136000, fameTo: 138000 })
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/rankings/fame?jobId=job-1&fameFrom=136000&fameTo=138000`
  )
  await read({ fameFrom: 0 })
  expect(new Request(fetch.mock.calls[1][0]).url).toBe(`${API_ORIGIN}/rankings/fame?fameFrom=0`)
  await expect(read({ fameFrom: 138000, fameTo: 136000 })).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('빈 랭킹도 읽는다', async () => {
  const read = createDfragonClient({
    apiOrigin: API_ORIGIN,
    fetch: respond({ characters: [], nextCursor: null })
  }).rankings.fame

  await expect(read({})).resolves.toEqual({ characters: [], nextCursor: null })
})

it('직업 없이 전직만 보내면 요청하지 않고 거부한다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await expect(read({ jobGrowId: 'grow-1' })).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
})

it('순위가 없거나 모르는 서버가 있는 랭킹 응답은 거부한다', async () => {
  const { rank: _rank, ...withoutRank } = ranking.characters[0]
  for (const characters of [[withoutRank], [{ ...ranking.characters[0], serverId: 'unknown' }]]) {
    const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond({ characters }) })
      .rankings.fame

    await expect(read({})).rejects.toThrow()
  }
})

it('통계 응답과 빈 통계를 읽는다', async () => {
  const empty: CharacterStats = { ...stats, total: 0, servers: [], jobs: [], fameDistribution: [] }

  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(stats) }).stats()
  ).resolves.toEqual(stats)
  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).stats()
  ).resolves.toEqual(empty)
})

it('집계 시각이 null인 빈 통계 응답을 읽는다', async () => {
  const empty = { computedAt: null, total: 0, servers: [], jobs: [], fameDistribution: [] }

  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).stats()
  ).resolves.toEqual(empty)
})

it('집계 시각이 없는 통계 응답과 오류 응답은 거부한다', async () => {
  const { computedAt: _computedAt, ...withoutTime } = stats

  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(withoutTime) }).stats()
  ).rejects.toThrow()
  await expect(
    createDfragonClient({
      apiOrigin: API_ORIGIN,
      fetch: respond({ error: { code: 'INTERNAL_SERVER_ERROR', message: '실패' } }, 500)
    }).stats()
  ).rejects.toThrow()
})

it('스킬 채택률은 전직을 query로 보내고 응답을 schema로 읽는다', async () => {
  const skillStats = {
    computedAt: '2026-11-06T15:00:00.000Z',
    minFame: null,
    sampleSize: 0,
    skills: [],
    evolutions: [],
    enhancements: []
  }
  const fetch = respond({ ...skillStats, topCount: 5000 })
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).skillStats

  await expect(read({ jobId: 'job-1', jobGrowId: 'grow-1', role: null })).resolves.toEqual(
    skillStats
  )
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/stats/skills?jobId=job-1&jobGrowId=grow-1`
  )
  await read({ jobId: 'job-1', jobGrowId: 'grow-1', role: 'buffer' })
  expect(new Request(fetch.mock.calls[1][0]).url).toBe(
    `${API_ORIGIN}/stats/skills?jobId=job-1&jobGrowId=grow-1&role=buffer`
  )
  await expect(
    createDfragonClient({
      apiOrigin: API_ORIGIN,
      fetch: respond({ ...skillStats, sampleSize: undefined })
    }).skillStats({ jobId: 'job-1', jobGrowId: 'grow-1', role: null })
  ).rejects.toThrow()
})

it('집계 시각이 null인 빈 스킬 채택률 응답을 읽는다', async () => {
  const empty = {
    computedAt: null,
    minFame: null,
    sampleSize: 0,
    skills: [],
    evolutions: [],
    enhancements: []
  }
  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).skillStats({
      jobId: 'job-1',
      jobGrowId: 'grow-1',
      role: null
    })
  ).resolves.toEqual(empty)
})

it('랭킹에 장비 세트, 서약 세트, 선택지를 query로 보내고 서약 세트 없는 선택지는 요청하지 않는다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await read({
    jobId: 'job-1',
    equipmentSetId: 'set-1',
    oathSetId: 16204,
    oathSetOption: '용투 : 용제 강림'
  })
  const url = new URL(new Request(fetch.mock.calls[0][0]).url)
  expect(Object.fromEntries(url.searchParams)).toEqual({
    jobId: 'job-1',
    equipmentSetId: 'set-1',
    oathSetId: '16204',
    oathSetOption: '용투 : 용제 강림'
  })
  await expect(read({ oathSetOption: '용투 : 용제 강림' })).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(1)
})

// #1798의 실제 응답 모양이다. 세 목록 각각의 count 합이 sampleSize이고, 서약 세트 하나의 선택지 count 합이 그 세트 count다.
const setStats = {
  computedAt: '2026-11-18T11:00:27.845Z',
  sampleSize: 4,
  equipmentSets: [
    { setId: 'set-fairy', name: '소울 페어리 세트', count: 3 },
    { setId: null, name: null, count: 1 }
  ],
  oathSets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      count: 2,
      options: [
        { name: '용투 : 세계를 태우는 불꽃', count: 1 },
        { name: '용투 : 합성 선택지', count: 1 }
      ]
    },
    { setId: null, name: null, count: 2, options: [{ name: null, count: 2 }] }
  ],
  combos: [
    { equipmentSetId: 'set-fairy', oathSetId: 16204, count: 2 },
    { equipmentSetId: 'set-fairy', oathSetId: null, count: 1 },
    { equipmentSetId: null, oathSetId: null, count: 1 }
  ]
}

it('세트 통계는 고른 직업, 전직, 역할만 query로 보내고 응답을 schema로 읽는다', async () => {
  const fetch = respond(setStats)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).setStats

  await expect(read({})).resolves.toEqual(setStats)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(`${API_ORIGIN}/stats/sets`)
  await read({ jobId: 'job-1', jobGrowId: 'grow-1', role: 'buffer' })
  expect(new Request(fetch.mock.calls[1][0]).url).toBe(
    `${API_ORIGIN}/stats/sets?jobId=job-1&jobGrowId=grow-1&role=buffer`
  )
  await expect(read({ jobGrowId: 'grow-1' })).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('저장분이 없는 빈 세트 통계를 읽는다', async () => {
  const empty = { computedAt: null, sampleSize: 0, equipmentSets: [], oathSets: [], combos: [] }
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).setStats

  await expect(read({})).resolves.toEqual(empty)
})

it('목록의 count 합이 표본 수와 다르거나 선택지 합이 세트 수와 다른 세트 통계는 거부한다', async () => {
  const [fairy, noSet] = setStats.equipmentSets
  const [dragon, noOath] = setStats.oathSets
  const broken = [
    { ...setStats, equipmentSets: [fairy, { ...noSet, count: 2 }] },
    { ...setStats, oathSets: [{ ...dragon, options: dragon.options.slice(1) }, noOath] },
    { ...setStats, combos: setStats.combos.slice(1) }
  ]

  for (const body of broken) {
    const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(body) }).setStats
    await expect(read({})).rejects.toThrow()
  }
})

it('랭킹 다음 page는 같은 필터에 cursor를 붙여 받고 행의 세트와 nextCursor를 읽는다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await expect(read({ oathSetId: 16204 }, 'cursor-1')).resolves.toEqual(ranking)
  const url = new URL(new Request(fetch.mock.calls[0][0]).url)
  expect(Object.fromEntries(url.searchParams)).toEqual({ oathSetId: '16204', cursor: 'cursor-1' })
})

it('nextCursor가 없거나 세트 모양이 다른 랭킹 응답은 거부한다', async () => {
  const [character] = ranking.characters
  const broken = [
    { characters: ranking.characters },
    {
      ...ranking,
      characters: [{ ...character, oathSet: { id: '16204', name: '서약', option: null } }]
    }
  ]

  for (const body of broken) {
    const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(body) }).rankings.fame
    await expect(read({})).rejects.toThrow()
  }
})

it('랭킹에 itemIds를 쉼표로 이어 보내고, 빈 항목, 중복, 여섯 개 이상은 요청하지 않는다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await read({ jobId: 'job-1', itemIds: ['weapon-1', 'ring-1'] })
  const url = new URL(new Request(fetch.mock.calls[0][0]).url)
  expect(Object.fromEntries(url.searchParams)).toEqual({
    jobId: 'job-1',
    itemIds: 'weapon-1,ring-1'
  })
  for (const itemIds of [[''], ['a', 'a'], ['a', 'b', 'c', 'd', 'e', 'f'], ['a,b']]) {
    await expect(read({ itemIds })).rejects.toThrow()
  }
  expect(fetch).toHaveBeenCalledTimes(1)
})

// #1802의 실제 응답 모양이다. 유일 장비가 없는 캐릭터는 부위의 items에 없어 그 부위 count 합이 sampleSize보다 작다.
const itemStats = {
  computedAt: '2026-11-18T15:38:47.900Z',
  sampleSize: 5,
  slots: [
    {
      slotId: 'WEAPON',
      items: [
        { itemId: 'item-weapon-a', name: '합성 무기', typeDetail: '도', count: 2 },
        { itemId: 'item-weapon-b', name: '합성 다른 무기', typeDetail: '낫', count: 2 }
      ]
    },
    {
      slotId: 'RING',
      items: [{ itemId: 'item-ring-a', name: '합성 반지', typeDetail: null, count: 1 }]
    }
  ]
}

it('아이템 통계는 고른 직업, 전직, 역할만 query로 보내고 응답을 schema로 읽는다', async () => {
  const fetch = respond(itemStats)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).itemStats

  await expect(read({ jobId: 'job-1', jobGrowId: 'grow-1' })).resolves.toEqual(itemStats)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/stats/items?jobId=job-1&jobGrowId=grow-1`
  )
  const empty = { computedAt: null, sampleSize: 0, slots: [] }
  await expect(
    createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(empty) }).itemStats({})
  ).resolves.toEqual(empty)
})

it('한 부위의 count 합이 표본 수보다 큰 아이템 통계는 거부한다', async () => {
  const broken = { ...itemStats, sampleSize: 3 }
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond(broken) }).itemStats

  await expect(read({})).rejects.toThrow()
})
