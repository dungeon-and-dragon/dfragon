import { Link, useLocation } from '@tanstack/react-router'

const STATS_TABS = [
  { to: '/stats/sets', label: '세트' },
  { to: '/stats/jobs', label: '직업' },
  { to: '/stats', label: '명성' },
  { to: '/clears', label: '클리어' }
] as const

// 세트, 직업 탭은 같은 직업, 전직, 표본 필터를 주소에 두므로 두 탭 사이를 오갈 때 필터를 그대로 넘긴다.
const SHARED_FILTER_TABS: ReadonlySet<string> = new Set(['/stats/sets', '/stats/jobs'])

export function StatsTabs(): React.JSX.Element {
  const pathname = useLocation({ select: (location) => location.pathname })
  const keepsFilter = SHARED_FILTER_TABS.has(pathname)

  return (
    <nav aria-label="통계 종류" className="tabs px-1">
      {STATS_TABS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          search={keepsFilter && SHARED_FILTER_TABS.has(to) ? true : undefined}
          activeOptions={{ exact: to !== '/clears', includeSearch: false }}
          className="tab no-underline focus-ring-inset"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
