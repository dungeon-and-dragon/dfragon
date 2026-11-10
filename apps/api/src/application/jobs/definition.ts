import type { JobRunSummary } from '@dfragon/database'
import type { z } from 'zod'

export type JobContext = {
  reportProgress: (done: number, total?: number) => void
}

export type JobDefinition<Schema extends z.ZodType = z.ZodType> = {
  name: string
  displayName: string
  description: string
  /** Asia/Seoul 기준 cron 식이다. 없으면 수동으로만 돈다. */
  schedule?: string
  argsSchema: Schema
  delayMinutes: number
  run(args: z.output<Schema>, context: JobContext): Promise<JobRunSummary | undefined>
}

export function defineJob<Schema extends z.ZodType>(
  definition: JobDefinition<Schema>
): JobDefinition<Schema> {
  return definition
}
