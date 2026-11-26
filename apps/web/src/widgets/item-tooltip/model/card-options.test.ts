import { expect, it } from 'vitest'
import { cardOptionRows } from './card-options'

// 합성 카드 옵션이다.
const stage = (upgrade: number, status: [string, string][], buffSkills: string[] = []) => ({
  upgrade,
  status: status.map(([name, value]) => ({ name, value })),
  reinforceSkill: buffSkills.map((value, index) => ({
    jobName: `합성 직업 ${index}`,
    skills: [{ name: `합성 버프 ${index}`, value }]
  }))
})

const buffCard = {
  slots: ['상의'],
  enchants: [
    stage(0, [
      ['캐스트속도', '5%'],
      ['힘', '100'],
      ['모든 속성 강화', '10']
    ]),
    stage(1, [
      ['힘', '105'],
      ['캐스트속도', '6%'],
      ['모든 속성 강화', '11']
    ])
  ]
}

it('옵션마다 낮은 단계부터 값을 모으고, 줄 순서는 가장 낮은 단계의 옵션 순서를 따른다', () => {
  expect(cardOptionRows(buffCard, undefined).map(({ name, values }) => [name, values])).toEqual([
    ['캐스트속도', ['5%', '6%']],
    ['힘', ['100', '105']],
    ['모든 속성 강화', ['10', '11']]
  ])
})

it('딜러는 속성 강화를, 버퍼는 올스탯 묶음을 강조하고, 역할을 모르면 둘 다 강조한다', () => {
  const emphasizedOf = (role: 'dealer' | 'buffer' | undefined) =>
    cardOptionRows(buffCard, role)
      .filter(({ emphasized }) => emphasized)
      .map(({ name }) => name)

  expect(emphasizedOf('dealer')).toEqual(['모든 속성 강화'])
  expect(emphasizedOf('buffer')).toEqual(['힘'])
  expect(emphasizedOf(undefined)).toEqual(['힘', '모든 속성 강화'])
})

it('어떤 단계에만 있는 옵션은 없는 단계를 -로 채우고 뒤에 두며, 단계가 하나면 값도 하나다', () => {
  const partial = {
    slots: ['무기'],
    enchants: [
      stage(0, [['물리 공격력', '20']]),
      stage(1, [
        ['물리 공격력', '25'],
        ['적중률', '3%']
      ])
    ]
  }
  const single = { slots: ['칭호'], enchants: [stage(0, [['모든 속성 강화', '13']])] }

  expect(cardOptionRows(partial, 'dealer').map(({ values }) => values)).toEqual([
    ['20', '25'],
    ['-', '3%']
  ])
  expect(cardOptionRows(single, 'dealer').map(({ values }) => values)).toEqual([['13']])
})

it('버프 스킬은 직업별 값 가운데 단계마다 가장 큰 값을 버프 패시브 스킬 한 줄로 묶어 장비 탭 옵션 순서 자리에 두고, 버퍼 기준에서 강조한다', () => {
  const card = {
    slots: ['상의'],
    enchants: [
      stage(
        0,
        [
          ['모든 속성 강화', '10'],
          ['힘', '105'],
          ['모험가 명성', '210']
        ],
        ['3', '4']
      ),
      stage(
        1,
        [
          ['힘', '115'],
          ['모험가 명성', '221']
        ],
        ['4']
      ),
      stage(2, [
        ['힘', '125'],
        ['모험가 명성', '240']
      ])
    ]
  }

  expect(cardOptionRows(card, 'buffer')).toEqual([
    { name: '모든 속성 강화', values: ['10', '-', '-'], emphasized: false },
    { name: '버프 패시브 스킬', values: ['4', '4', '-'], emphasized: true },
    { name: '힘', values: ['105', '115', '125'], emphasized: true },
    { name: '모험가 명성', values: ['210', '221', '240'], emphasized: false }
  ])
  expect(cardOptionRows(card, 'dealer')[1]).toMatchObject({
    name: '버프 패시브 스킬',
    emphasized: false
  })
})

it('버프 스킬이 없는 카드는 버프 패시브 스킬 줄이 없다', () => {
  const card = { slots: ['무기'], enchants: [stage(0, [['모든 속성 강화', '13']])] }

  expect(cardOptionRows(card, undefined).map(({ name }) => name)).toEqual(['모든 속성 강화'])
})
