import type { FameRankingFilter } from '#core/ranking'
import { TitleBox } from '../../components/table/TitleBox'
import { FameRankingList } from './FameRankingList'
import { RankingFilterBox } from './RankingFilterBox'

export function RankingsScreen({
  filter,
  onFilterChange
}: {
  filter: FameRankingFilter
  onFilterChange: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <TitleBox title="명성 랭킹" />
      <RankingFilterBox filter={filter} onChange={onFilterChange} />
      <FameRankingList filter={filter} />
    </div>
  )
}
