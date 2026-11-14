import type { AccessLogEnv } from '@dfragon/http-server'
import { Hono } from 'hono'
import { AdventureGuildController } from '../../presentation/http/adventure-guild/controller.js'
import { CharacterDetailController } from '../../presentation/http/character-detail/controller.js'
import { CharacterImageController } from '../../presentation/http/character-image/controller.js'
import { CharacterSearchController } from '../../presentation/http/character-search/controller.js'
import { CharacterTimelineController } from '../../presentation/http/character-timeline/controller.js'
import { ClearStatsController } from '../../presentation/http/content-clears/controller.js'
import { createHealthRoutes } from '../../presentation/http/health/routes.js'
import { RankingStatsController } from '../../presentation/http/ranking-stats/controller.js'
import { TodayGradeController } from '../../presentation/http/today-grade/controller.js'
import { createVersionRoutes } from '../../presentation/http/version/routes.js'
import type { ApiServices } from '../api-services.js'

export function createApiRoutes(services: ApiServices): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()
  routes.route('/health', createHealthRoutes())
  routes.route('/version', createVersionRoutes(services.buildInfo))
  routes.route('/characters', new CharacterSearchController(services.search).routes())
  routes.route('/characters', new CharacterDetailController(services.details).routes())
  routes.route('/characters', new CharacterImageController(services.characterImage).routes())
  routes.route('/characters', new CharacterTimelineController(services.timeline).routes())
  routes.route('/', new AdventureGuildController(services.adventureGuild).routes())
  routes.route('/', new RankingStatsController(services.rankingStats).routes())
  routes.route('/stats/clears', new ClearStatsController(services.clearStats).routes())
  routes.route('/items', new TodayGradeController(services.todayGrade).routes())

  return routes
}
