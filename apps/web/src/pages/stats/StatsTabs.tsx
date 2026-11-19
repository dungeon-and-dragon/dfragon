import { Link } from '@tanstack/react-router'

const STATS_TABS = [
  { to: '/stats', label: '캐릭터' },
  { to: '/stats/sets', label: '세트' }
] as const

export function StatsTabs(): React.JSX.Element {
  return (
    <nav aria-label="통계 종류" className="tabs px-1">
      {STATS_TABS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: true, includeSearch: false }}
          className="tab no-underline focus-ring-inset"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
