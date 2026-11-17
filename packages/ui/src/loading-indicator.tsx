import type { ReactNode } from 'react'
import { ProgressCircle } from './progress-circle'

export type LoadingIndicatorProps = {
  children?: ReactNode
}

export function LoadingIndicator({ children }: LoadingIndicatorProps) {
  return (
    <span className="loading">
      <span className="loading-label">{children}</span>
      <span className="loading-indicator">
        <ProgressCircle size="inherit" tone="inherit" aria-hidden="true" />
      </span>
    </span>
  )
}
