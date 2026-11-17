import { Button, Popover, type PopoverChangeEventDetails } from '@dfragon/ui'
import { useRef } from 'react'
import { HeaderTooltip, tooltipTriggerClass } from './HeaderTooltip'
import { SnapshotIcon } from './SnapshotIcon'

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

  function handleOpenChange(open: boolean, details: PopoverChangeEventDetails): void {
    if (open && !active) {
      details.cancel()
      onTake()
    }
  }

  return (
    <Popover.Root onOpenChange={handleOpenChange}>
      <HeaderTooltip label={tooltipLabel}>
        <span className={tooltipTriggerClass}>
          <Popover.Trigger
            disabled={disabled}
            render={
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                className="icon-btn icon-btn-sm"
              >
                <SnapshotIcon filled={active} width={16} height={16} />
              </button>
            }
          />
        </span>
      </HeaderTooltip>
      <Popover.Popup
        side="bottom"
        align="end"
        sideOffset={8}
        role="alertdialog"
        initialFocus={cancelRef}
      >
        <div className="box-border flex w-55 flex-col gap-3 px-3.5 pt-3.5 pb-3">
          <Popover.Title>고정을 취소하시겠습니까?</Popover.Title>
          <div className="flex justify-end gap-2">
            <Popover.Close ref={cancelRef} render={<Button variant="secondary" size="sm" />}>
              유지
            </Popover.Close>
            <Popover.Close render={<Button variant="primary" size="sm" />} onClick={onClear}>
              고정 취소
            </Popover.Close>
          </div>
        </div>
      </Popover.Popup>
    </Popover.Root>
  )
}
