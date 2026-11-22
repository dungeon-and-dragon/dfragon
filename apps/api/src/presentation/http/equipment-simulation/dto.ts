import { ENCHANT_GRADE_SLOTS } from '@dfragon/lib/enchant-grades'
import { z } from 'zod'
import type {
  EquipmentSimulationRequest,
  EquipmentSimulationScores
} from '#application/equipment-simulation/index.js'
import { EquipmentSimulationFailure } from '#domain/equipment-simulation/index.js'

const equipmentChange = z.strictObject({
  slotId: z.enum(ENCHANT_GRADE_SLOTS),
  reinforce: z.int().min(0),
  amplified: z.boolean(),
  enchantId: z.string().nullable()
})

// 생략과 null은 착용한 아이템을 그대로 둔다.
const slotItemId = z.string().nullable().default(null)

const simulationRequest = z.strictObject({
  equipment: z
    .array(equipmentChange)
    .refine((changes) => new Set(changes.map(({ slotId }) => slotId)).size === changes.length),
  title: slotItemId,
  creature: slotItemId,
  aura: slotItemId
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

  const { equipment, title, creature, aura } = parsed.data
  const slotItems = { title, creature, aura }

  return { equipment, slotItems }
}
