import type { OathCatalog } from '#core/catalog'
import type { FameRankingFilter, FameRankingSetFilter, SetStats } from '#core/ranking'
import { TitleBox } from '#components/table/TitleBox'
import type { LoadedResult } from '#hooks/useLoadedResult'
import { useOathCatalog } from '#hooks/useOathCatalog'
import { useSetStats } from '#hooks/useSetStats'
import { FameRankingList } from './FameRankingList'
import { RankingFilterBox } from './RankingFilterBox'
import { RankingSetFilter } from './RankingSetFilter'
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
  const stats: SetStats | null = loadedValue(useSetStats(ALL_JOBS))
  const catalog: OathCatalog | null = loadedValue(useOathCatalog())
  const choices = setChoicesOf(stats, catalog, filter)
  const setLabel = setFilterLabel(stats, catalog, filter)

  function changeSets(sets: FameRankingSetFilter): void {
    const { jobId, jobGrowId, role } = filter

    onFilterChange({ jobId, jobGrowId, role, ...sets })
  }

  return (
    <div className="flex flex-col">
      <TitleBox title="명성 랭킹" />
      <RankingFilterBox
        filter={filter}
        onChange={onFilterChange}
        setSelects={<RankingSetFilter choices={choices} filter={filter} onChange={changeSets} />}
      />
      <FameRankingList filter={filter} setLabel={setLabel} catalog={catalog} />
    </div>
  )
}
