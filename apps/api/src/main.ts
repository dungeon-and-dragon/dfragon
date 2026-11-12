import { applyMigrations } from '@dfragon/database'
import type { HttpAppHandle } from './runtime/app-handle.js'
import { createApiRuntime, createOpsRuntime } from './runtime/application.js'
import { readRuntimeConfiguration } from './runtime/configuration.js'

const startupFailureMessage = 'API failed to start'

async function closeAll(apps: readonly HttpAppHandle[]): Promise<void> {
  const results = await Promise.allSettled(apps.map((app) => app.close()))
  if (results.some(({ status }) => status === 'rejected')) {
    throw new Error(startupFailureMessage)
  }
}

async function main(): Promise<void> {
  const configuration = await readRuntimeConfiguration(process.env)
  if (configuration.database !== undefined) {
    await applyMigrations()
  }
  const listen = (app: HttpAppHandle, port: number) => {
    if (configuration.localHttps !== undefined) {
      return app.listen(port, '127.0.0.1')
    }

    return app.listen(port)
  }
  const apps: HttpAppHandle[] = []
  try {
    const { app, readQueueCounts } = await createApiRuntime(configuration)
    apps.push(app)
    await listen(app, configuration.port)
    const { ops } = configuration
    if (ops !== undefined) {
      const opsApp = createOpsRuntime(ops.database, readQueueCounts)
      apps.push(opsApp)
      await listen(opsApp, ops.port)
    }
  } catch (error) {
    await closeAll(apps).catch(() => undefined)
    throw error
  }

  const shutdown = (): void => {
    // close가 열린 연결을 기다리며 끝나지 않으면 두 번째 signal은 Node 기본 동작으로 즉시 종료한다.
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    closeAll(apps).catch(() => {
      console.error(startupFailureMessage)
      process.exitCode = 1
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

try {
  await main()
} catch {
  console.error(startupFailureMessage)
  process.exitCode = 1
}
