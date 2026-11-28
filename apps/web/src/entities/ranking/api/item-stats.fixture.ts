import type { ItemStats } from '#entities/ranking/model/item-stats'

// 비율은 #1781 시안의 합성 값이다. 무기와 유일 장비 이름은 게임 데이터 그대로이고 itemId는 합성 값이다.
const SAMPLE_SIZE = 412_380

// 종류는 시안 16B의 묶음을 따랐고, 시안에 없던 무기는 종류를 모르는 경우(null)로 둔다.
const WEAPONS: readonly (readonly [string, string | null, number])[] = [
  ['요도 : 날뛰는 흑혈', '도', 14.8],
  ['재앙의 송곳니', '낫', 6.1],
  ['구속된 공작의 아귀', '둔기', 5.7],
  ['검은 질병의 칠흑의 저주', '빗자루', 5.2],
  ['끝없는 분노의 지팡이', '스탭', 4.9],
  ['오염된 피의 쾌', '리볼버', 4.4],
  ['만 갈래로 뻗어가는 질병', '낫', 4],
  ['검은 질병의 엠프레스 벳즈', '빗자루', 3.6],
  ['검은 질병의 오케아누스 프라이모디어', '스탭', 3.1],
  ['첫 섬광', '도', 2.8],
  ['제2형 - 수식, 방어의 운검', null, 2.4],
  ['그림자를 가르는 일섬', null, 2.1]
]

// 유일 장비는 화면이 itemId로 고정해 두므로 게임 데이터의 itemId를 쓴다.
const UNIQUES: readonly (readonly [string, string, string, number])[] = [
  ['RING', 'aa5273499f19ddba846919dbb6857d82', '광휘를 머금은 눈동자', 72.4],
  ['SUPPORT', '6e1fcf6e59ed8d5a95dc152b84fe93ce', '만병을 잉태한 역병의 심장', 68.9],
  ['MAGIC_STON', 'df77236c51ea1274a3deb79c3e470695', '우아한 기품의 향수', 70.3],
  ['EARRING', '14449881bc371352c250502e7b201506', '영롱한 날씨의 큐브', 66.1]
]

// 플래티넘 칭호, 크리쳐는 이름 끝 [NLv]로 Lv+1을 받는 스킬 레벨을 알린다. 이름은 게임 데이터 그대로다.
const TITLES: readonly (readonly [string, number])[] = [
  ['프로스트의 전설', 31.2],
  ['프로스트의 전설 플래티넘[80Lv]', 14.6],
  ['프로스트의 전설 플래티넘[75Lv]', 11.3],
  ['프로스트의 전설 플래티넘[30Lv]', 9.1],
  ['프로스트의 전설 플래티넘[35Lv]', 6.5],
  ['순백의 눈꽃 결정[75Lv]', 2.9],
  ['프로스트의 전설 플래티넘[40Lv]', 4.1],
  ['운명이 담긴 책[30Lv]', 2.4],
  ['프로스트의 전설 플래티넘[100Lv]', 1.6]
]

const CREATURES: readonly (readonly [string, number])[] = [
  ['운명을 담는 재단사', 38.4],
  ['운명을 담는 재단사 플래티넘[30Lv]', 12.7],
  ['운명을 담는 재단사 플래티넘[75Lv]', 9.8],
  ['운명을 담는 재단사 플래티넘[35Lv]', 7.2],
  ['운명을 담는 재단사 플래티넘[80Lv]', 7],
  ['운명을 담는 여신[30Lv]', 2.8],
  ['운명을 담는 재단사 플래티넘[45Lv]', 3.3]
]

const WEAPON_AVATARS: readonly (readonly [string, number])[] = [
  ['레어 무기 클론 아바타[30Lv]', 18.2],
  ['레어 무기 클론 아바타[75Lv]', 12.4],
  ['레어 무기 클론 아바타[80Lv]', 9.6],
  ['레어 무기 클론 아바타[35Lv]', 6.1],
  ['레어 무기 클론 아바타[60Lv]', 2.3]
]

function countOf(percent: number): number {
  return Math.round((SAMPLE_SIZE * percent) / 100)
}

function namedItems(kind: string, items: readonly (readonly [string, number])[]) {
  return items.map(([name, percent], index) => {
    const count = countOf(percent)

    return { itemId: `story-${kind}-${index + 1}`, name, typeDetail: null, count }
  })
}

export function storyItemStats(computedAt: string): ItemStats {
  const weapons = WEAPONS.map(([name, typeDetail, percent], index) => ({
    itemId: `story-weapon-${index + 1}`,
    name,
    typeDetail,
    count: countOf(percent)
  }))
  const uniques = UNIQUES.map(([slotId, itemId, name, percent]) => ({
    slotId,
    items: [{ itemId, name, typeDetail: null, count: countOf(percent) }]
  }))
  const titles = namedItems('title', TITLES)
  const creatures = namedItems('creature', CREATURES)
  const weaponAvatars = namedItems('weapon-avatar', WEAPON_AVATARS)

  return {
    computedAt,
    sampleSize: SAMPLE_SIZE,
    slots: [
      { slotId: 'WEAPON', items: weapons },
      { slotId: 'TITLE', items: titles },
      ...uniques,
      { slotId: 'CREATURE', items: creatures },
      { slotId: 'WEAPON_AVATAR', items: weaponAvatars }
    ]
  }
}
