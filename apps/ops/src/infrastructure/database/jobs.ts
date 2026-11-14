import {
  type DatabaseClient,
  type JobOverview,
  type JobPauseChange,
  type JobRunRecord,
  type JobRunRequest,
  readJobOverviews,
  readJobRuns,
  requestJobRun,
  setJobPaused
} from '@dfragon/database'
import type { JobRepository } from '../../application/jobs/repository.js'

export class DatabaseJobRepository implements JobRepository {
  constructor(private readonly client: DatabaseClient) {}

  readOverviews(): Promise<JobOverview[]> {
    return readJobOverviews(this.client)
  }

  readRuns(
    name: string,
    page: { before: number | undefined; limit: number }
  ): Promise<JobRunRecord[] | undefined> {
    return readJobRuns(this.client, name, page)
  }

  requestRun(name: string, args: unknown): Promise<JobRunRequest> {
    return requestJobRun(this.client, name, args)
  }

  setPaused(name: string, paused: boolean): Promise<JobPauseChange> {
    return setJobPaused(this.client, name, paused)
  }
}
