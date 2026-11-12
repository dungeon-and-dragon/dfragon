import { Hono } from 'hono'
import type { TodayGradeService } from '../../../application/today-grade/service.js'
import type { AccessLogEnv } from '../access-log.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'
import { createFailureHandler } from '../failure-response.js'
import { todayGradeFailureResponse } from './failures.js'

export function createTodayGradeRoutes(service: TodayGradeService): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()
  routes.onError(createFailureHandler(todayGradeFailureResponse))

  routes.get('/today-grade', (c) =>
    respondUnlessDisconnected(c, async (signal) => c.json(await service.get(signal)))
  )

  return routes
}
