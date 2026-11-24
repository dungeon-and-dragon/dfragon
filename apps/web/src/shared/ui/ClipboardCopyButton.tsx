import { Button, CheckIcon, CopyIcon } from '@dfragon/ui'
import { useClipboardCopy } from '#shared/lib/useClipboardCopy'
import { HeaderTooltip, tooltipTriggerClass } from './HeaderTooltip'

const FAILURE_MESSAGE = '클립보드에 복사하지 못했습니다.'

export function ClipboardCopyButton({
  text,
  label
}: {
  text: string
  label?: string
}): React.JSX.Element {
  const clipboard = useClipboardCopy(text)
  const Icon = clipboard.status === 'copied' ? CheckIcon : CopyIcon

  return (
    <>
      {clipboard.status === 'failed' && (
        <p
          title={FAILURE_MESSAGE}
          className="m-0 flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-fg-muted"
        >
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center rounded-control bg-danger-weak font-semibold text-fg-danger"
          >
            !
          </span>
          <span className="min-w-0 truncate">{FAILURE_MESSAGE}</span>
        </p>
      )}
      {label !== undefined ? (
        <Button variant="secondary" size="sm" onClick={clipboard.copy}>
          <Icon className="size-icon-sm" />
          {label}
        </Button>
      ) : (
        <HeaderTooltip label="복사하기">
          <span className={tooltipTriggerClass}>
            <button
              type="button"
              aria-label="클립보드로 복사"
              onClick={clipboard.copy}
              className="icon-btn icon-btn-sm"
            >
              <Icon className="size-icon-sm" />
            </button>
          </span>
        </HeaderTooltip>
      )}
    </>
  )
}
