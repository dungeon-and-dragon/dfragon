import type { ReactNode } from 'react'
import { BoardHeader } from '#components/BoardHeader'
import { BoardTitle } from '#components/BoardTitle'
import { CaptureButton } from '#components/CaptureButton'
import { ClipboardCopyButton } from '#shared/ui/ClipboardCopyButton'
import { LastCaptureTime } from '#components/LastCaptureTime'
import { SnapshotToggle } from '#components/SnapshotToggle'
import { useBoardHeaderPortal } from '#hooks/useBoardHeaderPortal'
import { usePartySlotCards } from './hooks/usePartySlotCards'
import { useScreenCaptureContext } from '#hooks/useScreenCaptureContext'
import { filledSlotCount } from '#core/capture'
import { PartyScreen } from './PartyScreen'

export function PartyPage({ captureSource }: { captureSource: ReactNode }): React.JSX.Element {
  const { partyCapture: capture } = useScreenCaptureContext()
  const { cards, snapshot, clipboardText } = usePartySlotCards(capture)
  const { renderBoardHeader } = useBoardHeaderPortal()

  return (
    <div className="flex flex-col gap-4">
      {renderBoardHeader(
        <BoardHeader
          start={
            <>
              <BoardTitle
                label="파티"
                filled={filledSlotCount(cards)}
                total={cards.length}
                round={snapshot.round}
              />
            </>
          }
          end={
            <>
              <LastCaptureTime at={capture.lastCompletedAt} />
              {captureSource}
              <SnapshotToggle
                label="파티 모험단 순번 스냅샷"
                active={snapshot.active}
                disabled={!snapshot.active && filledSlotCount(cards) === 0}
                onTake={snapshot.take}
                onClear={snapshot.clear}
              />
              <ClipboardCopyButton text={clipboardText} />
              <CaptureButton
                target="파티"
                disabled={!capture.canStartCapture}
                onClick={capture.startRound}
              />
            </>
          }
        />
      )}
      <PartyScreen
        resetKey={String(capture.round)}
        slots={cards}
        seats={capture.seats}
        actions={{
          lookupSlot: capture.search.lookupSlot,
          pickCandidate: capture.search.pickCandidate,
          changeSnapshotAdventure: snapshot.changeAdventure
        }}
      />
    </div>
  )
}
