import { PRODUCT_NAME } from '@dfragon/lib'
import { ExternalLinkIcon, IconButton, RefreshIcon } from '@dfragon/ui'
import { EMPTY_VALUE, formatAgo, formatClockMinute, formatClockSecond } from '#ops-app/format'
import { OPS_PAGES, type OpsPageId } from '#ops-app/pages'

const WORKER_STALE_MS = 5 * 60_000

const STATUS = 'inline-flex items-center gap-2 whitespace-nowrap text-xs'
const STATUS_VALUE = 'num font-semibold'
const DIVIDER = 'divider-v max-sm:hidden'
const NAV_LINK =
  'inline-flex h-topbar items-center gap-2 whitespace-nowrap px-3 text-sm font-medium text-fg-muted no-underline transition-colors hover:bg-surface hover:text-fg max-sm:h-12 focus-ring'
const PAGE_LINK =
  'inline-flex h-topbar items-center whitespace-nowrap px-3 text-sm font-medium text-fg-muted no-underline transition-colors hover:bg-surface hover:text-fg max-sm:h-12 focus-ring'
const CURRENT_PAGE_LINK =
  'inline-flex h-topbar items-center whitespace-nowrap px-3 text-sm font-semibold text-fg no-underline max-sm:h-12 focus-ring'

const TOOL_LINKS = [
  { label: 'Grafana', href: '/grafana/' },
  { label: 'Semaphore', href: '/semaphore/' }
] as const

type OpsHeaderProps = {
  page: OpsPageId
  workerSeenAt: Date | null | undefined
  readAt: Date | undefined
  onRefresh: () => void
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

export function OpsHeader({
  page,
  workerSeenAt,
  readAt,
  onRefresh
}: OpsHeaderProps): React.JSX.Element {
  return (
    <header className="topbar self-stretch">
      <div className="page page-wide max-sm:h-auto max-sm:flex-wrap max-sm:gap-y-0 max-sm:pb-2">
        <a href="/" className="flex shrink-0 items-center gap-2 text-fg no-underline focus-ring">
          <span className="text-base font-bold tracking-heading">{PRODUCT_NAME}</span>
          <span className="text-sm font-medium text-fg-muted">운영</span>
        </a>
        <span aria-hidden="true" className={DIVIDER} />
        <nav aria-label="운영 화면" className="flex h-topbar min-w-0 items-stretch max-sm:h-12">
          {OPS_PAGES.map(({ id, label, path }) => {
            const current = id === page

            return (
              <a
                key={id}
                href={path}
                aria-current={current ? 'page' : undefined}
                className={current ? CURRENT_PAGE_LINK : PAGE_LINK}
              >
                {label}
              </a>
            )
          })}
        </nav>
        <span aria-hidden="true" className={DIVIDER} />
        <nav aria-label="운영 도구" className="flex h-topbar min-w-0 items-stretch max-sm:h-12">
          {TOOL_LINKS.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className={NAV_LINK}>
              {label}
              <span className="inline-flex text-fg-subtle">
                <ExternalLinkIcon className="size-icon-sm" />
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
          <b className="num font-medium">
            {readAt !== undefined ? formatClockSecond(readAt) : EMPTY_VALUE}
          </b>
        </span>
        <IconButton size="sm" aria-label="다시 읽기" icon={<RefreshIcon />} onClick={onRefresh} />
      </div>
    </header>
  )
}
