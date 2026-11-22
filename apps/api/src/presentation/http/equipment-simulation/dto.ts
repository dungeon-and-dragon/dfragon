import { ENCHANT_GRADE_SLOTS } from '@dfragon/lib/enchant-grades'
import { z } from 'zod'
import type { EquipmentSimulationScores } from '#application/equipment-simulation/index.js'
import {
  type EquipmentChange,
  EquipmentSimulationFailure
} from '#domain/equipment-simulation/index.js'

const equipmentChange = z.strictObject({
  slotId: z.enum(ENCHANT_GRADE_SLOTS),
  reinforce: z.int().min(0),
  amplified: z.boolean(),
  enchantId: z.string().nullable()
})

const simulationRequest = z.strictObject({
  equipment: z
    .array(equipmentChange)
    .refine((changes) => new Set(changes.map(({ slotId }) => slotId)).size === changes.length)
})

export type EquipmentSimulationResponse = EquipmentSimulationScores

export function parseSimulationRequest(text: string): EquipmentChange[] {
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

  return parsed.data.equipment
}
