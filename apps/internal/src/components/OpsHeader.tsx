import { PRODUCT_NAME } from '@dfragon/lib'
import { IconButton } from '@dfragon/ui'
import { EMPTY_VALUE, formatAgo, formatClockMinute, formatClockSecond } from '../format'
import { FOCUS_RING } from './panel-classes'

const WORKER_STALE_MS = 5 * 60_000

const STATUS = 'inline-flex items-center gap-1.5 whitespace-nowrap text-xs'
const STATUS_VALUE = 'font-mono font-semibold tabular-nums'
const DIVIDER = 'h-5 w-px shrink-0 bg-line max-sm:hidden'
const NAV_LINK = `inline-flex h-topbar items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium text-fg-muted no-underline transition-colors duration-(--duration-hover) ease-standard hover:bg-surface hover:text-fg max-sm:h-11 ${FOCUS_RING}`

const TOOL_LINKS = [
  { label: 'Grafana', href: '/grafana/' },
  { label: 'Semaphore', href: '/semaphore/' }
] as const

type OpsHeaderProps = {
  workerSeenAt: Date | null | undefined
  readAt: Date | undefined
  onRefresh: () => void
}

function ExternalIcon(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M14 4h6v6M20 4 10 14M18 14v6H4V6h6" />
    </svg>
  )
}

function RefreshIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  )
}

function WorkerSeen({ seenAt, readAt }: { seenAt: Date; readAt: Date }): React.JSX.Element {
  const age = readAt.getTime() - seenAt.getTime()
  const stale = age > WORKER_STALE_MS

  return (
    <span className={`${STATUS} ${stale ? 'text-fg-warning' : 'text-fg-muted'}`}>
      worker
      <b className={`${STATUS_VALUE} ${stale ? 'text-fg-warning' : 'text-fg'}`}>
        {formatClockMinute(seenAt)}
      </b>
      <span>{formatAgo(age)}</span>
    </span>
  )
}

export function OpsHeader({ workerSeenAt, readAt, onRefresh }: OpsHeaderProps): React.JSX.Element {
  return (
    <header className="self-stretch border-b border-line bg-canvas">
      <div className="mx-auto box-border flex h-topbar w-300 min-w-0 max-w-full items-center gap-4 px-4 max-sm:h-auto max-sm:flex-wrap max-sm:gap-y-0 max-sm:pb-2">
        <a
          href="/"
          className={`flex shrink-0 items-center gap-2 text-fg no-underline ${FOCUS_RING}`}
        >
          <span className="text-base font-bold tracking-heading">{PRODUCT_NAME}</span>
          <span className="text-sm font-medium text-fg-muted">운영</span>
        </a>
        <span aria-hidden="true" className={DIVIDER} />
        <nav aria-label="운영 도구" className="flex h-topbar min-w-0 items-stretch max-sm:h-11">
          {TOOL_LINKS.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className={NAV_LINK}>
              {label}
              <span className="inline-flex text-fg-subtle">
                <ExternalIcon />
              </span>
            </a>
          ))}
        </nav>
        <span className="grow" />
        {workerSeenAt != null && readAt !== undefined ? (
          <WorkerSeen seenAt={workerSeenAt} readAt={readAt} />
        ) : (
          <span className={`${STATUS} text-fg-muted`}>
            worker <b className={`${STATUS_VALUE} text-fg-subtle`}>{EMPTY_VALUE}</b>
          </span>
        )}
        <span aria-hidden="true" className={DIVIDER} />
        <span className={`${STATUS} text-fg-muted`}>
          <b className="font-mono font-medium tabular-nums">
            {readAt !== undefined ? formatClockSecond(readAt) : EMPTY_VALUE}
          </b>
        </span>
        <IconButton size="sm" aria-label="다시 읽기" icon={<RefreshIcon />} onClick={onRefresh} />
      </div>
    </header>
  )
}
