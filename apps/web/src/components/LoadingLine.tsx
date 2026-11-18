import { useRef } from 'react'
import { useLoadingLinePass } from '#animations/useLoadingLinePass'

export function LoadingLine({ short = false }: { short?: boolean }): React.JSX.Element {
  const segmentRef = useRef<HTMLSpanElement>(null)
  useLoadingLinePass(segmentRef)

  return (
    <span aria-hidden="true" className={short ? 'loading-line loading-line-sm' : 'loading-line'}>
      <span ref={segmentRef} />
    </span>
  )
}
