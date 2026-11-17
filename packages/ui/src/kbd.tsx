import type { ReactNode } from 'react'

export type KbdSurface = 'default' | 'signal'

export type KbdProps = {
  surface?: KbdSurface
  children: ReactNode
}

export function Kbd({ surface = 'default', children }: KbdProps) {
  return (
    <kbd data-surface={surface} className="kbd">
      {children}
    </kbd>
  )
}
