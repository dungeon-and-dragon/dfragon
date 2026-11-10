import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, type SchemaObject } from '@nestjs/swagger'
import { CLEAR_CONTENTS } from '../../domain/content-clears/contents.js'
import {
  timestampSchema,
  objectSchema,
  successResponse,
  errorResponses,
  textSchema,
  characterCountSchema
} from './common.js'

const clearContentHeader = {
  id: { type: 'string', enum: CLEAR_CONTENTS.map(({ id }) => id) },
  kind: { type: 'string', enum: ['raid', 'challenge'] },
  name: textSchema,
  releasedAt: { ...timestampSchema, description: '출시 시각' },
  entryFame: { type: 'integer', minimum: 0, description: '채널 입장 명성' },
  latest: { type: 'boolean', description: '종류별 최신 컨텐츠 여부' }
} satisfies Record<string, SchemaObject>

const clearWeek = objectSchema({
  weekStart: {
    type: 'string',
    format: 'date',
    description: '목요일 06:00 KST에 시작하는 주의 첫날'
  },
  closed: { type: 'boolean', description: '주를 마감해 값이 더 바뀌지 않는지 여부' },
  collectedAt: { ...timestampSchema, description: '이 주 모집단을 마지막으로 저장한 시각' },
  population: {
    ...characterCountSchema,
    description: '모집단(분모) 캐릭터 수. 최고 명성이 minFame 이상인 캐릭터입니다.'
  },
  minFame: {
    type: 'integer',
    nullable: true,
    description:
      '모집단을 가른 최고 명성 기준. entryFame과 종류별 최신 컨텐츠의 가장 낮은 entryFame 가운데 큰 값입니다. 상위 10만으로 저장한 주는 그때 상위 10만의 최저 명성입니다.'
  },
  cleared: {
    ...characterCountSchema,
    description: '레이드는 그 주에 깬 캐릭터 수, 챌린지는 출시부터 그 주 끝까지 깬 누적 수'
  },
  newlyCleared: {
    ...characterCountSchema,
    nullable: true,
    description: '챌린지를 그 주에 처음 깬 캐릭터 수. 레이드는 null'
  },
  ratios: {
    type: 'array',
    description:
      '배율별 클리어 캐릭터 수. 합은 cleared와 같고 배율 없는 클리어(ratio null)가 먼저, 그 뒤 배율이 낮은 순입니다. 레이드는 그 주 첫 클리어의 배율로 셉니다.',
    items: objectSchema({
      ratio: { type: 'integer', nullable: true, description: '100에 더하는 퍼센트. 50이면 150%' },
      cleared: characterCountSchema
    })
  }
})

const clearWeeks: SchemaObject = {
  type: 'array',
  description: '모집단을 저장한 주. 이른 순이며 수집 기록이 없으면 빈 배열입니다.',
  items: clearWeek
}

export const contentClearsSchemas: Record<string, SchemaObject> = {
  ClearStats: objectSchema({
    contents: {
      type: 'array',
      description: '집계 대상 컨텐츠. 코드에 둔 목록 순서입니다.',
      items: objectSchema({ ...clearContentHeader, weeks: clearWeeks })
    }
  }),
  ClearContentStats: objectSchema({
    ...clearContentHeader,
    week: {
      ...clearWeek,
      nullable: true,
      description: '고른 주의 요약. 모집단을 저장한 주가 없으면 null'
    },
    jobs: {
      type: 'array',
      description:
        '직업, 전직별 모집단 수와 클리어 수. 순서는 정하지 않습니다. 모집단에 없는 전직의 클리어는 population 0으로 넣어 cleared의 합이 week.cleared와 같습니다.',
      items: objectSchema({
        jobId: { ...textSchema, nullable: true },
        jobGrowId: { ...textSchema, nullable: true },
        jobName: { ...textSchema, nullable: true },
        jobGrowName: { ...textSchema, nullable: true },
        population: {
          ...characterCountSchema,
          description: '그 주 모집단의 이 전직 캐릭터 수. week.minFame과 같은 기준'
        },
        cleared: { ...characterCountSchema, description: '이 전직의 클리어 캐릭터 수' }
      })
    },
    adventures: {
      type: 'array',
      description:
        '클리어 캐릭터를 모험단으로 묶은 분포. characters가 작은 순이며 characters와 adventures를 곱해 더하면 week.cleared입니다.',
      items: objectSchema({
        characters: { type: 'integer', minimum: 1, description: '모험단 하나에서 깬 캐릭터 수' },
        adventures: { type: 'integer', minimum: 1, description: '그만큼 깬 모험단 수' }
      })
    }
  })
}

export function ApiClearStats() {
  return applyDecorators(
    ApiOperation({
      summary: '컨텐츠 클리어 집계 목록 조회',
      description:
        '공개 API. 클리어 집계 대상 컨텐츠와 모집단을 저장한 주별 요약을 반환합니다. 모집단은 수집 때 명성 상위 캐릭터이고, 레이드의 cleared는 그 주에 깬 캐릭터 수, 챌린지의 cleared는 출시부터 그 주 끝까지 깬 누적 수입니다. 클리어 기록과 모집단은 캐릭터 목록 worker가 저장하며 이 경로는 Neople을 부르지 않습니다. 결과는 API 메모리에 캐시하고, 요청마다 모집단의 마지막 수집 시각을 읽어 바뀌었으면 다시 계산합니다. 실패는 캐시하지 않습니다. DB 설정이 없는 API는 모든 컨텐츠의 weeks를 빈 배열로 반환합니다.'
    }),
    successResponse('ClearStats', '컨텐츠별 주별 모집단, 클리어 수와 배율별 클리어 수'),
    errorResponses({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiClearContentStats() {
  return applyDecorators(
    ApiOperation({
      summary: '컨텐츠 한 주의 클리어 집계 조회',
      description:
        '공개 API. 한 컨텐츠의 한 주 요약과 직업, 전직별 모집단과 클리어 수, 모험단별 클리어 캐릭터 수 분포를 반환합니다. 챌린지는 출시부터 그 주 끝까지 깬 캐릭터를 셉니다. 캐시와 갱신은 목록 조회와 같습니다. 모집단을 저장한 주가 없으면 week는 null이고 jobs, adventures는 빈 배열입니다.'
    }),
    ApiParam({
      name: 'contentId',
      schema: { type: 'string', enum: CLEAR_CONTENTS.map(({ id }) => id) }
    }),
    ApiQuery({
      name: 'week',
      required: false,
      schema: { type: 'string', format: 'date' },
      description: '목록의 weekStart 가운데 하나. 없으면 가장 최근 주입니다.'
    }),
    successResponse('ClearContentStats', '한 주의 요약, 직업별 클리어와 모험단별 분포'),
    errorResponses({
      400: 'INVALID_CHARACTER_QUERY',
      404: 'CHARACTER_NOT_FOUND',
      500: 'INTERNAL_SERVER_ERROR'
    })
  )
}
