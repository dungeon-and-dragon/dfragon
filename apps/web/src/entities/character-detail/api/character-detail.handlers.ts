import { delay, HttpResponse } from 'msw'
import type { CharacterIdentity } from '#entities/character/@x/character-detail'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { characterPath } from './character-api'

export function characterUrl(identity: CharacterIdentity, path = ''): string {
  return `${API_BASE_URL}${characterPath(identity)}${path}`
}

export function apiFailure(status: number, code: string, message: string): HttpResponse<object> {
  return HttpResponse.json({ error: { code, message } }, { status })
}

export async function loadingResponse(): Promise<void> {
  await delay('infinite')
}
