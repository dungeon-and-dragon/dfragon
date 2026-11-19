import { Tooltip } from '@dfragon/ui'
import type { ReactElement } from 'react'

// 게임 바(40px)의 32px 버튼 아래로 8px을 띄워 툴팁이 게임 바보다 4px 아래에서 시작하게 한다.
const TOP_BAR_TOOLTIP_OFFSET = 8

// 툴팁 trigger로 버튼을 감싼 요소를 버튼 상자와 같은 크기로 둔다.
export const tooltipTriggerClass = 'inline-flex'

export function HeaderTooltip({
  label,
  disabled,
  children
}: {
  label: string
  disabled?: boolean
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="bottom" sideOffset={TOP_BAR_TOOLTIP_OFFSET}>
        <span className="block text-center">{label}</span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
