import type { OathCatalog } from '#core/catalog'
import { useEffect } from 'react'
import type { FameRankingFilter, FameRankingSetFilter, ItemStats, SetStats } from '#core/ranking'
import { TitleBox } from '#shared/ui/TitleBox'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { useItemStats } from '#hooks/useItemStats'
import { useOathCatalog } from '#hooks/useOathCatalog'
import { useSetStats } from '#hooks/useSetStats'
import { FameRankingList } from './FameRankingList'
import { type FilterRow, RankingFilterBox } from './RankingFilterBox'
import { UniqueItemChips, WeaponSelect } from './RankingItemFilter'
import { RankingSetFilter } from './RankingSetFilter'
import { itemChoicesOf, itemIdsInStats } from './ranking-items'
import { setChoicesOf, setFilterLabel } from './ranking-sets'

// 세트 셀렉트 목록은 전체 직업 세트 통계에서 읽어, 직업을 바꿔도 같은 목록을 쓴다.
const ALL_JOBS = {}

function loadedValue<Value>(result: LoadedResult<Value>): Value | null {
  if (result.status !== 'success') {
    return null
  }

  return result.value
}

export function RankingsScreen({
  filter,
  onFilterChange
}: {
  filter: FameRankingFilter
  onFilterChange: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  const { jobId, jobGrowId, role, itemIds = [] } = filter
  const stats: SetStats | null = loadedValue(useSetStats(ALL_JOBS))
  const catalog: OathCatalog | null = loadedValue(useOathCatalog())
  const itemStats: ItemStats | null = loadedValue(useItemStats({ jobId, jobGrowId, role }))
  const choices = setChoicesOf(stats, catalog, filter)
  const itemChoices = itemChoicesOf(itemStats, jobId === undefined)
  const setLabel = setFilterLabel(stats, catalog, filter)
  const keptItemIds = itemStats !== null ? itemIdsInStats(itemStats, itemIds) : itemIds
  const dropsItems = keptItemIds.length !== itemIds.length

  // 직업이나 전직을 바꾸면 새 전직의 아이템 통계를 받은 뒤 그 통계에 없는 itemId(그 전직이 끼지 않는 무기)를 지운다.
  useEffect(() => {
    if (dropsItems) {
      onFilterChange({ ...filter, itemIds: keptItemIds })
    }
  }, [dropsItems, filter, keptItemIds, onFilterChange])

  function changeSets(sets: FameRankingSetFilter): void {
    onFilterChange({ jobId, jobGrowId, role, ...sets, itemIds: filter.itemIds })
  }

  function changeItems(next: readonly string[]): void {
    onFilterChange({ ...filter, itemIds: next })
  }

  const rows: readonly FilterRow[] = [
    {
      label: '세트',
      content: <RankingSetFilter choices={choices} filter={filter} onChange={changeSets} />
    },
    {
      label: '무기',
      content: <WeaponSelect choices={itemChoices} itemIds={itemIds} onChange={changeItems} />
    },
    {
      label: '유일 장비',
      content: <UniqueItemChips choices={itemChoices} itemIds={itemIds} onChange={changeItems} />
    }
  ]

  return (
    <div className="flex flex-col">
      <TitleBox title="명성 랭킹" />
      <RankingFilterBox filter={filter} onChange={onFilterChange} rows={rows} />
      <FameRankingList filter={filter} setLabel={setLabel} catalog={catalog} />
    </div>
  )
}
