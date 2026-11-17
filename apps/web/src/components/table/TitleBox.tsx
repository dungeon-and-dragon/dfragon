import type { ReactNode } from 'react'

export function TitleBox({
  title,
  children
}: {
  title: string
  children?: ReactNode
}): React.JSX.Element {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 rounded-panel border border-line bg-canvas px-4 max-sm:flex-wrap max-sm:py-3">
      <h1 className="m-0 text-xl font-semibold tracking-heading">{title}</h1>
      {children != null && <div className="flex items-center gap-6">{children}</div>}
    </header>
  )
}

export function TitleStat({
  label,
  value
}: {
  label: string
  value: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs font-medium text-fg-subtle">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums">{value}</span>
    </div>
  )
}
