import { describe, expect, it } from 'vitest'
import { characterDetailFixture } from '../../testing/fixtures/character-detail'
import {
  learnedSkillRowsOf,
  type SkillWindowCatalog,
  skillChainOf,
  skillUpgradeBoardOf,
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
  return { active, passive, evolution: [], enhancement: [], chain: null }
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
    enhancement: [{ skillId: 'id-없음', type: 1 }],
    chain: null
  }

  expect(skillUpgradesOf(style, 'evolution')).toEqual([
    { skillId: 'id-신의 대행자', name: '신의 대행자', type: 2 }
  ])
  expect(skillUpgradesOf(style, 'enhancement')).toEqual([
    { skillId: 'id-없음', name: null, type: 1 }
  ])
})

function evolutionOf(name: string): NonNullable<Skill['evolution']> {
  return [
    { name: `${name} 1`, basicExplain: `${name} 요약 1`, explain: `${name} 설명 1` },
    { name: `${name} 2`, basicExplain: `${name} 요약 2`, explain: `${name} 설명 2` }
  ]
}

const ENHANCEMENT: NonNullable<Skill['enhancement']> = {
  1: { explain: '데미지 증가' },
  2: { explain: '데미지 증가, 쿨타임 감소' }
}

const MARKS = {
  evolution: ['marks/evolution-1.png', 'marks/evolution-2.png'],
  enhancement: ['marks/enhancement-1.png', 'marks/enhancement-2.png']
} satisfies SkillWindowCatalog['marks']

// 저장소 fixture(프리스트(여) 眞 이단심판관)의 개화, 강화, 스킬 체인 스킬 이름으로 만든 합성 배치다. 스킬 번호 9는 다른
// 전직에만 있어 배울 수 없는 스킬이다.
const INQUISITOR_CATALOG: SkillWindowCatalog = {
  pvfSha256: 'synthetic',
  marks: MARKS,
  jobs: [
    {
      jobId: 'at_priest',
      jobName: '프리스트(여)',
      sprite: 'sprites/at_priest.png',
      advancements: [
        {
          growtype: 2,
          name: '이단심판관',
          awakeningNames: ['眞 이단심판관'],
          slots: [
            slot(1, 2, 8),
            slot(2, 0, 7),
            slot(3, 1, 7),
            slot(4, 3, 6),
            slot(5, 0, 6),
            slot(6, 0, 0)
          ]
        },
        { growtype: 3, name: '무녀', awakeningNames: ['眞 무녀'], slots: [slot(9, 0, 7)] }
      ],
      skills: {
        1: { ...skill('참수', 45), evolution: evolutionOf('참수'), enhancement: ENHANCEMENT },
        2: {
          ...skill('즉결심판', 35),
          evolution: evolutionOf('즉결심판'),
          enhancement: ENHANCEMENT
        },
        3: { ...skill('세례의 불길', 35), evolution: evolutionOf('세례의 불길') },
        4: { ...skill('성염의 쇄도', 30), icon: { x: 84, y: 28 } },
        5: { ...skill('성화', 25), enhancement: ENHANCEMENT },
        6: skill('백스텝', 1),
        9: { ...skill('무녀의 스킬', 35), evolution: evolutionOf('무녀의 스킬') }
      }
    }
  ]
}

function inquisitor() {
  const detail = characterDetailFixture('dealer')
  const style = detail.skillStyle?.style
  if (style == null) {
    throw new Error('딜러 fixture에 스킬 스타일이 없다')
  }

  return { character: detail.character, style }
}

describe('스킬 개화, 강화', () => {
  it('스킬 창 아이콘에 고른 개화와 강화 type을 둔다', () => {
    const { character, style } = inquisitor()
    const window = skillWindowOf(INQUISITOR_CATALOG, character, style)

    expect(window?.marks).toEqual(MARKS)
    expect(
      window?.icons
        .filter(({ evolution, enhancement }) => evolution !== null || enhancement !== null)
        .map(({ name, evolution, enhancement }) => [name, evolution, enhancement])
    ).toEqual([
      ['참수', 2, 1],
      ['즉결심판', 1, 1],
      ['세례의 불길', 1, null]
    ])
    expect(window?.icons.find(({ name }) => name === '성화')).toMatchObject({
      evolution: null,
      enhancement: null
    })
  })

  it('개화는 그 전직이 배울 수 있는 스킬을 모두, 강화는 강화한 스킬만 습득 레벨 순으로 두고 고른 갈래를 표시한다', () => {
    const { character, style } = inquisitor()
    const board = skillUpgradeBoardOf(INQUISITOR_CATALOG, character, style)

    expect(board?.evolutions.map(({ name, picked }) => [name, picked])).toEqual([
      ['즉결심판', 1],
      ['세례의 불길', 1],
      ['참수', 2]
    ])
    expect(board?.evolutions[2]?.branches).toEqual([
      { type: 1, name: '참수 1', basicExplain: '참수 요약 1', explain: '참수 설명 1' },
      { type: 2, name: '참수 2', basicExplain: '참수 요약 2', explain: '참수 설명 2' }
    ])
    expect(board?.enhancements.map(({ name, picked }) => [name, picked])).toEqual([
      ['즉결심판', 1],
      ['참수', 1]
    ])
    expect(board?.enhancements[0]?.branches).toEqual([{ type: 1 }, { type: 2 }])
  })

  it('강화한 스킬이 없으면 스킬 강화 목록이 비어 있다', () => {
    const { character, style } = inquisitor()
    const board = skillUpgradeBoardOf(INQUISITOR_CATALOG, character, { ...style, enhancement: [] })

    expect(board?.enhancements).toEqual([])
    expect(board?.evolutions).toHaveLength(3)
  })

  it('개화, 강화 데이터를 넣지 않은 묶음이면 목록을 만들지 않는다', () => {
    const { character, style } = inquisitor()
    const { marks: _marks, ...withoutExtras } = INQUISITOR_CATALOG

    expect(skillUpgradeBoardOf(withoutExtras, character, style)).toBeNull()
    expect(skillWindowOf(withoutExtras, character, style)?.marks).toBeNull()
  })
})

describe('스킬 체인', () => {
  it('체인 스킬을 순서대로 이름과 그 전직 배치의 아이콘으로 둔다', () => {
    const { character, style } = inquisitor()

    expect(skillChainOf(INQUISITOR_CATALOG, character, style)).toEqual({
      skills: [
        { name: '세례의 불길', icon: { sprite: 'sprites/at_priest.png', x: 0, y: 0 } },
        { name: '성염의 쇄도', icon: { sprite: 'sprites/at_priest.png', x: 84, y: 28 } },
        { name: '성화', icon: { sprite: 'sprites/at_priest.png', x: 0, y: 0 } },
        { name: '즉결심판', icon: { sprite: 'sprites/at_priest.png', x: 0, y: 0 } }
      ]
    })
  })

  it('스킬 창 데이터가 없으면 이름만 둔다', () => {
    const { character, style } = inquisitor()

    expect(
      skillChainOf(null, character, style)?.skills.map(({ name, icon }) => [name, icon])
    ).toEqual([
      ['세례의 불길', null],
      ['성염의 쇄도', null],
      ['성화', null],
      ['즉결심판', null]
    ])
  })

  it('체인을 쓰지 않는 캐릭터는 체인이 없다', () => {
    const detail = characterDetailFixture('buffer')
    const style = detail.skillStyle?.style
    if (style == null) {
      throw new Error('버퍼 fixture에 스킬 스타일이 없다')
    }

    expect(skillChainOf(INQUISITOR_CATALOG, detail.character, style)).toBeNull()
  })

  it('칸이 모두 비어 있는 체인은 체인이 없는 것으로 본다', () => {
    const { character, style } = inquisitor()
    const emptyChain = { ...style, chain: { resetTime: 0, skills: [null, null, null, null] } }

    expect(skillChainOf(INQUISITOR_CATALOG, character, emptyChain)).toBeNull()
  })
})
