import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactElement } from 'react'
import { styles } from './HeaderTooltip.style'

// 상단 바의 28px 버튼 아래로 12px을 띄워 툴팁이 상단 바(44px)보다 4px 아래에서 시작하게 한다.
const TOP_BAR_TOOLTIP_OFFSET = 12

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
        <span {...stylex.props(styles.label)}>{label}</span>
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
