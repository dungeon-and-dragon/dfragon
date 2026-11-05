import { describe, expect, it } from 'vitest'
import { characterDetailFixture } from '../testing/fixtures/character-detail'
import { groupEnchant, toEquipmentView } from './character-equipment'

type Stat = { name: string; value: number | string }

function enchantOf(status: Stat[], skillLevels: number[][] = []) {
  return {
    status,
    reinforceSkill: skillLevels.map((levels) => ({
      skills: levels.map((value) => ({ name: '스킬', value }))
    }))
  }
}

describe('마법부여 묶음', () => {
  it.each<[string, Stat[], string[]]>([
    [
      '힘, 지능, 체력, 정신력은 올스탯 하나로 묶는다',
      [
        { name: '힘', value: 110 },
        { name: '지능', value: 110 },
        { name: '체력', value: 110 },
        { name: '정신력', value: 110 },
        { name: '캐스트속도', value: '7%' }
      ],
      ['올스탯 +110', '캐스트속도 +7%']
    ],
    ['정신력 하나만 있어도 올스탯으로 쓴다', [{ name: '정신력', value: 50 }], ['올스탯 +50']],
    [
      '물리, 마법, 독립 공격력은 공격력, 물리, 마법 크리티컬 히트는 크리티컬로 묶는다',
      [
        { name: '물리 공격력', value: 10 },
        { name: '마법 공격력', value: 10 },
        { name: '독립 공격력', value: 10 },
        { name: '물리 크리티컬 히트', value: '5%' },
        { name: '마법 크리티컬 히트', value: '5%' }
      ],
      ['공격력 +10', '크리티컬 +5%']
    ],
    [
      '속성 하나의 강화와 모든 속성 강화는 모든 속성 강화로 묶는다',
      [
        { name: '화속성강화', value: 15 },
        { name: '명속성강화', value: 15 },
        { name: '모든 속성 강화', value: 12 }
      ],
      ['모든 속성 강화 +15']
    ],
    [
      '한 묶음의 수치가 다르면 가장 큰 값을 쓴다',
      [
        { name: '힘', value: 40 },
        { name: '지능', value: 90 },
        { name: '물리 크리티컬 히트', value: '3.0%' },
        { name: '마법 크리티컬 히트', value: '12%' }
      ],
      ['올스탯 +90', '크리티컬 +12%']
    ],
    [
      '묶지 않는 이름은 응답 이름 그대로 쓴다',
      [
        { name: '최종 데미지 증가', value: '1%' },
        { name: '공격력 증폭', value: '3%' }
      ],
      ['최종 데미지 증가 +1%', '공격력 증폭 +3%']
    ]
  ])('%s', (_, status, expected) => {
    expect(groupEnchant(enchantOf(status))).toEqual(expected)
  })

  it('스킬 레벨 증가는 직업별 스킬 가운데 가장 큰 레벨로 버프 패시브 스킬 +N을 쓴다', () => {
    expect(groupEnchant(enchantOf([{ name: '힘', value: 25 }], [[3], [4], [3]]))).toEqual([
      '올스탯 +25',
      '버프 패시브 스킬 +4'
    ])
  })

  it('마법부여가 없으면 빈 목록이다', () => {
    expect(groupEnchant(null)).toEqual([])
  })
})

describe('장비 탭 값', () => {
  it('딜러의 강화, 증폭, 마법부여, 세트, 안개 융화, 크리쳐, 오라를 응답과 같게 읽는다', () => {
    const view = toEquipmentView(characterDetailFixture('dealer'))

    expect(view.items.map((item) => item.slotName)).toEqual([
      '무기',
      '칭호',
      '상의',
      '머리어깨',
      '하의',
      '신발',
      '벨트',
      '목걸이',
      '팔찌',
      '반지',
      '보조장비',
      '마법석',
      '귀걸이'
    ])
    expect(view.items[0]).toMatchObject({
      itemName: '재앙의 송곳니',
      rarity: 'primordial',
      reinforce: { kind: 'enhance', value: 10 },
      refine: null,
      tune: null,
      enchants: ['모든 속성 강화 +15'],
      setPoint: null,
      exalted: false,
      potency: null
    })
    expect(view.items[1].reinforce).toBeNull()
    expect(view.items[3].enchants).toEqual([
      '올스탯 +40',
      '공격력 +10',
      '크리티컬 +5%',
      '최종 데미지 증가 +3%'
    ])
    expect(view.items[3].setPoint).toBe(235)
    expect(view.items[12].reinforce).toEqual({ kind: 'amplify', value: 8 })
    expect(view.sets).toEqual([
      { name: '로열 페어리 세트', rarityName: '태초', rarity: 'primordial', point: 2615 }
    ])
    expect(view.mistLevel).toBe(100)
    expect(view.creature).toMatchObject({ itemName: '운명을 담는 재단사', rarity: 'rare' })
    expect(view.aura).toMatchObject({
      itemName: '고결한 영혼의 잔상',
      emblems: ['빛나는 붉은빛 엠블렘[힘]', '빛나는 붉은빛 엠블렘[힘]']
    })
  })

  it('버퍼의 재련과 스킬 레벨 증가 마법부여를 읽는다', () => {
    const view = toEquipmentView(characterDetailFixture('buffer'))

    expect(view.items[0]).toMatchObject({ slotName: '무기', reinforce: null, refine: 8 })
    expect(view.items[2]).toMatchObject({
      slotName: '상의',
      reinforce: null,
      enchants: ['올스탯 +100', '버프 패시브 스킬 +3']
    })
  })

  it('조율 단계를 로마 숫자로, 유일 장비 여부와 정밀도를 읽는다', () => {
    const detail = characterDetailFixture('dealer')
    const [, , jacket, shoulder, pants] = detail.equipment.equipment
    jacket.tune = [{ level: 1, setPoint: 245 }]
    shoulder.tune = [{ level: 3, setPoint: 265 }]
    Object.assign(pants, { exaltedInfo: { explain: null }, potency: { value: 100 } })
    const view = toEquipmentView(detail)

    expect(
      view.items.slice(2, 5).map(({ tune, exalted, potency }) => [tune, exalted, potency])
    ).toEqual([
      ['I', false, null],
      ['III', false, null],
      [null, true, '100%']
    ])
  })

  it('응답에 없는 슬롯은 행이 없고, 크리쳐, 오라, 세트, 안개 융화가 없으면 비운다', () => {
    const detail = characterDetailFixture('dealer')
    const view = toEquipmentView({
      equipment: {
        equipment: detail.equipment.equipment.filter(({ slotId }) => slotId !== 'TITLE'),
        setItemInfo: []
      },
      creature: null,
      avatar: [],
      mistAssimilation: null
    })

    expect(view.items).toHaveLength(12)
    expect(view.items.map((item) => item.slotName)).not.toContain('칭호')
    expect(view).toMatchObject({ sets: [], mistLevel: null, creature: null, aura: null })
  })
})
