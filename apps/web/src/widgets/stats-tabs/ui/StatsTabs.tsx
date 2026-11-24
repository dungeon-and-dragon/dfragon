import { Link, useLocation } from '@tanstack/react-router'

const STATS_TABS = [
  { to: '/stats/sets', label: '세트' },
  { to: '/stats/weapons', label: '무기' },
  { to: '/stats/combos', label: '조합' },
  { to: '/stats', label: '캐릭터' },
  { to: '/stats/skills', label: '스킬' },
  { to: '/clears', label: '클리어' }
] as const

// 세트, 조합, 무기, 스킬 탭은 같은 직업, 전직 필터를 주소에 두므로 이 탭 사이를 오갈 때 필터를 그대로 넘긴다.
const SHARED_FILTER_TABS: ReadonlySet<string> = new Set([
  '/stats/sets',
  '/stats/combos',
  '/stats/weapons',
  '/stats/skills'
])

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
