import { describe, expect, it } from 'vitest'
import {
  learnedSkillRowsOf,
  type SkillWindowCatalog,
  skillUpgradesOf,
  skillWindowOf
} from './skill-window'

type Style = Parameters<typeof skillWindowOf>[2]
type Skill = SkillWindowCatalog['jobs'][number]['skills'][string]

function skill(name: string, requiredLevel: number | null, kind: Skill['kind'] = 'active'): Skill {
  return { name, kind, requiredLevel, maxLevel: 10, icon: { x: 0, y: 0 } }
}

function slot(skillId: number, col: number, row: number) {
  return { skillId, col, row, nextSkills: [] }
}

// 묶음(skilltab.json)과 같은 모양의 합성 데이터다. 두 직업 모두 찰나의 깨달음이 있어 직업마다의 스킬과 구분된다.
const CATALOG: SkillWindowCatalog = {
  pvfSha256: 'synthetic',
  jobs: [
    {
      jobId: 'priest',
      jobName: '프리스트(남)',
      sprite: 'sprites/priest.png',
      advancements: [
        { growtype: 0, name: '프리스트', awakeningNames: [], slots: [slot(1, 0, 0)] },
        {
          growtype: 1,
          name: '크루세이더',
          awakeningNames: ['홀리오더', '세인트', '眞 크루세이더'],
          slots: [
            slot(1, 0, 0),
            slot(2, 3, 2),
            slot(3, 5, 2),
            slot(4, 6, 2),
            slot(5, 1.4893617021276595, 4),
            slot(6, 5, 15),
            slot(7, 5, 15)
          ]
        },
        { growtype: 2, name: '인파이터', awakeningNames: ['眞 인파이터'], slots: [slot(8, 2, 1)] }
      ],
      skills: {
        1: skill('백스텝', 1),
        2: { ...skill('슬로우 힐', 5), icon: { x: 28, y: 56 } },
        3: skill('럭키 스트레이트', 5),
        4: skill('세컨드 어퍼', 10),
        5: skill('연환격', 15),
        6: skill('찰나의 깨달음', 95, 'passive'),
        7: skill('신의 대행자', 95, 'passive'),
        8: skill('더킹', 1)
      }
    },
    {
      jobId: 'creator_mage',
      jobName: '크리에이터',
      sprite: 'sprites/creator_mage.png',
      advancements: [
        {
          growtype: 0,
          name: '크리에이터',
          awakeningNames: [],
          slots: [slot(1, 0.48936170212765956, 1), slot(2, 0, 0)]
        },
        {
          growtype: 1,
          name: '크리에이터',
          awakeningNames: ['크리에이터', '크리에이터', '眞 크리에이터'],
          slots: [slot(2, 0, 0)]
        }
      ],
      skills: { 1: skill('화염', 1), 2: skill('찰나의 깨달음', 95, 'passive') }
    }
  ]
}

function learned(name: string, level: number, requiredLevel: number | null = 1) {
  return { skillId: `id-${name}`, name, level, requiredLevel }
}

function styleOf(active: Style['active'], passive: Style['passive'] = []): Style {
  return { active, passive, evolution: [], enhancement: [] }
}

const CRUSADER = { jobName: '프리스트(남)', jobGrowName: '眞 크루세이더' }

describe('스킬 창 배치', () => {
  it('각성 이름으로 전직을 골라, 배운 스킬에는 레벨을 두고 배우지 않은 스킬은 배우지 않은 칸으로 둔다', () => {
    const window = skillWindowOf(
      CATALOG,
      CRUSADER,
      styleOf([learned('백스텝', 1), learned('슬로우 힐', 20, 5)])
    )

    expect(window?.icons.find(({ name }) => name === '슬로우 힐')).toMatchObject({
      icon: { sprite: 'sprites/priest.png', x: 28, y: 56 },
      col: 3,
      row: 2,
      learned: true,
      level: 20
    })
    expect(window?.icons.find(({ name }) => name === '럭키 스트레이트')).toMatchObject({
      learned: false,
      level: null
    })
    expect(window?.icons.some(({ name }) => name === '더킹')).toBe(false)
  })

  it('1차 전직 이름으로도 같은 전직을 고른다', () => {
    const window = skillWindowOf(
      CATALOG,
      { jobName: '프리스트(남)', jobGrowName: '크루세이더' },
      styleOf([])
    )

    expect(window?.icons.map(({ name }) => name)).toContain('세컨드 어퍼')
  })

  it('칸 사이에 놓인 소수 좌표는 반올림하지 않는다', () => {
    const window = skillWindowOf(CATALOG, CRUSADER, styleOf([]))

    expect(window?.icons.find(({ name }) => name === '연환격')).toMatchObject({
      col: 1.4893617021276595,
      row: 4
    })
  })

  it('같은 칸의 두 스킬은 배운 쪽을 둔다', () => {
    const window = skillWindowOf(CATALOG, CRUSADER, styleOf([], [learned('찰나의 깨달음', 2, 95)]))
    const inCell = window?.icons.filter(({ col, row }) => col === 5 && row === 15)

    expect(inCell?.map(({ name, level }) => [name, level])).toEqual([['찰나의 깨달음', 2]])
  })

  it('같은 칸의 두 스킬을 다 배우지 않았거나 다 배웠으면 다른 직업에 없는 그 전직의 스킬을 둔다', () => {
    const none = skillWindowOf(CATALOG, CRUSADER, styleOf([]))
    const both = skillWindowOf(
      CATALOG,
      CRUSADER,
      styleOf([], [learned('찰나의 깨달음', 2, 95), learned('신의 대행자', 9, 95)])
    )

    for (const window of [none, both]) {
      expect(
        window?.icons.filter(({ col, row }) => col === 5 && row === 15).map(({ name }) => name)
      ).toEqual(['신의 대행자'])
    }
  })

  it('줄마다 공용 줄부터 마지막 줄까지 그 줄의 습득 레벨을 둔다', () => {
    const window = skillWindowOf(CATALOG, CRUSADER, styleOf([]))

    expect(window?.rows.map(({ row }) => row)).toEqual(Array.from({ length: 16 }, (_, row) => row))
    expect(window?.rows[2]).toEqual({ row: 2, requiredLevel: 5 })
    expect(window?.rows[3]).toEqual({ row: 3, requiredLevel: null })
  })

  it('크리에이터는 전직 상태와 관계없이 growtype 0 배치를 쓴다', () => {
    for (const jobGrowName of ['크리에이터', '자각2', '眞 크리에이터']) {
      const window = skillWindowOf(
        CATALOG,
        { jobName: '크리에이터', jobGrowName },
        styleOf([learned('화염', 1)])
      )

      expect(window?.icons.find(({ name }) => name === '화염')).toMatchObject({
        col: 0.48936170212765956,
        row: 1,
        learned: true
      })
    }
  })

  it('데이터에 없는 직업이나 전직은 배치가 없다', () => {
    expect(
      skillWindowOf(CATALOG, { jobName: '총검사', jobGrowName: '眞 요원' }, styleOf([]))
    ).toBeNull()
    expect(
      skillWindowOf(CATALOG, { jobName: '프리스트(남)', jobGrowName: '프리스트(남)' }, styleOf([]))
    ).toBeNull()
  })
})

it('배치가 없을 때의 목록은 배운 스킬을 습득 레벨 순 줄로 나누고 습득 레벨이 없는 스킬을 끝에 둔다', () => {
  const rows = learnedSkillRowsOf([
    learned('컨버전', 1, null),
    learned('세컨드 어퍼', 5, 10),
    learned('백스텝', 1, 1),
    learned('스매셔', 20, 1)
  ])

  expect(
    rows.map(({ requiredLevel, skills }) => [requiredLevel, skills.map(({ name }) => name)])
  ).toEqual([
    [1, ['백스텝', '스매셔']],
    [10, ['세컨드 어퍼']],
    [null, ['컨버전']]
  ])
})

it('스킬 개화와 강화는 skillId로 배운 스킬의 이름을 찾고 type을 그대로 둔다', () => {
  const style: Style = {
    active: [learned('백스텝', 1)],
    passive: [learned('신의 대행자', 9, 95)],
    evolution: [{ skillId: 'id-신의 대행자', type: 2 }],
    enhancement: [{ skillId: 'id-없음', type: 1 }]
  }

  expect(skillUpgradesOf(style, 'evolution')).toEqual([
    { skillId: 'id-신의 대행자', name: '신의 대행자', type: 2 }
  ])
  expect(skillUpgradesOf(style, 'enhancement')).toEqual([
    { skillId: 'id-없음', name: null, type: 1 }
  ])
})
