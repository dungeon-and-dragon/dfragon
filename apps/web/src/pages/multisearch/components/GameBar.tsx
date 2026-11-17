import { BoardHeaderSlot } from './BoardHeaderSlot'
import { SearchModeTabs } from './SearchModeTabs'

export function GameBar(): React.JSX.Element {
  return (
    <div className="box-border flex h-10 shrink-0 items-center gap-3 border-b border-line pr-4 pl-1 text-fg">
      <SearchModeTabs />
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
      <BoardHeaderSlot />
    </div>
  )
}
