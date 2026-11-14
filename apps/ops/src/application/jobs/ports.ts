import type { JobOverview, JobPauseChange, JobRunRecord, JobRunRequest } from '@dfragon/database'

export type OpsJobStore = {
  readOverviews: () => Promise<JobOverview[]>
  readRuns: (
    name: string,
    page: { before: number | undefined; limit: number }
  ) => Promise<JobRunRecord[] | undefined>
  requestRun: (name: string, args: unknown) => Promise<JobRunRequest>
  setPaused: (name: string, paused: boolean) => Promise<JobPauseChange>
}
