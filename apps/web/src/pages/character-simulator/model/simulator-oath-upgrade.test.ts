import { type OathUpgradeKind, oathUpgradeSteps } from '@dfragon/lib/equipment-variants'
import { expect, it } from 'vitest'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import { NO_CHANGES, simulationBody, simulatorReducer } from './simulator-draft'
import { changeUpgradeUnlock, toSimulatorOathUpgrade, upgradeOf } from './simulator-oath-upgrade'

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

it('진의는 9단계를 두고 착용한 단계를 1단계부터 차례로 읽는다', () => {
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
  expect(dealerUpgrade.worn).toEqual(DEALER_WORN)
  expect(bufferUpgrade.worn).toEqual([])
  expect(toSimulatorOathUpgrade({ oath: null })).toBeNull()
})

it('중간 단계를 해금하면 앞 단계까지 1~4단계는 최종 데미지, 5~9단계는 이동속도로 채우고 이미 해금한 단계는 그대로 둔다', () => {
  const second = changeUpgradeUnlock(bufferUpgrade, null, 2, true)

  expect(second).toEqual([
    { step: 1, option: optionOf(1, 'Damage') },
    { step: 2, option: optionOf(2, 'Damage') }
  ])
  expect(changeUpgradeUnlock(bufferUpgrade, second, 6, true)).toEqual([
    { step: 1, option: optionOf(1, 'Damage') },
    { step: 2, option: optionOf(2, 'Damage') },
    { step: 3, option: optionOf(3, 'Damage') },
    { step: 4, option: optionOf(4, 'Damage') },
    { step: 5, option: optionOf(5, 'Speed') },
    { step: 6, option: optionOf(6, 'Speed') }
  ])
  expect(changeUpgradeUnlock(bufferUpgrade, second, 1, true)).toEqual(second)
})

it('서약 포인트를 착용한 단계는 뒤 단계를 해금해도 서약 포인트로 두고, 풀었다가 다시 해금하면 최종 데미지로 채운다', () => {
  const wornOathpoint = {
    ...dealerUpgrade,
    worn: [{ step: 1, option: optionOf(1, 'Oathpoint') }]
  }
  const raised = changeUpgradeUnlock(wornOathpoint, null, 2, true)
  const cleared = changeUpgradeUnlock(wornOathpoint, raised, 1, false)

  expect(raised).toEqual([
    { step: 1, option: optionOf(1, 'Oathpoint') },
    { step: 2, option: optionOf(2, 'Damage') }
  ])
  expect(changeUpgradeUnlock(wornOathpoint, cleared, 1, true)).toEqual([
    { step: 1, option: optionOf(1, 'Damage') }
  ])
})

it('해금을 풀면 그 뒤 단계도 함께 내리고, 착용한 단계 아래로도 내린다', () => {
  const lowered = changeUpgradeUnlock(dealerUpgrade, null, 5, false)

  expect(lowered).toEqual(DEALER_WORN.slice(0, 4))
  expect(changeUpgradeUnlock(dealerUpgrade, lowered, 2, false)).toEqual(DEALER_WORN.slice(0, 1))
  expect(changeUpgradeUnlock(dealerUpgrade, null, 1, false)).toEqual([])
  expect(upgradeOf(dealerUpgrade, null)).toEqual(DEALER_WORN)
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
  const cleared = simulatorReducer(lowered, {
    type: 'oathUpgradeUnlock',
    upgrade: dealerUpgrade,
    step: 1,
    unlocked: false
  })

  expect(simulationBody([], null, NO_CHANGES)).toEqual({ equipment: [] })
  expect(simulationBody([], null, lowered)).toEqual({
    equipment: [],
    oathUpgrade: DEALER_WORN.slice(0, 4)
  })
  expect(simulationBody([], null, cleared)).toEqual({ equipment: [], oathUpgrade: [] })
  expect(simulatorReducer(cleared, { type: 'reset' })).toEqual(NO_CHANGES)
})
