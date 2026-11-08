import { expect, it, vi } from 'vitest'
import type { CharacterStats, FameRanking } from '../ranking/ranking-stats'
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
      role: null
    }
  ]
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

it('랭킹 응답을 그대로 읽고 정한 직업, 전직만 query로 보낸다', async () => {
  const fetch = respond(ranking)
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).rankings.fame

  await expect(read({ jobId: 'job-1', jobGrowId: 'grow-1' })).resolves.toEqual(ranking)
  expect(new Request(fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/rankings/fame?jobId=job-1&jobGrowId=grow-1`
  )
  await read({})
  expect(new Request(fetch.mock.calls[1][0]).url).toBe(`${API_ORIGIN}/rankings/fame`)
})

it('빈 랭킹도 읽는다', async () => {
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch: respond({ characters: [] }) })
    .rankings.fame

  await expect(read({})).resolves.toEqual({ characters: [] })
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
