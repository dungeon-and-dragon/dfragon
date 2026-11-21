import type { Bar } from '#shared/ui/chart/RowBars'
import {
  equipmentSetShortName,
  NO_SET_NAME,
  oathSetShortName,
  type SetStats,
  type SetStatsFilter
} from '#entities/ranking'
import { byCountWithBaseLast, FULL_SHARE, rankingLink, shareOf } from './set-stats-bars'

function oathBarsOf(
  stats: SetStats,
  filter: SetStatsFilter,
  equipmentSetId: string,
  equipmentCount: number
): Bar[] {
  const oathNames = new Map(
    stats.oathSets.map(({ setId, name }) => [setId, oathSetShortName(name)])
  )

  return stats.combos
    .filter((combo) => combo.equipmentSetId === equipmentSetId)
    .map(({ oathSetId, count }): Bar => {
      const key = `${equipmentSetId}/${oathSetId ?? ''}`
      const value = shareOf(count, equipmentCount)

      if (oathSetId === null) {
        return { key, name: NO_SET_NAME, value, base: true }
      }

      const name = oathNames.get(oathSetId) ?? String(oathSetId)
      const link = rankingLink(filter, { equipmentSetId, oathSetId })

      return { key, name, value, link }
    })
    .toSorted(byCountWithBaseLast)
}

export function equipmentComboBars(stats: SetStats, filter: SetStatsFilter): Bar[] {
  return stats.equipmentSets
    .map(({ setId, name, count }): Bar => {
      const value = shareOf(count, stats.sampleSize)

      if (setId === null) {
        return { key: NO_SET_NAME, name: NO_SET_NAME, value, base: true }
      }

      const shortName = equipmentSetShortName(setId, name)
      const link = rankingLink(filter, { equipmentSetId: setId })
      const oathBars = oathBarsOf(stats, filter, setId, count)
      const details = { bars: oathBars, max: FULL_SHARE }

      return { key: setId, name: shortName, value, link, details }
    })
    .toSorted(byCountWithBaseLast)
}
