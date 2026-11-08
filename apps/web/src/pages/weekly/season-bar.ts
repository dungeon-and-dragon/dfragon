import type { ActivitySeason } from '#core/adventure-guild/adventure-activity'

export type SeasonBar =
  | Readonly<{ state: 'ready' }>
  | Readonly<{ state: 'locked' }>
  | Readonly<{ state: 'backfill'; progress: number; running: boolean }>

export function backfillProgress(done: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return Math.min(done / total, 1)
}

export function seasonBar({ available, backfill }: ActivitySeason): SeasonBar {
  if (available) {
    return { state: 'ready' }
  }

  if (backfill === undefined) {
    return { state: 'locked' }
  }

  return {
    state: 'backfill',
    progress: backfillProgress(backfill.done, backfill.total),
    running: backfill.running
  }
}
