import type { LabCurrencyIcon } from '@dfragon/database'
import { z } from 'zod'
import { OpsFailure } from '#domain/failure.js'

export const itemNameField = z.string().trim().min(1)

export function readItemName(value: string | undefined): string {
  const name = itemNameField.safeParse(value)

  if (!name.success) {
    throw new OpsFailure('request')
  }

  return name.data
}

// 게임 아이콘은 수 KB인 PNG라, 잘못 고른 큰 그림만 막을 만큼 둔다.
const ICON_MAX_BYTES = 64 * 1024

type IconFormat = {
  contentType: string
  matches: (bytes: Uint8Array) => boolean
}

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  return prefix.every((byte, index) => bytes[offset + index] === byte)
}

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0))

const ICON_FORMATS: readonly IconFormat[] = [
  {
    contentType: 'image/png',
    matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  },
  { contentType: 'image/jpeg', matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
  { contentType: 'image/gif', matches: (bytes) => startsWith(bytes, ascii('GIF8')) },
  {
    contentType: 'image/webp',
    matches: (bytes) => startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)
  }
]

// 공개 API가 저장한 형식을 Content-Type으로 그대로 내므로, 올린 쪽이 밝힌 형식 대신 파일 앞부분으로 형식을 정한다.
function readIcon(base64: string): LabCurrencyIcon | null {
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'))

  if (bytes.length === 0 || bytes.length > ICON_MAX_BYTES) {
    return null
  }

  const format = ICON_FORMATS.find(({ matches }) => matches(bytes))

  if (format === undefined) {
    return null
  }

  return { bytes, contentType: format.contentType }
}

// 화면의 tooltip 한 상자에 들어갈 길이로 둔다.
const DESCRIPTION_MAX_LENGTH = 500

// 빈 설명은 설명이 없는 것으로 저장해 화면이 이름만 보이게 한다.
export const descriptionField = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_LENGTH)
  .transform((value) => {
    if (value === '') {
      return null
    }

    return value
  })

export const iconField = z.base64().transform((value, context): LabCurrencyIcon => {
  const read = readIcon(value)

  if (read === null) {
    context.addIssue({ code: 'custom', message: 'icon' })

    return z.NEVER
  }

  return read
})

// tooltip 한 상자에 들어갈 만큼으로 둔다.
const TYPE_DETAIL_MAX_LENGTH = 40
const SLOT_MAX_COUNT = 12
const STAGE_MAX_COUNT = 5
const OPTION_MAX_COUNT = 30
const OPTION_TEXT_MAX_LENGTH = 40

const shortText = z.string().trim().min(1).max(OPTION_TEXT_MAX_LENGTH)

// 빈 값은 값이 없는 것으로 저장해 tooltip이 그 줄을 빼게 한다.
export const typeDetailField = z
  .string()
  .trim()
  .max(TYPE_DETAIL_MAX_LENGTH)
  .transform((value) => {
    if (value === '') {
      return null
    }

    return value
  })

export const statusField = z
  .array(z.object({ name: shortText, value: shortText }))
  .max(OPTION_MAX_COUNT)

const stageField = z.object({
  upgrade: z.int().min(0),
  status: statusField
})

// 공개 API가 카드 상세와 같은 모양으로 내므로, 단계는 upgrade가 커지는 순서로만 받는다.
export const cardField = z.object({
  slots: z.array(shortText).min(1).max(SLOT_MAX_COUNT),
  enchants: z
    .array(stageField)
    .min(1)
    .max(STAGE_MAX_COUNT)
    .refine((stages) =>
      stages.every((stage, index) => index === 0 || stages[index - 1].upgrade < stage.upgrade)
    )
})
