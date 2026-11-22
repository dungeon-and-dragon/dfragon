import {
  type CharacterCardScore,
  cardScoreCalculator,
  toCardScore,
  toSimulatedCardScore
} from '@dfragon/server-core/domain/character-card/index.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import {
  type ScoreCalculator,
  type ScoreEngineInput,
  type ScoreEngineResult,
  type ScoreMainStat,
  toScoreEngineInput
} from '@dfragon/server-core/domain/score/index.js'
import type { CalculateScore } from '@dfragon/server-core/application/character-detail/ports.js'
import {
  type EquipmentChange,
  amplifiesReinforcedItem,
  editEquipment,
  mainStatAmplificationName,
  simulatedEquipment,
  wornAmplificationName
} from '#domain/equipment-simulation/index.js'
import type { LoadCharacterScoreSource } from './ports.js'

export interface EquipmentSimulationScores {
  baseline: CharacterCardScore | null
  simulated: CharacterCardScore | null
}

const noScores: EquipmentSimulationScores = { baseline: null, simulated: null }

export class EquipmentSimulationService {
  private readonly active = new Set<Promise<unknown>>()
  // 캐시 항목의 원문에 묶어, 만료되거나 갱신된 항목의 주 스탯은 항목과 함께 사라진다.
  private readonly mainStats = new WeakMap<CharacterPayloads, ScoreMainStat>()

  constructor(
    private readonly loadScoreSource: LoadCharacterScoreSource,
    private readonly calculateScore: CalculateScore
  ) {}

  /** 가상 점수는 상세 응답 캐시, 조회 알림, DB에 남기지 않는다. */
  simulate(
    identity: CharacterIdentity,
    changes: readonly EquipmentChange[],
    signal: AbortSignal
  ): Promise<EquipmentSimulationScores> {
    return this.track(this.run(identity, changes, signal))
  }

  /** 진행 중인 계산을 끊지 않고 끝나기를 기다린다. */
  async close(): Promise<void> {
    await Promise.allSettled([...this.active])
  }

  private async run(
    identity: CharacterIdentity,
    changes: readonly EquipmentChange[],
    signal: AbortSignal
  ): Promise<EquipmentSimulationScores> {
    const { payloads, role, items } = await this.loadScoreSource(identity, signal)
    const edits = editEquipment(payloads.equipment, changes, role)
    const calculator = cardScoreCalculator(role)
    const input = toScoreEngineInput(payloads, items)

    if (edits.length === 0) {
      const result = await this.calculate(payloads, input, calculator, signal)

      if (result === null) {
        return noScores
      }

      const score = toCardScore(result)

      return { baseline: score, simulated: score }
    }

    let convertedName: string | null = null

    if (amplifiesReinforcedItem(edits)) {
      convertedName = await this.convertedAmplificationName(payloads, input, calculator, signal)

      if (convertedName === null) {
        return noScores
      }
    }

    const equipment = simulatedEquipment(edits, convertedName)
    const simulation = { equipment }
    const result = await this.calculate(payloads, { ...input, simulation }, calculator, signal)

    if (result === null) {
      return noScores
    }

    const simulated = toSimulatedCardScore(result)

    if (simulated === null) {
      return noScores
    }

    const baseline = toCardScore(result)

    return { baseline, simulated }
  }

  private async calculate(
    payloads: CharacterPayloads,
    input: ScoreEngineInput,
    calculator: ScoreCalculator,
    signal: AbortSignal
  ): Promise<ScoreEngineResult | null> {
    const result = await this.calculateScore(input, calculator, signal)
    const mainStat = result?.display.mainStat

    if (mainStat !== undefined) {
      this.mainStats.set(payloads, mainStat)
    }

    return result
  }

  private async convertedAmplificationName(
    payloads: CharacterPayloads,
    input: ScoreEngineInput,
    calculator: ScoreCalculator,
    signal: AbortSignal
  ): Promise<string | null> {
    const worn = wornAmplificationName(payloads.equipment)

    if (worn !== null) {
      return worn
    }

    const mainStat = await this.mainStatOf(payloads, input, calculator, signal)

    if (mainStat === null) {
      return null
    }

    return mainStatAmplificationName(mainStat)
  }

  private async mainStatOf(
    payloads: CharacterPayloads,
    input: ScoreEngineInput,
    calculator: ScoreCalculator,
    signal: AbortSignal
  ): Promise<ScoreMainStat | null> {
    const known = this.mainStats.get(payloads)

    if (known !== undefined) {
      return known
    }

    const result = await this.calculate(payloads, input, calculator, signal)
    const mainStat = result?.display.mainStat

    if (mainStat === undefined) {
      return null
    }

    return mainStat
  }

  private track<T>(operation: Promise<T>): Promise<T> {
    this.active.add(operation)
    operation.finally(() => this.active.delete(operation)).catch(() => undefined)

    return operation
  }
}
