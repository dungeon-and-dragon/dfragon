import type { ItemDetail } from '#widgets/item-tooltip/model/item-detail'

// Neople 아이템 상세를 API 응답 형태로 옮긴 합성 데이터다.
export function storyItemDetail(itemId: string): ItemDetail {
  return {
    itemId,
    name: '제2형 - 수식, 방어의 운검',
    rarity: '에픽',
    itemType: '무기',
    typeDetail: '대검',
    availableLevel: 115,
    fame: 8500,
    status: [
      { name: '모험가 명성', value: '8500' },
      { name: '물리 공격력', value: '1683' },
      { name: '마법 공격력', value: '1683' },
      { name: '독립 공격력', value: '1683' },
      { name: '힘', value: '138' },
      { name: '지능', value: '138' },
      { name: '적중률', value: '15%' }
    ],
    explain:
      '[호위무사의 혼]\n장착 시 호위무사의 혼이 착용자를 보호합니다.\n- 물리/마법 피해 감소 +25%\n\n[철벽방어] [장비 발동 옵션]\n20초 동안 호위무사가 착용자에게 가해지는 피해를 막아줍니다.\n- HP MAX 20% 수치의 보호막 부여\n- 쿨타임 60초',
    flavorText: '방어는 최선의 공격이지',
    card: null
  }
}

export const STORY_CARD_ITEM_ID = '42ee831ce6b283ecd8b06969caad7894'

// 카드 이름은 지금은 지운 마법부여 등급표에 있던 이름이고, 부위와 단계별 옵션은 Neople 아이템 상세 응답의 cardInfo를 옮긴 값이다.
export function storyCardDetail(itemId: string): ItemDetail {
  const option = (allElements: number, attack: number, fame: number) => [
    { name: '모든 속성 강화', value: String(allElements) },
    { name: '물리 공격력', value: String(attack) },
    { name: '마법 공격력', value: String(attack) },
    { name: '독립 공격력', value: String(attack) },
    { name: '모험가 명성', value: String(fame) }
  ]

  const firstOptions = option(13, 20, 196)
  const secondOptions = option(14, 25, 196)
  const thirdOptions = option(15, 30, 210)

  return {
    itemId,
    name: '멸절의 폭룡왕 바칼 카드',
    rarity: '레전더리',
    itemType: '카드',
    typeDetail: null,
    availableLevel: null,
    fame: null,
    status: [{ name: '모험가 명성', value: '210' }],
    explain: null,
    flavorText: null,
    card: {
      slots: ['무기'],
      enchants: [
        { upgrade: 0, status: firstOptions, reinforceSkill: [] },
        { upgrade: 1, status: secondOptions, reinforceSkill: [] },
        { upgrade: 2, status: thirdOptions, reinforceSkill: [] }
      ]
    }
  }
}

export const STORY_BUFF_CARD_ITEM_ID = 'synthetic-buff-card'

// 카드와 직업, 스킬 이름은 지어낸 값이고, 단계별 옵션과 버프 스킬 값은 Neople 버퍼 카드 응답의 값을 따랐다.
export function storyBuffCardDetail(itemId: string): ItemDetail {
  const option = (stat: number, fame: number) => [
    { name: '힘', value: String(stat) },
    { name: '지능', value: String(stat) },
    { name: '체력', value: String(stat) },
    { name: '정신력', value: String(stat) },
    { name: '모험가 명성', value: String(fame) }
  ]
  const reinforceSkill = [
    { jobName: '합성 직업 A', skills: [{ name: '합성 버프 A', value: '4' }] },
    { jobName: '합성 직업 B', skills: [{ name: '합성 버프 B', value: '4' }] }
  ]
  const firstOptions = option(105, 210)
  const secondOptions = option(115, 221)
  const thirdOptions = option(125, 240)

  return {
    itemId,
    name: '합성 여신 카드',
    rarity: '레전더리',
    itemType: '카드',
    typeDetail: null,
    availableLevel: null,
    fame: null,
    status: [{ name: '모험가 명성', value: '240' }],
    explain: null,
    flavorText: null,
    card: {
      slots: ['상의'],
      enchants: [
        { upgrade: 0, status: firstOptions, reinforceSkill },
        { upgrade: 1, status: secondOptions, reinforceSkill },
        { upgrade: 2, status: thirdOptions, reinforceSkill }
      ]
    }
  }
}
