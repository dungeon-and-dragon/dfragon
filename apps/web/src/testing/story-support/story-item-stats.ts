import type { ItemStats } from '#core/ranking'

// 비율은 #1781 시안의 합성 값이다. 무기와 유일 장비 이름은 게임 데이터 그대로이고 itemId는 합성 값이다.
const SAMPLE_SIZE = 412_380

const WEAPONS: readonly (readonly [string, number])[] = [
  ['요도 : 날뛰는 흑혈', 14.8],
  ['재앙의 송곳니', 6.1],
  ['구속된 공작의 아귀', 5.7],
  ['검은 질병의 칠흑의 저주', 5.2],
  ['끝없는 분노의 지팡이', 4.9],
  ['오염된 피의 쾌', 4.4],
  ['만 갈래로 뻗어가는 질병', 4],
  ['검은 질병의 엠프레스 벳즈', 3.6],
  ['검은 질병의 오케아누스 프라이모디어', 3.1],
  ['첫 섬광', 2.8],
  ['제2형 - 수식, 방어의 운검', 2.4],
  ['그림자를 가르는 일섬', 2.1]
]

const UNIQUES: readonly (readonly [string, string, number])[] = [
  ['RING', '광휘를 머금은 눈동자', 72.4],
  ['SUPPORT', '만병을 잉태한 역병의 심장', 68.9],
  ['MAGIC_STON', '우아한 기품의 향수', 70.3],
  ['EARRING', '영롱한 날씨의 큐브', 66.1]
]

function countOf(percent: number): number {
  return Math.round((SAMPLE_SIZE * percent) / 100)
}

export function storyItemStats(computedAt: string): ItemStats {
  const weapons = WEAPONS.map(([name, percent], index) => ({
    itemId: `story-weapon-${index + 1}`,
    name,
    count: countOf(percent)
  }))
  const uniques = UNIQUES.map(([slotId, name, percent], index) => ({
    slotId,
    items: [{ itemId: `story-unique-${index + 1}`, name, count: countOf(percent) }]
  }))

  return {
    computedAt,
    sampleSize: SAMPLE_SIZE,
    slots: [{ slotId: 'WEAPON', items: weapons }, ...uniques]
  }
}
