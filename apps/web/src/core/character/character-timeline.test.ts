import { expect, it, vi } from 'vitest'
import { createDfragonClient } from '../api/dfragon-client'
import type { CharacterTimeline } from './character-timeline'

const API_ORIGIN = 'https://api.example.test'
const identity = { serverId: 'cain', characterId: 'character-1' }

function readTimeline(body: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify(body), { status })
  )
  const read = createDfragonClient({ apiOrigin: API_ORIGIN, fetch }).characters.timeline(identity)

  return { fetch, read }
}

const filled: CharacterTimeline = {
  weeklyClears: [
    {
      kind: 'raid',
      name: '디레지에 레이드',
      modeName: '디레지에 : 악연',
      hard: true,
      occurredAt: '2026-11-05T12:30:00.000Z'
    },
    {
      kind: 'legion',
      name: '베누스',
      modeName: null,
      hard: false,
      occurredAt: '2026-11-05T13:00:00.000Z'
    }
  ],
  seasonClears: [{ kind: 'raid', name: '디레지에 레이드', hard: true, count: 3 }],
  enhancements: [
    {
      kind: 'refine',
      itemId: 'item-1',
      itemName: '합성 무기',
      itemRarity: '태초',
      before: null,
      after: 8,
      result: true,
      safe: null,
      occurredAt: '2026-11-04T10:00:00.000Z'
    }
  ],
  enhancementsCursor: 'enhancement-cursor',
  acquisitions: [
    {
      code: 505,
      name: '아이템 획득(던전 드랍)',
      itemId: 'item-2',
      itemName: '합성 상의',
      itemRarity: '에픽',
      occurredAt: '2026-11-03T10:00:00.000Z'
    }
  ],
  acquisitionsCursor: null
}

const empty: CharacterTimeline = {
  weeklyClears: [],
  seasonClears: [],
  enhancements: [],
  enhancementsCursor: null,
  acquisitions: [],
  acquisitionsCursor: null
}

it('값이 있는 응답과 빈 응답을 그대로 읽고 캐릭터의 timeline 경로를 부른다', async () => {
  const withValues = readTimeline(filled)
  await expect(withValues.read).resolves.toEqual(filled)
  expect(new Request(withValues.fetch.mock.calls[0][0]).url).toBe(
    `${API_ORIGIN}/characters/cain/character-1/timeline`
  )

  await expect(readTimeline(empty).read).resolves.toEqual(empty)
})

it('hard를 주지 않는 API의 클리어는 하드가 아닌 것으로 읽는다', async () => {
  const { hard: _weeklyHard, ...weekly } = filled.weeklyClears[0]
  const { hard: _seasonHard, ...season } = filled.seasonClears[0]
  const { read } = readTimeline({ ...empty, weeklyClears: [weekly], seasonClears: [season] })

  await expect(read).resolves.toEqual({
    ...empty,
    weeklyClears: [{ ...weekly, hard: false }],
    seasonClears: [{ ...season, hard: false }]
  })
})

it('cursor를 보내지 않는 API의 응답은 강화, 획득을 더 받을 수 없는 것으로 읽는다', async () => {
  const { enhancementsCursor: _enhancements, acquisitionsCursor: _acquisitions, ...before } = filled

  await expect(readTimeline(before).read).resolves.toEqual({
    ...filled,
    enhancementsCursor: null,
    acquisitionsCursor: null
  })
})

it('강화, 획득 이어 받기는 목록별 경로에 before를 붙여 부르고 받은 행과 다음 cursor를 준다', async () => {
  const pages = [
    { items: filled.acquisitions, nextCursor: 'next-acquisition' },
    { items: filled.enhancements, nextCursor: null }
  ]
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const page of pages) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(page)))
  }
  const { characters } = createDfragonClient({ apiOrigin: API_ORIGIN, fetch })

  await expect(characters.timelineAcquisitions(identity, 'cursor 1')).resolves.toEqual(pages[0])
  await expect(characters.timelineEnhancements(identity, 'cursor-2')).resolves.toEqual(pages[1])
  expect(fetch.mock.calls.map(([request]) => new Request(request).url)).toEqual([
    `${API_ORIGIN}/characters/cain/character-1/timeline/acquisitions?before=cursor+1`,
    `${API_ORIGIN}/characters/cain/character-1/timeline/enhancements?before=cursor-2`
  ])
})

it('이어 받기 응답의 행이 타임라인 형식과 다르면 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(
        JSON.stringify({
          items: [{ ...filled.acquisitions[0], itemRarity: '레전더리' }],
          nextCursor: null
        })
      )
  )
  const { characters } = createDfragonClient({ apiOrigin: API_ORIGIN, fetch })

  await expect(characters.timelineAcquisitions(identity, 'cursor')).rejects.toMatchObject({
    code: 'SEARCH_RESPONSE_INVALID'
  })
})

it.each([
  ['목록이 빠진 응답', { ...empty, acquisitions: undefined }],
  [
    '모르는 클리어 종류',
    { ...empty, seasonClears: [{ kind: 'dungeon', name: '이름', hard: false, count: 1 }] }
  ],
  [
    '에픽, 태초가 아닌 획득',
    { ...empty, acquisitions: [{ ...filled.acquisitions[0], itemRarity: '레전더리' }] }
  ],
  [
    '시각이 아닌 occurredAt',
    { ...empty, weeklyClears: [{ ...filled.weeklyClears[0], occurredAt: '어제' }] }
  ]
])('%s는 SEARCH_RESPONSE_INVALID로 실패한다', async (_name, body) => {
  await expect(readTimeline(body).read).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
})

it('400 INVALID_CHARACTER_QUERY의 error.message를 오류 문구로 준다', async () => {
  const message = 'API가 보낸 잘못된 캐릭터 문구'
  const { read } = readTimeline({ error: { code: 'INVALID_CHARACTER_QUERY', message } }, 400)

  await expect(read).rejects.toMatchObject({ code: 'INVALID_SEARCH_QUERY', message })
})

it('timeline 경로가 없는 API의 404는 SEARCH_RESPONSE_INVALID로 실패한다', async () => {
  const { read } = readTimeline(
    { error: { code: 'NOT_FOUND', message: 'Cannot GET /characters/cain/character-1/timeline' } },
    404
  )

  await expect(read).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
})
