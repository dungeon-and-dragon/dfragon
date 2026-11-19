import { expect, it, vi } from 'vitest'
import type { CharacterStats } from '#core/ranking/ranking-stats'
import { createDfragonClient } from './dfragon-client'

const API_ORIGIN = 'https://api.example.test'

function respond(body: unknown, status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body), { status }))
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
