export function BoardNotice({ children }: { children: string }): React.JSX.Element {
  return (
    <span role="status" title={children} className="min-w-0 truncate text-xs text-fg-muted">
      {children}
    </span>
  )
}
