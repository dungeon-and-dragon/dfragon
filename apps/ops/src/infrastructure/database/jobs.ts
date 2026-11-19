import {
  type DatabaseClient,
  type JobOverview,
  type JobPauseChange,
  type JobRunHistoryRecord,
  type JobRunRequest,
  readJobOverviews,
  readJobRuns,
  requestJobRun,
  setJobPaused
} from '@dfragon/database'
import type { JobRepository } from '#application/jobs/repository.js'

export class DatabaseJobRepository implements JobRepository {
  constructor(private readonly client: DatabaseClient) {}

  readOverviews(): Promise<JobOverview[]> {
    return readJobOverviews(this.client)
  }

  readRuns(page: { before: number | undefined; limit: number }): Promise<JobRunHistoryRecord[]> {
    return readJobRuns(this.client, page)
  }

  requestRun(name: string, args: unknown): Promise<JobRunRequest> {
    return requestJobRun(this.client, name, args)
  }

  setPaused(name: string, paused: boolean): Promise<JobPauseChange> {
    return setJobPaused(this.client, name, paused)
  }
}
