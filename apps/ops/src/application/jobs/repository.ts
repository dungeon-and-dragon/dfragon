import type {
  JobOverview,
  JobPauseChange,
  JobRunHistoryRecord,
  JobRunRequest
} from '@dfragon/database'

export interface JobRepository {
  readOverviews(): Promise<JobOverview[]>
  readRuns(page: { before: number | undefined; limit: number }): Promise<JobRunHistoryRecord[]>
  requestRun(name: string, args: unknown): Promise<JobRunRequest>
  setPaused(name: string, paused: boolean): Promise<JobPauseChange>
}
