import { createOpsRuntime } from './runtime/application.js'
import { readRuntimeConfiguration } from './runtime/configuration.js'

const failureMessage = 'Ops app failed to start'

try {
  const configuration = readRuntimeConfiguration(process.env)
  const app = createOpsRuntime(configuration.database)

  try {
    await app.listen(configuration.port)
  } catch (error) {
    await app.close().catch(() => undefined)

    throw error
  }

  // close가 열린 연결을 기다리며 끝나지 않으면 두 번째 signal은 Node 기본 동작으로 즉시 종료한다.
  const shutdown = (): void => {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    app.close().catch(reportFailure)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch {
  reportFailure()
}

function reportFailure(): void {
  console.error(failureMessage)
  process.exitCode = 1
}
