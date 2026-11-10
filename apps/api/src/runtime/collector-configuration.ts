import { isAbsolute } from 'node:path'
import { readDatabaseConfiguration, readSecretInput } from '@dfragon/database'
import { z } from 'zod'

const invalidConfiguration = 'Invalid character collector configuration'
const DEFAULT_REQUESTS_PER_SECOND = 5
const DEFAULT_CONCURRENCY = 1
const MAX_CONCURRENCY = 32

const collectorEnvironmentSchema = z.object({
  CHARACTER_IMPORT_FILES: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.array(z.string().refine(isAbsolute)).min(1)),
  CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: z.coerce
    .number()
    .positive()
    .finite()
    .default(DEFAULT_REQUESTS_PER_SECOND),
  CHARACTER_COLLECTOR_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CONCURRENCY)
    .default(DEFAULT_CONCURRENCY)
})

const HTTPS_PROTOCOL_PATTERN = /^https$/
const jobAlertWebhookUrlSchema = z.url({ protocol: HTTPS_PROTOCOL_PATTERN }).optional()

export function readCollectorConfiguration(environment: NodeJS.ProcessEnv) {
  try {
    const {
      CHARACTER_IMPORT_FILES: importFiles,
      CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: requestsPerSecond,
      CHARACTER_COLLECTOR_CONCURRENCY: concurrency
    } = collectorEnvironmentSchema.parse(environment)
    const apiKey = readSecretInput(environment.NEOPLE_API_KEY, environment.NEOPLE_API_KEY_FILE)
    const database = readDatabaseConfiguration(environment)
    if (apiKey === undefined || database === undefined) {
      throw new Error(invalidConfiguration)
    }
    const jobAlertWebhookUrl = jobAlertWebhookUrlSchema.parse(
      readSecretInput(
        environment.JOB_ALERT_DISCORD_WEBHOOK_URL,
        environment.JOB_ALERT_DISCORD_WEBHOOK_URL_FILE
      )
    )

    return { apiKey, database, importFiles, requestsPerSecond, concurrency, jobAlertWebhookUrl }
  } catch {
    // secret 파일 읽기 오류와 zod issue는 경로나 입력값을 담을 수 있다.
    throw new Error(invalidConfiguration)
  }
}
