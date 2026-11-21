import type { SoulPrice } from './useSoulPrices'

// 합성 가격이다. 실제 경매장 시세가 아니다.
export const soulPricesFixture = {
  crystals: [
    {
      itemId: 'synthetic-rare-crystal',
      itemName: '레어 소울 결정',
      itemRarity: '레어',
      unitPrice: 1_250,
      revelationCount: 2
    },
    {
      itemId: 'synthetic-unique-crystal',
      itemName: '유니크 소울 결정',
      itemRarity: '유니크',
      unitPrice: 3_000,
      revelationCount: 4
    },
    {
      itemId: 'synthetic-legendary-crystal',
      itemName: '레전더리 소울 결정',
      itemRarity: '레전더리',
      unitPrice: 41_000,
      revelationCount: 30
    },
    {
      itemId: 'synthetic-epic-crystal',
      itemName: '에픽 소울 결정',
      itemRarity: '에픽',
      unitPrice: 140_000,
      revelationCount: 90
    },
    {
      itemId: null,
      itemName: '태초 소울 결정',
      itemRarity: null,
      unitPrice: null,
      revelationCount: 1000
    },
    {
      itemId: 'synthetic-radiant-crystal',
      itemName: '광휘의 소울 결정',
      itemRarity: '에픽',
      unitPrice: 52_000,
      revelationCount: 40
    }
  ] satisfies SoulPrice[],
  failureMessage: '소울 결정 가격 조회 중 오류가 발생했습니다.'
}
