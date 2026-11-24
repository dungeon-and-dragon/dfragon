import { type OathUpgradeKind, oathUpgradeSteps } from '@dfragon/lib/equipment-variants'
import { expect, it } from 'vitest'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import { NO_CHANGES, simulationBody, simulatorReducer } from './simulator-draft'
import {
  changeUpgradeOathpoint,
  changeUpgradeUnlock,
  isOathpointChosen,
  toSimulatorOathUpgrade,
  upgradeOf
} from './simulator-oath-upgrade'

// 딜러 fixture는 진의 9단계를 모두 올렸고(1~3단계 쿨타임 감소, 4단계 최종 데미지, 5~9단계 이동속도), 버퍼 fixture는 진의가 없는 영겁의 안개 서약을 낀다.
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

function optionOf(step: number, kind: OathUpgradeKind): string {
  const option = oathUpgradeSteps()[step - 1]?.options.find(
    (candidate) => candidate.kind === kind
  )?.option
  expect(option, `${step} ${kind}`).toBeDefined()

  return option!
}

it('진의는 9단계를 두고 1~4단계에만 서약 포인트 선택지가 있으며 착용한 단계를 1단계부터 차례로 읽는다', () => {
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
  expect(dealerUpgrade.steps.map(({ oathpointOption }) => oathpointOption !== null)).toEqual([
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false
  ])
  expect(dealerUpgrade.worn).toEqual(DEALER_WORN)
  expect(bufferUpgrade.worn).toEqual([])
  expect(toSimulatorOathUpgrade({ oath: null })).toBeNull()
})

it('중간 단계를 해금하면 앞 단계까지 1~4단계는 최종 데미지, 5~9단계는 이동속도로 채우고 이미 해금한 단계는 그대로 둔다', () => {
  const second = changeUpgradeUnlock(bufferUpgrade, null, 2, true)
  const oathpoint = changeUpgradeOathpoint(bufferUpgrade, second, 2, true)

  expect(second).toEqual([
    { step: 1, option: optionOf(1, 'Damage') },
    { step: 2, option: optionOf(2, 'Damage') }
  ])
  expect(changeUpgradeUnlock(bufferUpgrade, oathpoint, 6, true)).toEqual([
    { step: 1, option: optionOf(1, 'Damage') },
    { step: 2, option: optionOf(2, 'Oathpoint') },
    { step: 3, option: optionOf(3, 'Damage') },
    { step: 4, option: optionOf(4, 'Damage') },
    { step: 5, option: optionOf(5, 'Speed') },
    { step: 6, option: optionOf(6, 'Speed') }
  ])
  expect(changeUpgradeUnlock(bufferUpgrade, oathpoint, 1, true)).toEqual(oathpoint)
})

it('해금을 풀면 그 뒤 단계도 함께 내리고, 착용한 단계 아래로도 내린다', () => {
  const lowered = changeUpgradeUnlock(dealerUpgrade, null, 5, false)

  expect(lowered).toEqual(DEALER_WORN.slice(0, 4))
  expect(changeUpgradeUnlock(dealerUpgrade, lowered, 2, false)).toEqual(DEALER_WORN.slice(0, 1))
  expect(changeUpgradeUnlock(dealerUpgrade, null, 1, false)).toEqual([])
  expect(upgradeOf(dealerUpgrade, null)).toEqual(DEALER_WORN)
})

it('쿨타임 감소를 낀 단계는 서약 포인트가 아니고, 서약 포인트에서 되돌리면 착용한 쿨타임 감소로 돌아와 바꾸지 않은 것이 된다', () => {
  const oathpoint = changeUpgradeOathpoint(dealerUpgrade, null, 1, true)

  expect(isOathpointChosen(dealerUpgrade, null, 1)).toBe(false)
  expect(oathpoint).toEqual([
    { step: 1, option: optionOf(1, 'Oathpoint') },
    ...DEALER_WORN.slice(1)
  ])
  expect(isOathpointChosen(dealerUpgrade, oathpoint, 1)).toBe(true)
  expect(changeUpgradeOathpoint(dealerUpgrade, oathpoint, 1, false)).toBeNull()
  expect(changeUpgradeOathpoint(dealerUpgrade, null, 1, false)).toBeNull()
})

it('착용하지 않은 단계나 서약 포인트를 착용한 단계를 되돌리면 최종 데미지로 두고, 해금하지 않았거나 5~9단계면 바꾸지 않는다', () => {
  const second = changeUpgradeUnlock(bufferUpgrade, null, 2, true)
  const oathpoint = changeUpgradeOathpoint(bufferUpgrade, second, 2, true)
  const wornOathpoint = {
    ...dealerUpgrade,
    worn: [{ step: 1, option: optionOf(1, 'Oathpoint') }]
  }

  expect(changeUpgradeOathpoint(bufferUpgrade, oathpoint, 2, false)).toEqual(second)
  expect(changeUpgradeOathpoint(wornOathpoint, null, 1, false)).toEqual([
    { step: 1, option: optionOf(1, 'Damage') }
  ])
  expect(changeUpgradeOathpoint(bufferUpgrade, second, 3, true)).toBe(second)
  expect(changeUpgradeOathpoint(dealerUpgrade, null, 5, true)).toBeNull()
})

it('내렸다가 다시 해금해 착용한 진의와 같아지면 바꾸지 않은 것으로 둔다', () => {
  const lowered = changeUpgradeUnlock(dealerUpgrade, null, 5, false)

  expect(changeUpgradeUnlock(bufferUpgrade, null, 1, false)).toBeNull()
  expect(changeUpgradeUnlock(dealerUpgrade, null, 9, true)).toBeNull()
  expect(changeUpgradeUnlock(dealerUpgrade, lowered, 9, true)).toBeNull()
})

it('요청에는 바꾼 진의 전체를 넣고, 바꾸지 않았으면 넣지 않으며 초기화하면 지운다', () => {
  const lowered = simulatorReducer(NO_CHANGES, {
    type: 'oathUpgradeUnlock',
    upgrade: dealerUpgrade,
    step: 5,
    unlocked: false
  })
  const oathpoint = simulatorReducer(lowered, {
    type: 'oathUpgradeOathpoint',
    upgrade: dealerUpgrade,
    step: 4,
    oathpoint: true
  })
  const cleared = simulatorReducer(oathpoint, {
    type: 'oathUpgradeUnlock',
    upgrade: dealerUpgrade,
    step: 1,
    unlocked: false
  })

  expect(simulationBody([], null, NO_CHANGES)).toEqual({ equipment: [] })
  expect(simulationBody([], null, oathpoint)).toEqual({
    equipment: [],
    oathUpgrade: [...DEALER_WORN.slice(0, 3), { step: 4, option: optionOf(4, 'Oathpoint') }]
  })
  expect(simulationBody([], null, cleared)).toEqual({ equipment: [], oathUpgrade: [] })
  expect(simulatorReducer(cleared, { type: 'reset' })).toEqual(NO_CHANGES)
})
