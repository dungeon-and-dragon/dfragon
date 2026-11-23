import {
  type CharacterCardScore,
  cardScoreCalculator,
  toCardScore,
  toSimulatedCardScore
} from '@dfragon/server-core/domain/character-card/index.js'
import type {
  CharacterPayload,
  CharacterPayloads
} from '@dfragon/server-core/domain/character-detail/index.js'
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
  type OathTuneChange,
  type SimulationFeatures,
  type SlotItemChanges,
  editEquipment,
  editEquipmentItems,
  editOathTunes,
  editSlotItems,
  equipmentItemIds,
  hasSlotItemEdits,
  needsMainStat,
  simulatedCrystals,
  simulatedEquipment,
  simulatedSlotItems,
  simulationInputOf,
  slotItemIds,
  supportsSimulation,
  withEquipmentItems,
  wornMainStat
} from '#domain/equipment-simulation/index.js'
import type { LoadCharacterScoreSource, LoadItemDetails } from './ports.js'

export interface EquipmentSimulationRequest {
  readonly equipment: readonly EquipmentChange[]
  readonly slotItems: SlotItemChanges
  readonly oath: readonly OathTuneChange[]
}

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
    private readonly loadItemDetails: LoadItemDetails,
    private readonly calculateScore: CalculateScore
  ) {}

  /** 가상 점수는 상세 응답 캐시, 조회 알림, DB에 남기지 않는다. */
  simulate(
    identity: CharacterIdentity,
    request: EquipmentSimulationRequest,
    signal: AbortSignal
  ): Promise<EquipmentSimulationScores> {
    return this.track(this.run(identity, request, signal))
  }

  /** 진행 중인 계산을 끊지 않고 끝나기를 기다린다. */
  async close(): Promise<void> {
    await Promise.allSettled([...this.active])
  }

  private async run(
    identity: CharacterIdentity,
    request: EquipmentSimulationRequest,
    signal: AbortSignal
  ): Promise<EquipmentSimulationScores> {
    const { payloads, role, items } = await this.loadScoreSource(identity, signal)
    const edits = editEquipment(payloads.equipment, request.equipment, role)
    const itemEdits = editEquipmentItems(payloads.equipment, request.equipment)
    const oathEdits = editOathTunes(payloads.oath, request.oath)
    const slotEdits = editSlotItems(payloads, request.slotItems)
    const editsSlotItems = hasSlotItemEdits(slotEdits)
    const features: SimulationFeatures = {
      slotItems: editsSlotItems,
      equipmentItems: itemEdits.length > 0,
      oathTunes: oathEdits.length > 0
    }
    const calculator = cardScoreCalculator(role)
    const input = toScoreEngineInput(payloads, items)

    if (
      edits.length === 0 &&
      !features.slotItems &&
      !features.equipmentItems &&
      !features.oathTunes
    ) {
      const result = await this.calculate(payloads, input, calculator, signal)

      if (result === null) {
        return noScores
      }

      const score = toCardScore(result)

      return { baseline: score, simulated: score }
    }

    const details = await this.itemDetails(
      [...slotItemIds(slotEdits), ...equipmentItemIds(itemEdits)],
      signal
    )

    if (details === null) {
      return noScores
    }

    let mainStat: ScoreMainStat | null = null

    if (needsMainStat(edits)) {
      mainStat =
        wornMainStat(payloads.equipment) ??
        (await this.mainStatOf(payloads, input, calculator, signal))

      if (mainStat === null) {
        return noScores
      }
    }

    const equipment = withEquipmentItems(simulatedEquipment(edits, mainStat), itemEdits, details)
    const simulation = simulationInputOf(
      equipment,
      simulatedSlotItems(slotEdits, details),
      simulatedCrystals(oathEdits)
    )
    const detailItems = Object.fromEntries(details)
    const engineItems = { ...input.items, ...detailItems }
    const simulationInput = { ...input, items: engineItems, simulation }
    const result = await this.calculate(payloads, simulationInput, calculator, signal)

    if (result === null) {
      return noScores
    }

    // 옛 엔진은 반영하지 못하는 변경을 빼고 계산한 점수를 바꾼 점수로 낼 수 있다.
    if (!supportsSimulation(result.versions.package, features)) {
      return noScores
    }

    const simulated = toSimulatedCardScore(result)

    if (simulated === null) {
      return noScores
    }

    const baseline = toCardScore(result)

    return { baseline, simulated }
  }

  /** 새 아이템의 상세를 하나라도 받지 못하면 null이다. */
  private async itemDetails(
    itemIds: string[],
    signal: AbortSignal
  ): Promise<ReadonlyMap<string, CharacterPayload> | null> {
    const details = new Map<string, CharacterPayload>()

    if (itemIds.length === 0) {
      return details
    }

    const loaded = await this.loadItemDetails(itemIds, signal)

    for (const itemId of itemIds) {
      const data = loaded.get(itemId)?.data

      if (data == null) {
        return null
      }

      details.set(itemId, data)
    }

    return details
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
