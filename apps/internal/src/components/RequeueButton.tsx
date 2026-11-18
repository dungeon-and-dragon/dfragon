import { Button, ConfirmPopover, Popover } from '@dfragon/ui'
import { formatCount } from '../format'
import { useRequeue } from '../ops-queries'

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

  function requeueFailures(): Promise<unknown> {
    return requeue.mutateAsync(failure)
  }

  return (
    <ConfirmPopover
      title={`${title} ${formatCount(count)}건 되돌리기`}
      confirmLabel="되돌리기"
      onConfirm={requeueFailures}
    >
      <Popover.Trigger disabled={count === 0} render={<Button size="sm" />}>
        {label}
      </Popover.Trigger>
    </ConfirmPopover>
  )
}
