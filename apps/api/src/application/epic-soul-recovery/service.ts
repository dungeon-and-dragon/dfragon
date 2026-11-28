import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import { type WornEpicSouls, wornEpicSouls } from './worn-epic-souls.js'

export type LoadEquipment = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterPayload>

export type LoadStoredEquipment = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterPayload | null>

export class EpicSoulRecoveryService {
  constructor(
    private readonly loadStoredEquipment: LoadStoredEquipment,
    private readonly loadEquipment: LoadEquipment
  ) {}

  /** 저장한 장비 원문이 있으면 Neople을 부르지 않고, 없을 때만 상세 조회와 같은 캐시로 받는다. */
  async recover(identity: CharacterIdentity, signal: AbortSignal): Promise<WornEpicSouls> {
    const equipment =
      (await this.loadStoredEquipment(identity, signal)) ??
      (await this.loadEquipment(identity, signal))

    return wornEpicSouls(equipment)
  }
}
