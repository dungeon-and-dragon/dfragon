import { toBase64Url } from '#shared/lib/base64url'
import type { EpicSoulRecovery } from '#pages/lab-epic-souls/model/epic-soul-recovery'

const WEAPON_SLOT_ID = 'WEAPON'
const NO_OATH_CHANGES = { set: null, body: null, crystals: {}, upgrade: null }

type SlotDraft = Readonly<{
  reinforce: number
  amplified: boolean
  enchantId: null
  variantId: string
  tune: number
  potency: null
  release: null
}>

/**
 * 장비 시뮬레이터 `changes` 주소 값이다. 시뮬레이터가 공유 주소로 여는 모양과 같게, 최고 세팅의 세트를 고르고 에픽 부위만 그
 * 선택지로 바꾸며 강화, 증폭은 착용 그대로 담는다. 최고 세팅이 없으면 undefined다.
 */
export function simulatorChangesOf({ souls, best }: EpicSoulRecovery): string | undefined {
  if (best === null) {
    return undefined
  }

  const equipment: Record<string, SlotDraft> = {}

  for (const { slotId, before, after } of souls.slots) {
    const variantId = slotId === WEAPON_SLOT_ID ? best.weaponVariantId : (after?.itemId ?? null)

    if (variantId === null) {
      return undefined
    }

    const { reinforce, amplified } = before
    equipment[slotId] = {
      reinforce,
      amplified,
      enchantId: null,
      variantId,
      tune: 0,
      potency: null,
      release: null
    }
  }

  const changes = {
    equipmentSet: best.setItemId,
    equipment,
    slotItems: {},
    avatarPreset: null,
    buffLevel: null,
    switchingEquipment: null,
    oath: NO_OATH_CHANGES
  }

  return toBase64Url(JSON.stringify(changes))
}
