import {
  STORY_BUFF_CARD_ITEM_ID,
  STORY_CARD_ITEM_ID
} from '#widgets/item-tooltip/api/item-detail.fixture'
import type { LabItemsResponse } from './useLabItems'

const CHECKED_AT = '2026-11-26T05:30:00.000Z'

export const LAB_CURRENCY_ICON_PATH = '/lab/currencies/1/icon?v=1764135000000'

export const LAB_ITEM_ICON_PATH = `/lab/item-icon?${new URLSearchParams({ itemName: '합성 무기 보주', v: '1764135000000' })}`

// 카드 이름은 지금은 지운 마법부여 등급표에 있던 이름, 칭호, 크리쳐, 오라 이름은 부위별 아이템 id 파일에 있는 이름이고, 칭호, 크리쳐, 오라의 itemId와 레어리티는 그 파일 그대로다.
// 카드의 itemId는 그 파일에 없어 바칼 카드만 Neople 응답에서 받은 itemId를 쓰고 나머지는 null로 두며, 가격과 명성은 합성 값이다. 보주와 재화의 이름, 설명, 보주의 tooltip 값은 지어낸 값이다.
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
            fame: 210,
            itemId: STORY_CARD_ITEM_ID,
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            unitPrice: 1_480_000_000,
            checkedAt: CHECKED_AT,
            cost: null
          }
        ]
      },
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '준종결',
        items: [
          {
            itemName: '합성 무기 보주',
            fame: 232,
            itemId: null,
            itemRarity: '유니크',
            iconPath: LAB_ITEM_ICON_PATH,
            description: '합성 교환소에서 받는 무기 보주.\n원하는 속성 하나를 고를 수 있다.',
            unitPrice: null,
            checkedAt: CHECKED_AT,
            cost: {
              currencyName: '합성 교환 주화',
              description:
                '합성 교환소에서 장비 보주와 바꿀 수 있는 주화.\n한 번에 여러 개를 쓸 수 있다.',
              count: 5,
              iconPath: LAB_CURRENCY_ICON_PATH
            },
            tooltip: {
              typeDetail: '합성 재료',
              availableLevel: 115,
              fame: 232,
              card: {
                slots: ['무기'],
                enchants: [
                  {
                    upgrade: 0,
                    status: [
                      { name: '모든 속성 강화', value: '13' },
                      { name: '힘', value: '90' }
                    ],
                    reinforceSkill: []
                  },
                  {
                    upgrade: 1,
                    status: [
                      { name: '모든 속성 강화', value: '14' },
                      { name: '힘', value: '90' }
                    ],
                    reinforceSkill: []
                  },
                  {
                    upgrade: 2,
                    status: [
                      { name: '모든 속성 강화', value: '15' },
                      { name: '힘', value: '100' }
                    ],
                    reinforceSkill: []
                  }
                ]
              }
            }
          },
          {
            itemName: '허망한 맹신, 호스디그 카드',
            fame: 210,
            itemId: null,
            itemRarity: '유니크',
            iconPath: null,
            description: null,
            unitPrice: null,
            checkedAt: CHECKED_AT,
            cost: null
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
            fame: 210,
            itemId: null,
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            unitPrice: 612_000_000,
            checkedAt: CHECKED_AT,
            cost: null
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
            fame: 196,
            itemId: null,
            itemRarity: '유니크',
            iconPath: null,
            description: null,
            unitPrice: 88_000_000,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '혼돈의 천사 루치펠 카드',
            fame: null,
            itemId: null,
            itemRarity: null,
            iconPath: null,
            description: null,
            unitPrice: null,
            checkedAt: null,
            cost: null
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
            fame: 232,
            itemId: null,
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            unitPrice: 268_000_000,
            checkedAt: CHECKED_AT,
            cost: null
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
            fame: 221,
            itemId: null,
            itemRarity: '유니크',
            iconPath: null,
            description: null,
            unitPrice: 41_500_000,
            checkedAt: CHECKED_AT,
            cost: null
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
            fame: 232,
            itemId: null,
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            unitPrice: 233_000_000,
            checkedAt: CHECKED_AT,
            cost: null
          }
        ]
      },
      {
        category: 'JACKET',
        role: 'buffer',
        tier: '준종결',
        items: [
          {
            itemName: '합성 여신 카드',
            fame: 240,
            itemId: STORY_BUFF_CARD_ITEM_ID,
            itemRarity: '레전더리',
            iconPath: null,
            description: null,
            unitPrice: 51_000_000,
            checkedAt: CHECKED_AT,
            cost: null
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
            iconPath: null,
            description: null,
            unitPrice: 95_000_000,
            checkedAt: CHECKED_AT,
            cost: null
          },
          {
            itemName: '진정한 각성을 이룬 자',
            itemId: 'c89a01593a155a3cbaaf272084d8fb57',
            itemRarity: '레어',
            iconPath: null,
            description: null,
            unitPrice: 120_000_000,
            checkedAt: CHECKED_AT,
            cost: null
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
            iconPath: null,
            description: null,
            unitPrice: 54_000_000,
            checkedAt: CHECKED_AT,
            cost: null
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
            iconPath: null,
            description: null,
            unitPrice: null,
            checkedAt: CHECKED_AT,
            cost: null
          }
        ]
      }
    ]
  } satisfies LabItemsResponse
}
