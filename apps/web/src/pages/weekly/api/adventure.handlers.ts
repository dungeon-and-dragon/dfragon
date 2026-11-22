import { delay, HttpResponse, http } from 'msw'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import {
  storyAdventureActivity,
  storyAdventureEquipment,
  storyAdventureSeasonDays,
  storyAdventureTimeline,
  storyAdventureWeekly,
  storyEmptyAdventureEquipment
} from './adventure.fixture'

export const ADVENTURE_WEEKLY_URL = `${API_BASE_URL}/adventures/:adventureName/weekly`
export const ADVENTURE_EQUIPMENT_URL = `${API_BASE_URL}/adventures/:adventureName/equipment`
export const ADVENTURE_TIMELINE_URL = `${API_BASE_URL}/adventures/:adventureName/timeline`
export const ADVENTURE_ACTIVITY_URL = `${API_BASE_URL}/adventures/:adventureName/activity`
export const ADVENTURE_BACKFILL_URL = `${API_BASE_URL}/adventures/:adventureName/activity/seasons/:season/backfill`
export const ADVENTURE_SEASON_DAYS_URL = `${API_BASE_URL}/adventures/:adventureName/activity/seasons/:season/days`

function failure(message: string): HttpResponse<object> {
  return HttpResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 })
}

async function never(): Promise<void> {
  await delay('infinite')
}

export const adventureHandlers = {
  adventure: [
    oathCatalogHandlers.catalog(oathCatalogFixture.setStats),
    http.get(ADVENTURE_WEEKLY_URL, () => HttpResponse.json(storyAdventureWeekly)),
    http.get(ADVENTURE_EQUIPMENT_URL, ({ request }) => {
      const { searchParams } = new URL(request.url)
      const equipment = storyAdventureEquipment(searchParams.get('server'), searchParams.get('set'))

      return HttpResponse.json(equipment)
    }),
    http.get(ADVENTURE_TIMELINE_URL, ({ request }) => {
      const kind = new URL(request.url).searchParams.get('kind')

      return HttpResponse.json(storyAdventureTimeline(kind))
    }),
    http.get(ADVENTURE_ACTIVITY_URL, ({ request }) => {
      const season = new URL(request.url).searchParams.get('season')
      const seasonId = season !== null ? Number(season) : undefined
      const activity = storyAdventureActivity(seasonId)

      return HttpResponse.json(activity)
    }),
    http.get(ADVENTURE_SEASON_DAYS_URL, ({ params }) => {
      const days = storyAdventureSeasonDays(Number(params.season))

      return HttpResponse.json(days)
    })
  ],
  emptyEquipment: [
    http.get(ADVENTURE_EQUIPMENT_URL, () => HttpResponse.json(storyEmptyAdventureEquipment))
  ],
  loading: [
    ADVENTURE_WEEKLY_URL,
    ADVENTURE_ACTIVITY_URL,
    ADVENTURE_EQUIPMENT_URL,
    ADVENTURE_TIMELINE_URL
  ].map((url) => http.get(url, never)),
  failure: [
    http.get(ADVENTURE_WEEKLY_URL, () => failure('주간 던파를 받지 못했습니다.')),
    http.get(ADVENTURE_ACTIVITY_URL, () => failure('모험단 활동을 받지 못했습니다.')),
    http.get(ADVENTURE_EQUIPMENT_URL, () => failure('장비를 받지 못했습니다.')),
    http.get(ADVENTURE_TIMELINE_URL, () => failure('타임라인을 받지 못했습니다.')),
    http.get(ADVENTURE_SEASON_DAYS_URL, never)
  ]
}
