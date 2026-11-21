import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeopleClientForTest } from '@dfragon/neople'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { FetchLowestListing } from '../src/application/soul-prices/ports.js'
import { SoulPriceService } from '../src/application/soul-prices/service.js'
import { SoulPriceFailure, type SoulPriceFailureKind } from '../src/domain/soul-prices/failure.js'
import { createNeopleLowestListing } from '../src/infrastructure/neople/soul-prices.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'

const CRYSTAL_NAMES = [
  '레어 소울 결정',
  '유니크 소울 결정',
  '레전더리 소울 결정',
  '에픽 소울 결정',
  '태초 소울 결정',
  '광휘의 소울 결정'
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function recordingListing(unitPrice: (itemName: string) => number | null) {
  const calls: string[] = []
  const fetchLowestListing: FetchLowestListing = async (itemName) => {
    calls.push(itemName)
    const price = unitPrice(itemName)

    if (price === null) {
      return null
    }

    return { itemId: 'synthetic-crystal', itemRarity: '레어', unitPrice: price }
  }

  return { calls, fetchLowestListing }
}

test('소울 결정 6종의 최저가와 종말의 계시 교환 개수를 정한 순서로 주고, 매물이 없으면 가격과 itemId를 null로 둔다', async () => {
  const { fetchLowestListing } = recordingListing((itemName) =>
    itemName === '태초 소울 결정' ? null : 1000
  )
  const { crystals } = await new SoulPriceService(fetchLowestListing).get()

  assert.deepEqual(
    crystals.map(({ itemName, revelationCount }) => [itemName, revelationCount]),
    [
      ['레어 소울 결정', 2],
      ['유니크 소울 결정', 4],
      ['레전더리 소울 결정', 30],
      ['에픽 소울 결정', 90],
      ['태초 소울 결정', 1000],
      ['광휘의 소울 결정', 40]
    ]
  )
  assert.deepEqual(
    crystals.map(({ unitPrice }) => unitPrice),
    [1000, 1000, 1000, 1000, null, 1000]
  )
  assert.deepEqual(
    crystals.map(({ itemId }) => itemId),
    [
      'synthetic-crystal',
      'synthetic-crystal',
      'synthetic-crystal',
      'synthetic-crystal',
      null,
      'synthetic-crystal'
    ]
  )
})

test('5분 동안은 다시 조회하지 않고, 지나면 다시 조회한다', async () => {
  let now = 0
  const { calls, fetchLowestListing } = recordingListing(() => 1000)
  const service = new SoulPriceService(fetchLowestListing, () => now)

  await service.get()
  now = 5 * 60 * 1000 - 1
  await service.get()
  assert.equal(calls.length, 6)

  now = 5 * 60 * 1000
  await service.get()
  assert.equal(calls.length, 12)
})

test('한 결정이라도 실패하면 결과 없이 실패하고, 실패는 저장하지 않아 다음 요청이 다시 조회한다', async () => {
  let failing = true
  const { calls, fetchLowestListing } = recordingListing((itemName) => {
    if (failing && itemName === '에픽 소울 결정') {
      throw new SoulPriceFailure('timeout')
    }

    return 1000
  })
  const service = new SoulPriceService(fetchLowestListing, () => 0)

  await assert.rejects(service.get(), (error) => {
    assert(error instanceof SoulPriceFailure)
    assert.equal(error.kind, 'timeout')

    return true
  })
  failing = false
  const callsBeforeRetry = calls.length
  const { crystals } = await service.get()
  assert.equal(crystals.length, 6)
  assert.equal(calls.length - callsBeforeRetry, 6)
})

test('경매장 조회는 이름이 같은 매물 가운데 개당 가격이 가장 낮은 매물을 고르고, 없으면 null을 준다', async () => {
  const requests: Request[] = []
  let rows: unknown[] = []
  const fetchLowestListing = createNeopleLowestListing(
    createNeopleClientForTest('synthetic-auction-key', {
      fetch: async (request) => {
        requests.push(request)

        return jsonResponse({ rows })
      }
    })
  )

  rows = [
    { itemId: 'epic', itemName: '에픽 소울 결정', itemRarity: '에픽', count: 3, unitPrice: 31_000 },
    {
      itemId: 'box',
      itemName: '에픽 소울 결정 상자',
      itemRarity: '에픽',
      count: 1,
      unitPrice: 100
    },
    { itemId: 'epic', itemName: '에픽 소울 결정', itemRarity: '에픽', count: 1, unitPrice: 30_500 }
  ]
  assert.deepEqual(await fetchLowestListing('에픽 소울 결정'), {
    itemId: 'epic',
    itemRarity: '에픽',
    unitPrice: 30_500
  })
  const url = new URL(requests[0]!.url)
  assert.equal(url.pathname, '/df/auction')
  assert.equal(url.searchParams.get('itemName'), '에픽 소울 결정')
  assert.equal(url.searchParams.get('wordType'), 'match')

  rows = []
  assert.equal(await fetchLowestListing('에픽 소울 결정'), null)
})

test('Neople 오류와 잘못된 가격 값을 소울 결정 가격 오류로 바꾼다', async () => {
  const cases: [string, Response, SoulPriceFailureKind][] = [
    ['점검 오류 코드', jsonResponse({ error: { code: 'API002' } }, 503), 'unavailable'],
    ['가격 없음', jsonResponse({ rows: [{ itemId: 'rare', itemName: '레어 소울 결정' }] }), 'api'],
    [
      '문자열 가격',
      jsonResponse({ rows: [{ itemId: 'rare', itemName: '레어 소울 결정', unitPrice: '1000' }] }),
      'api'
    ],
    ['JSON이 아닌 응답', new Response('<html>', { status: 200 }), 'api']
  ]
  for (const [name, response, kind] of cases) {
    const fetchLowestListing = createNeopleLowestListing(
      createNeopleClientForTest('synthetic-auction-key', { fetch: async () => response })
    )
    await assert.rejects(fetchLowestListing('레어 소울 결정'), (error) => {
      assert(error instanceof SoulPriceFailure, name)
      assert.equal(error.kind, kind, name)

      return true
    })
  }
})

test('GET /items/soul-prices는 결정별 가격을, 실패하면 실패 종류별 오류 본문을 준다', async (t) => {
  const unusedProvider = async (): Promise<never> => {
    throw new Error('soul price test must not call character providers')
  }
  let failure: Error | undefined
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: new CatalogService(unusedProvider) },
    todayGrade: { fetchShopGrade: unusedProvider },
    soulPrices: {
      fetchLowestListing: async () => {
        if (failure !== undefined) {
          throw failure
        }

        return { itemId: 'synthetic-crystal', itemRarity: '유니크', unitPrice: 2400 }
      }
    },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  failure = new SoulPriceFailure('unavailable')
  const failed = await fetch(`${origin}/items/soul-prices`)
  assert.equal(failed.status, 503)
  assert.deepEqual(await failed.json(), {
    error: {
      code: 'NEOPLE_UNAVAILABLE',
      message: '현재 소울 결정 가격을 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    }
  })

  failure = undefined
  const response = await fetch(`${origin}/items/soul-prices`)
  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    crystals: { itemName: string; itemRarity: string; unitPrice: number }[]
  }
  assert.deepEqual(
    body.crystals.map(({ itemName }) => itemName),
    CRYSTAL_NAMES
  )
  assert.deepEqual(body.crystals[0], {
    itemId: 'synthetic-crystal',
    itemName: '레어 소울 결정',
    itemRarity: '유니크',
    unitPrice: 2400,
    revelationCount: 2
  })
})
