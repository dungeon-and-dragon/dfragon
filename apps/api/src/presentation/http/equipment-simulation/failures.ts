import type { FailureResponse } from '@dfragon/http-server'
import {
  EquipmentSimulationFailure,
  type EquipmentSimulationFailureKind
} from '#domain/equipment-simulation/index.js'
import { characterFailureResponse } from '#presentation/http/character-failures.js'

const failureResponses: Record<EquipmentSimulationFailureKind, FailureResponse> = {
  request: { status: 400, body: { error: { code: 'INVALID_SIMULATION_REQUEST' } } }
}

export function equipmentSimulationFailureResponse(error: unknown): FailureResponse {
  if (error instanceof EquipmentSimulationFailure) {
    return failureResponses[error.kind]
  }

  return characterFailureResponse(error)
}
