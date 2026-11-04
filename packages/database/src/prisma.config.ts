import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'
import { readDatabaseConfiguration } from './configuration.js'
import { createDatabaseUrl } from './database-url.js'

// 연결 URL은 DB_* 입력에서 이 프로세스 안에서만 만들어 비밀번호를 Prisma 명령 인자나 새 환경변수에 넣지 않는다.
// Prisma CLI가 schema engine에 넘기는 인자에는 URL이 들어간다(ADR 0014).
const configuration = readDatabaseConfiguration(process.env)
if (configuration === undefined) {
  throw new Error('Invalid database configuration')
}

export default defineConfig({
  schema: fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
  migrations: { path: fileURLToPath(new URL('../prisma/migrations', import.meta.url)) },
  datasource: { url: createDatabaseUrl(configuration) }
})
