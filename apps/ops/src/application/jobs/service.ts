import type { JobOverview, JobPauseChange, JobRunRecord } from '@dfragon/database'
import { OpsFailure } from '../../domain/failure.js'
import type { JobRepository } from './repository.js'

export type JobList = {
  readonly workerSeenAt: Date | null
  readonly jobs: readonly JobOverview[]
}

export type JobRunPage = {
  readonly runs: readonly JobRunRecord[]
  readonly nextBefore: number | null
}

function latestWorkerSeenAt(jobs: readonly JobOverview[]): Date | null {
  let latest: Date | null = null

  for (const { workerSeenAt } of jobs) {
    if (latest === null || workerSeenAt > latest) {
      latest = workerSeenAt
    }
  }

  return latest
}

function throwPauseFailure(change: JobPauseChange): void {
  if (change === 'not-found') {
    throw new OpsFailure('jobNotFound')
  }

  if (change === 'not-scheduled') {
    throw new OpsFailure('jobNotScheduled')
  }
}

export class JobService {
  constructor(private readonly repository: JobRepository) {}

  async readList(): Promise<JobList> {
    const jobs = await this.repository.readOverviews()
    const workerSeenAt = latestWorkerSeenAt(jobs)

    return { workerSeenAt, jobs }
  }

  async readRuns(
    name: string,
    { before, limit }: { before: number | undefined; limit: number }
  ): Promise<JobRunPage> {
    // 다음 쪽이 있는지 알려고 한 행을 더 읽는다.
    const runs = await this.repository.readRuns(name, { before, limit: limit + 1 })

    if (runs === undefined) {
      throw new OpsFailure('jobNotFound')
    }

    const pageRuns = runs.slice(0, limit)
    const nextBefore = runs.length > limit ? (pageRuns.at(-1)?.id ?? null) : null

    return { runs: pageRuns, nextBefore }
  }

  async requestRun(name: string, args: unknown): Promise<number> {
    const result = await this.repository.requestRun(name, args ?? {})

    if (result.status === 'not-found') {
      throw new OpsFailure('jobNotFound')
    }

    if (result.status === 'active') {
      throw new OpsFailure('jobAlreadyRunning')
    }

    return result.id
  }

  async setPaused(name: string, paused: boolean): Promise<void> {
    throwPauseFailure(await this.repository.setPaused(name, paused))
  }
}
