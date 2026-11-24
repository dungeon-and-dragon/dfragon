import table from './avatar-presets.json' with { type: 'json' }

export const AVATAR_PRESET_PARTS = [
  'HEADGEAR',
  'HAIR',
  'FACE',
  'BREAST',
  'JACKET',
  'PANTS',
  'WAIST',
  'SHOES',
  'WEAPON'
] as const

export type AvatarPresetPart = (typeof AVATAR_PRESET_PARTS)[number]

/** 플래티넘을 뺀 소켓 색이다. 끝 스펙은 색마다 찬란한 엠블렘 하나를 넣는다. */
export const AVATAR_EMBLEM_COLORS = ['붉은빛', '노란빛', '녹색빛', '푸른빛', '다색'] as const

export type AvatarEmblemColor = (typeof AVATAR_EMBLEM_COLORS)[number]

export const AVATAR_PRESET_RARITY = '레어'

const PLATINUM_COLOR = '플래티넘'

export type AvatarPresetRole = 'dealer' | 'buffer'

export interface AvatarEmblemItem {
  readonly itemId: string
  readonly itemName: string
  readonly itemRarity: string
}

/** Neople 아바타 응답의 `emblems[]` 항목과 같은 모양이다. */
export interface AvatarEmblem extends AvatarEmblemItem {
  readonly slotNo: number
  readonly slotColor: string
}

export interface AvatarPresetPartSpec {
  readonly slotId: AvatarPresetPart
  readonly slotName: string
  readonly itemName: string
  readonly itemRarity: string
  readonly optionAbility: string
  readonly emblems: readonly AvatarEmblem[]
}

export interface AvatarPreset {
  readonly role: AvatarPresetRole
  readonly jobId: string
  readonly jobGrowId: string
  readonly parts: Readonly<Record<AvatarPresetPart, AvatarPresetPartSpec>>
  readonly emblems: Readonly<Record<AvatarEmblemColor, AvatarEmblemItem>>
}

interface PresetPartTable {
  readonly slotName: string
  readonly itemName: string
  readonly sockets: readonly { readonly slotNo: number; readonly slotColor: string }[]
}

interface PresetJobTable {
  readonly role: AvatarPresetRole
  readonly jobId: string
  readonly jobGrowId: string
  readonly options: Readonly<Record<AvatarPresetPart, string>>
  readonly emblems: Readonly<Record<AvatarEmblemColor, AvatarEmblemItem>>
  readonly platinum: Readonly<Record<'JACKET' | 'PANTS', AvatarEmblemItem>>
}

interface AvatarPresetTable {
  readonly version: 1
  readonly parts: Readonly<Record<AvatarPresetPart, PresetPartTable>>
  readonly presets: readonly PresetJobTable[]
}

// 생성 스크립트가 소켓 색과 부위, 직업별 값을 모두 확인하고 쓴 파일이라 모양은 테스트가 확인한다.
const presetTable = table as AvatarPresetTable

function isEmblemColor(slotColor: string): slotColor is AvatarEmblemColor {
  return (AVATAR_EMBLEM_COLORS as readonly string[]).includes(slotColor)
}

function emblemFor(job: PresetJobTable, slotId: AvatarPresetPart, slotColor: string) {
  if (slotColor === PLATINUM_COLOR && (slotId === 'JACKET' || slotId === 'PANTS')) {
    return job.platinum[slotId]
  }

  if (!isEmblemColor(slotColor)) {
    throw new Error(`끝 스펙 표에 없는 소켓 색: ${slotId} ${slotColor}`)
  }

  return job.emblems[slotColor]
}

function partSpecOf(job: PresetJobTable, slotId: AvatarPresetPart): AvatarPresetPartSpec {
  const { slotName, itemName, sockets } = presetTable.parts[slotId]
  const emblems = sockets.map(({ slotNo, slotColor }) => {
    const emblem = emblemFor(job, slotId, slotColor)

    return { slotNo, slotColor, ...emblem }
  })

  return {
    slotId,
    slotName,
    itemName,
    itemRarity: AVATAR_PRESET_RARITY,
    optionAbility: job.options[slotId],
    emblems
  }
}

function presetOf(job: PresetJobTable): AvatarPreset {
  const partEntries = AVATAR_PRESET_PARTS.map((slotId) => [slotId, partSpecOf(job, slotId)])
  const parts = Object.fromEntries(partEntries) as Record<AvatarPresetPart, AvatarPresetPartSpec>
  const { role, jobId, jobGrowId, emblems } = job

  return { role, jobId, jobGrowId, parts, emblems }
}

function presetKey(role: AvatarPresetRole, jobId: string, jobGrowId: string): string {
  return JSON.stringify([role, jobId, jobGrowId])
}

const presets = new Map(
  presetTable.presets.map((job) => [presetKey(job.role, job.jobId, job.jobGrowId), presetOf(job)])
)

/** 남성 크루세이더는 딜러와 버퍼의 끝 스펙이 달라 역할도 함께 받는다. 표에 없는 전직은 null이다. */
export function findAvatarPreset(
  job: { readonly jobId: string; readonly jobGrowId: string },
  role: AvatarPresetRole
): AvatarPreset | null {
  const preset = presets.get(presetKey(role, job.jobId, job.jobGrowId))

  if (preset === undefined) {
    return null
  }

  return preset
}
