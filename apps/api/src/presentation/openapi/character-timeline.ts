import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiQuery, type SchemaObject } from '@nestjs/swagger'
import {
  timestampSchema,
  objectSchema,
  successResponse,
  errorResponses,
  textSchema,
  timelineClearKindSchema,
  characterParams
} from './common.js'

const timelineCursor: SchemaObject = { ...textSchema, nullable: true }

const timelineEnhancement = objectSchema({
  kind: { type: 'string', enum: ['reinforce', 'amplify', 'refine'] },
  itemId: { ...textSchema, nullable: true },
  itemName: { ...textSchema, nullable: true },
  itemRarity: { ...textSchema, nullable: true },
  before: { type: 'integer', nullable: true, description: '재련은 값이 없어 null' },
  after: { type: 'integer' },
  result: { type: 'boolean' },
  safe: { type: 'boolean', nullable: true, description: '재련은 값이 없어 null' },
  occurredAt: timestampSchema
})

const timelineAcquisition = objectSchema({
  code: { type: 'integer', description: '획득 경로의 타임라인 코드' },
  name: { ...textSchema, description: '타임라인 코드 이름' },
  itemId: { ...textSchema, nullable: true },
  itemName: { ...textSchema, nullable: true },
  itemRarity: { type: 'string', enum: ['에픽', '태초'] },
  occurredAt: timestampSchema
})

function timelinePageSchema(item: SchemaObject): SchemaObject {
  return objectSchema({
    items: { type: 'array', description: '최근 순으로 50개까지입니다.', items: item },
    nextCursor: { ...timelineCursor, description: '다음 이어 받기의 before. 없으면 null' }
  })
}

export const characterTimelineSchemas: Record<string, SchemaObject> = {
  CharacterTimeline: objectSchema({
    weeklyClears: {
      type: 'array',
      description: '이번 주 클리어. 오래된 순입니다.',
      items: objectSchema({
        kind: timelineClearKindSchema,
        name: { ...textSchema, description: '레이드는 raid_name, 레기온은 data.regionName' },
        modeName: {
          ...textSchema,
          nullable: true,
          description: '레이드의 data.modeName. 레기온은 null'
        },
        hard: {
          type: 'boolean',
          description: '레이드의 data.hard. 칸이 없는 레이드와 레기온은 false'
        },
        occurredAt: timestampSchema
      })
    },
    seasonClears: {
      type: 'array',
      description:
        '지금 시즌(가장 최근에 시작한 시즌) 클리어를 kind, name, hard별로 센 횟수. 시즌에 처음 클리어한 순입니다.',
      items: objectSchema({
        kind: timelineClearKindSchema,
        name: textSchema,
        hard: { type: 'boolean', description: '하드 클리어와 아닌 클리어를 따로 셉니다.' },
        count: { type: 'integer', minimum: 1 }
      })
    },
    enhancements: {
      type: 'array',
      description: '강화, 증폭, 재련 기록. 최근 순으로 50개까지입니다.',
      items: timelineEnhancement
    },
    enhancementsCursor: {
      ...timelineCursor,
      description: '강화 이어 받기의 before. 더 오래된 기록이 없으면 null'
    },
    acquisitions: {
      type: 'array',
      description: '에픽, 태초 장비 획득 기록. 최근 순으로 50개까지입니다.',
      items: timelineAcquisition
    },
    acquisitionsCursor: {
      ...timelineCursor,
      description: '획득 이어 받기의 before. 더 오래된 기록이 없으면 null'
    }
  }),
  TimelineEnhancementPage: timelinePageSchema(timelineEnhancement),
  TimelineAcquisitionPage: timelinePageSchema(timelineAcquisition)
}

export function ApiCharacterTimeline() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 타임라인 조회',
      description:
        '공개 API. DB에 저장한 타임라인에서 이번 주(목요일 06:00 KST부터) 레이드(코드 201, 210)와 레기온(209) 클리어, 지금 시즌의 같은 기록을 이름별로 센 횟수, 강화(401), 증폭(402), 재련(403)과 에픽, 태초 장비 획득(501~521, 550~557)의 최근 50개씩을 반환합니다. 강화, 획득 목록에 더 오래된 기록이 남아 있으면 enhancementsCursor, acquisitionsCursor로 이어 받기 경로에서 다음 50개를 받습니다. 조회한 캐릭터의 타임라인 동기화를 시작하고(진행 중이면 그 동기화에 합치며, 마지막 성공 뒤 1시간 안이면 받지 않음), 그 캐릭터의 진행 중인 동기화가 끝난 뒤 DB를 읽습니다. 처음 조회한 캐릭터는 동기화가 끝날 때까지 몇 초 걸릴 수 있습니다. 동기화 실패는 응답에 드러나지 않고 저장한 값까지만 반환합니다. DB 설정이 없는 API는 동기화 없이 빈 배열을 반환합니다.'
    }),
    ...characterParams,
    successResponse(
      'CharacterTimeline',
      '저장한 타임라인의 클리어, 강화, 획득 기록 (없으면 빈 배열)'
    ),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

function timelinePageOperation(list: string, label: string, schema: string) {
  return applyDecorators(
    ApiOperation({
      summary: `캐릭터 타임라인 ${label} 이어 받기`,
      description: `공개 API. 타임라인 조회나 앞선 이어 받기에서 받은 cursor를 before로 주면 그보다 오래된 ${label} 기록을 최근 순으로 50개까지 반환합니다. 동기화를 기다리지 않고 DB에 저장한 값만 읽습니다. nextCursor가 null이면 더 받을 기록이 없습니다. DB 설정이 없는 API는 빈 목록을 반환합니다.`
    }),
    ...characterParams,
    ApiQuery({
      name: 'before',
      required: true,
      schema: { type: 'string' },
      description: `타임라인 조회의 ${list}Cursor나 이어 받기의 nextCursor. 값의 형식은 정하지 않습니다.`
    }),
    successResponse(schema, `${label} 기록과 다음 cursor`),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiCharacterTimelineEnhancements() {
  return timelinePageOperation('enhancements', '강화, 증폭, 재련', 'TimelineEnhancementPage')
}

export function ApiCharacterTimelineAcquisitions() {
  return timelinePageOperation('acquisitions', '에픽, 태초 획득', 'TimelineAcquisitionPage')
}
