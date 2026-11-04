import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { TimelineFailure } from '../src/characters/timeline/errors.js'
import { createNeopleCharacterTimelineForTest } from '../src/characters/timeline/neople.js'
import { splitTimelineRanges } from '../src/characters/timeline/ranges.js'

const identity = { serverId: 'siroco', characterId: 'fixture-character' }
const range = {
  start: new Date('2025-01-09T06:00:00+09:00'),
  end: new Date('2025-04-08T05:59:00+09:00')
}

// API 문서의 코드 표와 컬럼 정보로 만든 합성 응답이며 실제 캐릭터, API key와 관계없다.
function timelinePages(): unknown[] {
  const url = new URL('../../test/fixtures/neople-timeline-pages.json', import.meta.url)

  return JSON.parse(readFileSync(url, 'utf8')) as unknown[]
}

const seoulDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })

function seoulDayNumber(date: Date): number {
  return Date.parse(`${seoulDate.format(date)}T00:00:00Z`) / 86_400_000
}

test('next를 따라 모든 페이지를 모으고 다음 페이지 요청에는 next만 보낸다', async () => {
  const pages = timelinePages()
  const requests: URL[] = []
  const adapter = createNeopleCharacterTimelineForTest('fake-key', {
    fetch: async (request) => {
      assert.equal(request.headers.get('apikey'), 'fake-key')
      requests.push(new URL(request.url))

      return Response.json(pages[requests.length - 1])
    }
  })

  const { events, items } = await adapter(identity, range)

  assert.equal(requests.length, 2)
  const [first, second] = requests
  assert.equal(first!.pathname, '/df/servers/siroco/characters/fixture-character/timeline')
  assert.equal(first!.searchParams.get('limit'), '100')
  assert.equal(first!.searchParams.get('startDate'), '20250109T0600')
  assert.equal(first!.searchParams.get('endDate'), '20250408T0559')
  const codes = first!.searchParams.get('code')!.split(',').map(Number)
  assert.equal(new Set(codes).size, 54)
  for (const code of [101, 105, 210, 301, 401, 407, 521, 550, 557, 602]) {
    assert(codes.includes(code), `${code}`)
  }
  assert.deepEqual([...second!.searchParams.keys()], ['next'])
  assert.equal(second!.searchParams.get('next'), 'fixture-next-page')

  assert.deepEqual(
    events.map(({ code, occurredAt, raidName }) => ({ code, occurredAt, raidName })),
    [
      { code: 201, occurredAt: new Date('2025-01-09T12:15:00Z'), raidName: '테스트 레이드' },
      { code: 104, occurredAt: new Date('2025-01-08T21:00:00Z'), raidName: null },
      { code: 301, occurredAt: new Date('2025-01-08T21:00:00Z'), raidName: null },
      { code: 101, occurredAt: new Date('2025-01-08T21:00:00Z'), raidName: null }
    ]
  )
  assert.deepEqual(events[1]!.data, { level: 115 })
  assert.deepEqual(events[3]!.data, {})
  assert.deepEqual(
    items.map(({ code, occurredAt, itemId, itemRarity }) => ({
      code,
      occurredAt,
      itemId,
      itemRarity
    })),
    [
      {
        code: 505,
        occurredAt: new Date('2025-01-09T15:30:00Z'),
        itemId: 'fixture-item-epic',
        itemRarity: '에픽'
      },
      {
        code: 504,
        occurredAt: new Date('2025-01-09T14:59:00Z'),
        itemId: 'fixture-item-box',
        itemRarity: '레전더리'
      },
      {
        code: 504,
        occurredAt: new Date('2025-01-09T14:59:00Z'),
        itemId: 'fixture-item-box',
        itemRarity: '레전더리'
      },
      {
        code: 401,
        occurredAt: new Date('2025-01-08T22:05:00Z'),
        itemId: 'fixture-item-reinforce',
        itemRarity: null
      }
    ]
  )
  assert.equal(items[3]!.itemName, '테스트 강화 아이템')
  assert.equal(items[0]!.data.dungeonName, '테스트 던전')
})

test('공급자 오류와 잘못된 응답은 기존 Neople 분류로 바꾸고 원문을 남기지 않는다', async () => {
  const validRow = { code: 101, name: '캐릭터 생성', date: '2025-01-09 06:00', data: {} }
  for (const [status, body, kind] of [
    [503, { error: { code: 'API901', message: 'sensitive upstream detail' } }, 'api'],
    [401, { error: { code: 'API003' } }, 'internal'],
    [400, { error: { code: 'API002' } }, 'unavailable'],
    [429, { error: { code: 'FUTURE' } }, 'unavailable'],
    [503, 'invalid JSON', 'unavailable'],
    [200, 'invalid JSON', 'api'],
    [200, {}, 'api'],
    [200, { timeline: { rows: [validRow], next: 1 } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, date: '20250109T0600' }], next: null } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, date: '2025-02-30 06:00' }], next: null } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, date: '2025-01-09 25:00' }], next: null } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, data: [] }], next: null } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, code: 99 }], next: null } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, code: 408 }], next: null } }, 'api'],
    [200, { timeline: { rows: [{ ...validRow, code: 701 }], next: null } }, 'api']
  ] as const) {
    let calls = 0
    const adapter = createNeopleCharacterTimelineForTest('fake-key', {
      fetch: async () => {
        calls++

        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
      }
    })
    await assert.rejects(adapter(identity, range), (error: unknown) => {
      assert(error instanceof TimelineFailure)
      assert.equal(error.kind, kind, `${status} ${JSON.stringify(body)}`)
      assert.equal(error.message.includes('sensitive'), false)
      assert.equal(JSON.stringify(error).includes('sensitive'), false)
      assert.equal(JSON.stringify(error.sanitizedCause ?? []).includes('sensitive'), false)

      return true
    })
    assert.equal(calls, 1)
  }
})

test('연결 오류는 재시도하지 않고 원문 없이 공급자 오류로 반환한다', async () => {
  let calls = 0
  const adapter = createNeopleCharacterTimelineForTest('fake-key', {
    fetch: async () => {
      calls++
      // undici가 연결 실패에 쓰는 오류와 같은 이름, 문구다.
      throw new TypeError('fetch failed', { cause: new Error('sensitive socket detail') })
    }
  })
  await assert.rejects(adapter(identity, range), (error: unknown) => {
    assert(error instanceof TimelineFailure)
    assert.equal(error.kind, 'api')
    assert(error.sanitizedCause)
    assert.equal(JSON.stringify(error.sanitizedCause).includes('sensitive'), false)
    assert.equal(JSON.stringify(error).includes('sensitive'), false)

    return true
  })
  assert.equal(calls, 1)
})

test('2025-01-09 06:00부터 지금까지를 빈틈없이 90일 이하 구간으로 나눈다', () => {
  const start = new Date('2025-01-09T06:00:00+09:00')
  const now = new Date('2026-11-04T21:34:56.789+09:00')
  const ranges = splitTimelineRanges(start, now)

  assert.deepEqual(ranges[0]!.start, start)
  assert.deepEqual(ranges.at(-1)!.end, new Date('2026-11-04T21:34:00+09:00'))
  for (const [index, { start: from, end: to }] of ranges.entries()) {
    assert(from <= to, `${index}`)
    assert(seoulDayNumber(to) - seoulDayNumber(from) + 1 <= 90, `${index}`)
    const previous = ranges[index - 1]
    if (previous) {
      assert.equal(from.getTime() - previous.end.getTime(), 60_000, `${index}`)
    }
  }
  assert.deepEqual(ranges[0]!.end, range.end)
  assert.equal(ranges.length, 8)
})

test('시작이 끝보다 늦으면 구간이 없고 같은 분이면 한 분짜리 구간 하나다', () => {
  const minute = new Date('2025-01-09T06:00:30+09:00')
  assert.deepEqual(splitTimelineRanges(new Date('2025-01-09T06:01:00+09:00'), minute), [])
  assert.deepEqual(splitTimelineRanges(minute, minute), [
    { start: new Date('2025-01-09T06:00:00+09:00'), end: new Date('2025-01-09T06:00:00+09:00') }
  ])
})
