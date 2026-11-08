import * as stylex from '@stylexjs/stylex'
import { CharacterSearchBox } from '../../components/CharacterSearchBox'
import { styles } from './HomeSearch.style'

export function HomeSearch(): React.JSX.Element {
  return (
    <div {...stylex.props(styles.hero)}>
      <CharacterSearchBox size="large" />
    </div>
  )
}
