import { isAbsolute } from 'node:path'
import { readDatabaseConfiguration, readSecretInput } from '@dfragon/database'
import { z } from 'zod'
import { concurrencySchema, requestsPerSecondSchema } from '../neople-collection/pace.js'

const invalidConfiguration = 'Invalid character collector configuration'

const collectorEnvironmentSchema = z.object({
  CHARACTER_IMPORT_FILES: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.array(z.string().refine(isAbsolute)).min(1)),
  CHARACTER_COLLECTOR_REQUESTS_PER_SECOND: requestsPerSecondSchema,
  CHARACTER_COLLECTOR_CONCURRENCY: concurrencySchema
})

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

    return { apiKey, database, importFiles, requestsPerSecond, concurrency }
  } catch {
    // secret 파일 읽기 오류와 zod issue는 경로나 입력값을 담을 수 있다.
    throw new Error(invalidConfiguration)
  }
}
