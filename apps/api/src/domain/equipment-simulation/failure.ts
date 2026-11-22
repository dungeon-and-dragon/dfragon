import { type FailureOptions, SanitizedFailure } from '@dfragon/lib/error-chain'

export type EquipmentSimulationFailureKind = 'request'

export class EquipmentSimulationFailure extends SanitizedFailure {
  readonly kind: EquipmentSimulationFailureKind

  constructor(kind: EquipmentSimulationFailureKind, options: FailureOptions = {}) {
    super(`Equipment simulation failed: ${kind}`, options)
    this.name = 'EquipmentSimulationFailure'
    this.kind = kind
  }
}
