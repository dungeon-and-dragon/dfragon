import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { eventRewardsSchema } from './event-rewards'

const DATA_FILE = new URL('../../../public/data/event-rewards.v1.json', import.meta.url)

// 이벤트와 아이템 이름은 합성 값이다.
const shopRecord = {
  via: 'shop',
  gives: {
    name: '합성 선택 상자',
    itemId: null,
    quantity: 1,
    tags: ['equipment'],
    binding: 'account',
    expiresAt: '2026-12-31',
    contents: [
      {
        mode: 'all',
        items: [{ name: '합성 재료', itemId: null, quantity: 20, tags: ['material'] }]
      },
      {
        mode: 'chooseOne',
        items: [{ name: '합성 보주', itemId: null, quantity: 1, tags: ['enchant'] }]
      }
    ]
  },
  costs: [{ name: '합성 코인', amount: 2500 }],
  condition: null,
  limit: { count: 1, scope: 'account', per: 'week' },
  evidence: 'table'
}

function rewardsOf(record: unknown): unknown {
  return {
    version: 1,
    readAt: '2026-11-18',
    events: [
      {
        id: 'sample',
        title: '합성 이벤트',
        url: 'https://example.test/pg/sample',
        period: { start: '2026-11-12', end: null },
        sourceHash: '0123456789abcdef',
        acquisitions: [record]
      }
    ]
  }
}

function readData(): unknown {
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
}

describe('이벤트 보상 schema', () => {
  it('가격, 구매 제한, 구성품 묶음이 둘인 상점 물품을 받는다', () => {
    const result = eventRewardsSchema.safeParse(rewardsOf(shopRecord))

    expect(result.error?.issues ?? []).toEqual([])
  })

  it('정의에 없는 필드가 붙은 레코드는 거절한다', () => {
    const result = eventRewardsSchema.safeParse(rewardsOf({ ...shopRecord, price: 2500 }))

    expect(result.error?.issues.map((issue) => issue.code)).toEqual(['unrecognized_keys'])
  })

  it('목록에 없는 tag는 거절한다', () => {
    const gives = { ...shopRecord.gives, tags: ['enchantment'] }
    const result = eventRewardsSchema.safeParse(rewardsOf({ ...shopRecord, gives }))

    expect(result.error?.issues.map((issue) => issue.path.at(-2))).toEqual(['tags'])
  })
})

// 데이터 파일은 이벤트 보상을 갱신하는 PR이 처음 더한다.
describe.skipIf(!existsSync(DATA_FILE))('이벤트 보상 데이터 파일', () => {
  it('커밋된 파일이 schema를 통과한다', () => {
    const result = eventRewardsSchema.safeParse(readData())

    expect(result.error?.issues ?? []).toEqual([])
  })

  it('이벤트 id가 겹치지 않는다', () => {
    const ids = eventRewardsSchema.parse(readData()).events.map((event) => event.id)

    expect(ids).toEqual([...new Set(ids)])
  })

  it('가격은 상점 물품에만 있다', () => {
    const pricedOutsideShop = eventRewardsSchema
      .parse(readData())
      .events.flatMap((event) => event.acquisitions)
      .filter((acquisition) => acquisition.via !== 'shop' && acquisition.costs.length > 0)

    expect(pricedOutsideShop).toEqual([])
  })
})
