import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { NeopleClient } from '@dfragon/neople'
import type { FetchCatalog } from '../../application/character-catalog/ports.js'
import type { CharacterPayload } from '../../domain/character-detail/sections.js'
import { CATALOG_LIMITS, isCatalogId } from '../../domain/character-catalog/types.js'

function selectRequestedRows(rows: unknown[], itemIds: string[]): Map<string, CharacterPayload> {
  const payloads = new Map<string, CharacterPayload>()
  for (const itemId of itemIds) {
    const matches = rows.filter((row) => isRecord(row) && row.itemId === itemId)
    const row: unknown = matches[0]

    if (
      matches.length === 1 &&
      isRecord(row) &&
      typeof row.itemName === 'string' &&
      row.itemName.trim()
    ) {
      payloads.set(itemId, row)
    }
  }

  return payloads
}

export function createNeopleCatalog(neople: NeopleClient): FetchCatalog {
  return async (itemIds, signal) => {
    if (
      itemIds.length === 0 ||
      itemIds.length > CATALOG_LIMITS.maximumBatchKeys ||
      itemIds.some((itemId) => !isCatalogId(itemId))
    ) {
      throw new Error('Invalid catalog request')
    }

    try {
      const { rows } = await neople.multiItems(itemIds, signal)

      return selectRequestedRows(rows, itemIds)
    } catch {
      throw new Error('Catalog lookup failed')
    }
  }
}
