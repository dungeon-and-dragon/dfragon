import type { SVGProps } from 'react'

export function StarIcon({
  filled,
  ...props
}: SVGProps<SVGSVGElement> & { filled: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      className={filled ? 'text-fg' : undefined}
      {...props}
    >
      <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" />
    </svg>
  )
}
