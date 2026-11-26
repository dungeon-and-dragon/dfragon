import type { LabCurrencyIcon, LabCurrencySummary } from '@dfragon/database'
import { z } from 'zod'
import { OpsFailure } from '#domain/failure.js'

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

const CURRENCY_ID_DIGITS = /^[1-9]\d{0,14}$/

const currencyIdParam = z.string().regex(CURRENCY_ID_DIGITS).transform(Number)

export function readCurrencyId(value: string): number {
  const id = currencyIdParam.safeParse(value)

  if (!id.success) {
    throw new OpsFailure('request')
  }

  return id.data
}

const name = z.string().trim().min(1)

const icon = z.base64().transform((value, context): LabCurrencyIcon => {
  const read = readIcon(value)

  if (read === null) {
    context.addIssue({ code: 'custom', message: 'icon' })

    return z.NEVER
  }

  return read
})

export const addBody = z.object({ name, icon })

export const updateBody = z.object({ name, icon: icon.optional() })

export type LabCurrencyResponse = LabCurrencySummary

export type LabCurrencyListResponse = {
  currencies: LabCurrencyResponse[]
}

export type LabCurrencyAdditionResponse = {
  id: number
}

export function toLabCurrencyListResponse(
  currencies: LabCurrencySummary[]
): LabCurrencyListResponse {
  return { currencies }
}

export function toLabCurrencyAdditionResponse(id: number): LabCurrencyAdditionResponse {
  return { id }
}
