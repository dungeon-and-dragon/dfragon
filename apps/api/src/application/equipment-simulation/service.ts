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
  type AvatarPresetChoice,
  type EquipmentChange,
  type OathChanges,
  type SimulationFeatures,
  type SlotItemChanges,
  avatarItemIds,
  avatarPresetJobOf,
  editAvatar,
  editBuffLevel,
  editEquipment,
  editEquipmentItems,
  editOath,
  editSlotItems,
  editSwitchingEquipment,
  editWeapon,
  equipmentItemIds,
  hasAvatarEdit,
  hasOathEdit,
  hasSlotItemEdits,
  needsAvatarMainStat,
  needsMainStat,
  simulatedAvatar,
  simulatedBuff,
  simulatedEquipment,
  simulatedOath,
  simulatedSlotItems,
  simulationInputOf,
  slotItemIds,
  supportsSimulation,
  weaponItemIds,
  withEquipmentItems,
  withWeapon,
  wornMainStat
} from '#domain/equipment-simulation/index.js'
import type { LoadCharacterScoreSource, LoadItemDetails } from './ports.js'

export interface EquipmentSimulationRequest {
  /** 고른 장비 세트의 setItemId이고, null이면 그대로 둔다. */
  readonly equipmentSet: string | null
  readonly equipment: readonly EquipmentChange[]
  readonly slotItems: SlotItemChanges
  readonly oath: OathChanges
  /** 버프 강화 스킬의 절대 레벨이고, null이면 그대로 둔다. */
  readonly buffLevel: number | null
  /** 버프 강화 장비에 등록한 것으로 볼 유니크 스위칭 장비 수이고, null이면 그대로 둔다. */
  readonly switchingEquipment: number | null
  /** null이면 착용 아바타를 그대로 둔다. */
  readonly avatarPreset: AvatarPresetChoice | null
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
    const itemEdits = editEquipmentItems(
      payloads.equipment,
      request.equipment,
      request.equipmentSet
    )
    const weaponEdit = editWeapon(payloads.equipment, request.equipment)
    const oathEdit = editOath(payloads.oath, request.oath)
    const slotEdits = editSlotItems(payloads, request.slotItems)
    const buffLevel = editBuffLevel(payloads, role, request.buffLevel)
    const switchingEquipment = editSwitchingEquipment(payloads, role, request.switchingEquipment)
    const presetJob = avatarPresetJobOf(payloads, role, request.avatarPreset)
    const calculator = cardScoreCalculator(role)
    const input = toScoreEngineInput(payloads, items)
    let avatarMainStat: ScoreMainStat | null = null

    if (needsAvatarMainStat(presetJob)) {
      avatarMainStat = await this.characterMainStat(payloads, input, calculator, signal)

      if (avatarMainStat === null) {
        return noScores
      }
    }

    const avatarEdit = editAvatar(payloads, presetJob, avatarMainStat)
    const editsSlotItems = hasSlotItemEdits(slotEdits)
    const editsOath = hasOathEdit(oathEdit)
    const editsAvatar = hasAvatarEdit(avatarEdit)
    const editsWeaponItem =
      weaponEdit !== null && (weaponEdit.item !== null || weaponEdit.release !== null)
    const features: SimulationFeatures = {
      slotItems: editsSlotItems,
      equipmentItems: itemEdits.length > 0,
      oathTunes: editsOath,
      equipmentSet: request.equipmentSet !== null && itemEdits.length > 0,
      weaponTune: weaponEdit !== null,
      weaponItem: editsWeaponItem,
      oathItems: oathEdit.changesItems,
      oathUpgrade: oathEdit.upgrade !== null,
      buffLevel: buffLevel !== null,
      switchingEquipment: switchingEquipment !== null,
      avatar: editsAvatar,
      oathWithoutSetInfo: editsOath && oathEdit.setInfoMissing
    }

    if (
      edits.length === 0 &&
      !features.slotItems &&
      !features.equipmentItems &&
      !features.weaponTune &&
      !editsOath &&
      !features.buffLevel &&
      !features.switchingEquipment &&
      !editsAvatar
    ) {
      const result = await this.calculate(payloads, input, calculator, signal)

      if (result === null) {
        return noScores
      }

      const score = toCardScore(result)

      return { baseline: score, simulated: score }
    }

    const details = await this.itemDetails(
      [
        ...slotItemIds(slotEdits),
        ...equipmentItemIds(itemEdits),
        ...weaponItemIds(weaponEdit),
        ...avatarItemIds(avatarEdit)
      ],
      signal
    )

    if (details === null) {
      return noScores
    }

    let mainStat: ScoreMainStat | null = null

    if (needsMainStat(edits)) {
      mainStat = await this.characterMainStat(payloads, input, calculator, signal)

      if (mainStat === null) {
        return noScores
      }
    }

    const itemEquipment = withEquipmentItems(
      simulatedEquipment(edits, mainStat),
      itemEdits,
      details
    )
    const equipment = withWeapon(itemEquipment, weaponEdit, details)
    const slots = simulatedSlotItems(slotEdits, details)
    const simulation = simulationInputOf(
      equipment,
      slots,
      simulatedAvatar(avatarEdit, slots.aura),
      simulatedOath(oathEdit),
      simulatedBuff(buffLevel, switchingEquipment)
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

  private async characterMainStat(
    payloads: CharacterPayloads,
    input: ScoreEngineInput,
    calculator: ScoreCalculator,
    signal: AbortSignal
  ): Promise<ScoreMainStat | null> {
    const worn = wornMainStat(payloads.equipment)

    if (worn !== null) {
      return worn
    }

    return await this.mainStatOf(payloads, input, calculator, signal)
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
