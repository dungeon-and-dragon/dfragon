import type { SkillWindowCatalog } from '#entities/catalog'
import { storyWeaponMasterCatalog } from '#entities/catalog/api/skill-window.fixture'
import type { SkillStats } from '#entities/ranking'

// 스킬 이름과 아이콘 좌표는 운영 사이트의 스킬 창 데이터 묶음 2ca27db1판 귀검사(남) 직업 파일 값이고, 배치와 표본 수는 합성 값이다.
type CatalogSkill = SkillWindowCatalog['job']['skills'][string]

function skill(
  name: string,
  icon: { x: number; y: number },
  requiredLevel: number,
  maxLevel: number,
  extra: Partial<CatalogSkill> = {}
): CatalogSkill {
  return { name, kind: 'active', requiredLevel, maxLevel, icon, stage: false, ...extra }
}

const { job: weaponMaster } = storyWeaponMasterCatalog
const BALDO = weaponMaster.skills[1]!
const MAENGRYONG = weaponMaster.skills[2]!
const ENHANCEMENT = { 1: { explain: [] }, 2: { explain: [] } }

export const SKILL_STATS_GROW = '웨펀마스터'

export const skillStatsCatalogFixture: SkillWindowCatalog = {
  marks: storyWeaponMasterCatalog.marks,
  job: {
    ...weaponMaster,
    advancements: [
      {
        growtype: 1,
        name: SKILL_STATS_GROW,
        awakeningNames: ['검성', '검신', '眞 웨펀마스터'],
        slots: [
          { skillId: 11, col: 0, row: 0, nextSkills: [] },
          { skillId: 12, col: 1, row: 0, nextSkills: [] },
          { skillId: 13, col: 2, row: 0, nextSkills: [] },
          { skillId: 14, col: 0, row: 1, nextSkills: [] },
          { skillId: 15, col: 1, row: 1, nextSkills: [] },
          { skillId: 16, col: 2, row: 1, nextSkills: [] },
          { skillId: 17, col: 3, row: 1, nextSkills: [] },
          { skillId: 1, col: 0, row: 2, nextSkills: [] },
          { skillId: 18, col: 1, row: 2, nextSkills: [] },
          { skillId: 2, col: 0, row: 3, nextSkills: [] },
          { skillId: 3, col: 1, row: 3, nextSkills: [] }
        ]
      }
    ],
    skills: {
      1: { ...BALDO, requiredLevel: 25, maxLevel: 20 },
      2: { ...MAENGRYONG, requiredLevel: 35, maxLevel: 20, enhancement: ENHANCEMENT },
      3: { ...weaponMaster.skills[3]!, requiredLevel: 35, maxLevel: 20 },
      11: skill('백스텝 강화', { x: 280, y: 140 }, 1, 1, { kind: 'passive' }),
      12: skill('크리티컬 히트', { x: 364, y: 140 }, 1, 1, { kind: 'passive' }),
      13: skill('도약', { x: 336, y: 140 }, 1, 1),
      14: skill('류심', { x: 0, y: 140 }, 15, 10, { kind: 'passive' }),
      15: skill('류심 충', { x: 28, y: 140 }, 15, 30),
      16: skill('류심 쾌', { x: 56, y: 140 }, 15, 30),
      17: skill('류심 승', { x: 84, y: 140 }, 15, 30),
      18: skill('차지 크래시', { x: 196, y: 84 }, 25, 20, { enhancement: ENHANCEMENT })
    }
  }
}

// 표본 400명 가운데 크리티컬 히트는 10%만 배웠고 환영검무는 아무도 배우지 않았다. 발도는 13과 20레벨이 같은 수다.
export const skillStatsFixture: SkillStats = {
  computedAt: '2026-11-24T15:00:29.502Z',
  minFame: null,
  sampleSize: 400,
  skills: [
    { name: '백스텝 강화', learned: 400, levels: [[1, 400]] },
    { name: '크리티컬 히트', learned: 40, levels: [[1, 40]] },
    { name: '도약', learned: 380, levels: [[1, 380]] },
    { name: '류심', learned: 400, levels: [[10, 400]] },
    {
      name: '류심 충',
      learned: 400,
      levels: [
        [1, 150],
        [30, 250]
      ]
    },
    { name: '류심 쾌', learned: 400, levels: [[30, 400]] },
    { name: '류심 승', learned: 400, levels: [[30, 400]] },
    {
      name: '발도',
      learned: 360,
      levels: [
        [1, 60],
        [13, 150],
        [20, 150]
      ]
    },
    { name: '차지 크래시', learned: 300, levels: [[20, 300]] },
    { name: '맹룡단공참', learned: 300, levels: [[20, 300]] }
  ],
  evolutions: [
    { name: '발도', type1: 200, type2: 100 },
    { name: '맹룡단공참', type1: 140, type2: 130 }
  ],
  enhancements: [
    { name: '차지 크래시', type1: 100, type2: 160 },
    { name: '맹룡단공참', type1: 140, type2: 130 }
  ],
  chainSampleSize: 380,
  chains: [
    { skills: ['류심 쾌', '류심 승', '류심 충', null], count: 123 },
    { skills: ['류심 쾌', '류심 승', '류심 충', '차지 크래시'], count: 44 },
    { skills: ['류심', '류심 쾌', '류심 승', '류심 충'], count: 16 },
    { skills: [null, '류심 쾌', '류심 승', '류심 충'], count: 9 },
    { skills: ['류심 승', '류심 충', '류심 쾌', null], count: 3 }
  ]
}
