import { Popover } from '@base-ui/react/popover'
import { Button } from '@dfragon/ui'
import { useRef, useState } from 'react'
import { popoverClasses, textClasses } from './panel-classes'

type ConfirmButtonProps = {
  label: string
  title: string
  confirmLabel: string
  disabled: boolean
  pending: boolean
  failed: boolean
  popupClassName: string
  onOpen: () => void
  onConfirm: (close: () => void) => void
}

export function ConfirmButton({
  label,
  title,
  confirmLabel,
  disabled,
  pending,
  failed,
  popupClassName,
  onOpen,
  onConfirm
}: ConfirmButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  function handleOpenChange(next: boolean): void {
    setOpen(next)

    if (next) {
      onOpen()
    }
  }

  function close(): void {
    setOpen(false)
  }

  function handleConfirm(): void {
    onConfirm(close)
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger disabled={disabled} render={<Button variant="secondary" size="sm" />}>
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          className={popoverClasses.positioner}
        >
          <Popover.Popup
            role="alertdialog"
            initialFocus={cancelRef}
            className={`${popoverClasses.popup} ${popupClassName}`}
          >
            <Popover.Title className={popoverClasses.title}>{title}</Popover.Title>
            {failed && (
              <p role="alert" className={`${textClasses.error} px-3 pt-2`}>
                요청에 실패했습니다.
              </p>
            )}
            <div className={`${popoverClasses.actions} pt-3`}>
              <Popover.Close ref={cancelRef} render={<Button variant="secondary" size="sm" />}>
                취소
              </Popover.Close>
              <Button variant="primary" size="sm" disabled={pending} onClick={handleConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
