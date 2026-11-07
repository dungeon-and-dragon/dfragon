import { readDatabaseConfiguration, readSecretInput } from '@dfragon/database'
import { z } from 'zod'
import { concurrencySchema } from '../neople-collection/concurrency.js'

const invalidConfiguration = 'Invalid skill style collector configuration'

const collectorEnvironmentSchema = z.object({
  SKILL_STYLE_COLLECTOR_CONCURRENCY: concurrencySchema
})

export function readSkillStyleCollectorConfiguration(environment: NodeJS.ProcessEnv) {
  try {
    const { SKILL_STYLE_COLLECTOR_CONCURRENCY: concurrency } =
      collectorEnvironmentSchema.parse(environment)
    const apiKey = readSecretInput(environment.NEOPLE_API_KEY, environment.NEOPLE_API_KEY_FILE)
    const database = readDatabaseConfiguration(environment)
    if (apiKey === undefined || database === undefined) {
      throw new Error(invalidConfiguration)
    }

    return { apiKey, database, concurrency }
  } catch {
    // secret 파일 읽기 오류와 zod issue는 경로나 입력값을 담을 수 있다.
    throw new Error(invalidConfiguration)
  }
}
