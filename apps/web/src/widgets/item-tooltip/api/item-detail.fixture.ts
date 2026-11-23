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
    flavorText: '방어는 최선의 공격이지'
  }
}
