import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { useIsPartyMode, useIsRaidMode } from '../../hooks/useSearchModeStore'
import { PartyScreen } from '../party/PartyScreen'
import { RaidScreen } from '../raid/RaidScreen'
import { styles } from './SearchScreen.style'

export function SearchScreen({ captureSource }: { captureSource: ReactNode }): React.JSX.Element {
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()

  return (
    <div {...stylex.props(styles.content)}>
      <div {...stylex.props(styles.page)}>
        {isPartyMode && <PartyScreen captureSource={captureSource} />}
        {isRaidMode && <RaidScreen captureSource={captureSource} />}
      </div>
    </div>
  )
}
