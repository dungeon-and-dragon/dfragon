import { Link } from '@tanstack/react-router'
import type { ReactNode, Ref } from 'react'

const TAB = 'tab no-underline focus-ring-inset'

export function AdventureTabs({
  adventureName,
  actions,
  ref
}: {
  adventureName: string
  actions?: ReactNode
  ref: Ref<HTMLDivElement>
}): React.JSX.Element {
  return (
    <div
      ref={ref}
      className="section sticky top-0 z-sticky flex flex-wrap items-center gap-x-4 bg-canvas pt-2 pb-0"
    >
      <nav aria-label="모험단" className="tabs min-w-0 grow px-1">
        <Link
          to="/adventures/$adventureName"
          params={{ adventureName }}
          activeOptions={{ exact: true, includeSearch: false }}
          className={TAB}
        >
          활동
        </Link>
        <Link
          to="/adventures/$adventureName/equipment"
          params={{ adventureName }}
          activeOptions={{ exact: true, includeSearch: false }}
          className={TAB}
        >
          장비
        </Link>
        <Link
          to="/adventures/$adventureName/timeline"
          params={{ adventureName }}
          activeOptions={{ exact: true, includeSearch: false }}
          className={TAB}
        >
          타임라인
        </Link>
      </nav>
      {actions}
    </div>
  )
}
