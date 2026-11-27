import type { AccessLogEnv } from '@dfragon/http-server'
import { Hono } from 'hono'
import { AdventureGuildController } from '#presentation/http/adventure-guild/index.js'
import { CharacterDetailController } from '#presentation/http/character-detail/index.js'
import { CharacterHistoryController } from '#presentation/http/character-history/index.js'
import { CharacterImageController } from '#presentation/http/character-image/index.js'
import { CharacterSearchController } from '#presentation/http/character-search/index.js'
import { EquipmentSimulationController } from '#presentation/http/equipment-simulation/index.js'
import { ClearStatsController } from '#presentation/http/content-clears/index.js'
import { HealthController } from '#presentation/http/health/index.js'
import { ItemDetailController } from '#presentation/http/item-detail/index.js'
import { LabItemController } from '#presentation/http/lab-items/index.js'
import { RankingStatsController } from '#presentation/http/ranking-stats/index.js'
import { SoulPriceController } from '#presentation/http/soul-prices/index.js'
import { TodayGradeController } from '#presentation/http/today-grade/index.js'
import { VersionController } from '#presentation/http/version/index.js'
import type { ApiServices } from '#runtime/api-services.js'

export function createApiRoutes(services: ApiServices): Hono<AccessLogEnv> {
  const routes = new Hono<AccessLogEnv>()
  routes.route('/health', new HealthController().routes())
  routes.route('/version', new VersionController(services.buildInfo).routes())
  routes.route('/characters', new CharacterSearchController(services.search).routes())
  routes.route('/characters', new CharacterDetailController(services.details).routes())
  routes.route(
    '/characters',
    new EquipmentSimulationController(services.equipmentSimulation).routes()
  )
  routes.route('/characters', new CharacterImageController(services.characterImage).routes())
  routes.route('/characters', new CharacterHistoryController(services.characterHistory).routes())
  routes.route('/', new AdventureGuildController(services.adventureGuild).routes())
  routes.route('/', new RankingStatsController(services.rankingStats).routes())
  routes.route('/stats/clears', new ClearStatsController(services.clearStats).routes())
  routes.route('/lab', new LabItemController(services.labItems).routes())
  routes.route('/items', new TodayGradeController(services.todayGrade).routes())
  routes.route('/items', new SoulPriceController(services.soulPrices).routes())
  // Hono는 먼저 붙인 route부터 맞추므로, `today-grade`, `soul-prices`를 itemId로 받지 않게 그 뒤에 붙인다.
  routes.route('/items', new ItemDetailController(services.itemDetail).routes())

  return routes
}
