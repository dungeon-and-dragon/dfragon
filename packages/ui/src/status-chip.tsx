import type { ReactNode } from 'react'

export type StatusChipTone = 'neutral' | 'success' | 'danger' | 'warning' | 'signal'

export type StatusChipProps = {
  tone: StatusChipTone
  role?: 'status'
  size?: 'sm' | 'md'
  busy?: boolean
  children: ReactNode
}

export function StatusChip({ tone, role, size = 'sm', busy = false, children }: StatusChipProps) {
  return (
    <span
      role={role}
      data-tone={tone}
      data-busy={busy ? '' : undefined}
      className={`status-chip status-chip-${size}`}
    >
      <span aria-hidden="true" className={busy ? 'status-spinner' : 'status-dot'} />
      {children}
    </span>
  )
}
