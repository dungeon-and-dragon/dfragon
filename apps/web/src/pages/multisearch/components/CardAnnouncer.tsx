export function CardAnnouncer({ children }: { children: string }): React.JSX.Element {
  return (
    <span aria-live="polite" className="sr-only">
      {children}
    </span>
  )
}
