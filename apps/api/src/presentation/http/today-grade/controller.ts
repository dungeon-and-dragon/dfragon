import { type AccessLogEnv, createFailureHandler } from '@dfragon/http-server'
import { Hono } from 'hono'
import type { TodayGradeService } from '../../../application/today-grade/service.js'
import { respondUnlessDisconnected } from '../disconnected-request.js'
import type { TodayGradeResponse } from './dto.js'
import { todayGradeFailureResponse } from './failures.js'

export class TodayGradeController {
  constructor(private readonly service: TodayGradeService) {}

  routes(): Hono<AccessLogEnv> {
    const routes = new Hono<AccessLogEnv>()
    routes.onError(createFailureHandler(todayGradeFailureResponse))

    routes.get('/today-grade', (c) =>
      respondUnlessDisconnected(c, async (signal) => {
        const grade: TodayGradeResponse = await this.service.get(signal)

        return c.json(grade)
      })
    )

    return routes
  }
}
