import { Popover } from '@base-ui/react/popover'
import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { formatCount } from '../format'
import { useRequeue } from '../ops-queries'
import { popoverStyles, textStyles } from './panel.style'
import { styles } from './RequeueButton.style'

type RequeueButtonProps = {
  label: string
  title: string
  failure: string | undefined
  count: number
}

export function RequeueButton({
  label,
  title,
  failure,
  count
}: RequeueButtonProps): React.JSX.Element {
  const requeue = useRequeue()
  const [open, setOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    if (next) {
      requeue.reset()
    }
  }

  function handleConfirm(): void {
    requeue.mutate(failure, { onSuccess: () => setOpen(false) })
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger disabled={count === 0} render={<Button variant="secondary" size="sm" />}>
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
            {...stylex.props(popoverStyles.popup, styles.popup)}
          >
            <Popover.Title {...stylex.props(popoverStyles.title)}>
              {`${title} ${formatCount(count)}건 되돌리기`}
            </Popover.Title>
            {requeue.isError && (
              <p role="alert" {...stylex.props(textStyles.error, styles.error)}>
                요청에 실패했습니다.
              </p>
            )}
            <div {...stylex.props(popoverStyles.actions)}>
              <Popover.Close ref={cancelRef} render={<Button variant="secondary" size="sm" />}>
                취소
              </Popover.Close>
              <Button
                variant="primary"
                size="sm"
                disabled={requeue.isPending}
                onClick={handleConfirm}
              >
                되돌리기
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
