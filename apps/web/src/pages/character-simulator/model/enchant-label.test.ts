import { enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import { expect, it } from 'vitest'
import { equippedEnchantLabels, optionEnchantLabels } from './enchant-label'

type Status = readonly (readonly [string, number | string])[]

function enchantOf(status: Status, skillLevels: readonly (number | string)[] = []) {
  const stats = status.map(([name, value]) => ({ name, value }))
  const reinforceSkill = skillLevels.map((value) => ({ skills: [{ name: '스킬', value }] }))

  return { status: stats, reinforceSkill }
}

function labels(
  status: Status,
  role: 'dealer' | 'buffer' = 'dealer',
  skills?: (number | string)[]
) {
  return equippedEnchantLabels(enchantOf(status, skills), role).map(({ label }) => label)
}

it('주스탯은 하나만 있어도 가장 큰 값의 올스탯으로 보인다', () => {
  expect(labels([['힘', 100]])).toEqual(['올스탯 +100'])
  expect(
    labels([
      ['힘', 100],
      ['지능', 90]
    ])
  ).toEqual(['올스탯 +100'])
})

it('공격력은 물리, 마법, 독립이 모두 같은 값일 때만 줄이고 아니면 실제 이름으로 둔다', () => {
  expect(
    labels([
      ['물리 공격력', 90],
      ['힘', 60]
    ])
  ).toEqual(['물리 공격력 +90', '올스탯 +60'])
  expect(
    labels([
      ['물리 공격력', 30],
      ['마법 공격력', 30],
      ['독립 공격력', 30]
    ])
  ).toEqual(['공격력 +30'])
})

it('크리티컬은 값이 달라도 가장 큰 값으로 줄이고 퍼센트 표기의 소수점 0은 뗀다', () => {
  expect(
    labels([
      ['물리 크리티컬 히트', '3.0%'],
      ['마법 크리티컬 히트', '5%']
    ])
  ).toEqual(['크리티컬 +5%'])
})

it('딜러는 최종 데미지, 공격력 증폭, 속성 강화를 강조해 앞에 두고 단일 속성 강화는 띄어 쓴 이름으로 각각 둔다', () => {
  const options = equippedEnchantLabels(
    enchantOf([
      ['힘', 50],
      ['지능', 50],
      ['물리 공격력', 15],
      ['마법 공격력', 15],
      ['독립 공격력', 15],
      ['화속성강화', 15],
      ['명속성강화', 15],
      ['최종 데미지 증가', '3%']
    ]),
    'dealer'
  )

  expect(options).toEqual([
    { label: '최종 데미지 증가 +3%', emphasized: true },
    { label: '화속성 강화 +15', emphasized: true },
    { label: '명속성 강화 +15', emphasized: true },
    { label: '공격력 +15', emphasized: false },
    { label: '올스탯 +50', emphasized: false }
  ])
})

it('버퍼는 직업별 스킬 강화를 버프 패시브 스킬 한 줄로 두고 올스탯과 함께 강조해 앞에 둔다', () => {
  const options = equippedEnchantLabels(
    enchantOf(
      [
        ['물리 크리티컬 히트', '7%'],
        ['마법 크리티컬 히트', '7%'],
        ['힘', 120],
        ['지능', 120],
        ['체력', 120],
        ['정신력', 120]
      ],
      ['3', '3']
    ),
    'buffer'
  )

  expect(options).toEqual([
    { label: '버프 패시브 스킬 +3', emphasized: true },
    { label: '올스탯 +120', emphasized: true },
    { label: '크리티컬 +7%', emphasized: false }
  ])
})

it('등급표 목록은 표시가 같아진 항목을 한 줄로 보이고 착용한 마법부여와 같은 표기를 쓴다', () => {
  const semiFinals = enchantOptionsOf('WEAPON', 'dealer').준종결
  const listed = semiFinals.map((option) =>
    optionEnchantLabels(option, 'dealer')
      .map(({ label }) => label)
      .join(', ')
  )

  expect(listed.filter((label) => label === '올스탯 +100')).toHaveLength(1)
  expect(listed).toContain('물리 공격력 +90, 올스탯 +60')
  expect(labels([['지능', 100]])).toEqual(['올스탯 +100'])
})

it('마법부여가 없으면 빈 목록이다', () => {
  expect(equippedEnchantLabels(null, 'dealer')).toEqual([])
})
