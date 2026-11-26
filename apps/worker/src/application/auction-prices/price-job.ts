import type { AuctionPriceService } from '@dfragon/server-core/application/auction-prices/index.js'
import { z } from 'zod'
import { defineJob, NEOPLE_APIS } from '#application/jobs/index.js'
import type { LabItemRepository } from './repository.js'

// 고른 아이템 이름은 많아야 수백 개라 이름마다 한 번 불러도 다음 실행 전에 끝난다.
const DELAY_MINUTES = 10

export function createAuctionPriceJob(
  repository: LabItemRepository,
  prices: Pick<AuctionPriceService, 'refresh'>
) {
  return defineJob({
    name: 'auction-price-refresh',
    displayName: '실험실 경매장 가격 받기',
    description:
      '실험실에 보일 아이템 이름마다 10분마다 경매장에서 이름이 정확히 같은 매물의 최저가를 받아 저장합니다. 매물이 없거나 재화로 교환하는 아이템이면 가격을 비우고 아이템 검색으로 찾은 아이콘만 저장하며, 조회가 실패하면 이미 저장한 가격은 그대로 둡니다.',
    schedule: '*/10 * * * *',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    neopleApi: NEOPLE_APIS.auction,
    run: async (_args, { reportProgress }) => {
      const targets = await repository.readPriceTargets()
      const checked = await prices.refresh(targets, reportProgress)

      return { checked }
    }
  })
}
