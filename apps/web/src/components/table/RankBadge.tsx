import * as stylex from '@stylexjs/stylex'
import { styles } from './RankBadge.style'

const BADGE_RANKS = 3

export function RankBadge({ rank }: { rank: number }): React.JSX.Element {
  return <span {...stylex.props(rank <= BADGE_RANKS ? styles.badge : styles.plain)}>{rank}</span>
}
