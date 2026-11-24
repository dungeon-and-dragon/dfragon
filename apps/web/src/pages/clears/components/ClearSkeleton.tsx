import { TitleBox } from '#shared/ui/TitleBox'
import { CARD_SIZE } from './ClearContentCards'
import { CLEAR_TITLE } from './ClearPanel'
import { clearClasses } from './clear-classes'

const CARD_SKELETON_COUNT = 6

export function ClearScreenSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" className={clearClasses.screen}>
      <TitleBox title={CLEAR_TITLE} />
      <div aria-hidden="true" className="section px-4">
        <div className="-m-1 flex gap-3 overflow-hidden p-1">
          {Array.from({ length: CARD_SKELETON_COUNT }, (_, index) => (
            <span key={index} className={`skeleton ${CARD_SIZE}`} />
          ))}
        </div>
      </div>
      <ClearStatsSkeleton />
    </div>
  )
}

export function ClearStatsSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" className={clearClasses.pending}>
      <div className={clearClasses.row}>
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton />
    </div>
  )
}

function PanelSkeleton(): React.JSX.Element {
  return (
    <div className="section flex min-w-0 grow basis-0 flex-col gap-4 px-4">
      <span className="skeleton-text w-[96px]" />
      <span className="skeleton h-[220px]" />
    </div>
  )
}
