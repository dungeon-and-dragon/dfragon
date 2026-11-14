import type { BatchNeopleKeySummary } from '@dfragon/database'
import { z } from 'zod'

// batch_neople_keys.id가 int4라 9자리까지만 받는다.
const POSITIVE_INT4_DIGITS = /^[1-9]\d{0,8}$/

export const keyIdParam = z.string().regex(POSITIVE_INT4_DIGITS).transform(Number)

export type KeyIdParam = z.infer<typeof keyIdParam>

const trimmedText = z.string().trim().min(1)

export const addBody = z.object({ label: trimmedText, key: trimmedText })

export type AddBody = z.infer<typeof addBody>

export type BatchNeopleKeyResponse = Pick<
  BatchNeopleKeySummary,
  'id' | 'label' | 'keySuffix' | 'enabled' | 'createdAt' | 'rejectedAt'
>

export type BatchNeopleKeyListResponse = {
  keys: BatchNeopleKeyResponse[]
}

export type BatchNeopleKeyAdditionResponse = {
  id: number
}

// 응답에 실을 field를 골라 key 원문이 어떤 경로로도 응답에 섞이지 않게 한다.
function toBatchNeopleKeyResponse({
  id,
  label,
  keySuffix,
  enabled,
  createdAt,
  rejectedAt
}: BatchNeopleKeySummary): BatchNeopleKeyResponse {
  return { id, label, keySuffix, enabled, createdAt, rejectedAt }
}

export function toBatchNeopleKeyListResponse(
  keys: readonly BatchNeopleKeySummary[]
): BatchNeopleKeyListResponse {
  const keyResponses = keys.map(toBatchNeopleKeyResponse)

  return { keys: keyResponses }
}

export function toBatchNeopleKeyAdditionResponse(id: number): BatchNeopleKeyAdditionResponse {
  return { id }
}
