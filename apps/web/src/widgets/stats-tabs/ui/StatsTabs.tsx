import { Link } from '@tanstack/react-router'

const STATS_TABS = [
  { to: '/stats/jobs', label: '직업' },
  { to: '/stats', label: '명성' },
  { to: '/clears', label: '클리어' }
] as const

export function StatsTabs(): React.JSX.Element {
  return (
    <nav aria-label="통계 종류" className="tabs px-1">
      {STATS_TABS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to !== '/clears', includeSearch: false }}
          className="tab no-underline focus-ring-inset"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
