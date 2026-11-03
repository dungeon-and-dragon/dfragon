import { Popover } from '@base-ui/react/popover'
import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef } from 'react'
import { HeaderTooltip } from './HeaderTooltip'
import { triggerStyles } from './HeaderTooltip.style'
import { toolStyles } from './HeaderTool.style'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './SnapshotToggle.style'

export function SnapshotToggle({
  label,
  active,
  disabled,
  onTake,
  onClear
}: {
  label: string
  active: boolean
  disabled: boolean
  onTake: () => void
  onClear: () => void
}): React.JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const tooltipLabel = active ? '모험단 고정 풀기' : '모험단 고정하기'

  function handleOpenChange(open: boolean, details: Popover.Root.ChangeEventDetails): void {
    if (open && !active) {
      details.cancel()
      onTake()
    }
  }

  return (
    <Popover.Root onOpenChange={handleOpenChange}>
      <HeaderTooltip label={tooltipLabel}>
        <span {...stylex.props(triggerStyles.wrapper)}>
          <Popover.Trigger
            disabled={disabled}
            render={
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                {...stylex.props(toolStyles.button)}
              >
                <SnapshotIcon filled={active} width={16} height={16} />
              </button>
            }
          />
        </span>
      </HeaderTooltip>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup
            role="alertdialog"
            initialFocus={cancelRef}
            {...stylex.props(styles.popup)}
          >
            <Popover.Title {...stylex.props(styles.title)}>고정을 취소하시겠습니까?</Popover.Title>
            <div {...stylex.props(styles.actions)}>
              <Popover.Close ref={cancelRef} render={<Button variant="secondary" size="sm" />}>
                유지
              </Popover.Close>
              <Popover.Close render={<Button variant="primary" size="sm" />} onClick={onClear}>
                고정 취소
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
