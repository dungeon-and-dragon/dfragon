import assert from 'node:assert/strict'
import test from 'node:test'
import { AuctionPriceService } from '@dfragon/server-core/application/auction-prices/index.js'
import { createAuctionPriceJob } from '../src/application/auction-prices/index.js'
import { NEOPLE_APIS } from '../src/application/jobs/index.js'

// 이름은 저장소의 마법부여 등급표에 있는 카드 이름이다. 경매장 조회와 가격 저장은 fake이며, 고르는 규칙은 server-core,
// 저장 SQL은 @dfragon/database의 테스트가 확인한다.
const itemNames = ['거짓의 베리디쿠스 카드', '허망한 맹신, 호스디그 카드']

test('경매장 가격 job은 실험실 아이템 이름마다 가격을 저장하고 받은 이름 수를 남긴다', async () => {
  const recorded: string[] = []
  const job = createAuctionPriceJob(
    { readItemNames: async () => itemNames },
    new AuctionPriceService(
      {
        record: async ({ itemName }) => {
          recorded.push(itemName)
        }
      },
      async () => null
    )
  )
  const progress: [number, number | undefined][] = []

  const summary = await job.run(
    {},
    { reportProgress: (done, total) => progress.push([done, total]) }
  )

  assert.deepEqual(summary, { checked: 2 })
  assert.deepEqual(recorded, itemNames)
  assert.deepEqual(progress.at(-1), [2, 2])
})

test('경매장 가격 job은 10분마다 돌고 경매장 API를 쓴다고 알린다', () => {
  const job = createAuctionPriceJob({ readItemNames: async () => [] }, { refresh: async () => 0 })

  assert.equal(job.schedule, '*/10 * * * *')
  assert.deepEqual(job.neopleApi, NEOPLE_APIS.auction)
})
