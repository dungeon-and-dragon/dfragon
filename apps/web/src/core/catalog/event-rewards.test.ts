import { describe, expect, it } from 'vitest'
import data from '../../../public/data/event-rewards.v1.json'
import { eventRewardsSchema } from './event-rewards'

describe('이벤트 보상 데이터 파일', () => {
  it('커밋된 파일이 schema를 통과한다', () => {
    expect(eventRewardsSchema.safeParse(data).error?.issues ?? []).toEqual([])
  })

  it('이벤트 id가 겹치지 않는다', () => {
    const ids = eventRewardsSchema.parse(data).events.map((event) => event.id)

    expect(ids).toEqual([...new Set(ids)])
  })

  it('가격은 상점 물품에만 있다', () => {
    const pricedOutsideShop = eventRewardsSchema
      .parse(data)
      .events.flatMap((event) => event.acquisitions)
      .filter((acquisition) => acquisition.via !== 'shop' && acquisition.costs.length > 0)

    expect(pricedOutsideShop).toEqual([])
  })
})
