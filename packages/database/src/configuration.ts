import { parsePort } from '@dfragon/lib/port'
import { readSecretInput } from './secret-input.js'

export interface DatabaseConfiguration {
  host: string
  port: number
  database: string
  username: string
  password: string
}

const invalidDatabaseConfiguration = 'Invalid database configuration'

function requireValue(value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(invalidDatabaseConfiguration)
  }

  return value
}

export function readDatabaseConfiguration(
  environment: NodeJS.ProcessEnv
): DatabaseConfiguration | undefined {
  const inputs = [
    environment.DB_HOST,
    environment.DB_PORT,
    environment.DB_NAME,
    environment.DB_USERNAME,
    environment.DB_PASSWORD,
    environment.DB_PASSWORD_FILE
  ]
  if (inputs.every((input) => input === undefined)) {
    return undefined
  }

  try {
    const host = requireValue(environment.DB_HOST)
    const port = parsePort(environment.DB_PORT)
    const database = requireValue(environment.DB_NAME)
    const username = requireValue(environment.DB_USERNAME)
    // 운영 비밀번호 파일은 끝에 줄바꿈이 있고 DB 비밀번호에는 없다. CRLF로 다시 저장해도 인증되게 끝 공백까지 뺀다.
    const password = requireValue(
      readSecretInput(environment.DB_PASSWORD, environment.DB_PASSWORD_FILE)?.trimEnd()
    )

    return { host, port, database, username, password }
  } catch {
    throw new Error(invalidDatabaseConfiguration)
  }
}
