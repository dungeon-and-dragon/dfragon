import { Hono } from 'hono'
import type { JobService } from '../../../application/jobs/service.js'
import { OpsFailure } from '../../../domain/failure.js'
import { readJsonBody } from '../json-request.js'
import {
  runPageQuery,
  runRequestBody,
  toJobListResponse,
  toJobRunPageResponse,
  toJobRunRequestResponse
} from './dto.js'

export class JobController {
  constructor(private readonly service: JobService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const list = await this.service.readList()

      return c.json(toJobListResponse(list))
    })

    routes.get('/:name/runs', async (c) => {
      const page = runPageQuery.safeParse(c.req.query())

      if (!page.success) {
        throw new OpsFailure('request')
      }

      const { before, limit } = page.data
      const runPage = await this.service.readRuns(c.req.param('name'), { before, limit })

      return c.json(toJobRunPageResponse(runPage))
    })

    routes.post('/:name/runs', async (c) => {
      const request = runRequestBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const id = await this.service.requestRun(c.req.param('name'), request.data.args)

      return c.json(toJobRunRequestResponse(id), 202)
    })

    routes.post('/:name/pause', async (c) => {
      await this.service.setPaused(c.req.param('name'), true)

      return c.body(null, 204)
    })

    routes.post('/:name/resume', async (c) => {
      await this.service.setPaused(c.req.param('name'), false)

      return c.body(null, 204)
    })

    return routes
  }
}
