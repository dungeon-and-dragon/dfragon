import { Hono } from 'hono'
import type { ContentClearSettingService } from '#application/content-clear-settings/index.js'
import { OpsFailure } from '#domain/failure.js'
import { readJsonBody } from '#presentation/http/json-request.js'
import { changeBody, toContentClearSettingListResponse } from './dto.js'

export class ContentClearSettingController {
  constructor(private readonly service: ContentClearSettingService) {}

  routes(): Hono {
    const routes = new Hono()

    routes.get('/', async (c) => {
      const contents = await this.service.readSettings()

      return c.json(toContentClearSettingListResponse(contents))
    })

    routes.patch('/:contentId', async (c) => {
      const request = changeBody.safeParse(await readJsonBody(c))

      if (!request.success) {
        throw new OpsFailure('request')
      }

      const contentId = c.req.param('contentId')
      await this.service.change({ contentId, ...request.data })

      return c.body(null, 204)
    })

    return routes
  }
}
