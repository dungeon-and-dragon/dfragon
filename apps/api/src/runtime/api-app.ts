import {
  type AccessLogSink,
  createCodeReport,
  createHonoApp,
  createHonoAppHandle,
  writeAccessLogToStdout
} from '@dfragon/http-server'
import { characterFailureResponse } from '../presentation/http/character-failures.js'
import { type ApiServicesOptions, createApiServices } from './api-services.js'
import { createApiRoutes } from './routes/api.js'

export interface ApiHttpAppOptions extends ApiServicesOptions {
  readonly httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>
  readonly writeAccessLog?: AccessLogSink
}

/** Public game data runs without authentication credentials; a database is only used for timeline sync, character basics, skill styles, adventure, guild reads and fame rankings, stats, clear stats. */
export async function createApiHttpApp(options: ApiHttpAppOptions) {
  const { writeAccessLog = writeAccessLogToStdout } = options
  const { services, readQueueCounts, refreshClearStats, close } = await createApiServices(
    options,
    createCodeReport(writeAccessLog, 'api')
  )
  try {
    const app = createHonoApp({
      accessLogService: 'api',
      writeAccessLog,
      toFailureResponse: characterFailureResponse
    })
    app.route('/', createApiRoutes(services))

    return {
      app: createHonoAppHandle(app, { httpsOptions: options.httpsOptions, close }),
      readQueueCounts,
      refreshClearStats
    }
  } catch (error) {
    // server를 만들지 못해도 이미 띄운 점수 worker가 process를 붙잡지 않게 멈춘다.
    await close(async () => undefined).catch(() => undefined)
    throw error
  }
}
