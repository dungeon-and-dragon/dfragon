import { applyMigrations } from '@dfragon/database'
import type { HttpAppHandle } from '@dfragon/http-server'
import { createApiRuntime } from './runtime/application.js'
import { readRuntimeConfiguration } from './runtime/configuration.js'

type RuntimeConfiguration = Awaited<ReturnType<typeof readRuntimeConfiguration>>

const failureMessage = 'API failed to start'

try {
  const configuration = await readRuntimeConfiguration(process.env)

  if (configuration.database !== undefined) {
    await applyMigrations()
  }

  const app = await startApp(configuration)
  closeOnSignal(app)
} catch {
  reportFailure()
}

async function startApp(configuration: RuntimeConfiguration): Promise<HttpAppHandle> {
  const hostname = configuration.localHttps === undefined ? undefined : '127.0.0.1'
  const { app } = await createApiRuntime(configuration)

  try {
    await app.listen(configuration.port, hostname)

    return app
  } catch (error) {
    await app.close().catch(() => undefined)

    throw error
  }
}

// close가 열린 연결을 기다리며 끝나지 않으면 두 번째 signal은 Node 기본 동작으로 즉시 종료한다.
function closeOnSignal(app: HttpAppHandle): void {
  const shutdown = (): void => {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    app.close().catch(reportFailure)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function reportFailure(): void {
  console.error(failureMessage)
  process.exitCode = 1
}
