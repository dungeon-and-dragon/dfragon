import type {
  SeasonBackfillJob,
  SeasonBackfillTarget
} from '@dfragon/server-core/domain/character-timeline/index.js'
import { type JobQueue, createJobQueue } from './queue.js'

// 운영 배포 뒤 실제 요청 수와 시간을 재 다시 정할 시작값이다(#1324).
export const SEASON_BACKFILL_CONCURRENCY = 2

export type SeasonBackfillQueue = JobQueue<SeasonBackfillTarget, SeasonBackfillJob>

function targetKey({ character: { serverId, characterId }, seasonId }: SeasonBackfillTarget) {
  return `${serverId}/${characterId}/${seasonId}`
}

export function createSeasonBackfillQueue(
  backfill: (job: SeasonBackfillJob) => Promise<void>,
  reportFailure: () => void
): SeasonBackfillQueue {
  return createJobQueue(targetKey, backfill, reportFailure, SEASON_BACKFILL_CONCURRENCY)
}
