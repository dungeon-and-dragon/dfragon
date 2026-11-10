import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiQuery, type SchemaObject } from '@nestjs/swagger'
import {
  timestampSchema,
  objectSchema,
  successResponse,
  errorResponses,
  textSchema,
  serverIdSchema,
  characterCountSchema,
  storedCharacterProperties
} from './common.js'

const skillSelectionCount = objectSchema({
  name: { ...textSchema, description: '스킬 이름' },
  type1: { ...characterCountSchema, description: 'type 1을 고른 캐릭터 수' },
  type2: { ...characterCountSchema, description: 'type 2를 고른 캐릭터 수' }
})

export const rankingStatsSchemas: Record<string, SchemaObject> = {
  FameRanking: objectSchema({
    characters: {
      type: 'array',
      description:
        'DB에 저장된 명성이 있는 캐릭터. 명성이 높은 순(같으면 서버, 캐릭터 id 순)으로 100명까지입니다.',
      items: objectSchema({
        rank: { type: 'integer', minimum: 1, description: '1부터 매긴 순서' },
        ...storedCharacterProperties
      })
    }
  }),
  Stats: objectSchema({
    computedAt: {
      ...timestampSchema,
      nullable: true,
      description: '집계를 계산한 시각. 아직 저장된 집계가 없으면 null'
    },
    total: { ...characterCountSchema, description: 'DB에 저장된 캐릭터 수' },
    servers: {
      type: 'array',
      description: '서버별 캐릭터 수. 많은 순입니다.',
      items: objectSchema({ serverId: serverIdSchema, count: characterCountSchema })
    },
    jobs: {
      type: 'array',
      description: '직업, 전직별 캐릭터 수. 기본 정보가 없는 캐릭터는 빠지며 많은 순입니다.',
      items: objectSchema({
        jobId: textSchema,
        jobGrowId: textSchema,
        jobName: textSchema,
        jobGrowName: textSchema,
        count: characterCountSchema,
        averageFame: {
          type: 'integer',
          nullable: true,
          description: '명성이 있는 캐릭터의 평균을 반올림한 값. 그런 캐릭터가 없으면 null'
        }
      })
    },
    fameDistribution: {
      type: 'array',
      description:
        '명성이 있는 캐릭터를 1,000 단위 구간으로 센 수. 캐릭터가 있는 구간만 낮은 순입니다.',
      items: objectSchema({
        from: { type: 'integer', description: '구간 시작(포함)' },
        to: { type: 'integer', description: '구간 끝(제외)' },
        count: characterCountSchema
      })
    }
  }),
  SkillStats: objectSchema({
    computedAt: {
      ...timestampSchema,
      nullable: true,
      description: '집계를 계산한 시각. 아직 저장된 집계가 없으면 null'
    },
    topCount: { type: 'integer', description: '표본으로 삼은 전직 안 명성 상위 순위' },
    minFame: {
      type: 'integer',
      nullable: true,
      description: '표본의 최저 명성. 명성이 있는 캐릭터가 없으면 null'
    },
    sampleSize: {
      ...characterCountSchema,
      description: '표본 가운데 스킬 스타일을 받았고, 받을 때의 전직이 지금 전직과 같은 캐릭터 수'
    },
    skills: {
      type: 'array',
      description: '표본 캐릭터가 배운 스킬. 이름 순입니다.',
      items: objectSchema({
        name: { ...textSchema, description: '스킬 이름' },
        learned: { ...characterCountSchema, description: '이 스킬을 배운 캐릭터 수' },
        levels: {
          type: 'array',
          description: '[레벨, 캐릭터 수] 쌍. 레벨이 낮은 순입니다.',
          items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }
        }
      })
    },
    evolutions: {
      type: 'array',
      description: '스킬 개화를 고른 캐릭터 수. 이름 순이며 비율의 분모는 skills의 learned입니다.',
      items: skillSelectionCount
    },
    enhancements: {
      type: 'array',
      description: '스킬 강화를 고른 캐릭터 수. 이름 순이며 비율의 분모는 skills의 learned입니다.',
      items: skillSelectionCount
    }
  })
}

const maleCrusaderRoleQuery = ApiQuery({
  name: 'role',
  required: false,
  schema: { type: 'string', enum: ['dealer', 'buffer'] },
  description:
    'jobId, jobGrowId가 남성 크루세이더(프리스트(남), 眞 크루세이더)일 때만 씁니다. 저장된 스킬 스타일(받을 때의 전직이 지금 전직과 같은 행)에 용기의 은총이 있으면 dealer, 없으면 buffer로 보고 그 역할의 캐릭터만 셉니다. 그런 행이 없는 캐릭터는 어느 쪽에도 넣지 않습니다. 다른 전직이나 jobGrowId 없는 요청은 400입니다.'
})

export function ApiFameRanking() {
  return applyDecorators(
    ApiOperation({
      summary: '명성 랭킹 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보에서 명성이 있는 캐릭터를 명성이 높은 순으로 100명까지 반환합니다. 명성이 같으면 서버, 캐릭터 id 순이고 rank는 1부터 매긴 순서입니다. jobId, jobGrowId로 거르며 jobGrowId는 jobId와 함께 씁니다. 서버는 통합되어 있어 서버로 거르지 않습니다. 다른 query key는 무시합니다. Neople을 부르지 않으며 값은 행마다 fetchedAt 시점의 것입니다. DB 설정이 없는 API는 빈 목록을 반환합니다.'
    }),
    ApiQuery({ name: 'jobId', required: false, schema: { type: 'string', minLength: 1 } }),
    ApiQuery({
      name: 'jobGrowId',
      required: false,
      schema: { type: 'string', minLength: 1 },
      description: 'jobId와 함께 씁니다.'
    }),
    maleCrusaderRoleQuery,
    successResponse('FameRanking', '명성 순 캐릭터 목록 (없으면 빈 목록)'),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiStats() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 통계 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보로 전체 캐릭터 수, 서버별 캐릭터 수, 직업별 캐릭터 수와 평균 명성, 명성 분포를 반환합니다. 캐릭터 목록 worker가 매일 0시(KST)에 계산해 저장한 값을 읽으며, 요청 때 계산하거나 API 메모리에 캐시하지 않습니다. 저장된 집계가 없거나 DB 설정이 없는 API는 0과 빈 목록, computedAt null을 반환합니다.'
    }),
    successResponse('Stats', '집계 시각과 서버, 직업, 명성 분포'),
    errorResponses({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiSkillStats() {
  return applyDecorators(
    ApiOperation({
      summary: '전직별 스킬 채택률 조회',
      description:
        '공개 API. 한 전직에서 명성이 있는 캐릭터 가운데 명성 상위 topCount위까지를 표본으로 삼고, 그 가운데 스킬 스타일을 받았고 받을 때의 전직이 지금 전직과 같은 캐릭터의 스킬별 배운 수와 레벨 분포, 스킬 개화와 강화를 고른 수를 반환합니다. 스킬 스타일은 상세 조회가 저장한 행만 셉니다. 채택률의 분모는 sampleSize, 개화와 강화 비율의 분모는 그 스킬의 learned입니다. 캐릭터 목록 worker가 매일 0시(KST)에 전직마다 계산해 저장한 값을 읽으며, 요청 때 계산하거나 API 메모리에 캐시하지 않습니다. Neople을 부르지 않습니다. 저장된 집계가 없는 전직과 DB 설정이 없는 API는 sampleSize 0과 빈 목록, computedAt null을 반환합니다.'
    }),
    ApiQuery({ name: 'jobId', required: true, schema: { type: 'string', minLength: 1 } }),
    ApiQuery({ name: 'jobGrowId', required: true, schema: { type: 'string', minLength: 1 } }),
    maleCrusaderRoleQuery,
    successResponse('SkillStats', '집계 시각, 표본 기준과 스킬별 채택 수'),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}
