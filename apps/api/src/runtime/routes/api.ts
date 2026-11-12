import { Hono } from 'hono'
import type { AccessLogEnv } from '../../presentation/http/access-log.js'
import { createAdventureGuildRoutes } from '../../presentation/http/adventure-guild/routes.js'
import { createCharacterDetailRoutes } from '../../presentation/http/character-detail/routes.js'
import { createCharacterImageRoutes } from '../../presentation/http/character-image/routes.js'
import { createCharacterSearchRoutes } from '../../presentation/http/character-search/routes.js'
import { createCharacterTimelineRoutes } from '../../presentation/http/character-timeline/routes.js'
import { createClearStatsRoutes } from '../../presentation/http/content-clears/routes.js'
import { createHealthRoutes } from '../../presentation/http/health/routes.js'
import { createRankingStatsRoutes } from '../../presentation/http/ranking-stats/routes.js'
import { createTodayGradeRoutes } from '../../presentation/http/today-grade/routes.js'
import { createVersionRoutes } from '../../presentation/http/version/routes.js'
import type { ApiServices } from '../api-services.js'

export function createApiRoutes(services: ApiServices): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()
  routes.route('/health', createHealthRoutes())
  routes.route('/version', createVersionRoutes(services.buildInfo))
  routes.route('/characters', createCharacterSearchRoutes(services.search))
  routes.route('/characters', createCharacterDetailRoutes(services.details))
  routes.route('/characters', createCharacterImageRoutes(services.fetchCharacterImage))
  routes.route('/characters', createCharacterTimelineRoutes(services.timeline))
  routes.route('/', createAdventureGuildRoutes(services.adventureGuild))
  routes.route('/', createRankingStatsRoutes(services.rankingStats))
  routes.route('/stats/clears', createClearStatsRoutes(services.clearStats))
  routes.route('/items', createTodayGradeRoutes(services.todayGrade))

  return routes
}
