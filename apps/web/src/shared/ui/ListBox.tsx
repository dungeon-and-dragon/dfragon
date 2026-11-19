import type { ReactNode } from 'react'

export function ListBox({
  name,
  fillHeight = false,
  children
}: {
  name: string
  fillHeight?: boolean
  children?: ReactNode
}): React.JSX.Element {
  return (
    <section aria-label={name} className={`section min-w-0${fillHeight ? ' flex flex-col' : ''}`}>
      <h2 className="section-title">{name}</h2>
      {children}
    </section>
  )
}
