import { readDatabaseConfiguration } from '@dfragon/database'
import { parsePort } from '@dfragon/lib/port'

const invalidConfiguration = 'Invalid ops runtime configuration'

export function readRuntimeConfiguration(environment: NodeJS.ProcessEnv) {
  try {
    const port = parsePort(environment.PORT)
    const database = readDatabaseConfiguration(environment)

    if (database === undefined) {
      throw new Error(invalidConfiguration)
    }

    return { port, database }
  } catch {
    // DB 입력 오류의 message와 cause는 파일 경로나 값을 포함할 수 있다.
    throw new Error(invalidConfiguration)
  }
}
