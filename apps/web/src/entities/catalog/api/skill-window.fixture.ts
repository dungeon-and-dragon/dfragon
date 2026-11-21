import type { GameTextLines } from '#entities/catalog/model/game-text'
import type { SkillWindowCatalog } from '#entities/catalog/model/skill-window'

// 스킬과 개화 이름은 게임 데이터 그대로이고, 그림 주소와 설명은 합성 값이다.
const GAME_TEXT: GameTextLines = [[{ text: '합성 설명', tone: 'default' }]]

type CatalogSkill = SkillWindowCatalog['job']['skills'][string]

function evolutionSkill(
  name: string,
  x: number,
  [first, second]: readonly [string, string]
): CatalogSkill {
  return {
    name,
    kind: 'active',
    requiredLevel: 15,
    maxLevel: 70,
    icon: { x, y: 0 },
    stage: false,
    evolution: [
      { name: first, basicExplain: GAME_TEXT, explain: GAME_TEXT },
      { name: second, basicExplain: GAME_TEXT, explain: GAME_TEXT }
    ]
  }
}

export const STORY_EVOLUTION_SKILLS = [
  '발도',
  '맹룡단공참',
  '환영검무',
  '극초발도',
  '차지 버스트'
] as const

export const storyWeaponMasterCatalog: SkillWindowCatalog = {
  marks: {
    evolution: [
      'https://skilltab.test/marks/evolution-1.png',
      'https://skilltab.test/marks/evolution-2.png'
    ],
    enhancement: [
      'https://skilltab.test/marks/enhancement-1.png',
      'https://skilltab.test/marks/enhancement-2.png'
    ]
  },
  job: {
    jobId: 'swordman_m',
    jobName: '귀검사(남)',
    sprite: 'https://skilltab.test/sprites/swordman_m.png',
    advancements: [],
    skills: {
      1: evolutionSkill('발도', 224, ['명가의 손놀림', '속전속결']),
      2: evolutionSkill('맹룡단공참', 252, ['맹룡선풍참', '파죽지세']),
      3: evolutionSkill('환영검무', 280, ['그림자 유희', '무형검무']),
      4: evolutionSkill('극초발도', 308, ['쾌속발도', '흐르는 칼날']),
      5: evolutionSkill('차지 버스트', 336, ['심기일전', '무수행보'])
    }
  }
}
