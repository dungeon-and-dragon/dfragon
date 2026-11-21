import type { SoulPrice } from './useSoulPrices'

// itemId와 레어리티는 2026-11-21 운영 API 응답 그대로이고, 가격은 합성 값이다.
export const soulPricesFixture = {
  crystals: [
    {
      itemId: 'c4816db14d145416921f0210063cb014',
      itemName: '레어 소울 결정',
      itemRarity: '레어',
      unitPrice: 1_250,
      revelationCount: 2
    },
    {
      itemId: '0620c107b1aae1f3a6cf9eee3aaf43d7',
      itemName: '유니크 소울 결정',
      itemRarity: '유니크',
      unitPrice: 3_000,
      revelationCount: 4
    },
    {
      itemId: 'c6947ff630cc59aebdcbabfb449258d1',
      itemName: '레전더리 소울 결정',
      itemRarity: '레전더리',
      unitPrice: 41_000,
      revelationCount: 30
    },
    {
      itemId: 'c7d845c65ab9dbcff6e55dc910fbea87',
      itemName: '에픽 소울 결정',
      itemRarity: '에픽',
      unitPrice: 140_000,
      revelationCount: 90
    },
    {
      itemId: 'd288ebf406a65f4ec23d1f9c33227888',
      itemName: '태초 소울 결정',
      itemRarity: '태초',
      unitPrice: 2_000_000,
      revelationCount: 1000
    },
    {
      itemId: '27a5877768a40a3a0eccc493d0a53b9b',
      itemName: '광휘의 소울 결정',
      itemRarity: '레전더리',
      unitPrice: 52_000,
      revelationCount: 40
    }
  ] satisfies SoulPrice[],
  failureMessage: '소울 결정 가격 조회 중 오류가 발생했습니다.'
}
