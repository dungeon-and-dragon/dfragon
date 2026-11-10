import type { Run, RunStatus, RunTrigger } from './api/ops-schemas'

export const EMPTY_VALUE = '—'

export const TRIGGER_LABELS: Readonly<Record<RunTrigger, string>> = {
  schedule: '정기',
  catchup: '보충',
  manual: '수동'
}

export const STATUS_LABELS: Readonly<Record<RunStatus, string>> = {
  requested: '요청됨',
  running: '실행 중',
  succeeded: '성공',
  failed: '실패',
  interrupted: '중단'
}

const QUEUE_LABELS: Readonly<Record<string, string>> = {
  'timeline-sync': '타임라인 동기화',
  'enhancement-backfill': '강화 백필',
  'season-backfill': '옛 시즌 백필'
}

const DAILY_CRON_PATTERN = /^(\d{1,2}) (\d{1,2}) \* \* \*$/
const SEOUL_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})
const COUNT_FORMAT = new Intl.NumberFormat('ko-KR')

type SeoulPart = 'month' | 'day' | 'hour' | 'minute' | 'second'

function seoulParts(date: Date): Record<SeoulPart, string> {
  const parts: Record<SeoulPart, string> = { month: '', day: '', hour: '', minute: '', second: '' }
  for (const { type, value } of SEOUL_TIME.formatToParts(date)) {
    if (Object.hasOwn(parts, type)) {
      parts[type as SeoulPart] = value
    }
  }

  return parts
}

export function formatDateMinute(date: Date): string {
  const { month, day, hour, minute } = seoulParts(date)

  return `${month}-${day} ${hour}:${minute}`
}

export function formatDateSecond(date: Date): string {
  const { month, day, hour, minute, second } = seoulParts(date)

  return `${month}-${day} ${hour}:${minute}:${second}`
}

export function formatClockMinute(date: Date): string {
  const { hour, minute } = seoulParts(date)

  return `${hour}:${minute}`
}

export function formatClockSecond(date: Date): string {
  const { hour, minute, second } = seoulParts(date)

  return `${hour}:${minute}:${second}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) {
    return `${seconds}초`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}분 ${pad(seconds % 60)}초`
  }

  return `${Math.floor(minutes / 60)}시간 ${pad(minutes % 60)}분`
}

export function formatAgo(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) {
    return `${seconds}초 전`
  }

  return `${Math.floor(seconds / 60)}분 전`
}

export function runDuration(run: Run, now: Date): number | undefined {
  if (run.startedAt === null) {
    return undefined
  }
  const end = run.finishedAt ?? now

  return end.getTime() - run.startedAt.getTime()
}

export function describeSchedule(cron: string): string | undefined {
  const daily = DAILY_CRON_PATTERN.exec(cron)
  if (daily === null) {
    return undefined
  }
  const [, minute, hour] = daily

  return `매일 ${pad(Number(hour))}:${pad(Number(minute))}`
}

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value)
}

export function formatSummary(summary: Run['summary']): string {
  const entries = Object.entries(summary ?? {})
  if (entries.length === 0) {
    return EMPTY_VALUE
  }

  return entries
    .map(([key, value]) => {
      const text = typeof value === 'number' ? formatCount(value) : String(value)

      return `${key} ${text}`
    })
    .join(' ')
}

export function queueLabel(name: string): string {
  const label = QUEUE_LABELS[name]
  if (label === undefined) {
    return name
  }

  return label
}
