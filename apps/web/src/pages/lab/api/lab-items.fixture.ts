import type { LabItems } from './useLabItems'

const CHECKED_AT = '2026-11-26T05:30:00.000Z'

// 이름은 마법부여 등급표와 부위별 아이템 id 파일에 있는 이름이고, 칭호, 크리쳐, 오라의 itemId와 레어리티는 그 파일 그대로다.
// 카드의 itemId는 그 파일에 없어 null로 두고, 가격은 합성 값이다.
export const labItemsFixture = {
  items: {
    groups: [
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '종결',
        items: [
          {
            itemName: '멸절의 폭룡왕 바칼 카드',
            itemId: null,
            itemRarity: '레전더리',
            unitPrice: 1_480_000_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '준종결',
        items: [
          {
            itemName: '허망한 맹신, 호스디그 카드',
            itemId: null,
            itemRarity: '유니크',
            unitPrice: null,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'WEAPON',
        role: 'buffer',
        tier: '종결',
        items: [
          {
            itemName: '뒤쫓는 자 제논 카드',
            itemId: null,
            itemRarity: '레전더리',
            unitPrice: 612_000_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'WEAPON',
        role: 'buffer',
        tier: '준종결',
        items: [
          {
            itemName: '대천사 미카엘 카드',
            itemId: null,
            itemRarity: '유니크',
            unitPrice: 88_000_000,
            checkedAt: CHECKED_AT
          },
          {
            itemName: '혼돈의 천사 루치펠 카드',
            itemId: null,
            itemRarity: null,
            unitPrice: null,
            checkedAt: null
          }
        ]
      },
      {
        category: 'JACKET',
        role: 'dealer',
        tier: '종결',
        items: [
          {
            itemName: '천해천 딜러 상의 카드 (최종 데미지 3%)',
            itemId: null,
            itemRarity: '레전더리',
            unitPrice: 268_000_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'JACKET',
        role: 'dealer',
        tier: '준종결',
        items: [
          {
            itemName: '중천 딜러 상의 카드 (최종 데미지 2%)',
            itemId: null,
            itemRarity: '유니크',
            unitPrice: 41_500_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'JACKET',
        role: 'buffer',
        tier: '종결',
        items: [
          {
            itemName: '천해천 버퍼 상의 카드 (힘, 지능, 체력, 정신력 +210)',
            itemId: null,
            itemRarity: '레전더리',
            unitPrice: 233_000_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'TITLE',
        role: 'all',
        tier: '종결',
        items: [
          {
            itemName: '프로스트의 전설',
            itemId: '42fd3d4144f788b37ed19c70281dcda6',
            itemRarity: '레어',
            unitPrice: 95_000_000,
            checkedAt: CHECKED_AT
          },
          {
            itemName: '진정한 각성을 이룬 자',
            itemId: 'c89a01593a155a3cbaaf272084d8fb57',
            itemRarity: '레어',
            unitPrice: 120_000_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'CREATURE',
        role: 'all',
        tier: '종결',
        items: [
          {
            itemName: '운명을 담는 재단사',
            itemId: 'bf04e5b415fea3989e8607efb4987d14',
            itemRarity: '레어',
            unitPrice: 54_000_000,
            checkedAt: CHECKED_AT
          }
        ]
      },
      {
        category: 'AURA',
        role: 'all',
        tier: '종결',
        items: [
          {
            itemName: '초월한 폭풍의 기세',
            itemId: '6997321d175648e99eb75adf5c8e2625',
            itemRarity: '레어',
            unitPrice: null,
            checkedAt: CHECKED_AT
          }
        ]
      }
    ]
  } satisfies LabItems
}
