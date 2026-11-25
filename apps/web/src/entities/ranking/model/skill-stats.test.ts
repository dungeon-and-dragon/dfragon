import { describe, expect, it } from 'vitest'
import { type SkillStats, skillAdoptionOf, skillStatsSchema } from './skill-stats'

// 합성 응답이다. 스킬, 갈래 이름은 응답 형태만 맞춘 값이다.
function statsOf(overrides: Partial<SkillStats> = {}): SkillStats {
  return {
    computedAt: '2026-11-06T15:00:00.000Z',
    minFame: 70000,
    sampleSize: 40,
    skills: [
      {
        name: '발도',
        learned: 20,
        levels: [
          [1, 10],
          [13, 9],
          [20, 1]
        ]
      }
    ],
    evolutions: [{ name: '발도', type1: 12, type2: 6 }],
    enhancements: [{ name: '발도', type1: 3, type2: 15 }],
    chainSampleSize: 0,
    chains: [],
    ...overrides
  }
}

const BALDO = {
  name: '발도',
  level: 13,
  maxLevel: 20,
  evolutionNames: ['명가의 손놀림', '속전속결'],
  hasEnhancement: true
} as const

describe('skillAdoptionOf', () => {
  it('채택률은 표본, 개화와 강화 비율은 그 스킬을 배운 캐릭터로 나눈다', () => {
    expect(skillAdoptionOf(statsOf(), BALDO)).toEqual({
      adoption: 0.5,
      levels: {
        rates: Array.from({ length: 20 }, (_, index) => {
          const level = index + 1
          const rate = { 1: 0.5, 13: 0.45, 20: 0.05 }[level] ?? 0

          return { level, rate }
        }),
        current: { level: 13, rate: 0.45 },
        top: [
          { level: 1, rate: 0.5 },
          { level: 13, rate: 0.45 },
          { level: 20, rate: 0.05 }
        ]
      },
      evolution: { names: ['명가의 손놀림', '속전속결'], rates: [0.6, 0.3] },
      enhancement: [0.15, 0.75],
      sampleSize: 40,
      computedAt: '2026-11-06T15:00:00.000Z'
    })
  })

  it('마스터 레벨보다 높은 표본 레벨과 이 캐릭터 레벨까지 칸을 늘린다', () => {
    const stats = statsOf({
      skills: [
        {
          name: '발도',
          learned: 20,
          levels: [
            [1, 19],
            [22, 1]
          ]
        }
      ]
    })

    expect(skillAdoptionOf(stats, BALDO)?.levels?.rates).toHaveLength(22)
    expect(skillAdoptionOf(stats, { ...BALDO, level: 24 })?.levels).toMatchObject({
      rates: { length: 24, 23: { level: 24, rate: 0 } },
      current: { level: 24, rate: 0 }
    })
  })

  it('이 캐릭터가 배우지 않은 스킬은 강조할 레벨을 두지 않는다', () => {
    expect(skillAdoptionOf(statsOf(), { ...BALDO, level: null })?.levels?.current).toBeNull()
  })

  it('많이 찍은 레벨은 비율 높은 순으로 3개까지 두고, 비율이 같으면 높은 레벨을 앞에 둔다', () => {
    const stats = statsOf({
      skills: [
        {
          name: '발도',
          learned: 20,
          levels: [
            [1, 5],
            [10, 5],
            [13, 6],
            [20, 4]
          ]
        }
      ]
    })

    expect(skillAdoptionOf(stats, BALDO)?.levels?.top).toEqual([
      { level: 13, rate: 0.3 },
      { level: 10, rate: 0.25 },
      { level: 1, rate: 0.25 }
    ])
  })

  it('찍은 레벨이 3개보다 적으면 있는 레벨만 둔다', () => {
    const stats = statsOf({ skills: [{ name: '발도', learned: 20, levels: [[13, 20]] }] })

    expect(skillAdoptionOf(stats, BALDO)?.levels?.top).toEqual([{ level: 13, rate: 1 }])
  })

  it('표본이 20명 미만이면 수치를 두지 않는다', () => {
    expect(skillAdoptionOf(statsOf({ sampleSize: 19 }), BALDO)).toBeNull()
    expect(skillAdoptionOf(statsOf({ sampleSize: 20 }), BALDO)?.adoption).toBe(1)
  })

  it('응답에 없는 스킬은 채택률 0만 두고 레벨, 개화, 강화를 두지 않는다', () => {
    expect(skillAdoptionOf(statsOf(), { ...BALDO, name: '류심 쾌' })).toEqual({
      adoption: 0,
      levels: null,
      evolution: null,
      enhancement: null,
      sampleSize: 40,
      computedAt: '2026-11-06T15:00:00.000Z'
    })
  })

  it('개화, 강화가 없는 스킬은 그 비율을 두지 않고, 아무도 고르지 않은 갈래는 0이다', () => {
    const stats = statsOf({ evolutions: [], enhancements: [] })

    expect(
      skillAdoptionOf(stats, { ...BALDO, evolutionNames: null, hasEnhancement: true })
    ).toMatchObject({ evolution: null, enhancement: [0, 0] })
  })
})

describe('skillStatsSchema', () => {
  it('API 응답 형태를 읽는다', () => {
    expect(skillStatsSchema.parse(statsOf())).toEqual(statsOf())
  })

  it.each([
    { name: 'sampleSize가 없음', body: { ...statsOf(), sampleSize: undefined } },
    { name: '기준 시각이 날짜가 아님', body: statsOf({ computedAt: '어제' }) },
    {
      name: '레벨 분포가 [레벨, 인원]이 아님',
      body: {
        ...statsOf(),
        skills: [{ name: '발도', learned: 1, levels: [{ level: 1, count: 1 }] }]
      }
    },
    {
      name: '레벨 분포의 인원 합이 learned와 다름',
      body: statsOf({ skills: [{ name: '발도', learned: 20, levels: [[1, 19]] }] })
    },
    {
      name: '개화 인원이 음수',
      body: statsOf({ evolutions: [{ name: '발도', type1: -1, type2: 0 }] })
    }
  ])('$name이면 거른다', ({ body }) => {
    expect(skillStatsSchema.safeParse(body).success).toBe(false)
  })
})
