import { Link } from '@tanstack/react-router'

const LAB_TABS = [
  { to: '/lab/enchants', label: '마법부여' },
  { to: '/lab/multisearch', label: '멀티서치' }
] as const

export function LabTabs(): React.JSX.Element {
  return (
    <nav aria-label="실험실 종류" className="tabs px-1">
      {LAB_TABS.map(({ to, label }) => (
        <Link key={to} to={to} className="tab no-underline focus-ring-inset">
          {label}
        </Link>
      ))}
    </nav>
  )
}
