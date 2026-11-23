import { oathUpgradeSteps } from '@dfragon/lib/equipment-variants'
import { expect, it } from 'vitest'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import { NO_CHANGES, simulationBody, simulatorReducer } from './simulator-draft'
import {
  changeUpgradeStep,
  toSimulatorOathUpgrade,
  upgradeOf,
  upgradeStepNameOf
} from './simulator-oath-upgrade'

// 딜러 fixture는 진의 9단계를 모두 올렸고, 버퍼 fixture는 진의가 없는 영겁의 안개 서약을 낀다.
const DEALER_WORN = [
  '고요한 호흡',
  '자애의 마음',
  '내면의 조율',
  '신념의 대가',
  '이어진 걸음',
  '영원의 궤적',
  '만물의 흐름',
  '순례자의 길',
  '진리 도달'
].map((option, index) => ({ step: index + 1, option }))

const dealerUpgrade = toSimulatorOathUpgrade(characterDetailFixture('dealer'))!
const bufferUpgrade = toSimulatorOathUpgrade(characterDetailFixture('buffer'))!

function optionOf(step: number, index: number): string {
  const option = oathUpgradeSteps()[step - 1]?.options[index]?.option
  expect(option, `${step} ${index}`).toBeDefined()

  return option!
}

it('진의는 9단계와 단계마다 서약 탭 표기의 선택지를 두고 착용한 단계를 1단계부터 차례로 읽는다', () => {
  expect(dealerUpgrade.title).toBe('묵언의 진의')
  expect(dealerUpgrade.steps.map(({ name }) => name)).toEqual([
    '첫 번째 진의',
    '두 번째 진의',
    '세 번째 진의',
    '네 번째 진의',
    '다섯 번째 진의',
    '여섯 번째 진의',
    '일곱 번째 진의',
    '여덟 번째 진의',
    '아홉 번째 진의'
  ])
  expect(dealerUpgrade.steps[0]?.options.map(({ label }) => label)).toEqual([
    '최종 데미지',
    '쿨타임 감소',
    '서약 포인트'
  ])
  expect(dealerUpgrade.steps[4]?.options.map(({ label }) => label)).toEqual([
    '이동속도',
    '범위',
    '방어력'
  ])
  expect(dealerUpgrade.worn).toEqual(DEALER_WORN)
  expect(bufferUpgrade.worn).toEqual([])
  expect(toSimulatorOathUpgrade({ oath: null })).toBeNull()
})

it('올리지 않은 단계는 바로 다음 단계만 올리고 없는 선택지는 받지 않는다', () => {
  const first = changeUpgradeStep(bufferUpgrade, null, 1, optionOf(1, 0))

  expect(changeUpgradeStep(bufferUpgrade, null, 2, optionOf(2, 0))).toBeNull()
  expect(first).toEqual([{ step: 1, option: optionOf(1, 0) }])
  expect(changeUpgradeStep(bufferUpgrade, first, 2, optionOf(2, 1))).toEqual([
    { step: 1, option: optionOf(1, 0) },
    { step: 2, option: optionOf(2, 1) }
  ])
  expect(changeUpgradeStep(bufferUpgrade, first, 2, optionOf(3, 0))).toBe(first)
  expect(changeUpgradeStep(bufferUpgrade, first, 3, optionOf(3, 0))).toBe(first)
})

it('단계를 내리면 그 뒤 단계도 함께 내리고, 올린 단계의 선택지만 바꾸면 다른 단계는 그대로 둔다', () => {
  const lowered = changeUpgradeStep(dealerUpgrade, null, 5, null)
  const swapped = changeUpgradeStep(dealerUpgrade, null, 1, optionOf(1, 0))

  expect(lowered).toEqual(DEALER_WORN.slice(0, 4))
  expect(upgradeStepNameOf(dealerUpgrade, lowered)).toBe('네 번째 진의')
  expect(swapped).toEqual([{ step: 1, option: optionOf(1, 0) }, ...DEALER_WORN.slice(1)])
  expect(upgradeOf(dealerUpgrade, null)).toEqual(DEALER_WORN)
})

it('착용한 진의와 같아지면 바꾸지 않은 것으로 두고, 모두 내리면 빈 진의다', () => {
  const swapped = changeUpgradeStep(dealerUpgrade, null, 1, optionOf(1, 0))

  expect(changeUpgradeStep(dealerUpgrade, swapped, 1, DEALER_WORN[0]!.option)).toBeNull()
  expect(changeUpgradeStep(dealerUpgrade, null, 1, null)).toEqual([])
  expect(upgradeStepNameOf(dealerUpgrade, [])).toBeNull()
})

it('요청에는 바꾼 진의 전체를 넣고, 바꾸지 않았으면 넣지 않으며 초기화하면 지운다', () => {
  const lowered = simulatorReducer(NO_CHANGES, {
    type: 'oathUpgrade',
    upgrade: dealerUpgrade,
    step: 5,
    option: null
  })
  const cleared = simulatorReducer(lowered, {
    type: 'oathUpgrade',
    upgrade: dealerUpgrade,
    step: 1,
    option: null
  })

  expect(simulationBody([], null, NO_CHANGES)).toEqual({ equipment: [] })
  expect(simulationBody([], null, lowered)).toEqual({
    equipment: [],
    oathUpgrade: DEALER_WORN.slice(0, 4)
  })
  expect(simulationBody([], null, cleared)).toEqual({ equipment: [], oathUpgrade: [] })
  expect(simulatorReducer(lowered, { type: 'reset' })).toEqual(NO_CHANGES)
})
