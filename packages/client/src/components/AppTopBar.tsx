import type { ReactNode } from 'react'
import { useTodayGrade } from '../hooks/useTodayGrade'
import { BoardHeaderSlot } from './BoardHeaderSlot'
import { MainNav } from './MainNav'
import { TopBar } from './TopBar'

export function AppTopBar({ captureControls }: { captureControls: ReactNode }): React.JSX.Element {
  const grade = useTodayGrade()

  return (
    <TopBar grade={grade} nav={<MainNav />} board={<BoardHeaderSlot />} status={captureControls} />
  )
}
