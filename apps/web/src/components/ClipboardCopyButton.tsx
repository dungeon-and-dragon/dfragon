import { CheckIcon, CopyIcon } from '@dfragon/ui'
import type { ClipboardCopyStatus } from '../hooks/useClipboardCopy'
import { HeaderTooltip, tooltipTriggerClass } from './HeaderTooltip'

const FAILURE_MESSAGE = '클립보드에 복사하지 못했습니다.'

export function ClipboardCopyButton({
  status,
  onCopy
}: {
  status: ClipboardCopyStatus
  onCopy: () => void
}): React.JSX.Element {
  const Icon = status === 'copied' ? CheckIcon : CopyIcon
  const announcement = clipboardAnnouncement(status)

  return (
    <>
      {status === 'failed' && (
        <p
          title={FAILURE_MESSAGE}
          className="m-0 flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-fg-muted"
        >
          <span
            aria-hidden="true"
            className="flex size-[18px] shrink-0 items-center justify-center rounded-control bg-danger-weak text-sm font-semibold text-fg-danger"
          >
            !
          </span>
          <span className="min-w-0 truncate">{FAILURE_MESSAGE}</span>
        </p>
      )}
      <HeaderTooltip label="복사하기">
        <span className={tooltipTriggerClass}>
          <button
            type="button"
            aria-label="클립보드로 복사"
            onClick={onCopy}
            className="icon-btn icon-btn-sm"
          >
            <Icon className="size-icon-sm" />
          </button>
        </span>
      </HeaderTooltip>
      {/* 화면 밖에 두어 헤더 컨트롤 사이 간격을 바꾸지 않는다. */}
      <span role="status" data-clipboard-announcer="" className="sr-only">
        {announcement}
      </span>
    </>
  )
}

function clipboardAnnouncement(status: ClipboardCopyStatus): string {
  if (status === 'copied') {
    return '클립보드로 복사했습니다.'
  }

  if (status === 'failed') {
    return FAILURE_MESSAGE
  }

  return ''
}
