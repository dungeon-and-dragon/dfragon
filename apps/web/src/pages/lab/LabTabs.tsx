import { Link } from '@tanstack/react-router'

export function LabTabs(): React.JSX.Element {
  return (
    <nav aria-label="실험실 종류" className="tabs px-1">
      <Link to="/lab/enchants" className="tab no-underline focus-ring-inset">
        마법부여
      </Link>
    </nav>
  )
}
