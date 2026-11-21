import type { GameTextLines } from '#entities/catalog/model/game-text'
import type { SkillWindowCatalog } from '#entities/catalog/model/skill-window'

// 스킬과 개화 이름은 게임 데이터 그대로이고 설명은 합성 값이다. Storybook에서 아이콘이 보이도록 그림은 운영 사이트의
// 스킬 창 데이터 묶음 2ca27db1판을 쓰고, 아이콘 좌표도 그 판의 귀검사(남) 직업 파일 값이다.
const SKILLTAB_ART = 'https://dfragon.com/skilltab/2ca27db1'
const GAME_TEXT: GameTextLines = [[{ text: '합성 설명', tone: 'default' }]]

type CatalogSkill = SkillWindowCatalog['job']['skills'][string]

function evolutionSkill(
  name: string,
  icon: { x: number; y: number },
  [first, second]: readonly [string, string]
): CatalogSkill {
  return {
    name,
    kind: 'active',
    requiredLevel: 15,
    maxLevel: 70,
    icon,
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
      `${SKILLTAB_ART}/marks/evolution-1.ffe62b73.png`,
      `${SKILLTAB_ART}/marks/evolution-2.8cb1d43d.png`
    ],
    enhancement: [
      `${SKILLTAB_ART}/marks/enhancement-1.b6bca15d.png`,
      `${SKILLTAB_ART}/marks/enhancement-2.4e92cb62.png`
    ]
  },
  job: {
    jobId: 'swordman_m',
    jobName: '귀검사(남)',
    sprite: `${SKILLTAB_ART}/sprites/swordman.34b5f0d6.png`,
    advancements: [],
    skills: {
      1: evolutionSkill('발도', { x: 224, y: 0 }, ['명가의 손놀림', '속전속결']),
      2: evolutionSkill('맹룡단공참', { x: 224, y: 84 }, ['맹룡선풍참', '파죽지세']),
      3: evolutionSkill('환영검무', { x: 252, y: 84 }, ['그림자 유희', '무형검무']),
      4: evolutionSkill('극초발도', { x: 308, y: 112 }, ['쾌속발도', '흐르는 칼날']),
      5: evolutionSkill('차지 버스트', { x: 336, y: 112 }, ['심기일전', '무수행보'])
    }
  }
}
