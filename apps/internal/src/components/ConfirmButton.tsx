import { Popover } from '@base-ui/react/popover'
import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { styles } from './ConfirmButton.style'
import { popoverStyles, textStyles } from './panel.style'

type ConfirmButtonProps = {
  label: string
  title: string
  confirmLabel: string
  disabled: boolean
  pending: boolean
  failed: boolean
  popupStyle: stylex.StyleXStyles
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
  popupStyle,
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
          {...stylex.props(popoverStyles.positioner)}
        >
          <Popover.Popup
            role="alertdialog"
            initialFocus={cancelRef}
            {...stylex.props(popoverStyles.popup, popupStyle)}
          >
            <Popover.Title {...stylex.props(popoverStyles.title)}>{title}</Popover.Title>
            {failed && (
              <p role="alert" {...stylex.props(textStyles.error, styles.error)}>
                요청에 실패했습니다.
              </p>
            )}
            <div {...stylex.props(popoverStyles.actions)}>
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
