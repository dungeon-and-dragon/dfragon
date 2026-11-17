import { attachBoardHeaderSlot } from '../../../hooks/useBoardHeaderPortal'

export function BoardHeaderSlot(): React.JSX.Element {
  return <div ref={attachBoardHeaderSlot} className="flex min-w-0 grow items-center" />
}
