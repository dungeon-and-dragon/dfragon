import { Popover as BasePopover } from '@base-ui/react/popover'
import { type ReactNode, useRef, useState } from 'react'
import { Button } from './button'
import { Popover, type PopoverChangeEventDetails } from './popover'

const FAILURE_MESSAGE = '요청에 실패했습니다.'

export type ConfirmPopoverProps = {
  title: string
  confirmLabel: string
  cancelLabel?: string
  children: ReactNode
  onOpenChange?: (open: boolean, details: PopoverChangeEventDetails) => void
  onConfirm: () => void | Promise<unknown>
}

export function ConfirmPopover({
  title,
  confirmLabel,
  cancelLabel = '취소',
  children,
  onOpenChange,
  onConfirm
}: ConfirmPopoverProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  function handleOpenChange(next: boolean, details: PopoverChangeEventDetails): void {
    onOpenChange?.(next, details)

    if (details.isCanceled) {
      return
    }

    setOpen(next)

    if (next) {
      setFailed(false)
    }
  }

  async function confirm(): Promise<void> {
    setPending(true)
    setFailed(false)

    try {
      await onConfirm()
      setOpen(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <BasePopover.Root open={open} onOpenChange={handleOpenChange}>
      {children}
      <Popover.Popup
        side="bottom"
        align="end"
        sideOffset={8}
        role="alertdialog"
        initialFocus={cancelRef}
      >
        <div className="confirm-popover">
          <Popover.Title>{title}</Popover.Title>
          {failed && (
            <p role="alert" className="confirm-popover-error">
              {FAILURE_MESSAGE}
            </p>
          )}
          <div className="confirm-popover-actions">
            <Popover.Close ref={cancelRef} render={<Button size="sm" />}>
              {cancelLabel}
            </Popover.Close>
            <Button variant="primary" size="sm" disabled={pending} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Popover.Popup>
    </BasePopover.Root>
  )
}
