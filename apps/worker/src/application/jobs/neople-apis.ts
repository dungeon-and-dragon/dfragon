import type { JobNeopleApi } from '@dfragon/database'

const CHARACTER = '/df/servers/{serverId}/characters/{characterId}'
const DETAIL_GROUP = '캐릭터 상세, 아이템'

export const NEOPLE_APIS = {
  timeline: { group: '캐릭터 타임라인', endpoints: [`${CHARACTER}/timeline`] },
  fameRefresh: {
    group: '캐릭터 기본 정보, 타임라인',
    endpoints: [CHARACTER, `${CHARACTER}/timeline`]
  },
  fameSearch: {
    group: '명성 검색',
    endpoints: ['/df/servers/{serverId}/characters-fame', '/df/servers', '/df/jobs']
  },
  skillStyle: { group: '스킬 스타일', endpoints: [`${CHARACTER}/skill/style`] },
  characterDetail: {
    group: DETAIL_GROUP,
    endpoints: [
      `${CHARACTER}/status`,
      `${CHARACTER}/equip/*`,
      `${CHARACTER}/skill/buff/equip/*`,
      '/df/multi/items'
    ]
  },
  items: { group: DETAIL_GROUP, endpoints: ['/df/multi/items'] },
  auction: { group: '경매장', endpoints: ['/df/auction'] }
} as const satisfies Record<string, JobNeopleApi>
