import { findAvatarPreset } from '@dfragon/lib/avatar-presets'
import type { CharacterDetailView, EnchantRole } from '#entities/character'

export const BEST_AVATAR_PRESET = 'best'

/** null이면 착용한 아바타 그대로다. */
export type AvatarPresetChange = typeof BEST_AVATAR_PRESET | null

export function hasAvatarPreset(
  detail: Pick<CharacterDetailView, 'character'>,
  role: EnchantRole
): boolean {
  const { jobId, jobGrowId } = detail.character

  if (jobId === null || jobGrowId === null) {
    return false
  }

  return findAvatarPreset({ jobId, jobGrowId }, role) !== null
}

export function avatarPresetNameOf(change: AvatarPresetChange): string {
  if (change === null) {
    return '지금 그대로'
  }

  return '끝 스펙'
}
