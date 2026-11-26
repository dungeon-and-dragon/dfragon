import { expect, it } from 'vitest'
import { cardOptionLines } from './card-options'

// 합성 카드 옵션이다.
const stage = (upgrade: number, status: [string, string][]) => ({
  upgrade,
  status: status.map(([name, value]) => ({ name, value }))
})

it('옵션마다 한 줄에 낮은 단계부터 값을 모으고, 줄 순서는 가장 낮은 단계의 옵션 순서를 따른다', () => {
  const card = {
    slots: ['상의'],
    enchants: [
      stage(0, [
        ['캐스트속도', '5%'],
        ['힘', '100'],
        ['모험가 명성', '196']
      ]),
      stage(1, [
        ['힘', '105'],
        ['캐스트속도', '6%'],
        ['모험가 명성', '196']
      ]),
      stage(2, [
        ['힘', '110'],
        ['캐스트속도', '7%'],
        ['모험가 명성', '210']
      ])
    ]
  }

  expect(cardOptionLines(card)).toEqual([
    '캐스트속도 (5% / 6% / 7%)',
    '힘 (100 / 105 / 110)',
    '모험가 명성 (196 / 196 / 210)'
  ])
})

it('어떤 단계에만 있는 옵션은 없는 단계를 -로 채우고 뒤에 둔다', () => {
  const card = {
    slots: ['무기'],
    enchants: [
      stage(0, [['물리 공격력', '20']]),
      stage(1, [
        ['물리 공격력', '25'],
        ['적중률', '3%']
      ]),
      stage(2, [['물리 공격력', '30']])
    ]
  }

  expect(cardOptionLines(card)).toEqual(['물리 공격력 (20 / 25 / 30)', '적중률 (- / 3% / -)'])
})

it('단계가 하나뿐이면 괄호 없이 값 하나만 둔다', () => {
  const card = { slots: ['칭호'], enchants: [stage(0, [['모든 속성 강화', '13']])] }

  expect(cardOptionLines(card)).toEqual(['모든 속성 강화 13'])
})
