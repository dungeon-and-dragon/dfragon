import type { EpicSoulSlot } from '@dfragon/lib/epic-soul-recovery'
import type { CharacterCardScore } from '@dfragon/server-core/domain/character-card/index.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import type {
  EquipmentSimulationService,
  SimulatedPlan
} from '#application/equipment-simulation/index.js'
import {
  type RecoveryAfterItem,
  type RecoveryCandidate,
  recoveryCandidates,
  wornEpicItems
} from './candidates.js'

export interface EpicSoulRecoverySlot {
  readonly slotId: EpicSoulSlot
  readonly before: {
    readonly itemId: string
    readonly itemName: string
    readonly itemRarity: string
    readonly tune: number
    /** 시뮬레이터 주소에 착용 강화, 증폭을 그대로 담는 데 쓴다. */
    readonly reinforce: number
    readonly amplified: boolean
  }
  /** 최고 세팅이 없으면 null이다. */
  readonly after: RecoveryAfterItem | null
  readonly souls: number
}

export interface EpicSoulRecoveryBest {
  readonly score: CharacterCardScore
  readonly setItemId: string
  /** 무기가 에픽이 아니면 null이다. */
  readonly weaponVariantId: string | null
}

export interface EpicSoulRecoveryResult {
  readonly souls: {
    readonly total: number
    readonly slots: readonly EpicSoulRecoverySlot[]
  }
  readonly baseline: CharacterCardScore | null
  /** 에픽 부위가 없거나 점수를 낸 세트가 없으면 null이다. */
  readonly best: EpicSoulRecoveryBest | null
}

type Simulated = SimulatedPlan<RecoveryCandidate>

interface ScoredCandidate {
  readonly candidate: RecoveryCandidate
  readonly score: CharacterCardScore
  readonly value: number
}

/** 점수가 같으면 세트 목록과 무기 계열 순서에서 먼저 나온 세팅이다. */
function bestOf(simulated: readonly Simulated[]): ScoredCandidate | null {
  let best: ScoredCandidate | null = null

  for (const { plan, scores } of simulated) {
    const score = scores.simulated
    const value = score?.value

    if (score != null && value != null && (best === null || value > best.value)) {
      best = { candidate: plan, score, value }
    }
  }

  return best
}

function baselineOf(simulated: readonly Simulated[]): CharacterCardScore | null {
  for (const { scores } of simulated) {
    if (scores.baseline !== null) {
      return scores.baseline
    }
  }

  return null
}

export class EpicSoulRecoveryService {
  constructor(private readonly simulation: EquipmentSimulationService) {}

  /** 가상 점수는 시뮬레이션처럼 상세 응답 캐시, 조회 알림, DB에 남기지 않는다. */
  async recover(
    identity: CharacterIdentity,
    includePrimordial: boolean,
    signal: AbortSignal
  ): Promise<EpicSoulRecoveryResult> {
    const { payloads, simulated } = await this.simulation.simulateEach(
      identity,
      (payloads) =>
        recoveryCandidates(
          payloads.equipment,
          wornEpicItems(payloads.equipment),
          includePrimordial
        ),
      signal
    )
    const worn = wornEpicItems(payloads.equipment)
    const best = bestOf(simulated)
    const slots = worn.slots.map(({ slotId, souls, ...before }) => {
      const after = best?.candidate.after.get(slotId) ?? null

      return { slotId, before, after, souls }
    })
    const bestSetting = best && {
      score: best.score,
      setItemId: best.candidate.setItemId,
      weaponVariantId: best.candidate.weaponVariantId
    }
    const baseline = baselineOf(simulated)

    return { souls: { total: worn.total, slots }, baseline, best: bestSetting }
  }
}
