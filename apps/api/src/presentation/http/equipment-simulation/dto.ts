import { ENCHANT_GRADE_SLOTS } from '@dfragon/lib/enchant-grades'
import { z } from 'zod'
import type {
  EquipmentSimulationRequest,
  EquipmentSimulationScores
} from '#application/equipment-simulation/index.js'
import { EquipmentSimulationFailure } from '#domain/equipment-simulation/index.js'

const POTENCY_LIMIT = 100

const equipmentChange = z.strictObject({
  slotId: z.enum(ENCHANT_GRADE_SLOTS),
  reinforce: z.int().min(0),
  amplified: z.boolean(),
  enchantId: z.string().nullable(),
  // 생략과 null은 착용한 아이템의 값을 그대로 둔다.
  variantId: z.string().nullable().default(null),
  tune: z.int().min(0).nullable().default(null),
  potency: z.int().min(0).max(POTENCY_LIMIT).nullable().default(null)
})

const oathUpgradeSelection = z.strictObject({
  step: z.int(),
  option: z.string()
})

const oathCrystalChange = z.strictObject({
  slotNo: z.int().min(0),
  tune: z.int().min(0).nullable().default(null),
  variantId: z.string().nullable().default(null)
})

// 생략과 null은 착용한 아이템을 그대로 둔다.
const slotItemId = z.string().nullable().default(null)

const simulationRequest = z.strictObject({
  equipmentSet: z.string().nullable().default(null),
  equipment: z
    .array(equipmentChange)
    .refine((changes) => new Set(changes.map(({ slotId }) => slotId)).size === changes.length),
  title: slotItemId,
  creature: slotItemId,
  aura: slotItemId,
  oathSet: z.int().nullable().default(null),
  oathBody: z.string().nullable().default(null),
  oath: z
    .array(oathCrystalChange)
    .refine((changes) => new Set(changes.map(({ slotNo }) => slotNo)).size === changes.length)
    .default([]),
  // 생략과 null은 착용한 진의를 그대로 둔다.
  oathUpgrade: z.array(oathUpgradeSelection).nullable().default(null)
})

export type EquipmentSimulationResponse = EquipmentSimulationScores

export function parseSimulationRequest(text: string): EquipmentSimulationRequest {
  let body: unknown

  try {
    body = JSON.parse(text)
  } catch {
    throw new EquipmentSimulationFailure('request')
  }

  const parsed = simulationRequest.safeParse(body)

  if (!parsed.success) {
    throw new EquipmentSimulationFailure('request')
  }

  const { equipmentSet, equipment, title, creature, aura, oathSet, oathBody, oath, oathUpgrade } =
    parsed.data
  const slotItems = { title, creature, aura }

  return {
    equipmentSet,
    equipment,
    slotItems,
    oath: { set: oathSet, body: oathBody, crystals: oath, upgrade: oathUpgrade }
  }
}
