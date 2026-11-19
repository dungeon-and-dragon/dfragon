import { Link } from '@tanstack/react-router'

const TAB = 'tab no-underline focus-ring-inset'

export function AdventureTabs({ adventureName }: { adventureName: string }): React.JSX.Element {
  return (
    <div className="section pb-0">
      <nav aria-label="모험단" className="tabs px-1">
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
      </nav>
    </div>
  )
}
