import { isAbsolute } from 'node:path'
import { readDatabaseConfiguration, readSecretInput } from '@dfragon/database'

const invalidConfiguration = 'Invalid character collector configuration'
const DEFAULT_REQUESTS_PER_SECOND = 5

function readRequestsPerSecond(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_REQUESTS_PER_SECOND
  }
  const requestsPerSecond = Number(value)
  if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
    throw new Error(invalidConfiguration)
  }

  return requestsPerSecond
}

export function readCollectorConfiguration(environment: NodeJS.ProcessEnv) {
  try {
    const apiKey = readSecretInput(environment.NEOPLE_API_KEY, environment.NEOPLE_API_KEY_FILE)
    const database = readDatabaseConfiguration(environment)
    const importFile = environment.CHARACTER_IMPORT_FILE
    if (
      apiKey === undefined ||
      database === undefined ||
      importFile === undefined ||
      !isAbsolute(importFile)
    ) {
      throw new Error(invalidConfiguration)
    }
    const requestsPerSecond = readRequestsPerSecond(
      environment.CHARACTER_COLLECTOR_REQUESTS_PER_SECOND
    )

    return { apiKey, database, importFile, requestsPerSecond }
  } catch {
    // secret 파일 읽기 오류는 경로를 담을 수 있다.
    throw new Error(invalidConfiguration)
  }
}
