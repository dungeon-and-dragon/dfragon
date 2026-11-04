import { spawnSync } from 'node:child_process'
import { prismaArguments, prismaEnvironment } from './prisma-command.js'

// 운영 이미지 안에서 pnpm 없이 시작 때와 같은 Prisma 설정으로 관리 명령을 실행한다.
const result = spawnSync(process.execPath, prismaArguments(process.argv.slice(2)), {
  env: prismaEnvironment(),
  stdio: 'inherit'
})
process.exitCode = result.status ?? 1
