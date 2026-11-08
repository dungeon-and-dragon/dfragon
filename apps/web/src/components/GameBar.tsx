import * as stylex from '@stylexjs/stylex'
import { BoardHeaderSlot } from './BoardHeaderSlot'
import { styles } from './GameBar.style'
import { SearchModeTabs } from './SearchModeTabs'

export function GameBar(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.bar)}>
      <SearchModeTabs />
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      <BoardHeaderSlot />
    </div>
  )
}
