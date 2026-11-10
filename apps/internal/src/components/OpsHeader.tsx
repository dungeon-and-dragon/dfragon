import { PRODUCT_NAME } from '@dfragon/lib'
import { IconButton } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { EMPTY_VALUE, formatAgo, formatClockMinute, formatClockSecond } from '../format'
import { styles } from './OpsHeader.style'

const WORKER_STALE_MS = 5 * 60_000

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
    <span {...stylex.props(styles.status, stale && styles.stale)}>
      worker
      <b {...stylex.props(styles.statusValue, stale && styles.stale)}>
        {formatClockMinute(seenAt)}
      </b>
      <span>{formatAgo(age)}</span>
    </span>
  )
}

export function OpsHeader({ workerSeenAt, readAt, onRefresh }: OpsHeaderProps): React.JSX.Element {
  return (
    <header {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.inner)}>
        <a href="/" {...stylex.props(styles.brand)}>
          <span {...stylex.props(styles.product)}>{PRODUCT_NAME}</span>
          <span {...stylex.props(styles.area)}>운영</span>
        </a>
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        <nav aria-label="운영 도구" {...stylex.props(styles.nav)}>
          {TOOL_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.navLink)}
            >
              {label}
              <span {...stylex.props(styles.external)}>
                <ExternalIcon />
              </span>
            </a>
          ))}
        </nav>
        <span {...stylex.props(styles.spacer)} />
        {workerSeenAt != null && readAt !== undefined ? (
          <WorkerSeen seenAt={workerSeenAt} readAt={readAt} />
        ) : (
          <span {...stylex.props(styles.status)}>
            worker <b {...stylex.props(styles.statusValue)}>{EMPTY_VALUE}</b>
          </span>
        )}
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
        <span {...stylex.props(styles.status)}>
          <b {...stylex.props(styles.readAt)}>
            {readAt !== undefined ? formatClockSecond(readAt) : EMPTY_VALUE}
          </b>
        </span>
        <IconButton size="sm" aria-label="다시 읽기" icon={<RefreshIcon />} onClick={onRefresh} />
      </div>
    </header>
  )
}
