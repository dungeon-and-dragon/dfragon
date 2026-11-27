import assert from 'node:assert/strict'
import test from 'node:test'
import { cardOptionRows } from '@dfragon/lib/enchant-options'

// 합성 카드 옵션이다.
const stage = (upgrade, status, buffSkills = []) => ({
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
    stage(
      0,
      [
        ['캐스트속도', '5%'],
        ['힘', '100'],
        ['물리 공격력', '20'],
        ['모든 속성 강화', '10'],
        ['모험가 명성', '210']
      ],
      ['3']
    ),
    stage(
      1,
      [
        ['지능', '105'],
        ['캐스트속도', '6%'],
        ['물리 공격력', '25'],
        ['모든 속성 강화', '11'],
        ['모험가 명성', '221']
      ],
      ['4']
    )
  ]
}

test('힘, 지능, 체력, 정신력은 올스탯, 공격력과 크리티컬 히트도 각 묶음 한 줄로 합치고, 단계마다 묶음의 가장 큰 값을 보인다', () => {
  const card = {
    slots: ['무기'],
    enchants: [
      stage(0, [
        ['힘', '100'],
        ['지능', '120'],
        ['물리 공격력', '20'],
        ['독립 공격력', '30'],
        ['물리 크리티컬 히트', '3%']
      ]),
      stage(1, [
        ['체력', '110'],
        ['정신력', '105'],
        ['마법 공격력', '35'],
        ['마법 크리티컬 히트', '4%'],
        ['물리 크리티컬 히트', '5%']
      ])
    ]
  }

  assert.deepEqual(
    cardOptionRows(card, 'dealer').map(({ name, values }) => [name, values]),
    [
      ['공격력', ['30', '35']],
      ['올스탯', ['120', '110']],
      ['크리티컬', ['3%', '5%']]
    ]
  )
})

test('딜러는 속성 강화, 버퍼는 버프 패시브 스킬과 올스탯을 위로 올리고, 그다음 장비 탭 옵션 순서를 따르며 순서가 같은 줄은 원래 순서를 지킨다', () => {
  const rowsOf = (role) =>
    cardOptionRows(buffCard, role).map(({ name, emphasized }) => [name, emphasized])

  assert.deepEqual(rowsOf('dealer'), [
    ['모든 속성 강화', true],
    ['버프 패시브 스킬', false],
    ['공격력', false],
    ['올스탯', false],
    ['캐스트속도', false],
    ['모험가 명성', false]
  ])
  assert.deepEqual(rowsOf('buffer'), [
    ['버프 패시브 스킬', true],
    ['올스탯', true],
    ['모든 속성 강화', false],
    ['공격력', false],
    ['캐스트속도', false],
    ['모험가 명성', false]
  ])
})

test('역할을 모르면 딜러와 버퍼의 강조 줄을 모두 위로 올린다', () => {
  assert.deepEqual(
    cardOptionRows(buffCard, undefined).map(({ name, emphasized }) => [name, emphasized]),
    [
      ['모든 속성 강화', true],
      ['버프 패시브 스킬', true],
      ['올스탯', true],
      ['공격력', false],
      ['캐스트속도', false],
      ['모험가 명성', false]
    ]
  )
})

test('단일 속성 강화는 모든 속성 강화로 바꾸지 않고 이름 그대로 두되, 딜러 기준에서 속성 강화처럼 강조해 위로 올린다', () => {
  const card = {
    slots: ['목걸이'],
    enchants: [
      stage(0, [
        ['힘', '50'],
        ['화속성강화', '20'],
        ['수속성 강화', '18']
      ])
    ]
  }

  assert.deepEqual(
    cardOptionRows(card, 'dealer').map(({ name, values, emphasized }) => [
      name,
      values,
      emphasized
    ]),
    [
      ['화속성강화', ['20'], true],
      ['수속성 강화', ['18'], true],
      ['올스탯', ['50'], false]
    ]
  )
})

test('어떤 단계에만 있는 옵션은 없는 단계를 -로 채우되 순서는 강조와 옵션 순서를 따르고, 단계가 하나면 값도 하나다', () => {
  const partial = {
    slots: ['무기'],
    enchants: [
      stage(0, [['물리 공격력', '20']]),
      stage(1, [
        ['물리 공격력', '25'],
        ['모든 속성 강화', '3']
      ])
    ]
  }
  const single = { slots: ['칭호'], enchants: [stage(0, [['모든 속성 강화', '13']])] }

  assert.deepEqual(
    cardOptionRows(partial, 'dealer').map(({ name, values }) => [name, values]),
    [
      ['모든 속성 강화', ['-', '3']],
      ['공격력', ['20', '25']]
    ]
  )
  assert.deepEqual(
    cardOptionRows(single, 'dealer').map(({ values }) => values),
    [['13']]
  )
})

test('버프 스킬은 직업별 값 가운데 단계마다 가장 큰 값을 버프 패시브 스킬 한 줄로 묶고, 버퍼 기준에서 강조해 맨 위에 둔다', () => {
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

  const { name, emphasized } = cardOptionRows(card, 'dealer')[1]

  assert.deepEqual(cardOptionRows(card, 'buffer'), [
    { name: '버프 패시브 스킬', values: ['4', '4', '-'], emphasized: true },
    { name: '올스탯', values: ['105', '115', '125'], emphasized: true },
    { name: '모든 속성 강화', values: ['10', '-', '-'], emphasized: false },
    { name: '모험가 명성', values: ['210', '221', '240'], emphasized: false }
  ])
  assert.deepEqual({ name, emphasized }, { name: '버프 패시브 스킬', emphasized: false })
})

test('버프 스킬이 없는 카드는 버프 패시브 스킬 줄이 없다', () => {
  const card = { slots: ['무기'], enchants: [stage(0, [['모든 속성 강화', '13']])] }

  assert.deepEqual(
    cardOptionRows(card, undefined).map(({ name }) => name),
    ['모든 속성 강화']
  )
})
