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
    <section
      aria-label={name}
      className={`min-w-0 overflow-hidden rounded-panel border border-line bg-canvas${fillHeight ? ' flex flex-col' : ''}`}
    >
      <h2
        className={`m-0 flex min-h-12 items-center px-4 text-base font-semibold${children != null ? ' border-b border-line' : ''}`}
      >
        {name}
      </h2>
      {children}
    </section>
  )
}
