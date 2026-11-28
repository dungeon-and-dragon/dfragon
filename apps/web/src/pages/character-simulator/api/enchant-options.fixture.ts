import { STORY_CARD_ITEM_ID } from '#widgets/item-tooltip/api/item-detail.fixture'
import { type EnchantOptionsResponse, enchantOptionsSchema } from './useEnchantOptions'

type Slot = EnchantOptionsResponse['slots'][number]
type Card = Slot['tiers'][number]['options'][number]['cards'][number]
type SlotItemGroup = EnchantOptionsResponse['slotItems'][number]
type SlotItemCard = SlotItemGroup['tiers'][number]['options'][number]['cards'][number]

export const ENCHANT_CARD_ICON_PATH = `/lab/item-icon?${new URLSearchParams({ itemName: '합성 하의 보주', v: '1764135000000' })}`
export const ENCHANT_CURRENCY_ICON_PATH = '/lab/currencies/1/icon?v=1764135000000'

// 카드 이름, 가격, 재화는 지어낸 값이고, 옵션은 장비 시뮬레이터 화면 fixture 캐릭터의 착용 마법부여에 맞춘 합성 값이다.
function card(itemName: string, unitPrice: number | null, overrides: Partial<Card> = {}): Card {
  return {
    itemName,
    itemId: STORY_CARD_ITEM_ID,
    itemRarity: '레전더리',
    iconPath: null,
    unitPrice,
    cost: null,
    ...overrides
  }
}

// 소유자가 넣은 보주는 Neople 아이템 id가 없고 올린 아이콘과 재화 값이 있다.
function orb(itemName: string, count: number): Card {
  return card(itemName, null, {
    itemId: null,
    itemRarity: '유니크',
    iconPath: ENCHANT_CARD_ICON_PATH,
    cost: {
      currencyName: '합성 교환 주화',
      description: null,
      count,
      iconPath: ENCHANT_CURRENCY_ICON_PATH
    }
  })
}

const ATTACK_110 = { name: '공격력', value: 110 }
const ALL_STATS_90 = { name: '올스탯', value: 90 }

export const DEALER_PANTS_FINAL = 'lab:PANTS:dealer:final'
export const DEALER_PANTS_WORN = 'lab:PANTS:dealer:worn'
export const DEALER_PANTS_BARRACKS = 'lab:PANTS:dealer:barracks'
export const DEALER_PANTS_ORB = 'lab:PANTS:dealer:orb'
export const DEALER_JACKET_FINAL = 'lab:JACKET:dealer:final'
export const DEALER_AMULET_FINAL = 'lab:AMULET:dealer:final'
export const DEALER_EARRING_FINAL = 'lab:EARRING:dealer:final'
export const BUFFER_JACKET_FINAL = 'lab:JACKET:buffer:final'

const slots: Slot[] = [
  {
    slotId: 'PANTS',
    role: 'dealer',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: DEALER_PANTS_FINAL,
            display: [ATTACK_110, ALL_STATS_90, { name: '최종 데미지 증가', value: '3%' }],
            skillLevel: null,
            cards: [card('합성 하의 카드', 26_498_500), card('합성 비싼 하의 카드', 30_000_000)]
          }
        ]
      },
      {
        tier: '준종결',
        options: [
          {
            id: DEALER_PANTS_WORN,
            display: [{ name: '최종 데미지 증가', value: '1%' }, ATTACK_110, ALL_STATS_90],
            skillLevel: null,
            cards: [card('합성 준종결 하의 카드', 3_300_000, { itemRarity: '유니크' })]
          }
        ]
      },
      {
        tier: '배럭',
        options: [
          {
            id: DEALER_PANTS_BARRACKS,
            display: [ATTACK_110, { name: '올스탯', value: 80 }],
            skillLevel: null,
            cards: [
              card('합성 배럭 하의 카드', 48_888),
              orb('합성 하의 보주', 240),
              orb('합성 남는 하의 보주', 300)
            ]
          },
          {
            id: DEALER_PANTS_ORB,
            display: [ATTACK_110, { name: '올스탯', value: 70 }],
            skillLevel: null,
            cards: [orb('합성 교환 하의 보주', 120)]
          }
        ]
      }
    ]
  },
  {
    slotId: 'JACKET',
    role: 'dealer',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: DEALER_JACKET_FINAL,
            display: [ATTACK_110, ALL_STATS_90, { name: '최종 데미지 증가', value: '3%' }],
            skillLevel: null,
            cards: [card('합성 상의 카드', 21_000_000)]
          }
        ]
      }
    ]
  },
  {
    slotId: 'AMULET',
    role: 'dealer',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: DEALER_AMULET_FINAL,
            display: [
              { name: '모든 속성 강화', value: 35 },
              { name: '최종 데미지 증가', value: '2%' }
            ],
            skillLevel: null,
            cards: [card('합성 목걸이 카드', null)]
          }
        ]
      }
    ]
  },
  {
    slotId: 'EARRING',
    role: 'dealer',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: DEALER_EARRING_FINAL,
            display: [
              { name: '모든 속성 강화', value: 25 },
              { name: '올스탯', value: 100 }
            ],
            skillLevel: null,
            cards: [card('합성 귀걸이 카드', 5_500_000)]
          }
        ]
      }
    ]
  },
  {
    slotId: 'JACKET',
    role: 'buffer',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: BUFFER_JACKET_FINAL,
            display: [{ name: '올스탯', value: 125 }],
            skillLevel: 4,
            cards: [card('합성 버퍼 상의 카드', 12_000_000)]
          }
        ]
      }
    ]
  }
]

// 이름과 Neople id는 운영 실험실 목록에서, 가격은 지어낸 값이다. 장비 시뮬레이터 화면 fixture 딜러가 착용한 칭호, 크리쳐, 오라는 종결 플래티넘 칭호, 종결 크리쳐, 준종결 오라 선택지에 든다.
function slotItemCard(
  itemName: string,
  itemId: string | null,
  unitPrice: number | null,
  gameItemName = itemName
): SlotItemCard {
  return {
    itemName,
    gameItemName,
    itemId,
    itemRarity: '레어',
    iconPath: null,
    unitPrice,
    cost: null
  }
}

export const TITLE_FINAL_PLATINUM = 'lab:title:final-platinum'
export const TITLE_FINAL = 'lab:title:final'
export const TITLE_SEMI = 'lab:title:semi'
export const TITLE_BARRACKS = 'lab:title:barracks'
export const CREATURE_FINAL = 'lab:creature:final'
export const CREATURE_SEMI = 'lab:creature:semi'
export const AURA_FINAL = 'lab:aura:final'
export const AURA_SEMI = 'lab:aura:semi'

const slotItems: SlotItemGroup[] = [
  {
    category: 'title',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: TITLE_FINAL_PLATINUM,
            cards: [
              slotItemCard(
                '프로스트의 전설 플래티넘',
                '53ebb215d0249e099ed0cd456e7ff2e4',
                27_999_999,
                '프로스트의 전설 플래티넘[45Lv]'
              ),
              slotItemCard(
                '군자의 사계 플래티넘',
                '381f087017173f2184925ecc09b8eaf6',
                33_333_333,
                '군자의 사계 플래티넘[70Lv]'
              )
            ]
          },
          {
            id: TITLE_FINAL,
            cards: [
              slotItemCard('군자의 사계', 'efef96c0ebc3ace0a7aed5bb82b4ff67', 26_970_000),
              slotItemCard('프로스트의 전설', '42fd3d4144f788b37ed19c70281dcda6', 27_111_111)
            ]
          }
        ]
      },
      {
        tier: '준종결',
        options: [
          {
            id: TITLE_SEMI,
            cards: [slotItemCard('진정한 각성을 이룬 자', 'c89a01593a155a3cbaaf272084d8fb57', null)]
          }
        ]
      },
      {
        tier: '배럭',
        options: [
          {
            id: TITLE_BARRACKS,
            cards: [
              slotItemCard(
                '세리아의 풍성한 선물 Ver.2',
                '29f088750881775babb636fdfda1d705',
                7_498_000
              )
            ]
          }
        ]
      }
    ]
  },
  {
    category: 'creature',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: CREATURE_FINAL,
            cards: [
              slotItemCard(
                '운명을 담는 재단사 알',
                'bf04e5b415fea3989e8607efb4987d14',
                26_699_999,
                '운명을 담는 재단사'
              )
            ]
          }
        ]
      },
      {
        tier: '준종결',
        options: [
          {
            id: CREATURE_SEMI,
            cards: [slotItemCard('멍멍이 잠수함', 'd2cd18e4d1d8a13d7e3a952fcf057b6d', 17_988_888)]
          }
        ]
      }
    ]
  },
  {
    category: 'aura',
    tiers: [
      {
        tier: '종결',
        options: [
          {
            id: AURA_FINAL,
            cards: [slotItemCard('열대야의 추억', 'c6ca900e513cccb177890939de234227', 41_299_990)]
          }
        ]
      },
      {
        tier: '준종결',
        options: [
          {
            id: AURA_SEMI,
            cards: [
              slotItemCard('고결한 영혼의 잔상', '25e7652de779ccea0d8559a3e5bf7e01', 17_999_999)
            ]
          }
        ]
      }
    ]
  }
]

export const enchantOptionsFixture: EnchantOptionsResponse = { slots, slotItems }

const parsedEnchantOptions = enchantOptionsSchema.parse(enchantOptionsFixture)

export const loadedEnchantOptions = {
  status: 'success',
  options: parsedEnchantOptions
} as const
