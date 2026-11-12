import { formatCount } from '../format'
import { useRequeue } from '../ops-queries'
import { ConfirmButton } from './ConfirmButton'
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

  function handleConfirm(close: () => void): void {
    requeue.mutate(failure, { onSuccess: close })
  }

  return (
    <ConfirmButton
      label={label}
      title={`${title} ${formatCount(count)}건 되돌리기`}
      confirmLabel="되돌리기"
      disabled={count === 0}
      pending={requeue.isPending}
      failed={requeue.isError}
      popupStyle={styles.popup}
      onOpen={requeue.reset}
      onConfirm={handleConfirm}
    />
  )
}
