import { useEffect } from 'react'
import type { ItemStats } from '#entities/ranking'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import {
  type FameRankingFilter,
  type FameRankingSetFilter,
  type SetStats,
  type ScoreSort,
  type SkillEvolutionChoice,
  useItemStats,
  useSetStats
} from '#entities/ranking'
import { type OathCatalog, useOathCatalog } from '#entities/catalog'
import { FameRankingList } from './FameRankingList'
import {
  type FilterRow,
  RankingFilterBox,
  UniqueItemSelect,
  useSkillEvolutionRow,
  WeaponSelect,
  RankingSetFilter,
  itemChoicesOf,
  itemIdsInStats,
  setChoicesOf,
  setFilterLabel
} from '#widgets/ranking-filter'
import { SearchCriterionFilter } from './SearchCriterionFilter'
import { criterionFilterOf, rangeOfFilter, type SearchRange } from './search-range'

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
  const { jobId, jobGrowId, role, itemIds = [], sort } = filter
  const range = rangeOfFilter(filter)
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
    const { equipmentSetId: _equipment, oathSetId: _oath, oathSetOption: _option, ...rest } = filter

    onFilterChange({ ...rest, ...sets })
  }

  function changeRange(nextRange: SearchRange): void {
    const criterionFilter = criterionFilterOf(sort, nextRange)

    onFilterChange({ ...filter, ...criterionFilter })
  }

  // 기준을 바꾸면 넣어 둔 범위는 다른 기준의 값이라 비운다.
  function changeSort(next: ScoreSort | undefined): void {
    const criterionFilter = criterionFilterOf(next, {})

    onFilterChange({ ...filter, ...criterionFilter })
  }

  function changeItems(next: readonly string[]): void {
    onFilterChange({ ...filter, itemIds: next })
  }

  function changeEvolutions(next: readonly SkillEvolutionChoice[]): void {
    onFilterChange({ ...filter, evolutions: next })
  }

  const evolutionRow = useSkillEvolutionRow(filter, changeEvolutions)

  function resetFilter(): void {
    onFilterChange({})
  }

  const rows: readonly FilterRow[] = [
    {
      label: '장비',
      content: (
        <div className="flex flex-wrap gap-2">
          <WeaponSelect choices={itemChoices} itemIds={itemIds} onChange={changeItems} />
          <UniqueItemSelect choices={itemChoices} itemIds={itemIds} onChange={changeItems} />
        </div>
      )
    },
    {
      label: '세트',
      content: <RankingSetFilter choices={choices} filter={filter} onChange={changeSets} />
    },
    ...(evolutionRow !== null ? [evolutionRow] : []),
    {
      label: '검색 기준',
      content: (
        <SearchCriterionFilter
          key={`${sort}/${range.from}/${range.to}`}
          sort={sort}
          range={range}
          onSortChange={changeSort}
          onRangeChange={changeRange}
        />
      )
    }
  ]

  return (
    <div className="flex flex-col">
      <RankingFilterBox
        filter={filter}
        onChange={onFilterChange}
        onReset={resetFilter}
        rows={rows}
      />
      <FameRankingList filter={filter} setLabel={setLabel} catalog={catalog} />
    </div>
  )
}
