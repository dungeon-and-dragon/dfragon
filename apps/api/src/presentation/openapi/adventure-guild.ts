import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, type SchemaObject } from '@nestjs/swagger'
import { LEGION_RELEASE_ORDER, RAID_RELEASE_ORDER } from '../../adventure-guild/activity.js'
import {
  timestampSchema,
  objectSchema,
  successResponse,
  errorResponses,
  textSchema,
  nullableTextSchema,
  timelineClearKindSchema,
  storedCharacterProperties,
  storedCharacterSchema
} from './common.js'

const clearName = objectSchema({
  kind: timelineClearKindSchema,
  name: { ...textSchema, description: '레이드는 raid_name, 레기온은 data.regionName' }
})

const activityCount: SchemaObject = { type: 'integer', minimum: 0 }

const releaseOrderDescription = (kind: string, releaseOrder: readonly string[]): string =>
  `${kind} 이름별 클리어 수. 출시가 최근인 것부터(${releaseOrder.join(', ')})이고, 목록에 없는 이름은 그 뒤에 많은 순, 같으면 이름 순`

const RAID_ORDER_DESCRIPTION = releaseOrderDescription('레이드(201, 210)', RAID_RELEASE_ORDER)

const LEGION_ORDER_DESCRIPTION = releaseOrderDescription('레기온(209)', LEGION_RELEASE_ORDER)

const activityNameCounts = (description: string): SchemaObject => {
  const items = objectSchema({ name: textSchema, count: activityCount })

  return { type: 'array', description, items }
}

const activityRaidCounts = (description: string): SchemaObject => {
  const items = objectSchema({
    name: textSchema,
    count: { ...activityCount, description: 'hard와 normal의 합' },
    hard: { ...activityCount, description: '하드로 클리어한 수(타임라인 data.hard가 true인 행)' },
    normal: { ...activityCount, description: '하드가 아닌 클리어 수' }
  })

  return { type: 'array', description, items }
}

const activityDayDetail = objectSchema({
  date: { type: 'string', format: 'date', description: '06:00 KST에 바뀌는 하루' },
  raids: activityRaidCounts(RAID_ORDER_DESCRIPTION),
  legions: activityNameCounts(LEGION_ORDER_DESCRIPTION),
  items: {
    type: 'array',
    description: '레전더리 이상 아이템 획득, 시각 순',
    items: objectSchema({
      at: { ...timestampSchema, description: '+09:00 offset을 붙인 KST 시각' },
      name: { ...textSchema, nullable: true, description: 'item_name' },
      rarity: { type: 'string', enum: ['레전더리', '에픽', '태초', '신화'] }
    })
  },
  enhancements: {
    type: 'array',
    description: '강화, 증폭, 재련(401~403) 기록, 시각 순',
    items: objectSchema({
      at: { ...timestampSchema, description: '+09:00 offset을 붙인 KST 시각' },
      kind: { type: 'string', enum: ['reinforce', 'amplify', 'refine'] },
      target: { type: 'integer', description: '도전한 단계(타임라인 after)' },
      success: { type: 'boolean' }
    })
  }
})

const enhancementTargets = (description: string): SchemaObject => {
  const items = objectSchema({
    target: { type: 'integer', description: '도전한 단계(타임라인 after)' },
    attempts: activityCount,
    successes: activityCount
  })

  return { type: 'array', description, items }
}

const backfillRanges: SchemaObject = {
  ...activityCount,
  description: '캐릭터마다 시즌 구간을 90일 이하로 나눈 구간 수의 합'
}

const activitySeasonProperties: Record<string, SchemaObject> = {
  id: { type: 'integer', description: '시즌 번호' },
  name: textSchema,
  startsAt: timestampSchema,
  available: {
    type: 'boolean',
    description:
      '집계할 수 있는지. 중천(10) 이후 시즌은 늘 true, 그 전 시즌은 모험단 캐릭터가 모두 끝까지 받았을 때 true'
  },
  backfill: {
    ...objectSchema({
      done: { ...backfillRanges, description: '받은 구간 수' },
      total: backfillRanges,
      running: { type: 'boolean', description: '그 모험단 캐릭터 가운데 받는 중인 캐릭터가 있는지' }
    }),
    description: '중천 전 시즌의 옛 시즌 받기 상태. 중천 이후 시즌에는 없습니다'
  }
}

const activitySeason: SchemaObject = {
  type: 'object',
  required: ['id', 'name', 'startsAt', 'available'],
  additionalProperties: false,
  properties: activitySeasonProperties
}

const storedCharacters = (description: string): SchemaObject => ({
  type: 'array',
  description,
  items: storedCharacterSchema
})

export const adventureGuildSchemas: Record<string, SchemaObject> = {
  AdventureCharacters: objectSchema({
    adventureName: textSchema,
    characters: storedCharacters(
      'DB에 저장된 그 모험단의 캐릭터. 서버를 가리지 않고 명성이 높은 순이며 명성이 없는 캐릭터는 뒤입니다.'
    )
  }),
  Guild: objectSchema({
    guildId: textSchema,
    guildName: {
      ...nullableTextSchema,
      description: '가장 최근에 기본 정보를 받은 길드원의 길드 이름. 길드원이 없으면 null'
    },
    memberCount: { type: 'integer', minimum: 0 },
    averageFame: {
      type: 'integer',
      nullable: true,
      description: '명성이 있는 길드원의 평균을 반올림한 값. 그런 길드원이 없으면 null'
    },
    members: storedCharacters(
      'DB에 저장된 길드원. 서버를 가리지 않고 명성이 높은 순이며 명성이 없는 캐릭터는 뒤입니다.'
    )
  }),
  AdventureWeekly: objectSchema({
    adventureName: textSchema,
    clearNames: {
      type: 'array',
      description:
        '모든 모험단에 같은 고정 레이드, 레기온 목록. 디레지에 레이드, 무너진 성자 미카엘라, 아포칼립스 순입니다.',
      items: clearName
    },
    characters: {
      type: 'array',
      description:
        'DB에 저장된 그 모험단의 캐릭터. 서버를 가리지 않고 명성이 높은 순이며 명성이 없는 캐릭터는 뒤입니다.',
      items: objectSchema({
        ...storedCharacterProperties,
        weeklyClears: {
          type: 'array',
          description:
            '이번 주(목요일 06:00 KST부터) 클리어한 이름. 여러 번 클리어해도 한 번이며 clearNames와 같은 순서입니다.',
          items: clearName
        }
      })
    }
  }),
  AdventureActivity: objectSchema({
    seasons: {
      type: 'array',
      description: '시작한 시즌, 오래된 순',
      items: activitySeason
    },
    season: {
      ...objectSchema({
        id: { type: 'integer' },
        startsAt: timestampSchema,
        endsAt: {
          ...timestampSchema,
          nullable: true,
          description: '다음 시즌 시작. 지금 시즌은 null'
        },
        timelineStartsAt: {
          ...timestampSchema,
          description:
            '타임라인 기록이 있을 수 있는 첫 시각. Neople이 2017-09-21 00:00 KST부터 주므로 마계(5)는 그 시각이고, 나머지는 startsAt과 같습니다'
        }
      }),
      nullable: true,
      description: '집계한 시즌. 시즌이 없는 DB 설정 없는 API에서만 null'
    },
    summary: objectSchema({
      raids: activityRaidCounts(RAID_ORDER_DESCRIPTION),
      legions: activityNameCounts(LEGION_ORDER_DESCRIPTION),
      items: objectSchema({
        legendary: activityCount,
        epic: activityCount,
        primeval: { ...activityCount, description: '태초' },
        mythic: { ...activityCount, description: '신화' }
      }),
      enhancement: objectSchema({
        attempts: { ...activityCount, description: '강화, 증폭, 재련(401~403) 전체 횟수' },
        amplify: enhancementTargets(
          '10증폭 이상 도전의 단계별 시도와 성공, 낮은 단계 순. 강화권, 증폭권 기록(data.ticket이 있는 행)은 뺍니다'
        ),
        reinforce: enhancementTargets(
          '12강 이상 도전의 단계별 시도와 성공, 낮은 단계 순. 강화권, 증폭권 기록(data.ticket이 있는 행)은 뺍니다'
        ),
        amplifyBelow10: activityCount,
        reinforceBelow12: activityCount,
        refine: activityCount
      })
    }),
    days: {
      type: 'array',
      description: '활동이 있는 날만, 오래된 순. 하루는 06:00 KST에 바뀝니다.',
      items: objectSchema({
        date: { type: 'string', format: 'date' },
        raid: activityCount,
        legion: activityCount,
        item: { ...activityCount, description: '레전더리 이상 아이템 획득 수' },
        enhance: { ...activityCount, description: '강화, 증폭, 재련 횟수' },
        primeval: { type: 'boolean', description: '태초를 얻었는지' },
        mythic: { type: 'boolean', description: '신화를 얻었는지' },
        highEnhancement: {
          type: 'boolean',
          description: '10증폭 이상이나 12강 이상 도전이 있었는지'
        }
      })
    }
  }),
  AdventureSeasonBackfill: activitySeason,
  AdventureSeasonDays: objectSchema({
    season: { type: 'integer' },
    days: { type: 'array', description: '활동이 있는 날만, 날짜 순', items: activityDayDetail }
  })
}

export function ApiAdventureCharacters() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 캐릭터 목록 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보에서 모험단 이름이 같은 캐릭터를 서버를 가리지 않고 명성이 높은 순으로 반환합니다. 명성이 없는 캐릭터는 뒤에 두고, 페이지는 없습니다. Neople을 부르지 않으며 값은 행마다 fetchedAt 시점의 것입니다. DB에 없는 모험단과 DB 설정이 없는 API는 빈 목록을 반환합니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    successResponse('AdventureCharacters', '모험단 이름과 캐릭터 목록 (없으면 빈 목록)'),
    errorResponses({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiGuild() {
  return applyDecorators(
    ApiOperation({
      summary: '길드 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보에서 길드 ID가 같은 길드원을 명성이 높은 순으로 반환하고, 길드원 수와 명성이 있는 길드원의 평균 명성을 붙입니다. 길드 ID는 서버가 달라도 같은 길드라 서버 조건이 없습니다. 명성이 없는 캐릭터는 뒤에 두고, 페이지는 없습니다. Neople을 부르지 않습니다. DB에 없는 길드와 DB 설정이 없는 API는 guildName, averageFame이 null인 빈 목록을 반환합니다.'
    }),
    ApiParam({ name: 'guildId', schema: { type: 'string' } }),
    successResponse('Guild', '길드 이름, 길드원 수, 평균 명성과 길드원 목록 (없으면 빈 목록)'),
    errorResponses({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureWeekly() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 주간 클리어 조회',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터를 명성이 높은 순으로 반환하고, 캐릭터마다 이번 주(목요일 06:00 KST부터) 레이드, 레기온 클리어를 붙입니다. clearNames는 모든 모험단에 같은 고정 목록(디레지에 레이드, 무너진 성자 미카엘라, 아포칼립스)이고, 캐릭터별 클리어도 이 목록에 있는 이름만 붙입니다. 조회는 캐릭터마다 타임라인 동기화를 시작하고 끝나기를 기다리지 않아, 응답은 지금 저장된 값입니다. DB에 없는 모험단은 characters만 빈 목록이고, DB 설정이 없는 API는 clearNames와 characters를 모두 빈 목록으로 반환합니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    successResponse(
      'AdventureWeekly',
      '모험단 이름, 고정 클리어 목록과 캐릭터별 이번 주 클리어 (없으면 빈 목록)'
    ),
    errorResponses({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureActivity() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 시즌 활동 조회',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터의 타임라인을 합쳐 한 시즌의 레이드, 레기온 클리어, 레전더리 이상 아이템 획득, 강화, 증폭, 재련 횟수와 활동이 있는 날(06:00 KST에 바뀜)의 횟수를 반환합니다. season이 없으면 지금 시즌입니다. 강화 단계는 타임라인의 after(도전한 단계)입니다. 중천 전 시즌은 backfill에 옛 시즌 받기 진행률이 있고, 모험단 캐릭터가 모두 끝까지 받아야 available이 true가 되어 집계하며 그 전에는 집계가 비어 있습니다. 조회는 캐릭터마다 타임라인 동기화를 시작하고 끝나기를 기다리지 않아, 응답은 지금 저장된 값입니다. DB에 없는 모험단은 집계가 비어 있고, DB 설정이 없는 API는 시즌 목록이 비고 season이 null입니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiQuery({
      name: 'season',
      required: false,
      schema: { type: 'integer', minimum: 1 },
      description: '시즌 번호(중천 10, 천해천 11). 없으면 지금 시즌'
    }),
    successResponse('AdventureActivity', '시즌 목록, 고른 시즌의 구간, 시즌 요약과 날짜별 활동'),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureSeasonBackfill() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 옛 시즌 받기',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터마다 중천 전 시즌 하나의 모든 타임라인 코드를 Neople에서 받도록 옛 시즌 받기 대기열에 넣고, 끝나기를 기다리지 않고 그 시즌의 진행률을 반환합니다. 받는 중이거나 끝까지 받은 캐릭터는 다시 넣지 않습니다. 진행률은 캐릭터마다 시즌 구간을 90일 이하로 나눈 구간 수의 합입니다. 받기는 메모리 대기열이라 API가 다시 시작되면 멈추고, 다시 요청하면 저장한 구간 뒤부터 이어 받습니다. 호출 제한은 없습니다. 중천 이후 시즌이나 시작하지 않은 시즌, DB 설정이 없는 API는 400입니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiParam({
      name: 'season',
      schema: { type: 'integer', minimum: 1 },
      description: '중천 전 시즌 번호(마계 5 ~ 선계 9)'
    }),
    successResponse('AdventureSeasonBackfill', '시즌 목록의 한 칸과 같은 모양의 그 시즌 받기 상태'),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureSeasonDays() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 시즌 하루 활동 상세 조회',
      description:
        '공개 API. 고른 시즌의 기록이 있는 날마다 하루 활동 상세를 날짜 순으로 반환합니다. 하루는 06:00 KST에 바뀝니다. 옛 시즌 받기가 끝나지 않으면 목록이 비고, 시작하지 않았거나 없는 시즌은 400입니다. 타임라인 동기화는 요청하지 않습니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiParam({
      name: 'season',
      schema: { type: 'integer', minimum: 1 },
      description: '시즌 번호'
    }),
    successResponse('AdventureSeasonDays', '시즌 번호와 기록이 있는 날의 상세'),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}
