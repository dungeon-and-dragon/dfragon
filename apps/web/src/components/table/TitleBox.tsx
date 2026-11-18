import type { ReactNode } from 'react'

export function TitleBox({
  title,
  children
}: {
  title: string
  children?: ReactNode
}): React.JSX.Element {
  return (
    <header className="section screen-head">
      <h1 className="screen-title">{title}</h1>
      {children != null && <div className="flex items-center gap-6">{children}</div>}
    </header>
  )
}

export function TitleStat({
  label,
  value,
  numeric = true
}: {
  label: string
  value: ReactNode
  numeric?: boolean
}): React.JSX.Element {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${numeric ? '' : ' font-sans'}`}>{value}</span>
    </div>
  )
}
