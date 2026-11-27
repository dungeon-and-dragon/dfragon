import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuctionPriceEntry } from '@dfragon/database'
import { AuctionPriceService } from '@dfragon/server-core/application/auction-prices/index.js'
import { createLabCandidatePriceJob } from '../src/application/auction-prices/index.js'

// 경매장 조회, 아이템 검색과 가격 저장은 fake이며, 후보를 고르는 SQL은 @dfragon/database의 테스트가 확인한다.
const targets = [
  { itemName: '거짓의 베리디쿠스 카드', exchanged: false, categories: ['WEAPON'] },
  { itemName: '허망한 맹신, 호스디그 카드', exchanged: false, categories: ['WEAPON'] },
  { itemName: '흑화된 팔티잔 카드', exchanged: false, categories: ['WEAPON'] }
]
const now = new Date('2026-11-28T12:00:00.000Z')

function createPrices(recorded: AuctionPriceEntry[], failingName?: string) {
  return new AuctionPriceService(
    {
      record: async (entry) => {
        recorded.push(entry)
      }
    },
    async (itemName) => {
      if (itemName === failingName) {
        throw new Error('auction lookup failed')
      }

      return { itemId: `${itemName}-id`, itemRarity: '레전더리', unitPrice: 1000 }
    },
    async () => null,
    async () => null,
    () => now
  )
}

test('실험실 후보 가격 job은 후보 이름마다 가격을 저장하고 받은 수와 지운 이력 수를 남긴다', async () => {
  const recorded: AuctionPriceEntry[] = []
  const deletedBefore: Date[] = []
  const job = createLabCandidatePriceJob(
    {
      readPriceTargets: async () => targets,
      deleteHistoryBefore: async (before) => {
        deletedBefore.push(before)

        return 4
      }
    },
    createPrices(recorded),
    () => now
  )

  const summary = await job.run({}, { reportProgress: () => undefined })

  assert.deepEqual(summary, { checked: 3, deleted: 4 })
  assert.deepEqual(
    recorded.map(({ itemName, unitPrice }) => [itemName, unitPrice]),
    targets.map(({ itemName }) => [itemName, 1000])
  )
  assert.deepEqual(deletedBefore, [new Date('2026-06-01T12:00:00.000Z')])
})

test('실험실 후보 가격 job은 두 번째 이름의 조회가 실패하면 첫 이름의 가격만 남기고 실패한다', async () => {
  const recorded: AuctionPriceEntry[] = []
  const deletedBefore: Date[] = []
  const job = createLabCandidatePriceJob(
    {
      readPriceTargets: async () => targets,
      deleteHistoryBefore: async (before) => {
        deletedBefore.push(before)

        return 0
      }
    },
    createPrices(recorded, targets[1].itemName),
    () => now
  )

  await assert.rejects(job.run({}, { reportProgress: () => undefined }), /auction lookup failed/)
  assert.deepEqual(
    recorded.map(({ itemName }) => itemName),
    [targets[0].itemName]
  )
  assert.deepEqual(deletedBefore, [])
})

test('실험실 후보 가격 job은 매시 0분에 돌고 30분 늦으면 지연으로 보며 경매장 API 묶음을 쓴다', () => {
  const job = createLabCandidatePriceJob(
    { readPriceTargets: async () => [], deleteHistoryBefore: async () => 0 },
    { refresh: async () => 0 }
  )

  assert.equal(job.name, 'lab-candidate-price-refresh')
  assert.equal(job.schedule, '0 * * * *')
  assert.equal(job.delayMinutes, 30)
  assert.deepEqual(job.neopleApi, {
    group: '경매장, 아이템 검색',
    endpoints: ['/df/auction', '/df/items']
  })
})
