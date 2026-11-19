import type { ReactNode } from 'react'
import { useIsPartyMode, useIsRaidMode } from '#features/capture-search'
import { PartyPage } from '#pages/party'
import { RaidPage } from '#pages/raid'

export function SearchScreen({ captureSource }: { captureSource: ReactNode }): React.JSX.Element {
  const isPartyMode = useIsPartyMode()
  const isRaidMode = useIsRaidMode()

  return (
    <div className="shrink-0 pb-1">
      <div className="flex flex-col">
        {isPartyMode && <PartyPage captureSource={captureSource} />}
        {isRaidMode && <RaidPage captureSource={captureSource} />}
      </div>
    </div>
  )
}
