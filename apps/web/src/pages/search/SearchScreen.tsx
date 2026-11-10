import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { useIsPartyMode, useIsRaidMode } from '../../hooks/useSearchModeStore'
import { PartyPage } from '../party/PartyPage'
import { RaidPage } from '../raid/RaidPage'
import { styles } from './SearchScreen.style'

export function SearchScreen({ captureSource }: { captureSource: ReactNode }): React.JSX.Element {
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()

  return (
    <div {...stylex.props(styles.content)}>
      <div {...stylex.props(styles.page)}>
        {isPartyMode && <PartyPage captureSource={captureSource} />}
        {isRaidMode && <RaidPage captureSource={captureSource} />}
      </div>
    </div>
  )
}
