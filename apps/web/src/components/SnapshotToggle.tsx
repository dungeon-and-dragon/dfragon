import { ConfirmPopover, PinIcon, Popover, type PopoverChangeEventDetails } from '@dfragon/ui'
import { HeaderTooltip, tooltipTriggerClass } from './HeaderTooltip'

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
  const tooltipLabel = active ? '모험단 고정 풀기' : '모험단 고정하기'

  function handleOpenChange(open: boolean, details: PopoverChangeEventDetails): void {
    if (open && !active) {
      details.cancel()
      onTake()
    }
  }

  return (
    <ConfirmPopover
      title="고정을 취소하시겠습니까?"
      cancelLabel="유지"
      confirmLabel="고정 취소"
      onOpenChange={handleOpenChange}
      onConfirm={onClear}
    >
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
                <PinIcon filled={active} className="size-icon-sm" />
              </button>
            }
          />
        </span>
      </HeaderTooltip>
    </ConfirmPopover>
  )
}
