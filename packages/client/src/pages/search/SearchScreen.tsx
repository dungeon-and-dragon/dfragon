import * as stylex from '@stylexjs/stylex'
import { useIsPartyMode, useIsRaidMode } from '../../hooks/useSearchModeStore'
import { PartyScreen } from '../party/PartyScreen'
import { RaidScreen } from '../raid/RaidScreen'
import { styles } from './SearchScreen.style'

export function SearchScreen(): React.JSX.Element {
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()

  return (
    <div {...stylex.props(styles.content)}>
      <div {...stylex.props(styles.page)}>
        {isPartyMode && <PartyScreen />}
        {isRaidMode && <RaidScreen />}
      </div>
    </div>
  )
}
