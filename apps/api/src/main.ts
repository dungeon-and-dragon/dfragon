import { applyMigrations } from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { createApiRuntime, createOpsRuntime } from './runtime/application.js'
import { readRuntimeConfiguration } from './runtime/configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

const failureMessage = 'API failed to start'

try {
  const configuration = await readRuntimeConfiguration(process.env)

  if (configuration.database !== undefined) {
    await applyMigrations()
  }

  const apps = await startApps(configuration)
  closeOnSignal(apps)
} catch {
  reportFailure()
}

async function startApps(configuration: RuntimeConfiguration): Promise<HttpAppHandle[]> {
  const hostname = configuration.localHttps === undefined ? undefined : '127.0.0.1'
  const apps: HttpAppHandle[] = []

  try {
    const { app } = await createApiRuntime(configuration)
    const { ops } = configuration

    apps.push(app)
    await app.listen(configuration.port, hostname)

    if (ops !== undefined) {
      const opsApp = createOpsRuntime(ops.database)

      apps.push(opsApp)
      await opsApp.listen(ops.port, hostname)
    }

    return apps
  } catch (error) {
    await closeApps(apps).catch(() => undefined)

    throw error
  }
}

// close가 열린 연결을 기다리며 끝나지 않으면 두 번째 signal은 Node 기본 동작으로 즉시 종료한다.
function closeOnSignal(apps: readonly HttpAppHandle[]): void {
  const shutdown = (): void => {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    closeApps(apps).catch(reportFailure)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function closeApps(apps: readonly HttpAppHandle[]): Promise<void> {
  const results = await Promise.allSettled(apps.map((app) => app.close()))

  if (results.some(({ status }) => status === 'rejected')) {
    throw new Error(failureMessage)
  }
}

function reportFailure(): void {
  console.error(failureMessage)
  process.exitCode = 1
}
