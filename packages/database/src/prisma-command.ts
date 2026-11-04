import { fileURLToPath } from 'node:url'

const prismaCli = fileURLToPath(import.meta.resolve('prisma/build/index.js'))
const prismaConfig = fileURLToPath(new URL('./prisma.config.js', import.meta.url))

export function prismaArguments(command: readonly string[]): string[] {
  return [prismaCli, ...command, '--config', prismaConfig]
}

export function prismaEnvironment(): NodeJS.ProcessEnv {
  // DEBUG=prisma:*는 연결 URL을 출력하므로 넘기지 않는다.
  const { DEBUG: _debug, ...environment } = process.env

  return { ...environment, CHECKPOINT_DISABLE: '1' }
}
