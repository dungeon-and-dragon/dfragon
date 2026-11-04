import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { prismaArguments, prismaEnvironment } from './prisma-command.js'

export async function applyMigrations(): Promise<void> {
  // Prisma CLI의 출력과 오류는 버린다. 시작 실패 출력은 API의 실패 문구 한 줄로 유지한다.
  const child = spawn(process.execPath, prismaArguments(['migrate', 'deploy']), {
    env: prismaEnvironment(),
    stdio: 'ignore'
  })
  const [code] = await once(child, 'exit')
  if (code !== 0) {
    throw new Error('Database migration failed')
  }
}
