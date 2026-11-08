import * as stylex from '@stylexjs/stylex'
import { ListBox } from '../../components/table/ListBox'
import { styles } from './FameRankingBox.style'

export function FameRankingBox(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.box)}>
      <ListBox name="명성 랭킹" />
    </div>
  )
}
