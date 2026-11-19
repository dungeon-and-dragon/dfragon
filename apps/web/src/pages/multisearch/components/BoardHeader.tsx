import type { ReactNode } from 'react'

export function BoardHeader({
  start,
  end
}: {
  start: ReactNode
  end: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 grow items-center gap-4">
      <div className="flex min-w-0 items-baseline gap-2">{start}</div>
      <div className="ml-auto flex shrink-0 items-center gap-1">{end}</div>
    </div>
  )
}
