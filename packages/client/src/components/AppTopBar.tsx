import type { ReactNode } from 'react'
import { useScreenCaptureContext } from '../hooks/useScreenCaptureContext'
import { useTodayGrade } from '../hooks/useTodayGrade'
import { BoardHeaderSlot } from './BoardHeaderSlot'
import { CaptureControls } from './CaptureControls'
import { MainNav } from './MainNav'
import { TopBar } from './TopBar'
import { UpdateNoticeSlot } from './UpdateNoticeSlot'

export function AppTopBar({ captureControls }: { captureControls?: ReactNode }): React.JSX.Element {
  const { partyCapture, controls } = useScreenCaptureContext()
  const grade = useTodayGrade()

  return (
    <TopBar
      grade={grade}
      start={<MainNav />}
      center={<BoardHeaderSlot />}
      end={
        <>
          <UpdateNoticeSlot />
          {captureControls ?? (
            <CaptureControls
              source={partyCapture.source}
              searchReady={partyCapture.search.ready}
              stopCapture={partyCapture.stopCapture}
              phase={controls.phase}
              status={controls.status}
            />
          )}
        </>
      }
    />
  )
}
