import type { ReactNode } from 'react'
import { BoardHeader } from '#components/BoardHeader'
import { BoardNotice } from './components/BoardNotice'
import { BoardTitle } from '#components/BoardTitle'
import { CaptureButton } from '#components/CaptureButton'
import { ClipboardCopyButton } from '#shared/ui/ClipboardCopyButton'
import { LastCaptureTime } from '#components/LastCaptureTime'
import { SnapshotToggle } from '#components/SnapshotToggle'
import { useBoardHeaderPortal } from '#hooks/useBoardHeaderPortal'
import { useRaidSlotCards } from './hooks/useRaidSlotCards'
import { filledSlotCount, useScreenCaptureContext } from '#features/capture-search'
import { RaidScreen } from './RaidScreen'

export function RaidPage({ captureSource }: { captureSource: ReactNode }): React.JSX.Element {
  const { raidCapture: capture } = useScreenCaptureContext()
  const { cards, snapshot, clipboardText } = useRaidSlotCards(capture)
  const notice = capture.search.connectionFailed
    ? '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    : ''
  const { renderBoardHeader } = useBoardHeaderPortal()

  return (
    <>
      {renderBoardHeader(
        <BoardHeader
          start={
            <>
              <BoardTitle
                label="공대"
                filled={filledSlotCount(cards)}
                total={cards.length}
                round={snapshot.round}
              />
              <BoardNotice>{notice}</BoardNotice>
            </>
          }
          end={
            <>
              <LastCaptureTime at={capture.lastCompletedAt} />
              {captureSource}
              <SnapshotToggle
                label="공대 모험단 순번 스냅샷"
                active={snapshot.active}
                disabled={!snapshot.active && filledSlotCount(cards) === 0}
                onTake={snapshot.take}
                onClear={snapshot.clear}
              />
              <ClipboardCopyButton text={clipboardText} />
              <CaptureButton
                target="공대"
                disabled={!capture.canStartCapture}
                onClick={capture.startRound}
              />
            </>
          }
        />
      )}
      <RaidScreen
        resetKey={String(capture.round)}
        slots={cards}
        seats={capture.seats}
        actions={{
          lookupSlot: capture.search.lookupSlot,
          pickCandidate: capture.search.pickCandidate,
          changeSnapshotAdventure: snapshot.changeAdventure
        }}
      />
    </>
  )
}
