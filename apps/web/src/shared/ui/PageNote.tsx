import { type ReactNode, use } from 'react'
import { createPortal } from 'react-dom'
import { PageNoteTarget } from './page-note-target'

export function PageNote({ children }: { children: ReactNode }): React.JSX.Element | null {
  const target = use(PageNoteTarget)

  if (target === null) {
    return null
  }

  return createPortal(children, target)
}
