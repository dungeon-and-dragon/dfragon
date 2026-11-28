import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import { type WornEpicSouls, wornEpicSouls } from './worn-epic-souls.js'

export type LoadEquipment = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterPayload>

export type LoadStoredEquipment = (identity: CharacterIdentity) => Promise<CharacterPayload | null>

export class EpicSoulRecoveryService {
  constructor(
    private readonly loadStoredEquipment: LoadStoredEquipment,
    private readonly loadEquipment: LoadEquipment
  ) {}

  async recover(identity: CharacterIdentity, signal: AbortSignal): Promise<WornEpicSouls> {
    const equipment =
      (await this.loadStoredEquipment(identity)) ?? (await this.loadEquipment(identity, signal))

    return wornEpicSouls(equipment)
  }
}
