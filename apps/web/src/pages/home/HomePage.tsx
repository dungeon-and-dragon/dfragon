import * as stylex from '@stylexjs/stylex'
import { FameRankingBox } from './FameRankingBox'
import { HomeSearch } from './HomeSearch'
import { styles } from './HomePage.style'

export function HomePage(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.screen)}>
      <HomeSearch />
      <FameRankingBox />
    </div>
  )
}
