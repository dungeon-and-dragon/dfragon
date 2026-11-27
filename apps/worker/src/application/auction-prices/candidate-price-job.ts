import type { AuctionPriceService } from '@dfragon/server-core/application/auction-prices/index.js'
import { subHours } from 'date-fns'
import { z } from 'zod'
import { defineJob, NEOPLE_APIS } from '#application/jobs/index.js'
import type { LabCandidatePriceRepository } from './candidate-repository.js'

const HISTORY_RETENTION_DAYS = 180

export function createLabCandidatePriceJob(
  repository: LabCandidatePriceRepository,
  prices: Pick<AuctionPriceService, 'refresh'>,
  now: () => Date = () => new Date()
) {
  return defineJob({
    name: 'lab-candidate-price-refresh',
    displayName: '실험실 후보 경매장 가격 받기',
    description:
      '실험실에 아직 고르지 않은 후보 이름마다 1시간마다 경매장에서 최저가를 받아 저장하고, 180일이 지난 가격 이력을 지웁니다. 조회가 실패하면 이미 저장한 가격은 그대로 둡니다.',
    schedule: '0 * * * *',
    argsSchema: z.object({}),
    delayMinutes: 30,
    neopleApi: NEOPLE_APIS.auction,
    run: async (_args, { reportProgress }) => {
      const targets = await repository.readPriceTargets()
      const checked = await prices.refresh(targets, reportProgress)
      const historyCutoff = subHours(now(), HISTORY_RETENTION_DAYS * 24)
      const deleted = await repository.deleteHistoryBefore(historyCutoff)

      return { checked, deleted }
    }
  })
}
