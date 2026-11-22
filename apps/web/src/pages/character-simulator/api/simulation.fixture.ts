import type { CharacterCardScore, CharacterDetailView } from '#entities/character'
import type { SimulationBody } from '#pages/character-simulator/model/simulator-draft'
import type { EquipmentSimulation } from './useEquipmentSimulation'

// 엔진을 열지 않고 바꾼 부위마다 점수를 정해진 만큼 더하는 합성 결과다. 실제 점수 계산과 관계없다.
const VERSIONS = { package: 'story', rulesRev: 'story', bundleId: 'story' }
const BASELINE = { equipment: 1_741_052, buff: 4_120_385 } as const
const POINTS_PER_REINFORCE = 3_100
const AMPLIFY_POINTS = 12_400
const ENCHANT_POINTS = 8_200

type Calculator = CharacterCardScore['calculator']

export function simulationScore(
  calculator: Calculator,
  score: Partial<CharacterCardScore> = {}
): CharacterCardScore {
  return {
    calculator,
    value: BASELINE[calculator],
    skipped: null,
    approximate: null,
    versions: VERSIONS,
    ...score
  }
}

export function calculatorOf(detail: CharacterDetailView): Calculator {
  if (detail.card?.role === 'buffer') {
    return 'buff'
  }

  return 'equipment'
}

function pointsOf(detail: CharacterDetailView, body: SimulationBody): number {
  const items = detail.equipment.equipment

  return body.equipment.reduce((sum, change) => {
    const item = items.find(({ slotId }) => slotId === change.slotId)
    const reinforce = (change.reinforce - (item?.reinforce ?? 0)) * POINTS_PER_REINFORCE
    const amplified = change.amplified !== (item?.amplificationName != null) ? AMPLIFY_POINTS : 0
    const enchant = change.enchantId !== null ? ENCHANT_POINTS : 0

    return sum + reinforce + amplified + enchant
  }, 0)
}

export function syntheticSimulation(
  detail: CharacterDetailView,
  body: SimulationBody
): EquipmentSimulation {
  const calculator = calculatorOf(detail)
  const baseline = simulationScore(calculator)
  const value = BASELINE[calculator] + pointsOf(detail, body)
  const simulated = simulationScore(calculator, { value })

  return { baseline, simulated }
}
