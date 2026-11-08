import * as stylex from '@stylexjs/stylex'
import type { FameRankingFilter } from '#core/shared/ranking/ranking-stats'
import { TitleBox } from '../../components/table/TitleBox'
import { FameRankingList } from './FameRankingList'
import { RankingFilterBox } from './RankingFilterBox'
import { styles } from './RankingsScreen.style'

export function RankingsScreen({
  filter,
  onFilterChange
}: {
  filter: FameRankingFilter
  onFilterChange: (filter: FameRankingFilter) => void
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.screen)}>
      <TitleBox title="명성 랭킹" />
      <RankingFilterBox filter={filter} onChange={onFilterChange} />
      <FameRankingList filter={filter} />
    </div>
  )
}
