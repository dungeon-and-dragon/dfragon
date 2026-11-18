import { CHARACTER_ID_PATTERN } from '../character-identity.js'
import type { CharacterPayload } from '../character-detail/sections.js'

export const CATALOG_LIMITS = {
  maximumBatchKeys: 15,
  maximumReferencesPerLoad: 128
} as const

export interface CatalogDetail {
  data: CharacterPayload | null
  fetchedAt: string | null
  status: 'fresh' | 'unavailable'
}

export function isCatalogId(value: unknown): value is string {
  return typeof value === 'string' && CHARACTER_ID_PATTERN.test(value)
}

export const unavailableDetail: CatalogDetail = {
  data: null,
  fetchedAt: null,
  status: 'unavailable'
}
